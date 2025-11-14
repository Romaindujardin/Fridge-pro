// Routes liées au profil utilisateur (lecture / mise à jour).
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Validation des données envoyées depuis le formulaire de profil.
const profileSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  geminiApiKey: z
    .string()
    .trim()
    .max(255, "La clé Gemini ne doit pas dépasser 255 caractères")
    .optional()
    .nullable(),
});

// Projection standard pour éviter de renvoyer le mot de passe ou autres champs sensibles.
const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  geminiApiKey: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * GET /users/profile
 * Retourne les informations du compte connecté.
 */
router.get(
  "/profile",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: userSelect,
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Utilisateur introuvable",
        });
      }

      return res.json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /users/profile
 * Met à jour les informations du profil (prénom, nom, email).
 */
router.put(
  "/profile",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = profileSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Utilisateur introuvable",
        });
      }

      if (body.email !== user.email) {
        const existingEmail = await prisma.user.findUnique({
          where: { email: body.email },
          select: { id: true },
        });

        if (existingEmail) {
          return res.status(400).json({
            success: false,
            message: "Cette adresse email est déjà utilisée",
          });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          geminiApiKey: body.geminiApiKey?.trim()
            ? body.geminiApiKey.trim()
            : null,
        },
        select: userSelect,
      });

      return res.json({
        success: true,
        data: {
          user: updatedUser,
        },
        message: "Profil mis à jour avec succès",
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
