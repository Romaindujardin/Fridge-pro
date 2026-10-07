// Routes liées aux fonctionnalités IA : extraction de tickets et génération de recettes.
import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import {
  analyzeReceiptImage,
  generateRecipeFromPrompt,
  generateShoppingListWithAI,
} from "../services/geminiService";
import { invalidateRecipeCache } from "../utils/recipeCache";

const router = Router();
const prisma = new PrismaClient();

// Stockage en mémoire des fichiers uploadés (images de tickets).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024),
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
      for (const item of analysis.items) {
        const name = item.name?.trim();
        if (!name) {
          continue;
        }

        const quantityValue =
          typeof item.quantity === "number"
            ? item.quantity
            : parseFloat(
                String(item.quantity ?? "")
                  .replace(",", ".")
                  .replace(/[^0-9.]/g, "")
              );
        const quantity =
          Number.isFinite(quantityValue) && quantityValue > 0
            ? quantityValue
            : 1;

        const unit = item.unit?.trim() || "pièce";
        const notes = item.notes?.trim() || undefined;

        // Extraction intelligente du poids/volume depuis les notes ou le nom
        let finalQuantity = quantity;
        let finalUnit = unit;
        let finalItemCount = 1;
        let finalNotes = notes;

        const isStandardUnit = ["g", "kg", "mg", "ml", "cl", "l"].includes(unit.toLowerCase());
        const textToScan = `${notes || ""} ${name}`;

        const multiMatch = textToScan.match(/(\d+)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)\b/i);
        if (multiMatch) {
          const packs = parseInt(multiMatch[1], 10);
          const each = parseFloat(multiMatch[2].replace(",", "."));
          const u = multiMatch[3].toLowerCase();
          finalItemCount = packs;
          finalQuantity = packs * each;
          finalUnit = u === "l" ? "L" : u;
          if (finalNotes) {
            finalNotes = finalNotes.replace(multiMatch[0], "").replace(/^[,\s-]+|[,\s-]+$/g, "").trim() || undefined;
          }
        } else if (!isStandardUnit) {
          const singleMatch = textToScan.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)\b/i);
          if (singleMatch) {
            const val = parseFloat(singleMatch[1].replace(",", "."));
            const u = singleMatch[2].toLowerCase();
            if (quantity > 1 && ["paquet", "bouteille", "boîte", "pot", "barquette", "pièce"].includes(unit.toLowerCase())) {
              finalQuantity = quantity * val;
              finalItemCount = quantity;
            } else {
              finalQuantity = val;
            }
            finalUnit = u === "l" ? "L" : u;
            if (finalNotes) {
              finalNotes = finalNotes.replace(singleMatch[0], "").replace(/^[,\s-]+|[,\s-]+$/g, "").trim() || undefined;
            }
          }
        }

        const countMatch = textToScan.match(/(?:[xX](\d+)|\b(\d+)[xX]\b)/);
        if (countMatch && finalItemCount === 1) {
          finalItemCount = parseInt(countMatch[1] || countMatch[2], 10);
          if (finalNotes) {
            finalNotes = finalNotes.replace(countMatch[0], "").replace(/^[,\s-]+|[,\s-]+$/g, "").trim() || undefined;
          }
        }

        if (finalNotes && ["null", "undefined"].includes(finalNotes.trim().toLowerCase())) {
          finalNotes = undefined;
        }

        const daysToExpire =
          typeof item.estimatedDaysToExpire === "number"
            ? item.estimatedDaysToExpire
            : parseInt(String(item.estimatedDaysToExpire ?? ""), 10);

        const expiryDate =
          Number.isFinite(daysToExpire) && daysToExpire > 0
            ? new Date(Date.now() + daysToExpire * 24 * 60 * 60 * 1000)
            : undefined;

        const priceValue =
          typeof item.price === "number"
            ? item.price
            : parseFloat(
                String(item.price ?? "")
                  .replace(",", ".")
                  .replace(/[^0-9.]/g, "")
              );
        const price =
          Number.isFinite(priceValue) && priceValue > 0 ? priceValue : undefined;

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
              categoryId: matchedCategoryId,
            },
          });
        } else if (!ingredient.categoryId && matchedCategoryId) {
          ingredient = await prisma.ingredient.update({
            where: { id: ingredient.id },
            data: {
              categoryId: matchedCategoryId,
            },
          });
        }

        const isExpiryEstimated = expiryDate !== undefined;

        const fridgeItem = await prisma.fridgeItem.upsert({
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
            ...(finalItemCount > 1 ? { itemCount: { increment: finalItemCount } } : {}),
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
      if (
        error instanceof Error &&
        error.message === "Seuls les fichiers image sont autorisés."
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  }
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

// Validation de la payload pour la génération de recette.
const generateRecipeSchema = z.object({
  prompt: z.string().min(10, "La demande doit contenir au moins 10 caractères"),
  useFridge: z.coerce.boolean().optional().default(true),
  useExistingRecipes: z.coerce.boolean().optional().default(false),
  specificRecipeId: z.string().optional(),
  servings: z.coerce.number().int().min(1).max(20).optional().default(4),
});

/**
 * POST /ai/generate-recipe
 * Demande à l'IA une recette personnalisée, optionnellement basée sur le frigo et les recettes existantes.
 */
router.post(
  "/generate-recipe",
  authenticateToken,
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
        })
      );

      const combinedIngredientRecords = Object.values(
        ingredientRecords.reduce((acc, record) => {
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
        }, {} as Record<string, (typeof ingredientRecords)[number]>)
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
  }
);

// Schema pour la génération intelligente de liste de courses
const generateShoppingListSchema = z.object({
  targetRecipeIds: z.array(z.string()).optional(),
  daysCount: z.coerce.number().int().min(1).max(14).optional().default(4),
  servings: z.coerce.number().int().min(1).max(20).optional().default(2),
  maxBudget: z.coerce.number().positive().optional().nullable(),
  includePantryBasics: z.coerce.boolean().optional().default(false),
  userPrompt: z.string().optional(),
  listName: z.string().optional(),
});

/**
 * POST /ai/generate-shopping-list
 * Génère une liste de courses mutualisée et optimisée via l'IA
 * en croisant le frigo, les recettes et les contraintes de l'utilisateur.
 */
router.post(
  "/generate-shopping-list",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        targetRecipeIds,
        daysCount,
        servings,
        maxBudget,
        includePantryBasics,
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

      // 3. Appel de Gemini
      const aiResult = await generateShoppingListWithAI({
        apiKey,
        fridgeItems: fridgeItems.map((fi) => ({
          name: fi.ingredient.name,
          brand: fi.brand,
          quantity: fi.quantity,
          unit: fi.unit,
          expiryDate: fi.expiryDate,
        })),
        allRecipes: allRecipes.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          ingredients: r.ingredients.map((ri) => ({
            name: ri.ingredient.name,
            quantity: ri.quantity,
            unit: ri.unit,
          })),
        })),
        targetRecipeIds,
        daysCount,
        servings,
        maxBudget,
        includePantryBasics,
        userPrompt,
      });

      // 4. Créer la liste de courses en base de données
      const finalListName =
        requestedListName?.trim() || aiResult.listName || "Courses optimisées IA";

      const createdList = await prisma.shoppingList.create({
        data: {
          name: finalListName,
          userId: req.userId!,
        },
      });

      // 5. Créer les items de la liste
      for (const item of aiResult.itemsToBuy) {
        const rawName = item.name.trim();
        if (!rawName) continue;

        let ingredient = await prisma.ingredient.findFirst({
          where: {
            name: {
              equals: rawName,
              mode: "insensitive",
            },
          },
        });

        if (!ingredient) {
          ingredient = await prisma.ingredient.create({
            data: {
              name: rawName,
            },
          });
        }

        await prisma.shoppingListItem.create({
          data: {
            shoppingListId: createdList.id,
            ingredientId: ingredient.id,
            quantity: item.quantity,
            unit: item.unit,
            notes: item.notes,
          },
        });
      }

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
            coveredRecipes: aiResult.coveredRecipes,
            alreadyInFridge: aiResult.alreadyInFridge,
            tips: aiResult.tips,
            estimatedTotalCost: aiResult.estimatedTotalCost,
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
  }
);

export default router;
