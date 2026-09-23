// Routes de gestion des recettes : listing, favoris, suggestions et CRUD.
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { isIngredientAvailable } from "../utils/ingredientMatcher";
import { estimateRecipeCost, ItemWithPrice } from "../utils/costEstimator";
import { z } from "zod";
import fs from "fs";
import path from "path";
import multer from "multer";

const router = Router();
const prisma = new PrismaClient();

// Configuration du stockage des photos de recettes
const recipeUploadsDir = path.join(process.cwd(), "uploads", "recipes");
if (!fs.existsSync(recipeUploadsDir)) {
  fs.mkdirSync(recipeUploadsDir, { recursive: true });
}

const recipeImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, recipeUploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `recipe-${uniqueSuffix}${ext}`);
  },
});

const uploadRecipeImage = multer({
  storage: recipeImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Seuls les fichiers image sont acceptés."));
    }
    cb(null, true);
  },
});

// Helper pour récupérer les ingrédients du frigo et de l'historique d'achat ayant un prix
async function getUserPricedItems(userId: string): Promise<ItemWithPrice[]> {
  const [fridgeItems, historyItems] = await Promise.all([
    prisma.fridgeItem.findMany({
      where: { userId },
      include: { ingredient: true },
    }),
    prisma.purchaseHistory.findMany({
      where: { userId, price: { gt: 0 } },
      select: {
        ingredientId: true,
        quantity: true,
        unit: true,
        price: true,
        brand: true,
        ingredient: { select: { id: true, name: true } },
      },
      orderBy: { finishedDate: "desc" },
    }),
  ]);

  return [
    ...fridgeItems.map((f) => ({
      ingredientId: f.ingredientId,
      quantity: f.quantity,
      unit: f.unit,
      price: f.price,
      brand: f.brand,
      ingredient: f.ingredient,
    })),
    ...historyItems.map((h) => ({
      ingredientId: h.ingredientId,
      quantity: h.quantity,
      unit: h.unit,
      price: h.price,
      brand: h.brand,
      ingredient: h.ingredient,
    })),
  ];
}

// Convertit et normalise un nombre décimal (gère virgule et point)
const parseDecimalNumber = (val: unknown): number | unknown => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return undefined;
    const normalized = trimmed.replace(",", ".");
    if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(normalized)) {
      return val;
    }
    const num = parseFloat(normalized);
    return isNaN(num) ? val : num;
  }
  return val;
};

// Schemas de validation des payloads d'entrée.
const createRecipeSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  instructions: z
    .array(z.string())
    .min(1, "Au moins une instruction est requise"),
  prepTime: z.number().int().positive().optional(),
  cookTime: z.number().int().positive().optional(),
  servings: z.number().int().positive().default(4),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  imageUrl: z.string().optional(),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().optional(),
        ingredientName: z.string().optional(),
        quantity: z
          .preprocess(
            parseDecimalNumber,
            z.number({
              invalid_type_error: "La quantité doit être un nombre",
            }).positive("La quantité doit être supérieure à 0")
          ),
        unit: z.string(),
        notes: z.string().optional(),
      }).refine(
        (data) => data.ingredientId || data.ingredientName,
        "Vous devez fournir soit ingredientId soit ingredientName"
      )
    )
    .min(1, "Au moins un ingrédient est requis"),
});

const updateRecipeSchema = z.object({
  title: z.string().min(1, "Le titre est requis").optional(),
  description: z.string().optional(),
  instructions: z
    .array(z.string())
    .min(1, "Au moins une instruction est requise")
    .optional(),
  prepTime: z.number().int().positive().nullable().optional(),
  cookTime: z.number().int().positive().nullable().optional(),
  servings: z.number().int().positive().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  imageUrl: z.string().nullable().optional(),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().optional(),
        ingredientName: z.string().optional(),
        quantity: z
          .preprocess(
            parseDecimalNumber,
            z.number({
              invalid_type_error: "La quantité doit être un nombre",
            }).positive("La quantité doit être supérieure à 0")
          ),
        unit: z.string(),
        notes: z.string().optional(),
      }).refine(
        (data) => data.ingredientId || data.ingredientName,
        "Vous devez fournir soit ingredientId soit ingredientName"
      )
    )
    .optional(),
});

const filterSchema = z.object({
  search: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  maxPrepTime: z.coerce.number().int().positive().optional(),
  makeable: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

/**
 * GET /recipes
 * Listing paginé avec filtres (recherche, difficulté, réalisable, etc.).
 */
router.get(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const filters = filterSchema.parse(req.query);
      const { search, difficulty, maxPrepTime, makeable, page, limit } =
        filters;
      const skip = (page - 1) * limit;

      // Construction dynamique de la clause WHERE
      const where: any = {};

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      if (difficulty) {
        where.difficulty = difficulty;
      }

      if (maxPrepTime) {
        where.prepTime = { lte: maxPrepTime };
      }

      // Filtrer par recettes réalisables uniquement avec le contenu du frigo
      if (makeable) {
        const userFridgeItemsForFilter = await prisma.fridgeItem.findMany({
          where: { userId: req.userId },
          include: { ingredient: true },
        });

        // Fonction pour vérifier si un ingrédient est disponible pour le filtre
        const isIngredientAvailableForFilter = (
          recipeIngredientId: string,
          recipeIngredientName: string
        ): boolean => {
          return isIngredientAvailable(
            recipeIngredientId,
            recipeIngredientName,
            userFridgeItemsForFilter
          );
        };

        // Trouver les recettes où tous les ingrédients sont disponibles
        const recipeIds = await prisma.recipe
          .findMany({
            where,
            include: {
              ingredients: {
                include: {
                  ingredient: true,
                },
              },
            },
          })
          .then((recipes) => {
            return recipes
              .filter((recipe) => {
                return recipe.ingredients.every((recipeIngredient) =>
                  isIngredientAvailableForFilter(
                    recipeIngredient.ingredientId,
                    recipeIngredient.ingredient.name
                  )
                );
              })
              .map((recipe) => recipe.id);
          });

        where.id = { in: recipeIds };
      }

      // Récupérer les ingrédients du frigo et les prix connus pour la compatibilité et les coûts
      const [userFridgeItems, pricedItems] = await Promise.all([
        prisma.fridgeItem.findMany({
          where: { userId: req.userId },
          include: { ingredient: true },
        }),
        getUserPricedItems(req.userId!),
      ]);

      // Fonction pour vérifier si un ingrédient est disponible (par ID, nom, synonymes et marque)
      const isIngredientAvailableInFridge = (
        recipeIngredientId: string,
        recipeIngredientName: string
      ): boolean => {
        return isIngredientAvailable(
          recipeIngredientId,
          recipeIngredientName,
          userFridgeItems
        );
      };

      const [recipes, total] = await Promise.all([
        prisma.recipe.findMany({
          where,
          skip,
          take: limit,
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
          orderBy: { createdAt: "desc" },
        }),
        prisma.recipe.count({ where }),
      ]);

      // Formater les résultats pour l'UI avec calcul de compatibilité et estimation des coûts
      const formattedRecipes = recipes.map((recipe) => {
        const totalIngredients = recipe.ingredients.length;
        const availableIngredients = recipe.ingredients.filter((ri) =>
          isIngredientAvailableInFridge(ri.ingredientId, ri.ingredient.name)
        ).length;
        const missingIngredients = totalIngredients - availableIngredients;

        const score =
          totalIngredients > 0
            ? Math.round((availableIngredients / totalIngredients) * 100)
            : 0;

        const costInfo = estimateRecipeCost(
          recipe.ingredients,
          recipe.servings,
          pricedItems
        );

        return {
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
          ingredients: recipe.ingredients.map((ri) => ({
            id: ri.id,
            recipeId: ri.recipeId,
            ingredientId: ri.ingredientId,
            quantity: ri.quantity,
            unit: ri.unit,
            notes: ri.notes,
            ingredient: {
              id: ri.ingredient.id,
              name: ri.ingredient.name,
              categoryId: ri.ingredient.categoryId,
              category: ri.ingredient.category,
            },
            available: isIngredientAvailableInFridge(ri.ingredientId, ri.ingredient.name),
            estimatedPrice: costInfo.ingredientCosts[ri.ingredientId] ?? null,
          })),
          isFavorite: recipe.favoriteRecipes.length > 0,
          compatibilityScore: score,
          missingIngredientsCount: missingIngredients,
          estimatedCost: costInfo.hasPricing ? costInfo.totalCost : null,
          costPerServing: costInfo.hasPricing ? costInfo.costPerServing : null,
        };
      });

      res.json({
        success: true,
        data: {
          recipes: formattedRecipes,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
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

/**
 * GET /recipes/suggestions
 * Calcule un score de compatibilité avec les ingrédients du frigo.
 */
router.get(
  "/suggestions",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      // Récupérer les ingrédients du frigo et les prix connus pour les suggestions
      const [userFridgeItems, pricedItems] = await Promise.all([
        prisma.fridgeItem.findMany({
          where: { userId: req.userId },
          include: { ingredient: true },
        }),
        getUserPricedItems(req.userId!),
      ]);

      if (userFridgeItems.length === 0) {
        return res.json({
          success: true,
          data: {
            suggestions: [],
          },
        });
      }

      // Fonction pour vérifier si un ingrédient est disponible pour les suggestions
      const isIngredientAvailableSuggestions = (
        recipeIngredientId: string,
        recipeIngredientName: string
      ): boolean => {
        return isIngredientAvailable(
          recipeIngredientId,
          recipeIngredientName,
          userFridgeItems
        );
      };

      const favoriteRecipeIds = await prisma.favoriteRecipe.findMany({
        where: { userId: req.userId },
        select: { recipeId: true },
      });
      const favoriteIdsSet = new Set(
        favoriteRecipeIds.map((fav) => fav.recipeId)
      );

      const favoriteRecipesPromise = prisma.recipe.findMany({
        where: {
          id: { in: Array.from(favoriteIdsSet) },
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

      // Trouver toutes les recettes et calculer le score de compatibilité
      const allRecipesPromise = prisma.recipe.findMany({
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

      const [favoriteRecipes, allRecipes] = await Promise.all([
        favoriteRecipesPromise,
        allRecipesPromise,
      ]);

      // Calculer le score pour chaque recette
      const scoredRecipes = allRecipes.map((recipe) => {
        const totalIngredients = recipe.ingredients.length;
        const availableIngredients = recipe.ingredients.filter((ri) =>
          isIngredientAvailableSuggestions(ri.ingredientId, ri.ingredient.name)
        ).length;

        const score =
          totalIngredients > 0
            ? (availableIngredients / totalIngredients) * 100
            : 0;

        return {
          recipe,
          score,
          missingIngredients: recipe.ingredients.filter(
            (ri) => !isIngredientAvailableSuggestions(ri.ingredientId, ri.ingredient.name)
          ).length,
        };
      });

      // Calculer le score réel pour les recettes favorites
      const favoriteRecipesPayload = favoriteRecipes.map((recipe) => {
        const totalIngredients = recipe.ingredients.length;
        const availableIngredients = recipe.ingredients.filter((ri) =>
          isIngredientAvailableSuggestions(ri.ingredientId, ri.ingredient.name)
        ).length;
        const missingIngredients = totalIngredients - availableIngredients;
        const score =
          totalIngredients > 0
            ? Math.round((availableIngredients / totalIngredients) * 100)
            : 0;

        const costInfo = estimateRecipeCost(
          recipe.ingredients,
          recipe.servings,
          pricedItems
        );

        return {
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
          ingredients: recipe.ingredients.map((ri) => ({
            id: ri.id,
            recipeId: ri.recipeId,
            ingredientId: ri.ingredientId,
            quantity: ri.quantity,
            unit: ri.unit,
            notes: ri.notes,
            ingredient: {
              id: ri.ingredient.id,
              name: ri.ingredient.name,
              categoryId: ri.ingredient.categoryId,
              category: ri.ingredient.category,
            },
            available: isIngredientAvailableSuggestions(ri.ingredientId, ri.ingredient.name),
            estimatedPrice: costInfo.ingredientCosts[ri.ingredientId] ?? null,
          })),
          isFavorite: true,
          compatibilityScore: score,
          missingIngredientsCount: missingIngredients,
          estimatedCost: costInfo.hasPricing ? costInfo.totalCost : null,
          costPerServing: costInfo.hasPricing ? costInfo.costPerServing : null,
        };
      });

      const suggestions = scoredRecipes
        .filter(
          ({ score, recipe }) => score > 0 && !favoriteIdsSet.has(recipe.id)
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(10 - favoriteRecipesPayload.length, 0))
        .map(({ recipe, score, missingIngredients }) => {
          const costInfo = estimateRecipeCost(
            recipe.ingredients,
            recipe.servings,
            pricedItems
          );

          return {
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
            ingredients: recipe.ingredients.map((ri) => ({
              id: ri.id,
              recipeId: ri.recipeId,
              ingredientId: ri.ingredientId,
              quantity: ri.quantity,
              unit: ri.unit,
              notes: ri.notes,
              ingredient: {
                id: ri.ingredient.id,
                name: ri.ingredient.name,
                categoryId: ri.ingredient.categoryId,
                category: ri.ingredient.category,
              },
              available: isIngredientAvailableSuggestions(ri.ingredientId, ri.ingredient.name),
              estimatedPrice: costInfo.ingredientCosts[ri.ingredientId] ?? null,
            })),
            isFavorite: recipe.favoriteRecipes.length > 0,
            compatibilityScore: Math.round(score),
            missingIngredientsCount: missingIngredients,
            estimatedCost: costInfo.hasPricing ? costInfo.totalCost : null,
            costPerServing: costInfo.hasPricing ? costInfo.costPerServing : null,
          };
        });

      const combinedSuggestions = [
        ...favoriteRecipesPayload,
        ...suggestions,
      ].slice(0, 10);

      res.json({
        success: true,
        data: {
          suggestions,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /recipes/favorites
 * Retourne la liste des favoris de l'utilisateur connecté.
 */
router.get(
  "/favorites",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const favoriteRecipes = await prisma.favoriteRecipe.findMany({
        where: { userId: req.userId },
        include: {
          recipe: {
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
              createdBy: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { addedAt: "desc" },
      });

      // Récupérer les ingrédients du frigo et les prix connus pour calculer la compatibilité et les coûts
      const [userFridgeItems, pricedItems] = await Promise.all([
        prisma.fridgeItem.findMany({
          where: { userId: req.userId },
          include: { ingredient: true },
        }),
        getUserPricedItems(req.userId!),
      ]);

      const isIngredientAvailableInFavorites = (
        recipeIngredientId: string,
        recipeIngredientName: string
      ): boolean => {
        return isIngredientAvailable(
          recipeIngredientId,
          recipeIngredientName,
          userFridgeItems
        );
      };

      const formattedFavorites = favoriteRecipes.map((fav) => {
        const totalIngredients = fav.recipe.ingredients.length;
        const availableIngredients = fav.recipe.ingredients.filter((ri) =>
          isIngredientAvailableInFavorites(ri.ingredientId, ri.ingredient.name)
        ).length;
        const missingIngredients = totalIngredients - availableIngredients;
        const score =
          totalIngredients > 0
            ? Math.round((availableIngredients / totalIngredients) * 100)
            : 0;

        const costInfo = estimateRecipeCost(
          fav.recipe.ingredients,
          fav.recipe.servings,
          pricedItems
        );

        return {
          id: fav.recipe.id,
          title: fav.recipe.title,
          description: fav.recipe.description,
          instructions: fav.recipe.instructions,
          prepTime: fav.recipe.prepTime,
          cookTime: fav.recipe.cookTime,
          servings: fav.recipe.servings,
          difficulty: fav.recipe.difficulty,
          imageUrl: fav.recipe.imageUrl,
          createdAt: fav.recipe.createdAt,
          createdById: fav.recipe.createdById,
          createdBy: fav.recipe.createdBy,
          source: fav.recipe.source,
          ingredients: fav.recipe.ingredients.map((ri) => ({
            id: ri.id,
            recipeId: ri.recipeId,
            ingredientId: ri.ingredientId,
            quantity: ri.quantity,
            unit: ri.unit,
            notes: ri.notes,
            ingredient: {
              id: ri.ingredient.id,
              name: ri.ingredient.name,
              categoryId: ri.ingredient.categoryId,
              category: ri.ingredient.category,
            },
            available: isIngredientAvailableInFavorites(ri.ingredientId, ri.ingredient.name),
            estimatedPrice: costInfo.ingredientCosts[ri.ingredientId] ?? null,
          })),
          isFavorite: true,
          favoriteAddedAt: fav.addedAt,
          compatibilityScore: score,
          missingIngredientsCount: missingIngredients,
          estimatedCost: costInfo.hasPricing ? costInfo.totalCost : null,
          costPerServing: costInfo.hasPricing ? costInfo.costPerServing : null,
        };
      });

      res.json({
        success: true,
        data: {
          favorites: formattedFavorites,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /recipes/:id
 * Détail complet d'une recette.
 */
router.get(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const recipe = await prisma.recipe.findUnique({
        where: { id },
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

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: "Recette non trouvée",
        });
      }

      // Récupérer les ingrédients du frigo et les prix connus pour la disponibilité et l'estimation des coûts
      const [userFridgeItems, pricedItems] = await Promise.all([
        prisma.fridgeItem.findMany({
          where: { userId: req.userId },
          include: { ingredient: true },
        }),
        getUserPricedItems(req.userId!),
      ]);

      const costInfo = estimateRecipeCost(
        recipe.ingredients,
        recipe.servings,
        pricedItems
      );

      const formattedRecipe = {
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
        ingredients: recipe.ingredients.map((ri) => ({
          id: ri.id,
          recipeId: ri.recipeId,
          ingredientId: ri.ingredientId,
          quantity: ri.quantity,
          unit: ri.unit,
          notes: ri.notes,
          available: isIngredientAvailable(
            ri.ingredientId,
            ri.ingredient.name,
            userFridgeItems
          ),
          estimatedPrice: costInfo.ingredientCosts[ri.ingredientId] ?? null,
          ingredient: {
            id: ri.ingredient.id,
            name: ri.ingredient.name,
            categoryId: ri.ingredient.categoryId,
            category: ri.ingredient.category,
          },
        })),
        isFavorite: recipe.favoriteRecipes.length > 0,
        estimatedCost: costInfo.hasPricing ? costInfo.totalCost : null,
        costPerServing: costInfo.hasPricing ? costInfo.costPerServing : null,
      };

      res.json({
        success: true,
        data: {
          recipe: formattedRecipe,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /recipes/:id/favorite
 * Ajoute une recette aux favoris de l'utilisateur.
 */
router.post(
  "/:id/favorite",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      // Vérifier que la recette existe
      const recipe = await prisma.recipe.findUnique({
        where: { id },
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: "Recette non trouvée",
        });
      }

      // Vérifier si déjà en favoris
      const existingFavorite = await prisma.favoriteRecipe.findUnique({
        where: {
          userId_recipeId: {
            userId: req.userId!,
            recipeId: id,
          },
        },
      });

      if (existingFavorite) {
        return res.status(400).json({
          success: false,
          message: "Cette recette est déjà dans vos favoris",
        });
      }

      // Ajouter aux favoris
      await prisma.favoriteRecipe.create({
        data: {
          userId: req.userId!,
          recipeId: id,
        },
      });

      res.json({
        success: true,
        message: "Recette ajoutée aux favoris",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /recipes/:id/favorite
 * Retire une recette des favoris.
 */
router.delete(
  "/:id/favorite",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const favorite = await prisma.favoriteRecipe.findUnique({
        where: {
          userId_recipeId: {
            userId: req.userId!,
            recipeId: id,
          },
        },
      });

      if (!favorite) {
        return res.status(404).json({
          success: false,
          message: "Cette recette n'est pas dans vos favoris",
        });
      }

      await prisma.favoriteRecipe.delete({
        where: {
          userId_recipeId: {
            userId: req.userId!,
            recipeId: id,
          },
        },
      });

      res.json({
        success: true,
        message: "Recette retirée des favoris",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /recipes
 * Crée une recette manuelle par l'utilisateur.
 */
router.post(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        title,
        description,
        instructions,
        prepTime,
        cookTime,
        servings,
        difficulty,
        imageUrl,
        ingredients,
      } = createRecipeSchema.parse(req.body);

      // Traiter les ingrédients : créer s'ils n'existent pas, ou utiliser l'ID fourni
      const processedIngredients = await Promise.all(
        ingredients.map(async (ing) => {
          let ingredientId: string;

          if (ing.ingredientId) {
            // Vérifier que l'ingrédient existe
            const existingIngredient = await prisma.ingredient.findUnique({
              where: { id: ing.ingredientId },
            });

            if (!existingIngredient) {
              throw new Error(`Ingrédient avec l'ID ${ing.ingredientId} non trouvé`);
            }

            ingredientId = ing.ingredientId;
          } else if (ing.ingredientName) {
            // Chercher ou créer l'ingrédient par nom
            const normalizedName = ing.ingredientName.trim();
            
            let ingredient = await prisma.ingredient.findUnique({
              where: { name: normalizedName },
            });

            if (!ingredient) {
              // Créer l'ingrédient s'il n'existe pas
              ingredient = await prisma.ingredient.create({
                data: {
                  name: normalizedName,
                },
              });
            }

            ingredientId = ingredient.id;
          } else {
            throw new Error("Vous devez fournir soit ingredientId soit ingredientName");
          }

          return {
            ingredientId,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes,
          };
        })
      );

      // Créer la recette avec ses ingrédients
      const recipe = await prisma.recipe.create({
        data: {
          title,
          description,
          instructions,
          prepTime,
          cookTime,
          servings,
          difficulty,
          imageUrl,
          source: "user",
          createdById: req.userId,
          ingredients: {
            create: processedIngredients,
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
          createdBy: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      const formattedRecipe = {
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
        ingredients: recipe.ingredients.map((ri) => ({
          id: ri.id,
          recipeId: ri.recipeId,
          ingredientId: ri.ingredientId,
          quantity: ri.quantity,
          unit: ri.unit,
          notes: ri.notes,
          ingredient: {
            id: ri.ingredient.id,
            name: ri.ingredient.name,
            categoryId: ri.ingredient.categoryId,
            category: ri.ingredient.category,
          },
        })),
        isFavorite: false,
      };

      res.status(201).json({
        success: true,
        data: {
          recipe: formattedRecipe,
        },
        message: "Recette créée avec succès",
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

/**
 * PUT /recipes/:id
 * Met à jour une recette existante.
 */
router.put(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        instructions,
        prepTime,
        cookTime,
        servings,
        difficulty,
        imageUrl,
        ingredients,
      } = updateRecipeSchema.parse(req.body);

      // Vérifier que la recette existe
      const existingRecipe = await prisma.recipe.findUnique({
        where: { id },
      });

      if (!existingRecipe) {
        return res.status(404).json({
          success: false,
          message: "Recette non trouvée",
        });
      }

      // Préparer les données de mise à jour de la recette
      const updateData: any = {};
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description ? description.trim() : null;
      if (instructions !== undefined) updateData.instructions = instructions.map((i) => i.trim());
      if (prepTime !== undefined) updateData.prepTime = prepTime;
      if (cookTime !== undefined) updateData.cookTime = cookTime;
      if (servings !== undefined) updateData.servings = servings;
      if (difficulty !== undefined) updateData.difficulty = difficulty;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

      let recipe;

      if (ingredients !== undefined) {
        // Traiter les ingrédients : créer s'ils n'existent pas, ou utiliser l'ID fourni
        const processedIngredients = await Promise.all(
          ingredients.map(async (ing) => {
            let ingredientId: string;

            if (ing.ingredientId) {
              const existingIngredient = await prisma.ingredient.findUnique({
                where: { id: ing.ingredientId },
              });

              if (!existingIngredient) {
                throw new Error(`Ingrédient avec l'ID ${ing.ingredientId} non trouvé`);
              }

              ingredientId = ing.ingredientId;
            } else if (ing.ingredientName) {
              const normalizedName = ing.ingredientName.trim();
              let ingredient = await prisma.ingredient.findUnique({
                where: { name: normalizedName },
              });

              if (!ingredient) {
                ingredient = await prisma.ingredient.create({
                  data: {
                    name: normalizedName,
                  },
                });
              }

              ingredientId = ingredient.id;
            } else {
              throw new Error("Vous devez fournir soit ingredientId soit ingredientName");
            }

            return {
              ingredientId,
              quantity: ing.quantity,
              unit: ing.unit.trim(),
              notes: ing.notes?.trim() || undefined,
            };
          })
        );

        // Transaction : supprimer anciens ingrédients et créer les nouveaux
        recipe = await prisma.$transaction(async (tx) => {
          await tx.recipeIngredient.deleteMany({
            where: { recipeId: id },
          });

          return tx.recipe.update({
            where: { id },
            data: {
              ...updateData,
              ingredients: {
                create: processedIngredients,
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
              createdBy: {
                select: { firstName: true, lastName: true },
              },
              favoriteRecipes: {
                where: { userId: req.userId },
                select: { id: true },
              },
            },
          });
        });
      } else {
        recipe = await prisma.recipe.update({
          where: { id },
          data: updateData,
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
            createdBy: {
              select: { firstName: true, lastName: true },
            },
            favoriteRecipes: {
              where: { userId: req.userId },
              select: { id: true },
            },
          },
        });
      }

      // Récupérer les ingrédients du frigo et prix pour calculer la disponibilité et l'estimation des coûts
      const [userFridgeItems, pricedItems] = await Promise.all([
        prisma.fridgeItem.findMany({
          where: { userId: req.userId },
          include: { ingredient: true },
        }),
        getUserPricedItems(req.userId!),
      ]);

      const costInfo = estimateRecipeCost(
        recipe.ingredients,
        recipe.servings,
        pricedItems
      );

      const formattedRecipe = {
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
        ingredients: recipe.ingredients.map((ri) => ({
          id: ri.id,
          recipeId: ri.recipeId,
          ingredientId: ri.ingredientId,
          quantity: ri.quantity,
          unit: ri.unit,
          notes: ri.notes,
          available: isIngredientAvailable(
            ri.ingredientId,
            ri.ingredient.name,
            userFridgeItems
          ),
          estimatedPrice: costInfo.ingredientCosts[ri.ingredientId] ?? null,
          ingredient: {
            id: ri.ingredient.id,
            name: ri.ingredient.name,
            categoryId: ri.ingredient.categoryId,
            category: ri.ingredient.category,
          },
        })),
        isFavorite: Array.isArray(recipe.favoriteRecipes) && recipe.favoriteRecipes.length > 0,
        estimatedCost: costInfo.hasPricing ? costInfo.totalCost : null,
        costPerServing: costInfo.hasPricing ? costInfo.costPerServing : null,
      };

      res.json({
        success: true,
        data: {
          recipe: formattedRecipe,
        },
        message: "Recette mise à jour avec succès",
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

/**
 * POST /recipes/:id/image
 * Ajoute ou met à jour la photo d'une recette (upload fichier ou URL).
 */
router.post(
  "/:id/image",
  authenticateToken,
  uploadRecipeImage.single("image"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const recipe = await prisma.recipe.findUnique({
        where: { id },
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: "Recette non trouvée",
        });
      }

      let imageUrl: string | null = null;
      if (req.file) {
        imageUrl = `/uploads/recipes/${req.file.filename}`;
      } else if (req.body.imageUrl) {
        imageUrl = req.body.imageUrl.trim();
      }

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: "Veuillez fournir un fichier image ou une URL d'image.",
        });
      }

      const updatedRecipe = await prisma.recipe.update({
        where: { id },
        data: { imageUrl },
      });

      res.json({
        success: true,
        message: "Photo de la recette mise à jour avec succès",
        data: {
          recipe: updatedRecipe,
          imageUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /recipes/:id/image
 * Supprime la photo d'une recette.
 */
router.delete(
  "/:id/image",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const recipe = await prisma.recipe.findUnique({
        where: { id },
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: "Recette non trouvée",
        });
      }

      if (recipe.imageUrl && recipe.imageUrl.startsWith("/uploads/recipes/")) {
        const localPath = path.join(process.cwd(), recipe.imageUrl);
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
          } catch (e) {
            // continuer même si échec suppression fichier physique
          }
        }
      }

      const updatedRecipe = await prisma.recipe.update({
        where: { id },
        data: { imageUrl: null },
      });

      res.json({
        success: true,
        message: "Photo supprimée",
        data: { recipe: updatedRecipe },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /recipes/:id
 * Supprime une recette.
 */
router.delete(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const recipe = await prisma.recipe.findUnique({
        where: { id },
        select: {
          id: true,
          source: true,
          createdById: true,
          imageUrl: true,
        },
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: "Recette non trouvée",
        });
      }

      // Nettoyer l'image uploadée si existante
      if (recipe.imageUrl && recipe.imageUrl.startsWith("/uploads/recipes/")) {
        const localPath = path.join(process.cwd(), recipe.imageUrl);
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
          } catch (e) {
            // ignorer
          }
        }
      }

      await prisma.recipe.delete({
        where: { id: recipe.id },
      });

      res.json({
        success: true,
        message: "Recette supprimée avec succès",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
