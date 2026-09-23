// Routes CRUD pour la gestion des catégories d'ingrédients.
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

const categorySchema = z.object({
  name: z.string().min(1, "Le nom de la catégorie est requis"),
  color: z.string().optional().default("#3b82f6"),
  icon: z.string().optional().default(""),
});

/**
 * GET /api/categories
 * Récupère toutes les catégories avec le nombre d'ingrédients associés.
 */
router.get(
  "/",
  authenticateToken,
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const categories = await prisma.category.findMany({
        include: {
          _count: {
            select: { ingredients: true },
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      res.json({
        success: true,
        data: {
          categories,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/categories
 * Crée une nouvelle catégorie personnalisée.
 */
router.post(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = categorySchema.parse(req.body);

      // Vérifier si une catégorie avec le même nom existe déjà
      const existing = await prisma.category.findUnique({
        where: { name: body.name.trim() },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: `La catégorie "${body.name}" existe déjà.`,
        });
      }

      const category = await prisma.category.create({
        data: {
          name: body.name.trim(),
          color: body.color || "#3b82f6",
          icon: body.icon || "",
        },
      });

      res.status(201).json({
        success: true,
        data: {
          category,
        },
        message: "Catégorie créée avec succès",
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
 * DELETE /api/categories/:id
 * Supprime une catégorie.
 */
router.delete(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;

      const existing = await prisma.category.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Catégorie non trouvée",
        });
      }

      // Détacher les ingrédients liés
      await prisma.ingredient.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });

      await prisma.category.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Catégorie supprimée avec succès",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
