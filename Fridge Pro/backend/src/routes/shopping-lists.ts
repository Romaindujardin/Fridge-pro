// Routes CRUD pour les listes de courses et leurs items.
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Sélection standard (liste + items + catégories) utilisée par plusieurs requêtes.
const listSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  items: {
    include: {
      ingredient: {
        include: {
          category: true,
        },
      },
    },
  },
};

// Validation des payloads
const createListSchema = z.object({
  name: z.string().min(1, "Le nom de la liste est requis"),
});

const addItemSchema = z.object({
  ingredientId: z.string().min(1, "L'ingrédient est requis"),
  quantity: z
    .number({
      invalid_type_error: "La quantité doit être un nombre",
    })
    .positive("La quantité doit être supérieure à 0"),
  unit: z.string().min(1, "L'unité est requise"),
  notes: z.string().optional(),
});

const updateItemSchema = addItemSchema.partial().extend({
  purchased: z.boolean().optional(),
});

const toggleItemSchema = z.object({
  purchased: z.boolean(),
});

// Vérifie qu'une liste appartient à l'utilisateur connecté.
const ensureListOwner = async (userId: string, listId: string) => {
  const list = await prisma.shoppingList.findFirst({
    where: {
      id: listId,
      userId,
    },
  });

  return list;
};

/**
 * GET /shopping-lists
 * Liste toutes les listes de courses de l'utilisateur.
 */
router.get(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const lists = await prisma.shoppingList.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
        select: listSelect,
      });

      return res.json({
        success: true,
        data: {
          shoppingLists: lists,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /shopping-lists
 * Crée une nouvelle liste vide.
 */
router.post(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = createListSchema.parse(req.body);

      const shoppingList = await prisma.shoppingList.create({
        data: {
          name: body.name,
          userId: req.userId!,
        },
        select: listSelect,
      });

      return res.status(201).json({
        success: true,
        data: {
          shoppingList,
        },
        message: "Liste de courses créée avec succès",
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
 * GET /shopping-lists/:id
 * Détail complet d'une liste (items inclus).
 */
router.get(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const shoppingList = await prisma.shoppingList.findFirst({
        where: {
          id,
          userId: req.userId,
        },
        select: listSelect,
      });

      if (!shoppingList) {
        return res.status(404).json({
          success: false,
          message: "Liste de courses introuvable",
        });
      }

      return res.json({
        success: true,
        data: {
          shoppingList,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /shopping-lists/:id
 * Supprime une liste appartenant à l'utilisateur.
 */
router.delete(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const list = await ensureListOwner(req.userId!, id);

      if (!list) {
        return res.status(404).json({
          success: false,
          message: "Liste de courses introuvable",
        });
      }

      await prisma.shoppingList.delete({
        where: { id },
      });

      return res.json({
        success: true,
        message: "Liste de courses supprimée",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /shopping-lists/:id/items
 * Ajoute un ingrédient à la liste (fusionne si déjà présent).
 */
router.post(
  "/:id/items",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const body = addItemSchema.parse(req.body);

      const list = await ensureListOwner(req.userId!, id);

      if (!list) {
        return res.status(404).json({
          success: false,
          message: "Liste de courses introuvable",
        });
      }

      const ingredient = await prisma.ingredient.findUnique({
        where: { id: body.ingredientId },
      });

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: "Ingrédient introuvable",
        });
      }

      const existingItem = await prisma.shoppingListItem.findFirst({
        where: {
          shoppingListId: id,
          ingredientId: body.ingredientId,
        },
      });

      let item;

      if (existingItem) {
        item = await prisma.shoppingListItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + body.quantity,
            unit: body.unit,
            notes: body.notes,
          },
          include: {
            ingredient: {
              include: {
                category: true,
              },
            },
          },
        });
      } else {
        item = await prisma.shoppingListItem.create({
          data: {
            shoppingListId: id,
            ingredientId: body.ingredientId,
            quantity: body.quantity,
            unit: body.unit,
            notes: body.notes,
          },
          include: {
            ingredient: {
              include: {
                category: true,
              },
            },
          },
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          item,
        },
        message: "Article ajouté à la liste",
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
 * PUT /shopping-lists/:listId/items/:itemId
 * Met à jour un article existant (ingrédient, quantité, notes...).
 */
router.put(
  "/:listId/items/:itemId",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { listId, itemId } = req.params;
      const body = updateItemSchema.parse(req.body);

      const list = await ensureListOwner(req.userId!, listId);

      if (!list) {
        return res.status(404).json({
          success: false,
          message: "Liste de courses introuvable",
        });
      }

      const item = await prisma.shoppingListItem.findFirst({
        where: { id: itemId, shoppingListId: listId },
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Article introuvable dans cette liste",
        });
      }

      if (body.ingredientId) {
        const ingredientExists = await prisma.ingredient.findUnique({
          where: { id: body.ingredientId },
        });

        if (!ingredientExists) {
          return res.status(404).json({
            success: false,
            message: "Ingrédient introuvable",
          });
        }
      }

      const updatedItem = await prisma.shoppingListItem.update({
        where: { id: itemId },
        data: {
          ingredientId: body.ingredientId ?? item.ingredientId,
          quantity: body.quantity ?? item.quantity,
          unit: body.unit ?? item.unit,
          notes: body.notes ?? item.notes,
          purchased: body.purchased ?? item.purchased,
        },
        include: {
          ingredient: {
            include: {
              category: true,
            },
          },
        },
      });

      return res.json({
        success: true,
        data: {
          item: updatedItem,
        },
        message: "Article mis à jour",
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
 * PATCH /shopping-lists/:listId/items/:itemId
 * Toggle rapide du statut purchased.
 */
router.patch(
  "/:listId/items/:itemId",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { listId, itemId } = req.params;
      const body = toggleItemSchema.parse(req.body);

      const list = await ensureListOwner(req.userId!, listId);

      if (!list) {
        return res.status(404).json({
          success: false,
          message: "Liste de courses introuvable",
        });
      }

      const item = await prisma.shoppingListItem.findFirst({
        where: { id: itemId, shoppingListId: listId },
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Article introuvable dans cette liste",
        });
      }

      const updatedItem = await prisma.shoppingListItem.update({
        where: { id: itemId },
        data: {
          purchased: body.purchased,
        },
        include: {
          ingredient: {
            include: {
              category: true,
            },
          },
        },
      });

      return res.json({
        success: true,
        data: {
          item: updatedItem,
        },
        message: "Statut de l'article mis à jour",
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
 * DELETE /shopping-lists/:listId/items/:itemId
 * Supprime un article spécifique.
 */
router.delete(
  "/:listId/items/:itemId",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { listId, itemId } = req.params;

      const list = await ensureListOwner(req.userId!, listId);

      if (!list) {
        return res.status(404).json({
          success: false,
          message: "Liste de courses introuvable",
        });
      }

      const item = await prisma.shoppingListItem.findFirst({
        where: { id: itemId, shoppingListId: listId },
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Article introuvable dans cette liste",
        });
      }

      await prisma.shoppingListItem.delete({
        where: { id: itemId },
      });

      return res.json({
        success: true,
        message: "Article supprimé",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
