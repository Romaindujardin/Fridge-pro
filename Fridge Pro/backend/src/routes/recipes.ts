// Routes de gestion des recettes : listing, favoris, suggestions et CRUD.
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

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
  imageUrl: z.string().url().optional(),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string(),
        quantity: z.number().positive(),
        unit: z.string(),
        notes: z.string().optional(),
      })
    )
    .min(1, "Au moins un ingrédient est requis"),
});

const filterSchema = z.object({
  search: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  maxPrepTime: z.number().int().positive().optional(),
  makeable: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(20),
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
        const userFridgeItems = await prisma.fridgeItem.findMany({
          where: { userId: req.userId },
          include: { ingredient: true },
        });

        const availableIngredientIds = userFridgeItems.map(
          (item) => item.ingredientId
        );

        // Trouver les recettes où tous les ingrédients sont disponibles
        const recipeIds = await prisma.recipe
          .findMany({
            where,
            include: {
              ingredients: true,
            },
          })
          .then((recipes) => {
            return recipes
              .filter((recipe) => {
                return recipe.ingredients.every((recipeIngredient) =>
                  availableIngredientIds.includes(recipeIngredient.ingredientId)
                );
              })
              .map((recipe) => recipe.id);
          });

        where.id = { in: recipeIds };
      }

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

      // Formater les résultats pour l'UI
      const formattedRecipes = recipes.map((recipe) => ({
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
        isFavorite: recipe.favoriteRecipes.length > 0,
      }));

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
      // Récupérer les ingrédients du frigo de l'utilisateur
      const userFridgeItems = await prisma.fridgeItem.findMany({
        where: { userId: req.userId },
        include: { ingredient: true },
      });

      const availableIngredientIds = userFridgeItems.map(
        (item) => item.ingredientId
      );

      if (availableIngredientIds.length === 0) {
        return res.json({
          success: true,
          data: {
            suggestions: [],
          },
        });
      }

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
          availableIngredientIds.includes(ri.ingredientId)
        ).length;

        const score =
          totalIngredients > 0
            ? (availableIngredients / totalIngredients) * 100
            : 0;

        return {
          recipe,
          score,
          missingIngredients: recipe.ingredients.filter(
            (ri) => !availableIngredientIds.includes(ri.ingredientId)
          ).length,
        };
      });

      // Trier par score décroissant et prendre les 10 meilleures
      const favoriteRecipesPayload = favoriteRecipes.map((recipe) => ({
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
          available: availableIngredientIds.includes(ri.ingredientId),
        })),
        isFavorite: true,
        compatibilityScore: 100,
        missingIngredientsCount: 0,
      }));

      const suggestions = scoredRecipes
        .filter(
          ({ score, recipe }) => score > 0 && !favoriteIdsSet.has(recipe.id)
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(10 - favoriteRecipesPayload.length, 0))
        .map(({ recipe, score, missingIngredients }) => ({
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
            available: availableIngredientIds.includes(ri.ingredientId),
          })),
          isFavorite: recipe.favoriteRecipes.length > 0,
          compatibilityScore: Math.round(score),
          missingIngredientsCount: missingIngredients,
        }));

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

      const formattedFavorites = favoriteRecipes.map((fav) => ({
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
        })),
        isFavorite: true,
        favoriteAddedAt: fav.addedAt,
      }));

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
        isFavorite: recipe.favoriteRecipes.length > 0,
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
            create: ingredients.map((ing) => ({
              ingredientId: ing.ingredientId,
              quantity: ing.quantity,
              unit: ing.unit,
              notes: ing.notes,
            })),
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
 * DELETE /recipes/:id
 * Supprime une recette créée/IA par son auteur.
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
        },
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: "Recette non trouvée",
        });
      }

      if (
        recipe.createdById !== req.userId ||
        (recipe.source !== "ai_generated" && recipe.source !== "user")
      ) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à supprimer cette recette",
        });
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
