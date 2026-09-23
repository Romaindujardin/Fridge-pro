// Routes CRUD pour la gestion du frigo utilisateur.
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { invalidateUserInventory } from "../utils/recipeCache";

const router = Router();
const prisma = new PrismaClient();

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

// Validation commune pour les payloads d'items de frigo.
const fridgeItemSchema = z.object({
  ingredientId: z.string().min(1, "L'ingrédient est requis"),
  itemCount: z
    .preprocess(
      (val) => {
        if (typeof val === "string") {
          const num = parseInt(val.trim(), 10);
          return isNaN(num) ? val : num;
        }
        return val;
      },
      z.number().int().positive().optional().default(1)
    ),
  initialItemCount: z
    .preprocess(
      (val) => {
        if (typeof val === "string") {
          const num = parseInt(val.trim(), 10);
          return isNaN(num) ? val : num;
        }
        return val;
      },
      z.number().int().positive().optional().nullable()
    ),
  quantity: z
    .preprocess(
      parseDecimalNumber,
      z.number({
        invalid_type_error: "La quantité doit être un nombre",
      }).positive("La quantité doit être supérieure à 0")
    ),
  initialQuantity: z
    .preprocess(
      parseDecimalNumber,
      z.number().positive().optional().nullable()
    ),
  unit: z.string().min(1, "L'unité est requise"),
  brand: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  price: z
    .preprocess(
      parseDecimalNumber,
      z
        .number({
          invalid_type_error: "Le prix doit être un nombre",
        })
        .nonnegative("Le prix ne peut pas être négatif")
        .optional()
        .nullable()
    ),
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

      // Si une catégorie est spécifiée, mettre à jour la catégorie de l'ingrédient
      if (body.categoryId !== undefined) {
        await prisma.ingredient.update({
          where: { id: ingredient.id },
          data: { categoryId: body.categoryId || null },
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
        const addedQty = body.quantity;
        const newTotalQty = Math.round((existingItem.quantity + addedQty) * 1000) / 1000;
        const newInitialQty = body.initialQuantity !== undefined && body.initialQuantity !== null
          ? body.initialQuantity
          : Math.round(((existingItem.initialQuantity ?? existingItem.quantity) + addedQty) * 1000) / 1000;

        fridgeItem = await prisma.fridgeItem.update({
          where: { id: existingItem.id },
          data: {
            itemCount: (existingItem.itemCount || 1) + (body.itemCount ?? 1),
            initialItemCount: (existingItem.initialItemCount ?? existingItem.itemCount ?? 1) + (body.itemCount ?? 1),
            quantity: newTotalQty,
            initialQuantity: Math.max(newTotalQty, newInitialQty),
            unit: body.unit,
            brand: body.brand ?? existingItem.brand,
            price: body.price !== undefined ? body.price : existingItem.price,
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
        const initialQty = body.initialQuantity && body.initialQuantity >= body.quantity
          ? body.initialQuantity
          : body.quantity;
        const initialCount = body.initialItemCount && body.initialItemCount >= (body.itemCount ?? 1)
          ? body.initialItemCount
          : (body.itemCount ?? 1);

        fridgeItem = await prisma.fridgeItem.create({
          data: {
            userId: req.userId!,
            ingredientId: body.ingredientId,
            itemCount: body.itemCount ?? 1,
            initialItemCount: initialCount,
            quantity: body.quantity,
            initialQuantity: initialQty,
            unit: body.unit,
            brand: body.brand || null,
            price: body.price ?? null,
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

      invalidateUserInventory(req.userId!);

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
 * GET /fridge/history
 * Liste les ingrédients achetés et consommés avec statistiques et filtres.
 */
router.get(
  "/history",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { search, status, page = "1", limit = "100" } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 100));
      const skip = (pageNum - 1) * limitNum;

      const where: any = { userId: req.userId };

      if (status && (status === "consumed" || status === "expired")) {
        where.status = status;
      }

      if (search && typeof search === "string" && search.trim()) {
        where.OR = [
          { ingredient: { name: { contains: search.trim(), mode: "insensitive" } } },
          { brand: { contains: search.trim(), mode: "insensitive" } },
        ];
      }

      const [items, totalCount, allUserHistory] = await Promise.all([
        prisma.purchaseHistory.findMany({
          where,
          include: {
            ingredient: {
              include: {
                category: true,
              },
            },
          },
          orderBy: {
            finishedDate: "desc",
          },
          skip,
          take: limitNum,
        }),
        prisma.purchaseHistory.count({ where }),
        // Pour les KPIs globaux de l'utilisateur
        prisma.purchaseHistory.findMany({
          where: { userId: req.userId },
          select: {
            price: true,
            status: true,
            finishedDate: true,
          },
        }),
      ]);

      // Calcul des statistiques financières et de consommation
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let totalSpent = 0;
      let spentThisMonth = 0;
      let consumedCount = 0;
      let expiredCount = 0;

      for (const record of allUserHistory) {
        if (record.price && record.price > 0) {
          totalSpent += record.price;
          if (record.finishedDate && new Date(record.finishedDate) >= startOfMonth) {
            spentThisMonth += record.price;
          }
        }
        if (record.status === "expired") {
          expiredCount++;
        } else {
          consumedCount++;
        }
      }

      totalSpent = Math.round(totalSpent * 100) / 100;
      spentThisMonth = Math.round(spentThisMonth * 100) / 100;
      const pricedItemsCount = allUserHistory.filter((h) => h.price && h.price > 0).length;
      const averagePrice =
        pricedItemsCount > 0
          ? Math.round((totalSpent / pricedItemsCount) * 100) / 100
          : 0;

      return res.json({
        success: true,
        data: {
          items,
          pagination: {
            total: totalCount,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalCount / limitNum),
          },
          stats: {
            totalSpent,
            spentThisMonth,
            consumedCount,
            expiredCount,
            totalItems: allUserHistory.length,
            averagePrice,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /fridge/history
 * Ajout manuel d'une entrée dans l'historique d'achat / consommation.
 */
router.post(
  "/history",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const manualHistorySchema = z.object({
        ingredientId: z.string().min(1, "L'ingrédient est requis"),
        itemCount: z
          .preprocess(
            (val) => (typeof val === "string" ? parseInt(val.trim(), 10) : val),
            z.number().int().positive().optional().default(1)
          ),
        quantity: z
          .preprocess(
            parseDecimalNumber,
            z.number({ invalid_type_error: "La quantité doit être un nombre" }).positive()
          ),
        unit: z.string().min(1, "L'unité est requise"),
        brand: z.string().optional().nullable(),
        price: z
          .preprocess(
            parseDecimalNumber,
            z.number().nonnegative().optional().nullable()
          ),
        status: z.enum(["consumed", "expired"]).optional().default("consumed"),
        boughtDate: z.string().optional(),
        finishedDate: z.string().optional(),
        notes: z.string().optional().nullable(),
      });

      const body = manualHistorySchema.parse(req.body);

      const historyItem = await prisma.purchaseHistory.create({
        data: {
          userId: req.userId!,
          ingredientId: body.ingredientId,
          itemCount: body.itemCount,
          quantity: body.quantity,
          unit: body.unit,
          brand: body.brand || null,
          price: body.price ?? null,
          status: body.status,
          boughtDate: body.boughtDate ? new Date(body.boughtDate) : new Date(),
          finishedDate: body.finishedDate ? new Date(body.finishedDate) : new Date(),
          notes: body.notes || null,
        },
        include: {
          ingredient: {
            include: {
              category: true,
            },
          },
        },
      });

      invalidateUserInventory(req.userId!);

      return res.status(201).json({
        success: true,
        data: { historyItem },
        message: "Achat ajouté à l'historique",
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
 * DELETE /fridge/history/:id
 * Supprime une entrée de l'historique d'achat.
 */
router.delete(
  "/history/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const existingItem = await prisma.purchaseHistory.findUnique({
        where: { id },
      });

      if (!existingItem || existingItem.userId !== req.userId) {
        return res.status(404).json({
          success: false,
          message: "Entrée d'historique non trouvée",
        });
      }

      await prisma.purchaseHistory.delete({
        where: { id },
      });

      invalidateUserInventory(req.userId!);

      return res.json({
        success: true,
        message: "Entrée d'historique supprimée",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /fridge/history/:id/re-add
 * Remet un ingrédient de l'historique dans le frigo ou dans la liste de courses.
 */
router.post(
  "/history/:id/re-add",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const destination = (req.body.destination || "fridge") as "fridge" | "shopping";

      const historyItem = await prisma.purchaseHistory.findUnique({
        where: { id },
        include: { ingredient: true },
      });

      if (!historyItem || historyItem.userId !== req.userId) {
        return res.status(404).json({
          success: false,
          message: "Entrée d'historique non trouvée",
        });
      }

      if (destination === "shopping") {
        // Ajouter à la première liste de courses ou en créer une
        let shoppingList = await prisma.shoppingList.findFirst({
          where: { userId: req.userId },
          orderBy: { createdAt: "desc" },
        });

        if (!shoppingList) {
          shoppingList = await prisma.shoppingList.create({
            data: {
              userId: req.userId!,
              name: "Ma liste de courses",
            },
          });
        }

        const existingListItem = await prisma.shoppingListItem.findFirst({
          where: {
            shoppingListId: shoppingList.id,
            ingredientId: historyItem.ingredientId,
          },
        });

        if (existingListItem) {
          await prisma.shoppingListItem.update({
            where: { id: existingListItem.id },
            data: {
              quantity: existingListItem.quantity + historyItem.quantity,
            },
          });
        } else {
          await prisma.shoppingListItem.create({
            data: {
              shoppingListId: shoppingList.id,
              ingredientId: historyItem.ingredientId,
              quantity: historyItem.quantity,
              unit: historyItem.unit,
              notes: historyItem.brand ? `Marque: ${historyItem.brand}` : undefined,
            },
          });
        }

        return res.json({
          success: true,
          message: `${historyItem.ingredient.name} ajouté à la liste de courses`,
        });
      } else {
        // Destination : Frigo
        const existingFridge = await prisma.fridgeItem.findFirst({
          where: {
            userId: req.userId!,
            ingredientId: historyItem.ingredientId,
          },
        });

        let fridgeItem;
        if (existingFridge) {
          fridgeItem = await prisma.fridgeItem.update({
            where: { id: existingFridge.id },
            data: {
              itemCount: (existingFridge.itemCount || 1) + (historyItem.itemCount || 1),
              quantity: Math.round((existingFridge.quantity + historyItem.quantity) * 1000) / 1000,
              brand: historyItem.brand || existingFridge.brand,
              price: historyItem.price !== null ? historyItem.price : existingFridge.price,
            },
            include: { ingredient: { include: { category: true } } },
          });
        } else {
          fridgeItem = await prisma.fridgeItem.create({
            data: {
              userId: req.userId!,
              ingredientId: historyItem.ingredientId,
              itemCount: historyItem.itemCount || 1,
              quantity: historyItem.quantity,
              unit: historyItem.unit,
              brand: historyItem.brand,
              price: historyItem.price,
            },
            include: { ingredient: { include: { category: true } } },
          });
        }

        invalidateUserInventory(req.userId!);

        return res.json({
          success: true,
          data: { fridgeItem },
          message: `${historyItem.ingredient.name} remis dans le frigo`,
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /fridge/:id/finish
 * Marque un aliment comme fini / consommé ou périmé et l'archive dans l'historique d'achat.
 */
router.post(
  "/:id/finish",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const finishItemSchema = z.object({
        status: z.enum(["consumed", "expired"]).optional().default("consumed"),
        price: z
          .preprocess(
            parseDecimalNumber,
            z.number().nonnegative().optional().nullable()
          ),
        quantity: z
          .preprocess(
            parseDecimalNumber,
            z.number().positive().optional()
          ),
        itemCount: z
          .preprocess(
            (val) => (typeof val === "string" ? parseInt(val.trim(), 10) : val),
            z.number().int().positive().optional()
          ),
        finishAll: z.boolean().optional(),
        notes: z.string().optional().nullable(),
      });

      const body = finishItemSchema.parse(req.body);

      const existingItem = await prisma.fridgeItem.findUnique({
        where: { id },
        include: {
          ingredient: {
            include: {
              category: true,
            },
          },
        },
      });

      if (!existingItem || existingItem.userId !== req.userId) {
        return res.status(404).json({
          success: false,
          message: "Élément de frigo non trouvé",
        });
      }

      const totalItems = existingItem.itemCount || 1;
      let quantityToFinish: number;
      let countToFinish: number;
      let isFinishingAll: boolean;

      if (body.finishAll === true) {
        quantityToFinish = existingItem.quantity;
        countToFinish = totalItems;
        isFinishingAll = true;
      } else if (body.quantity !== undefined) {
        quantityToFinish = Math.min(body.quantity, existingItem.quantity);
        isFinishingAll = quantityToFinish >= existingItem.quantity;
        countToFinish = isFinishingAll
          ? totalItems
          : Math.max(1, Math.round((quantityToFinish / existingItem.quantity) * totalItems));
      } else if (body.itemCount !== undefined && totalItems > 1) {
        countToFinish = Math.min(body.itemCount, totalItems);
        isFinishingAll = countToFinish >= totalItems;
        quantityToFinish = isFinishingAll
          ? existingItem.quantity
          : Math.round((existingItem.quantity / totalItems) * countToFinish * 1000) / 1000;
      } else {
        quantityToFinish = existingItem.quantity;
        countToFinish = totalItems;
        isFinishingAll = true;
      }

      // Calcul du prix : si spécifié dans le body, on l'utilise, sinon proratisation
      let priceToRecord: number | null = null;
      if (body.price !== undefined) {
        priceToRecord = body.price;
      } else if (existingItem.price !== null && existingItem.price !== undefined) {
        if (isFinishingAll) {
          priceToRecord = existingItem.price;
        } else {
          priceToRecord = Math.round((existingItem.price * (quantityToFinish / existingItem.quantity)) * 100) / 100;
        }
      }

      // 1. Créer l'entrée dans l'historique d'achat / consommation
      const historyItem = await prisma.purchaseHistory.create({
        data: {
          userId: req.userId!,
          ingredientId: existingItem.ingredientId,
          itemCount: countToFinish,
          quantity: quantityToFinish,
          unit: existingItem.unit,
          brand: existingItem.brand,
          price: priceToRecord,
          status: body.status,
          boughtDate: existingItem.addedDate,
          finishedDate: new Date(),
          notes: body.notes !== undefined ? (body.notes || null) : existingItem.notes,
        },
        include: {
          ingredient: {
            include: {
              category: true,
            },
          },
        },
      });

      // 2. Mettre à jour ou supprimer l'item du frigo
      if (isFinishingAll) {
        await prisma.fridgeItem.delete({
          where: { id },
        });
      } else {
        const remainingCount = Math.max(1, totalItems - countToFinish);
        const remainingQuantity = Math.round((existingItem.quantity - quantityToFinish) * 1000) / 1000;
        const remainingPrice =
          existingItem.price !== null && existingItem.price !== undefined && priceToRecord !== null
            ? Math.round(Math.max(0, existingItem.price - priceToRecord) * 100) / 100
            : existingItem.price;

        await prisma.fridgeItem.update({
          where: { id },
          data: {
            itemCount: remainingCount,
            quantity: remainingQuantity,
            price: remainingPrice,
            initialQuantity: existingItem.initialQuantity ?? existingItem.quantity,
            initialItemCount: existingItem.initialItemCount ?? existingItem.itemCount ?? 1,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          historyItem,
          finishedAll: isFinishingAll,
        },
        message:
          body.status === "expired"
            ? "Aliment marqué comme périmé et archivé"
            : "Aliment marqué comme consommé et archivé",
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

      const { expiryDate: expiryDateInput, categoryId, ...rest } = updates;
      const updateData: Record<string, unknown> = { ...rest };

      if (categoryId !== undefined) {
        const targetIngredientId = updates.ingredientId || existingItem.ingredientId;
        await prisma.ingredient.update({
          where: { id: targetIngredientId },
          data: { categoryId: categoryId || null },
        });
      }

      if (expiryDateInput !== undefined) {
        if (expiryDateInput === "") {
          updateData.expiryDate = null;
        } else {
          updateData.expiryDate = parseExpiryDate(expiryDateInput);
        }
      }

      // Synchronisation intelligente de initialQuantity
      if (updates.quantity !== undefined) {
        if (updates.initialQuantity !== undefined && updates.initialQuantity !== null) {
          updateData.initialQuantity = Math.max(updates.quantity, updates.initialQuantity);
        } else if (existingItem.initialQuantity !== null && existingItem.initialQuantity !== undefined) {
          updateData.initialQuantity = Math.max(updates.quantity, existingItem.initialQuantity);
        } else {
          updateData.initialQuantity = updates.quantity;
        }
      } else if (updates.initialQuantity !== undefined && updates.initialQuantity !== null) {
        updateData.initialQuantity = Math.max(existingItem.quantity, updates.initialQuantity);
      }

      // Synchronisation intelligente de initialItemCount
      if (updates.itemCount !== undefined) {
        if (updates.initialItemCount !== undefined && updates.initialItemCount !== null) {
          updateData.initialItemCount = Math.max(updates.itemCount, updates.initialItemCount);
        } else if (existingItem.initialItemCount !== null && existingItem.initialItemCount !== undefined) {
          updateData.initialItemCount = Math.max(updates.itemCount, existingItem.initialItemCount);
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

      invalidateUserInventory(req.userId!);

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

      invalidateUserInventory(req.userId!);

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
