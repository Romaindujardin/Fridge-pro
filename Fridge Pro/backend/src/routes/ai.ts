// Routes liées aux fonctionnalités IA : extraction de tickets et génération de recettes.
import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import {
  analyzeReceiptImage,
  generateRecipeFromPrompt,
} from "../services/geminiService";

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

      if (!userWithKey?.geminiApiKey) {
        return res.status(400).json({
          success: false,
          message:
            "Veuillez renseigner votre clé Gemini API dans votre profil avant d'utiliser cette fonctionnalité.",
        });
      }

      const base64Image = req.file.buffer.toString("base64"); // Gemini attend du base64
      const analysis = await analyzeReceiptImage({
        base64Image,
        mimeType: req.file.mimetype,
        apiKey: userWithKey.geminiApiKey,
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
            quantity,
            unit,
            notes,
          },
          update: {
            quantity: {
              increment: quantity,
            },
            unit,
            ...(notes ? { notes } : {}),
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
});

/**
 * POST /ai/generate-recipe
 * Demande à l'IA une recette personnalisée, optionnellement basée sur le frigo.
 */
router.post(
  "/generate-recipe",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { prompt, useFridge } = generateRecipeSchema.parse(req.body);

      const userWithKey = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { geminiApiKey: true },
      });

      if (!userWithKey?.geminiApiKey) {
        return res.status(400).json({
          success: false,
          message:
            "Veuillez renseigner votre clé Gemini API dans votre profil avant d'utiliser cette fonctionnalité.",
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

      const aiRecipe = await generateRecipeFromPrompt({
        prompt,
        fridgeItems,
        apiKey: userWithKey.geminiApiKey,
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
          servings: aiRecipe.servings ?? 4,
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

export default router;
