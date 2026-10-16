// Routes liées aux fonctionnalités IA : extraction de tickets et génération de recettes.
import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { parseFileSize } from "../utils/security";
import {
  analyzeReceiptImage,
  generateRecipeFromPrompt,
  generateShoppingListWithAI,
} from "../services/geminiService";
import { invalidateRecipeCache } from "../utils/recipeCache";
import { planShoppingList } from "../utils/shoppingListPlanner";
import { normalizeIngredient } from "../utils/ingredientMatcher";

const router = Router();
const prisma = new PrismaClient();

/**
 * Convertit une valeur numérique renvoyée par l'IA (nombre ou chaîne type
 * "2x100g", "1,5 kg") en nombre exploitable pour la base.
 * Gère la multiplication ("2x100g" → 200) et évite de concaténer les chiffres.
 */
function parseAiNumericValue(raw: unknown): number | undefined {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : undefined;
  }
  if (typeof raw !== "string") {
    return undefined;
  }

  const text = raw.replace(",", ".");
  const multiMatch = text.match(/(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/);
  if (multiMatch) {
    const product = parseFloat(multiMatch[1]) * parseFloat(multiMatch[2]);
    return Number.isFinite(product) ? product : undefined;
  }

  const singleMatch = text.match(/\d+(?:\.\d+)?/);
  if (!singleMatch) {
    return undefined;
  }
  const value = parseFloat(singleMatch[0]);
  return Number.isFinite(value) ? value : undefined;
}

// Limite l'usage des endpoints IA (coûteux) : 30 requêtes / heure / utilisateur.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) =>
    (req as AuthenticatedRequest).userId || req.ip || "unknown",
  message:
    "Limite d'utilisation de l'IA atteinte (30 requêtes par heure). Réessayez plus tard.",
});

// Stockage en mémoire des fichiers uploadés (images de tickets).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseFileSize(process.env.MAX_FILE_SIZE, 10 * 1024 * 1024),
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Seuls les fichiers image sont autorisés."));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /ai/extract-receipt
 * Analyse un ticket de caisse et alimente le frigo utilisateur.
 */
router.post(
  "/extract-receipt",
  authenticateToken,
  aiLimiter,
  upload.single("receipt"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Aucun fichier fourni.",
        });
      }

      const userWithKey = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { geminiApiKey: true },
      });

      const apiKey = userWithKey?.geminiApiKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message:
            "Veuillez renseigner votre clé Gemini API dans votre profil ou les variables d'environnement avant d'utiliser cette fonctionnalité.",
        });
      }

      const base64Image = req.file.buffer.toString("base64"); // Gemini attend du base64
      const analysis = await analyzeReceiptImage({
        base64Image,
        mimeType: req.file.mimetype,
        apiKey,
      });

      if (!analysis.isReceipt) {
        return res.status(200).json({
          success: false,
          message: "Le document fourni ne semble pas être un ticket de caisse.",
        });
      }

      if (!analysis.items.length) {
        return res.status(200).json({
          success: false,
          message: "Aucun ingrédient n'a pu être extrait du ticket.",
        });
      }

      const userId = req.userId!;
      const allCategories = await prisma.category.findMany();
      const itemsMap = new Map<
        string,
        Awaited<ReturnType<typeof prisma.fridgeItem.upsert>>
      >();

      // Pour chaque ligne détectée sur le ticket, on crée/actualise l'ingrédient
      // Transaction : ajout tout-ou-rien, jamais d'état partiel si une ligne échoue.
      await prisma.$transaction(
        async (tx) => {
          for (const item of analysis.items) {
            const name = item.name?.trim();
            if (!name) {
              continue;
            }

            const quantityValue = parseAiNumericValue(item.quantity);
            const quantity =
              quantityValue !== undefined && quantityValue > 0 ? quantityValue : 1;

            const unit = item.unit?.trim() || "pièce";
            const notes = item.notes?.trim() || undefined;

            // Extraction intelligente du poids/volume depuis les notes ou le nom
            let finalQuantity = quantity;
            let finalUnit = unit;
            let finalItemCount = 1;
            let finalNotes = notes;

            const isStandardUnit = ["g", "kg", "mg", "ml", "cl", "l"].includes(
              unit.toLowerCase(),
            );
            const textToScan = `${notes || ""} ${name}`;

            const multiMatch = textToScan.match(
              /(\d+)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)\b/i,
            );
            if (multiMatch) {
              const packs = parseInt(multiMatch[1], 10);
              const each = parseFloat(multiMatch[2].replace(",", "."));
              const u = multiMatch[3].toLowerCase();
              finalItemCount = packs;
              finalQuantity = packs * each;
              finalUnit = u === "l" ? "L" : u;
              if (finalNotes) {
                finalNotes =
                  finalNotes
                    .replace(multiMatch[0], "")
                    .replace(/^[,\s-]+|[,\s-]+$/g, "")
                    .trim() || undefined;
              }
            } else if (!isStandardUnit) {
              const singleMatch = textToScan.match(
                /(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)\b/i,
              );
              if (singleMatch) {
                const val = parseFloat(singleMatch[1].replace(",", "."));
                const u = singleMatch[2].toLowerCase();
                if (
                  quantity > 1 &&
                  [
                    "paquet",
                    "bouteille",
                    "boîte",
                    "pot",
                    "barquette",
                    "pièce",
                  ].includes(unit.toLowerCase())
                ) {
                  finalQuantity = quantity * val;
                  finalItemCount = quantity;
                } else {
                  finalQuantity = val;
                }
                finalUnit = u === "l" ? "L" : u;
                if (finalNotes) {
                  finalNotes =
                    finalNotes
                      .replace(singleMatch[0], "")
                      .replace(/^[,\s-]+|[,\s-]+$/g, "")
                      .trim() || undefined;
                }
              }
            }

            const countMatch = textToScan.match(/(?:[xX](\d+)|\b(\d+)[xX]\b)/);
            if (countMatch && finalItemCount === 1) {
              finalItemCount = parseInt(countMatch[1] || countMatch[2], 10);
              if (finalNotes) {
                finalNotes =
                  finalNotes
                    .replace(countMatch[0], "")
                    .replace(/^[,\s-]+|[,\s-]+$/g, "")
                    .trim() || undefined;
              }
            }

            if (
              finalNotes &&
              ["null", "undefined"].includes(finalNotes.trim().toLowerCase())
            ) {
              finalNotes = undefined;
            }

            const daysToExpire =
              typeof item.estimatedDaysToExpire === "number"
                ? item.estimatedDaysToExpire
                : parseInt(String(item.estimatedDaysToExpire ?? ""), 10);

            // Détection de la catégorie la plus adaptée
            let matchedCategoryId: string | undefined = undefined;
            if (item.category) {
              const rawCat = item.category.trim().toLowerCase();
              const found = allCategories.find((cat) => {
                const cName = cat.name.toLowerCase();
                return (
                  cName === rawCat ||
                  rawCat.includes(cName) ||
                  cName.includes(rawCat)
                );
              });
              if (found) {
                matchedCategoryId = found.id;
              }
            }

            const isFrozen =
              (item.category || "").toLowerCase().includes("surgele") ||
              (item.category || "").toLowerCase().includes("surgelé") ||
              (item.category || "").toLowerCase().includes("congel") ||
              name.toLowerCase().includes("surgel") ||
              name.toLowerCase().includes("congel") ||
              (matchedCategoryId
                ? allCategories.some(
                    (c) =>
                      c.id === matchedCategoryId &&
                      (c.name.toLowerCase().includes("surgele") ||
                        c.name.toLowerCase().includes("surgelé") ||
                        c.name.toLowerCase().includes("congel"))
                  )
                : false);

            const expiryDate =
              !isFrozen && Number.isFinite(daysToExpire) && daysToExpire > 0
                ? new Date(Date.now() + daysToExpire * 24 * 60 * 60 * 1000)
                : undefined;

            const priceValue = parseAiNumericValue(item.price);
            const price =
              priceValue !== undefined && priceValue > 0 ? priceValue : undefined;

            let ingredient = await tx.ingredient.findFirst({
              where: {
                name: {
                  equals: name,
                  mode: "insensitive",
                },
              },
            });

            if (!ingredient) {
              ingredient = await tx.ingredient.create({
                data: {
                  name,
                  categoryId: matchedCategoryId,
                },
              });
            } else if (!ingredient.categoryId && matchedCategoryId) {
              ingredient = await tx.ingredient.update({
                where: { id: ingredient.id },
                data: {
                  categoryId: matchedCategoryId,
                },
              });
            }

            const isExpiryEstimated = expiryDate !== undefined;

            const fridgeItem = await tx.fridgeItem.upsert({
              where: {
                userId_ingredientId: {
                  userId,
                  ingredientId: ingredient.id,
                },
              },
              create: {
                userId,
                ingredientId: ingredient.id,
                itemCount: finalItemCount,
                initialItemCount: finalItemCount,
                quantity: finalQuantity,
                initialQuantity: finalQuantity,
                unit: finalUnit,
                price,
                expiryDate,
                isExpiryEstimated,
                notes: finalNotes,
              },
              update: {
                quantity: {
                  increment: finalQuantity,
                },
                unit: finalUnit,
                ...(finalItemCount > 1
                  ? { itemCount: { increment: finalItemCount } }
                  : {}),
                ...(price !== undefined ? { price } : {}),
                ...(expiryDate !== undefined
                  ? { expiryDate, isExpiryEstimated: true }
                  : {}),
                ...(finalNotes ? { notes: finalNotes } : {}),
              },
              include: {
                ingredient: {
                  include: {
                    category: true,
                  },
                },
              },
            });

            itemsMap.set(fridgeItem.ingredientId, fridgeItem);
          }
        },
        { maxWait: 10000, timeout: 30000 },
      );

      const addedItems = Array.from(itemsMap.values());

      return res.json({
        success: true,
        data: {
          items: addedItems,
          addedCount: addedItems.length,
          message: `${addedItems.length} ingrédient(s) ajouté(s) ou mis à jour depuis le ticket.`,
        },
        message: "Ticket traité avec succès.",
      });
    } catch (error) {
      // Les erreurs d'upload (taille, type de fichier) sont formatées par errorHandler.
      next(error);
    }
  },
);

// Normalise la forme de recette renvoyée au frontend.
const formatRecipe = (recipe: any) => ({
  id: recipe.id,
  title: recipe.title,
  description: recipe.description,
  instructions: recipe.instructions,
  prepTime: recipe.prepTime,
  cookTime: recipe.cookTime,
  servings: recipe.servings,
  difficulty: recipe.difficulty,
  imageUrl: recipe.imageUrl,
  category: (recipe as any).category || "repas",
  createdAt: recipe.createdAt,
  createdById: recipe.createdById,
  createdBy: recipe.createdBy,
  source: recipe.source,
  ingredients: recipe.ingredients.map((ri: any) => ({
    id: ri.ingredient.id,
    name: ri.ingredient.name,
    quantity: ri.quantity,
    unit: ri.unit,
    notes: ri.notes,
    ingredient: {
      id: ri.ingredient.id,
      name: ri.ingredient.name,
      category: ri.ingredient.category,
    },
  })),
  isFavorite: recipe.favoriteRecipes?.length > 0,
  compatibilityScore: recipe.compatibilityScore ?? null,
  missingIngredientsCount: recipe.missingIngredientsCount ?? null,
});

// Validation de la payload pour la génération de recette (accepte 'prompt' ou 'userPrompt').
const generateRecipeSchema = z
  .object({
    prompt: z.string().optional(),
    userPrompt: z.string().optional(),
    useFridge: z.coerce.boolean().optional().default(true),
    useExistingRecipes: z.coerce.boolean().optional().default(false),
    specificRecipeId: z.string().optional(),
    servings: z.coerce.number().int().min(1).max(20).optional().default(4),
  })
  .transform((data) => ({
    ...data,
    prompt: (data.prompt || data.userPrompt || "").trim(),
  }))
  .refine((data) => data.prompt.length >= 10, {
    message: "La demande doit contenir au moins 10 caractères",
    path: ["prompt"],
  });

/**
 * POST /ai/generate-recipe
 * Demande à l'IA une recette personnalisée, optionnellement basée sur le frigo et les recettes existantes.
 */
router.post(
  "/generate-recipe",
  authenticateToken,
  aiLimiter,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        prompt,
        useFridge,
        useExistingRecipes,
        specificRecipeId,
        servings,
      } = generateRecipeSchema.parse(req.body);

      const userWithKey = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { geminiApiKey: true },
      });

      const apiKey = userWithKey?.geminiApiKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message:
            "Veuillez renseigner votre clé Gemini API dans votre profil ou les variables d'environnement avant d'utiliser cette fonctionnalité.",
        });
      }

      let fridgeItems:
        | {
            name: string;
            quantity?: number | null;
            unit?: string | null;
          }[]
        | undefined;

      if (useFridge) {
        const items = await prisma.fridgeItem.findMany({
          where: { userId: req.userId },
          include: { ingredient: true },
        });

        fridgeItems = items.map((item) => ({
          name: item.ingredient.name,
          quantity: item.quantity,
          unit: item.unit,
        }));
      }

      let existingRecipes:
        | {
            id?: string;
            title: string;
            description?: string | null;
            ingredients: {
              name: string;
              quantity?: number | null;
              unit?: string | null;
            }[];
            instructions?: string[];
            isTarget?: boolean;
          }[]
        | undefined;

      if (useExistingRecipes) {
        const recipes = await prisma.recipe.findMany({
          include: {
            ingredients: {
              include: {
                ingredient: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        existingRecipes = recipes.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          ingredients: r.ingredients.map((ri) => ({
            name: ri.ingredient.name,
            quantity: ri.quantity,
            unit: ri.unit,
          })),
          instructions: r.instructions,
          isTarget: specificRecipeId ? r.id === specificRecipeId : false,
        }));
      }

      const aiRecipe = await generateRecipeFromPrompt({
        prompt,
        servings,
        fridgeItems,
        existingRecipes,
        apiKey,
      });

      const ingredientRecords = await Promise.all(
        aiRecipe.ingredients.map(async (ing) => {
          const name = ing.name.trim();
          if (!name) {
            throw new Error("Un ingrédient généré n'a pas de nom valide.");
          }

          let ingredient = await prisma.ingredient.findFirst({
            where: {
              name: {
                equals: name,
                mode: "insensitive",
              },
            },
          });

          if (!ingredient) {
            ingredient = await prisma.ingredient.create({
              data: {
                name,
              },
            });
          }

          return {
            ingredientId: ingredient.id,
            quantity: ing.quantity ?? 1,
            unit: ing.unit || "pièce",
            notes: ing.notes || undefined,
          };
        }),
      );

      const combinedIngredientRecords = Object.values(
        ingredientRecords.reduce(
          (acc, record) => {
            const key = record.ingredientId;
            if (!acc[key]) {
              acc[key] = { ...record };
            } else {
              acc[key].quantity += record.quantity;
              if (!acc[key].unit && record.unit) {
                acc[key].unit = record.unit;
              }
              if (!acc[key].notes && record.notes) {
                acc[key].notes = record.notes;
              }
            }
            return acc;
          },
          {} as Record<string, (typeof ingredientRecords)[number]>,
        ),
      );

      const createdRecipe = await prisma.recipe.create({
        data: {
          title: aiRecipe.title,
          description: aiRecipe.description,
          instructions: aiRecipe.instructions,
          prepTime: aiRecipe.prepTime ?? 15,
          cookTime: aiRecipe.cookTime ?? 0,
          servings: aiRecipe.servings ?? servings ?? 4,
          difficulty: aiRecipe.difficulty,
          imageUrl: aiRecipe.imageUrl,
          category: (aiRecipe as any).category || "repas",
          source: "ai_generated",
          createdById: req.userId,
          ingredients: {
            create: combinedIngredientRecords,
          },
        },
        include: {
          ingredients: {
            include: {
              ingredient: {
                include: {
                  category: true,
                },
              },
            },
          },
          favoriteRecipes: {
            where: { userId: req.userId },
            select: { id: true },
          },
          createdBy: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      const formatted = formatRecipe(createdRecipe);

      invalidateRecipeCache();

      res.status(201).json({
        success: true,
        data: {
          recipe: formatted,
        },
        message: "Recette générée avec succès",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: error.errors[0].message,
        });
      }
      next(error);
    }
  },
);

// Schema pour la génération intelligente de liste de courses
const generateShoppingListSchema = z.object({
  targetRecipeIds: z.array(z.string()).optional(),
  excludedRecipeIds: z.array(z.string()).optional(),
  daysCount: z.coerce.number().int().min(1).max(30).optional().default(4),
  dessertsCount: z.coerce.number().int().min(0).max(10).optional().default(0),
  servings: z.coerce.number().int().min(1).max(20).optional().default(2),
  maxBudget: z.coerce.number().positive().optional().nullable(),
  includePantryBasics: z.coerce.boolean().optional().default(false),
  includeArchivedItems: z.coerce.boolean().optional().default(true),
  suggestNewRecipes: z.coerce.boolean().optional().default(true),
  suggestedRecipesCount: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(2),
  allowRepeatMeals: z.coerce.boolean().optional().default(true),
  userPrompt: z.string().optional(),
  listName: z.string().optional(),
});

function matchDbCategoryId(
  name: string,
  categories: { id: string; name: string }[],
): string | null {
  const norm = normalizeIngredient(name);
  let target = "Produits secs";
  if (
    /\b(eau|eaux|coca|cola|soda|sodas|jus|boisson|boissons|biere|bieres|vin|vins|cafe|cafes|the|thes|sirop|sirops|ice tea|oasis|sprite|fanta)\b/i.test(
      norm,
    )
  )
    target = "Boissons";
  else if (
    /(fruits?|legumes?|salades?|tomates?|oignons?|courgettes?|carottes?|poireaux?|poivrons?|champignons?|pommes? de terre|patates?|avocats?|concombres?|radis|brocolis?|choux?|navets?|celeri|aubergines?|epinards?|haricots? vert|ails?|\bail\b|echalotes?|persil|basilic|menthe|coriandre|ciboulette|estragon|thym|romarin|gingembre|\bpommes?\b|\bpoires?\b|bananes?|fraises?|framboises?|citrons?|oranges?|clementines?|mandarines?|raisins?|\bpeches?\b|abricots?)/i.test(
      norm,
    )
  )
    target = "Les fruits & légumes";
  else if (
    /(poulets?|dindes?|canards?|volailles?|boeufs?|\bsteaks?\b|viandes?|haches?|porcs?|veaux?|agneaux?|lardons?|bacons?|jambons?|saucisses?|merguez|chipolatas?|chorizos?|charcuteries?|tenders?|nuggets?|poissons?|saumons?|cabillauds?|thons?|colins?|merlus?|crevettes?|gambas|moules?|saint-jacques|crabes?|fruits? de mer|escalopes?)/i.test(
      norm,
    )
  )
    target = "Les viandes";
  else if (
    /(\blaits?\b|cremes?|beurres?|oeufs?|fromages?|gorgonzola|mozzarella|parmesan|grana|gruyere|comte|cheddar|mascarpone|ricotta|feta|chevres?|yaourts?|yogourts?|fromage blanc|petit suisse|cantal|reblochon|beaufort|emmental|roquefort|\bbleus?\b|\bbries?\b|camembert|saint-nectaire|maroilles|pecorino|burrata)/i.test(
      norm,
    )
  )
    target = "Produits laitiers";
  else if (/(surgels?|glaces?|sorbets?)/i.test(norm)) target = "Surgelés";
  else if (
    /(pates?|spaghetti|tagliatelles?|penne|coquillettes?|macaroni|crozets?|riz|semoules?|couscous|quinoa|lentilles?|pois chiches?|haricots?)/i.test(
      norm,
    )
  )
    target = "Féculents";
  else if (/(sauces?|ketchup|mayonnaise|moutarde|pesto|coulis)/i.test(norm))
    target = "Sauces";
  else if (
    /(sucres?|chocolats?|cacao|biscuits?|gateaux?|cookies?|muffins?|confitures?|miel|nutella|pate a tartiner|compotes?|cereales?|muesli|brioches?|croissants?|pains? au chocolat|bonbons?|caramels?|vanille)/i.test(
      norm,
    )
  )
    target = "Gâteaux";
  else if (/(chips|aperitifs?|cacahuetes?|noix|olives?|tortillas?)/i.test(norm))
    target = "Apéritifs";
  else target = "Produits secs";

  const found = categories.find(
    (c) => c.name.toLowerCase() === target.toLowerCase(),
  );
  return found ? found.id : null;
}

/**
 * POST /ai/generate-shopping-list
 * Génère une liste de courses mutualisée et optimisée via l'IA
 * en croisant le frigo, les recettes et les contraintes de l'utilisateur.
 */
router.post(
  "/generate-shopping-list",
  authenticateToken,
  aiLimiter,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        targetRecipeIds,
        excludedRecipeIds,
        daysCount,
        dessertsCount,
        servings,
        maxBudget,
        includePantryBasics,
        includeArchivedItems,
        suggestNewRecipes,
        suggestedRecipesCount,
        allowRepeatMeals,
        userPrompt,
        listName: requestedListName,
      } = generateShoppingListSchema.parse(req.body);

      const userWithKey = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { geminiApiKey: true },
      });
      const apiKey = userWithKey?.geminiApiKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message:
            "Veuillez renseigner votre clé Gemini API dans votre profil ou les variables d'environnement avant d'utiliser cette fonctionnalité.",
        });
      }

      // 1. Récupérer le frigo de l'utilisateur
      const fridgeItems = await prisma.fridgeItem.findMany({
        where: { userId: req.userId },
        include: { ingredient: true },
        orderBy: { expiryDate: "asc" },
      });

      // 2. Récupérer les recettes existantes
      const allRecipes = await prisma.recipe.findMany({
        include: {
          ingredients: {
            include: {
              ingredient: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // 3. Récupérer l'historique des aliments consommés / archivés si demandé ou si essentiels du quotidien cochés
      let archivedItems: Array<{
        name: string;
        brand?: string | null;
        quantity?: number | null;
        unit?: string | null;
        status?: string | null;
        finishedDate?: Date | string | null;
      }> = [];

      let outOfStockItems: Array<{
        name: string;
        brand?: string | null;
        unit?: string | null;
        finishedDate?: Date | string | null;
      }> = [];

      if (includeArchivedItems || includePantryBasics) {
        const historyRecords = await prisma.purchaseHistory.findMany({
          where: { userId: req.userId },
          include: { ingredient: true },
          orderBy: { finishedDate: "desc" },
          take: 60,
        });

        if (includeArchivedItems) {
          archivedItems = historyRecords.map((h) => ({
            name: h.ingredient.name,
            brand: h.brand,
            quantity: h.quantity,
            unit: h.unit,
            status: h.status,
            finishedDate: h.finishedDate,
          }));
        }

        // Identifier les aliments consommés qui ne sont plus actuellement au frigo (rupture de stock du foyer)
        const fridgeNames = new Set(
          fridgeItems.map((fi) => fi.ingredient.name.trim().toLowerCase()),
        );
        const seenOutOfStock = new Set<string>();
        for (const h of historyRecords) {
          const name = h.ingredient.name.trim();
          const lower = name.toLowerCase();
          if (!fridgeNames.has(lower) && !seenOutOfStock.has(lower)) {
            seenOutOfStock.add(lower);
            outOfStockItems.push({
              name,
              brand: h.brand,
              unit: h.unit,
              finishedDate: h.finishedDate,
            });
          }
        }
      }

      // 4. Appel de Gemini
      const aiResult = await generateShoppingListWithAI({
        apiKey,
        fridgeItems: fridgeItems.map((fi) => ({
          name: fi.ingredient.name,
          brand: fi.brand,
          quantity: fi.quantity,
          unit: fi.unit,
          expiryDate: fi.expiryDate,
        })),
        archivedItems,
        outOfStockItems,
        allRecipes: allRecipes.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          servings: r.servings,
          category: (r as any).category || "repas",
          ingredients: r.ingredients.map((ri) => ({
            name: ri.ingredient.name,
            quantity: ri.quantity,
            unit: ri.unit,
          })),
        })),
        targetRecipeIds,
        excludedRecipeIds,
        daysCount,
        dessertsCount,
        servings,
        maxBudget,
        includePantryBasics,
        includeArchivedItems,
        suggestNewRecipes,
        suggestedRecipesCount,
        allowRepeatMeals,
        userPrompt,
      });

      const basePlanningRecipes = allRecipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        servings: recipe.servings,
        category: (recipe as any).category || "repas",
        ingredients: recipe.ingredients.map((ingredient) => ({
          name: ingredient.ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })),
      }));

      // Les idées ne sont pas utilisées directement : on les transforme en vraies
      // recettes avec le générateur existant, en lui donnant tout le carnet pour
      // éviter les variantes quasi identiques.
      const generatedRecipes: Array<{
        id: string;
        title: string;
        description?: string | null;
        servings: number;
        category: string;
        ingredients: { name: string; quantity?: number; unit?: string }[];
      }> = [];
      if (suggestNewRecipes) {
        const requestedNewRecipes = Math.min(
          10,
          Math.max(1, suggestedRecipesCount || 2),
        );

        const initialRecipeContext = allRecipes.map((recipe) => ({
          id: recipe.id,
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients.map((ingredient) => ({
            name: ingredient.ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          })),
        }));

        for (let index = 0; index < requestedNewRecipes; index++) {
          // Mise en mémoire cumulative : carnet d'origine + recettes déjà générées lors des tours précédents
          const memoryContext = [
            ...initialRecipeContext,
            ...generatedRecipes.map((recipe) => ({
              id: recipe.id,
              title: recipe.title,
              description: recipe.description,
              ingredients: recipe.ingredients,
            })),
          ];

          const existingTitles = new Set(
            memoryContext.map((r) => normalizeIngredient(r.title)),
          );

          const idea = aiResult.suggestedNewRecipes?.[index];
          const basePrompt = idea?.title
            ? `Voici les habitudes de consommation et les recettes actuelles du foyer (${memoryContext.length} recettes enregistrées). En t'inspirant de cette idée : "${idea.title}" (${idea.description || ""}), génère 1 nouvelle recette salée complète et originale qui apporte du renouveau et change des recettes déjà existantes dans son carnet. Ingrédients clés à valoriser : ${(idea.mainIngredients || []).join(", ")}. Exclure tout dessert ou plat sucré.`
            : `Voici les habitudes de consommation et les recettes actuelles du foyer (${memoryContext.length} recettes enregistrées). Génère 1 nouvelle recette salée originale et savoureuse qui change de ses habitudes et apporte un vrai renouveau culinaire. Exclure tout dessert ou plat sucré.`;

          let candidate:
            | Awaited<ReturnType<typeof generateRecipeFromPrompt>>
            | undefined;

          try {
            candidate = await generateRecipeFromPrompt({
              apiKey,
              servings,
              fridgeItems: fridgeItems.map((item) => ({
                name: item.ingredient.name,
                quantity: item.quantity,
                unit: item.unit,
              })),
              existingRecipes: memoryContext,
              prompt: basePrompt,
            });
          } catch (err) {
            console.warn(
              `[shoppingList] Erreur lors de la génération de la recette ${index + 1}:`,
              err,
            );
          }

          // Si collision exacte de titre ou dessert, une tentative de relance avec variation
          if (
            candidate &&
            (existingTitles.has(normalizeIngredient(candidate.title)) ||
              candidate.category === "dessert" ||
              /dessert|g[aâ]teau|cookie|sucr[ée]|pain perdu|brioche|pancake/i.test(
                candidate.title,
              ))
          ) {
            try {
              candidate = await generateRecipeFromPrompt({
                apiKey,
                servings,
                fridgeItems: fridgeItems.map((item) => ({
                  name: item.ingredient.name,
                  quantity: item.quantity,
                  unit: item.unit,
                })),
                existingRecipes: memoryContext,
                prompt: `${basePrompt} Change complètement de plat et d'ingrédient principal par rapport à "${candidate.title}".`,
              });
            } catch {
              // conservation du candidat précédent si possible
            }
          }

          if (
            candidate &&
            candidate.category !== "dessert" &&
            !/dessert|g[aâ]teau|cookie|sucr[ée]|pain perdu|brioche|pancake/i.test(
              candidate.title,
            )
          ) {
            generatedRecipes.push({
              id: `generated-shopping-${Date.now()}-${index}`,
              title: candidate.title,
              description: candidate.description,
              servings: candidate.servings || servings,
              category: candidate.category || "repas",
              ingredients: candidate.ingredients,
            });
          }
        }
      }

      const planningRecipes = [...basePlanningRecipes, ...generatedRecipes];
      const planningHints = (aiResult.mealPlan || []).map((meal) => ({
        dishName: meal.dishName,
        details: meal.details,
      }));

      // Si l'utilisateur a expressément désactivé la répétition, on remplace
      // les doublons par les nouvelles recettes générées.
      if (!allowRepeatMeals && generatedRecipes.length) {
        for (const generated of generatedRecipes) {
          const seenDishes = new Set<string>();
          const replacementIndex = planningHints.findIndex((hint, index) => {
            if (index === 0) {
              seenDishes.add(normalizeIngredient(hint.dishName));
              return false;
            }
            const normalizedName = normalizeIngredient(hint.dishName);
            const isRepeat = seenDishes.has(normalizedName);
            seenDishes.add(normalizedName);
            return isRepeat;
          });
          if (replacementIndex >= 0) {
            planningHints[replacementIndex] = {
              dishName: generated.title,
              details: undefined,
            };
          }
        }
      }
      const plannerTargetRecipeIds = targetRecipeIds?.length
        ? [...targetRecipeIds, ...generatedRecipes.map((recipe) => recipe.id)]
        : undefined;

      // Gemini propose le planning, mais le calcul des courses est déterministe.
      // Cela empêche les recettes inventées, les stocks ignorés et les quantités sous-estimées.
      let shoppingPlan;
      try {
        shoppingPlan = planShoppingList({
          recipes: planningRecipes,
          fridgeItems: fridgeItems.map((fridgeItem) => ({
            name: fridgeItem.ingredient.name,
            brand: fridgeItem.brand,
            quantity: fridgeItem.quantity,
            unit: fridgeItem.unit,
          })),
          pantryItems: outOfStockItems,
          includePantryBasics,
          mealHints: planningHints,
          targetRecipeIds: plannerTargetRecipeIds,
          excludedRecipeIds,
          daysCount: daysCount!,
          dessertsCount: dessertsCount || 0,
          servings: servings!,
          allowRepeatMeals: allowRepeatMeals!,
        });
      } catch (planningError: any) {
        return res.status(422).json({
          success: false,
          message:
            planningError?.message ||
            "Le planning généré ne permet pas de construire une liste cohérente.",
        });
      }

      const persistedSuggestions = generatedRecipes.map((recipe) => ({
        title: recipe.title,
        description: recipe.description || "",
        mainIngredients: recipe.ingredients.map(
          (ingredient) => ingredient.name,
        ),
        whySuggested:
          "Nouvelle recette générée à partir des achats et surplus identifiés.",
      }));
      const persistedAiSummary = JSON.parse(
        JSON.stringify({
          version: 1,
          summary: {
            coveredRecipes: shoppingPlan.coveredRecipes,
            mealPlan: shoppingPlan.mealPlan,
            suggestedNewRecipes: persistedSuggestions,
            alreadyInFridge: shoppingPlan.alreadyInFridge,
            tips: [...(aiResult.tips || []), ...shoppingPlan.warnings],
            estimatedTotalCost: null,
          },
          planning: {
            generatedRecipes,
            targetRecipeIds: plannerTargetRecipeIds || [],
            excludedRecipeIds: excludedRecipeIds || [],
            daysCount,
            servings,
            allowRepeatMeals,
            includePantryBasics,
            mealHints: planningHints,
          },
        }),
      );

      // 4. Créer la liste de courses en base de données
      const finalListName =
        requestedListName?.trim() ||
        aiResult.listName ||
        "Courses optimisées IA";

      // 4. + 5. Créer la liste de courses et ses items dans une transaction (tout-ou-rien).
      const createdList = await prisma.$transaction(
        async (tx) => {
          const list = await tx.shoppingList.create({
            data: {
              name: finalListName,
              userId: req.userId!,
              aiSummary: persistedAiSummary as any,
            },
          });

          // 5. Créer les items de la liste
          const dbCategories = await tx.category.findMany();
          const itemsByIngredientId = new Map<
            string,
            {
              quantity: number;
              unit: string;
              notes?: string;
            }
          >();
          for (const item of shoppingPlan.itemsToBuy) {
            const rawName = item.name.trim();
            if (!rawName) continue;

            let ingredient = await tx.ingredient.findFirst({
              where: {
                name: {
                  equals: rawName,
                  mode: "insensitive",
                },
              },
            });

            if (!ingredient) {
              const categoryId = matchDbCategoryId(rawName, dbCategories);
              ingredient = await tx.ingredient.create({
                data: {
                  name: rawName,
                  categoryId,
                },
              });
            }

            const existingItem = itemsByIngredientId.get(ingredient.id);
            if (existingItem) {
              const sameUnit =
                existingItem.unit.trim().toLowerCase() ===
                item.unit.trim().toLowerCase();
              if (sameUnit) {
                existingItem.quantity += item.quantity;
              }
              existingItem.notes =
                [existingItem.notes, item.notes]
                  .filter(Boolean)
                  .filter((note, index, notes) => notes.indexOf(note) === index)
                  .join(". ") || undefined;
              continue;
            }

            itemsByIngredientId.set(ingredient.id, {
              quantity: item.quantity,
              unit: item.unit,
              notes: item.notes,
            });
          }

          for (const [ingredientId, item] of itemsByIngredientId) {
            await tx.shoppingListItem.create({
              data: {
                shoppingListId: list.id,
                ingredientId,
                quantity: item.quantity,
                unit: item.unit,
                notes: item.notes,
              },
            });
          }

          return list;
        },
        { maxWait: 10000, timeout: 30000 },
      );

      // 6. Récupérer la liste complète avec ses items
      const fullShoppingList = await prisma.shoppingList.findUnique({
        where: { id: createdList.id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              quantity: true,
              unit: true,
              purchased: true,
              notes: true,
              ingredient: {
                select: {
                  id: true,
                  name: true,
                  category: {
                    select: {
                      id: true,
                      name: true,
                      color: true,
                    },
                  },
                },
              },
            },
            orderBy: { id: "asc" },
          },
        },
      });

      return res.status(201).json({
        success: true,
        data: {
          shoppingList: fullShoppingList,
          summary: {
            coveredRecipes: shoppingPlan.coveredRecipes,
            mealPlan: shoppingPlan.mealPlan,
            suggestedNewRecipes: persistedSuggestions,
            alreadyInFridge: shoppingPlan.alreadyInFridge,
            tips: [...(aiResult.tips || []), ...shoppingPlan.warnings],
            // Les prix Gemini ne correspondent pas aux conditionnements calculés.
            estimatedTotalCost: undefined,
          },
        },
        message: "Liste de courses générée et optimisée avec succès !",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: error.errors[0].message,
        });
      }
      next(error);
    }
  },
);

/**
 * POST /ai/shopping-lists/:id/replace-suggestion
 * Régénère une seule recette suggérée et recalcule la liste associée.
 */
router.post(
  "/shopping-lists/:id/replace-suggestion",
  authenticateToken,
  aiLimiter,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const suggestionIndex = z.coerce
        .number()
        .int()
        .min(0)
        .parse(req.body?.suggestionIndex);
      const list = await prisma.shoppingList.findFirst({
        where: { id: req.params.id, userId: req.userId },
      });
      if (!list?.aiSummary || typeof list.aiSummary !== "object") {
        return res
          .status(404)
          .json({
            success: false,
            message: "Résumé IA introuvable pour cette liste.",
          });
      }

      const stored = list.aiSummary as any;
      const storedPlanning = stored.planning || {};
      const storedSuggestions = stored.summary?.suggestedNewRecipes || [];
      const storedGeneratedRecipes = storedPlanning.generatedRecipes || [];
      if (
        suggestionIndex >= storedSuggestions.length ||
        suggestionIndex >= storedGeneratedRecipes.length
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Cette recette suggérée n'existe pas.",
          });
      }

      const [fridgeItems, allRecipes] = await Promise.all([
        prisma.fridgeItem.findMany({
          where: { userId: req.userId },
          include: { ingredient: true },
        }),
        prisma.recipe.findMany({
          include: { ingredients: { include: { ingredient: true } } },
        }),
      ]);
      const previousRecipe = storedGeneratedRecipes[suggestionIndex];
      const existingRecipeContext = allRecipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients.map((ingredient) => ({
          name: ingredient.ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })),
      }));
      const replacement = await generateRecipeFromPrompt({
        apiKey:
          (
            await prisma.user.findUnique({
              where: { id: req.userId! },
              select: { geminiApiKey: true },
            })
          )?.geminiApiKey || process.env.GEMINI_API_KEY,
        servings: Number(storedPlanning.servings || 2),
        fridgeItems: fridgeItems.map((item) => ({
          name: item.ingredient.name,
          quantity: item.quantity,
          unit: item.unit,
        })),
        existingRecipes: existingRecipeContext,
        prompt: `Remplace uniquement cette idée par une recette salée totalement différente : "${previousRecipe.title}".
La nouvelle recette ne doit être ni une variante, ni un changement de fromage, ni un doublon du carnet fourni.
Elle doit réutiliser au moins un ingrédient du frigo ou des achats de la liste, mais changer de famille culinaire. Exclure dessert, petit-déjeuner, recette sucrée et croziflette.`,
      });
      if (
        replacement.category === "dessert" ||
        /dessert|g[aâ]teau|cookie|sucr[ée]|pain perdu/i.test(replacement.title)
      ) {
        return res
          .status(422)
          .json({
            success: false,
            message:
              "La nouvelle proposition n'est pas une recette salée valide.",
          });
      }

      const generatedRecipes = storedGeneratedRecipes.map(
        (recipe: any, index: number) =>
          index === suggestionIndex
            ? {
                id: recipe.id,
                title: replacement.title,
                description: replacement.description || "",
                servings:
                  replacement.servings || Number(storedPlanning.servings || 2),
                category: replacement.category || "repas",
                ingredients: replacement.ingredients,
              }
            : recipe,
      );
      const planningRecipes = [
        ...allRecipes.map((recipe) => ({
          id: recipe.id,
          title: recipe.title,
          servings: recipe.servings,
          category: (recipe as any).category || "repas",
          ingredients: recipe.ingredients.map((ingredient) => ({
            name: ingredient.ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          })),
        })),
        ...generatedRecipes,
      ];
      const mealHints = (storedPlanning.mealHints || []).map((hint: any) =>
        hint.dishName === previousRecipe.title
          ? { ...hint, dishName: replacement.title }
          : hint,
      );
      const plan = planShoppingList({
        recipes: planningRecipes,
        fridgeItems: fridgeItems.map((item) => ({
          name: item.ingredient.name,
          brand: item.brand,
          quantity: item.quantity,
          unit: item.unit,
        })),
        pantryItems: [],
        includePantryBasics: Boolean(storedPlanning.includePantryBasics),
        mealHints,
        targetRecipeIds: storedPlanning.targetRecipeIds || undefined,
        excludedRecipeIds: storedPlanning.excludedRecipeIds || undefined,
        daysCount: Number(storedPlanning.daysCount || 4),
        servings: Number(storedPlanning.servings || 2),
        allowRepeatMeals: storedPlanning.allowRepeatMeals !== false,
      });
      const suggestions = generatedRecipes.map((recipe: any) => ({
        title: recipe.title,
        description: recipe.description || "",
        mainIngredients: (recipe.ingredients || []).map(
          (ingredient: any) => ingredient.name,
        ),
        whySuggested:
          "Recette générée pour remplacer une suggestion précédente.",
      }));
      const updatedSummary = {
        version: 1,
        summary: {
          ...stored.summary,
          coveredRecipes: plan.coveredRecipes,
          mealPlan: plan.mealPlan,
          suggestedNewRecipes: suggestions,
          alreadyInFridge: plan.alreadyInFridge,
        },
        planning: { ...storedPlanning, generatedRecipes, mealHints },
      };

      const updatedList = await prisma.$transaction(async (tx) => {
        await tx.shoppingListItem.deleteMany({
          where: { shoppingListId: list.id },
        });
        const grouped = new Map<
          string,
          { quantity: number; unit: string; notes?: string }
        >();
        for (const item of plan.itemsToBuy) {
          const ingredient = await tx.ingredient.upsert({
            where: { name: item.name.trim() },
            update: {},
            create: { name: item.name.trim() },
          });
          const previous = grouped.get(ingredient.id);
          if (
            previous &&
            previous.unit.toLowerCase() === item.unit.toLowerCase()
          )
            previous.quantity += item.quantity;
          else if (!previous)
            grouped.set(ingredient.id, {
              quantity: item.quantity,
              unit: item.unit,
              notes: item.notes,
            });
        }
        for (const [ingredientId, item] of grouped) {
          await tx.shoppingListItem.create({
            data: {
              shoppingListId: list.id,
              ingredientId,
              quantity: item.quantity,
              unit: item.unit,
              notes: item.notes,
            },
          });
        }
        await tx.shoppingList.update({
          where: { id: list.id },
          data: { aiSummary: updatedSummary as any },
        });
        return tx.shoppingList.findUnique({
          where: { id: list.id },
          select: {
            id: true,
            userId: true,
            name: true,
            aiSummary: true,
            createdAt: true,
            updatedAt: true,
            items: {
              include: {
                ingredient: { include: { category: true } },
              },
            },
          },
        });
      });

      return res.json({
        success: true,
        data: { shoppingList: updatedList, summary: updatedSummary.summary },
        message: "Recette remplacée et liste recalculée.",
      });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ success: false, message: error.errors[0].message });
      next(error);
    }
  },
);

export default router;
