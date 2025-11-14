// Routes CRUD pour la gestion du frigo utilisateur.
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Validation commune pour les payloads d'items de frigo.
const fridgeItemSchema = z.object({
  ingredientId: z.string().min(1, "L'ingrédient est requis"),
  quantity: z
    .number({
      invalid_type_error: "La quantité doit être un nombre",
    })
    .positive("La quantité doit être supérieure à 0"),
  unit: z.string().min(1, "L'unité est requise"),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

// Convertit une string en Date et lève si invalide.
const parseExpiryDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Date d'expiration invalide");
  }

  return date;
};

/**
 * GET /fridge
 * Liste les ingrédients du frigo courant avec leurs catégories.
 */
router.get(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const fridgeItems = await prisma.fridgeItem.findMany({
        where: { userId: req.userId },
        include: {
          ingredient: {
            include: {
              category: true,
            },
          },
        },
        orderBy: {
          addedDate: "desc",
        },
      });

      res.json({
        success: true,
        data: {
          fridgeItems,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /fridge
 * Ajoute un ingrédient dans le frigo ou incrémente la quantité existante.
 */
router.post(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = fridgeItemSchema.parse(req.body);

      const ingredient = await prisma.ingredient.findUnique({
        where: { id: body.ingredientId },
      });

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: "Ingrédient non trouvé",
        });
      }

      const existingItem = await prisma.fridgeItem.findFirst({
        where: {
          userId: req.userId!,
          ingredientId: body.ingredientId,
        },
      });

      let expiryDate: Date | undefined;
      if (body.expiryDate) {
        expiryDate = parseExpiryDate(body.expiryDate);
      }

      let fridgeItem;

      if (existingItem) {
        fridgeItem = await prisma.fridgeItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + body.quantity,
            unit: body.unit,
            expiryDate: body.expiryDate
              ? expiryDate ?? existingItem.expiryDate
              : existingItem.expiryDate,
            notes: body.notes ?? existingItem.notes,
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
        fridgeItem = await prisma.fridgeItem.create({
          data: {
            userId: req.userId!,
            ingredientId: body.ingredientId,
            quantity: body.quantity,
            unit: body.unit,
            expiryDate,
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

      res.status(existingItem ? 200 : 201).json({
        success: true,
        data: {
          fridgeItem,
        },
        message: existingItem
          ? "Quantité mise à jour pour cet ingrédient"
          : "Ingrédient ajouté au frigo",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: error.errors[0].message,
        });
      }

      if (error instanceof Error && error.message.includes("Date")) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  }
);

/**
 * PUT /fridge/:id
 * Met à jour un item existant (quantité, unité, DLUO, etc.).
 */
router.put(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const updates = fridgeItemSchema.partial().parse(req.body);

      const existingItem = await prisma.fridgeItem.findUnique({
        where: { id },
      });

      if (!existingItem || existingItem.userId !== req.userId) {
        return res.status(404).json({
          success: false,
          message: "Élément de frigo non trouvé",
        });
      }

      if (updates.ingredientId) {
        const ingredient = await prisma.ingredient.findUnique({
          where: { id: updates.ingredientId },
        });

        if (!ingredient) {
          return res.status(404).json({
            success: false,
            message: "Ingrédient non trouvé",
          });
        }
      }

      const { expiryDate: expiryDateInput, ...rest } = updates;
      const updateData: Record<string, unknown> = { ...rest };

      if (expiryDateInput !== undefined) {
        if (expiryDateInput === "") {
          updateData.expiryDate = null;
        } else {
          updateData.expiryDate = parseExpiryDate(expiryDateInput);
        }
      }

      const fridgeItem = await prisma.fridgeItem.update({
        where: { id },
        data: updateData,
        include: {
          ingredient: {
            include: {
              category: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: {
          fridgeItem,
        },
        message: "Élément de frigo mis à jour",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: error.errors[0].message,
        });
      }

      if (error instanceof Error && error.message.includes("Date")) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }
);

/**
 * DELETE /fridge/:id
 * Supprime un élément du frigo pour l'utilisateur connecté.
 */
router.delete(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const existingItem = await prisma.fridgeItem.findUnique({
        where: { id },
      });

      if (!existingItem || existingItem.userId !== req.userId) {
        return res.status(404).json({
          success: false,
          message: "Élément de frigo non trouvé",
        });
      }

      await prisma.fridgeItem.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Élément de frigo supprimé",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
