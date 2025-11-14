import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { openFoodFactsService } from "../services/openFoodFactsService";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

// Schéma de validation pour création d'ingrédient
const createIngredientSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  categoryId: z.string().optional(),
  calories: z.number().positive().optional(),
  protein: z.number().positive().optional(),
  carbs: z.number().positive().optional(),
  fat: z.number().positive().optional(),
  fiber: z.number().positive().optional(),
});

// GET /api/ingredients - Liste de tous les ingrédients
router.get(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const ingredients = await prisma.ingredient.findMany({
        include: {
          category: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      res.json({
        success: true,
        data: {
          ingredients,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/ingredients/search - Recherche d'ingrédients depuis OpenFoodFacts et base locale
router.get(
  "/search",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          message: "Paramètre de recherche 'q' requis",
        });
      }

      // Recherche d'abord dans la base locale
      const localIngredients = await prisma.ingredient.findMany({
        where: {
          name: {
            contains: q,
            mode: "insensitive",
          },
        },
        include: {
          category: true,
        },
        take: 10, // Limiter à 10 résultats locaux pour laisser de la place à OpenFoodFacts
        orderBy: {
          name: "asc",
        },
      });

      // Recherche dans Open Food Facts
      let openFoodFactsResults: any[] = [];
      try {
        openFoodFactsResults = await openFoodFactsService.searchIngredients(q);
      } catch (error) {
        console.warn("Erreur lors de la recherche OpenFoodFacts:", error);
        // Continue avec seulement les résultats locaux
      }

      // Combiner les résultats en évitant les doublons
      const allIngredients = [...localIngredients];
      const localNames = localIngredients.map((ing) => ing.name.toLowerCase());

      openFoodFactsResults.forEach((offIngredient) => {
        if (!localNames.includes(offIngredient.name.toLowerCase())) {
          allIngredients.push({
            id: `off_${offIngredient.sourceId}`,
            name: offIngredient.name,
            category: offIngredient.category
              ? {
                  id: "external",
                  name: offIngredient.category,
                  color: "#666666",
                  icon: "🥄",
                }
              : null,
            categoryId: null,
            calories: offIngredient.nutritionalInfo?.calories || null,
            protein: offIngredient.nutritionalInfo?.proteins || null,
            carbs: offIngredient.nutritionalInfo?.carbohydrates || null,
            fat: offIngredient.nutritionalInfo?.fat || null,
            fiber: offIngredient.nutritionalInfo?.fiber || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any); // Type assertion temporaire pour OpenFoodFacts
        }
      });

      res.json({
        success: true,
        data: {
          ingredients: allIngredients.slice(0, 20), // Limiter à 20 résultats au total
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/ingredients/:id - Détails d'un ingrédient
// GET /api/ingredients/external/search - Recherche directe dans OpenFoodFacts
router.get(
  "/external/search",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          message: "Paramètre de recherche 'q' requis",
        });
      }

      const openFoodFactsResults = await openFoodFactsService.searchIngredients(
        q
      );

      res.json({
        success: true,
        data: {
          ingredients: openFoodFactsResults,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la recherche OpenFoodFacts:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la recherche d'ingrédients",
      });
    }
  }
);

router.get(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const ingredient = await prisma.ingredient.findUnique({
        where: { id },
        include: {
          category: true,
        },
      });

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: "Ingrédient non trouvé",
        });
      }

      res.json({
        success: true,
        data: {
          ingredient,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/ingredients - Créer un nouvel ingrédient
router.post(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { name, categoryId, calories, protein, carbs, fat, fiber } =
        createIngredientSchema.parse(req.body);

      // Vérifier si l'ingrédient existe déjà
      const existingIngredient = await prisma.ingredient.findUnique({
        where: { name },
      });

      if (existingIngredient) {
        return res.status(400).json({
          success: false,
          message: "Un ingrédient avec ce nom existe déjà",
        });
      }

      // Vérifier que la catégorie existe si fournie
      if (categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: categoryId },
        });

        if (!category) {
          return res.status(400).json({
            success: false,
            message: "Catégorie non trouvée",
          });
        }
      }

      const ingredient = await prisma.ingredient.create({
        data: {
          name,
          categoryId,
          calories,
          protein,
          carbs,
          fat,
          fiber,
        },
        include: {
          category: true,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          ingredient,
        },
        message: "Ingrédient créé avec succès",
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

// PUT /api/ingredients/:id - Mettre à jour un ingrédient
router.put(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const updates = createIngredientSchema.partial().parse(req.body);

      const ingredient = await prisma.ingredient.findUnique({
        where: { id },
      });

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: "Ingrédient non trouvé",
        });
      }

      // Vérifier que le nouveau nom n'existe pas déjà (si fourni)
      if (updates.name && updates.name !== ingredient.name) {
        const existingIngredient = await prisma.ingredient.findUnique({
          where: { name: updates.name },
        });

        if (existingIngredient) {
          return res.status(400).json({
            success: false,
            message: "Un ingrédient avec ce nom existe déjà",
          });
        }
      }

      // Vérifier que la catégorie existe si fournie
      if (updates.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: updates.categoryId },
        });

        if (!category) {
          return res.status(400).json({
            success: false,
            message: "Catégorie non trouvée",
          });
        }
      }

      const updatedIngredient = await prisma.ingredient.update({
        where: { id },
        data: updates,
        include: {
          category: true,
        },
      });

      res.json({
        success: true,
        data: {
          ingredient: updatedIngredient,
        },
        message: "Ingrédient mis à jour avec succès",
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

// DELETE /api/ingredients/:id - Supprimer un ingrédient
router.delete(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const ingredient = await prisma.ingredient.findUnique({
        where: { id },
      });

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: "Ingrédient non trouvé",
        });
      }

      // Vérifier s'il est utilisé dans des recettes ou des éléments de frigo
      const [fridgeItems, recipeIngredients] = await Promise.all([
        prisma.fridgeItem.findFirst({ where: { ingredientId: id } }),
        prisma.recipeIngredient.findFirst({ where: { ingredientId: id } }),
      ]);

      if (fridgeItems || recipeIngredients) {
        return res.status(400).json({
          success: false,
          message:
            "Impossible de supprimer cet ingrédient car il est utilisé dans des recettes ou des éléments de frigo",
        });
      }

      await prisma.ingredient.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Ingrédient supprimé avec succès",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
