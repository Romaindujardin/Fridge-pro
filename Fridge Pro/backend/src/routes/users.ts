// Routes liées au profil utilisateur (lecture / mise à jour).
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { getJwtSecret } from "../utils/security";

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
// La clé Gemini n'est JAMAIS renvoyée : seul un booléen indique si elle est configurée.
const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  geminiApiKey: true,
  createdAt: true,
  updatedAt: true,
};

// Retire la clé API de la réponse et la remplace par un simple indicateur.
function toPublicUser<T extends { geminiApiKey: string | null }>(user: T) {
  const { geminiApiKey, ...rest } = user;
  return { ...rest, hasGeminiKey: Boolean(geminiApiKey) };
}

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

      const activeFirstName = req.user?.firstName || user.firstName;

      return res.json({
        success: true,
        data: {
          user: {
            ...toPublicUser(user),
            firstName: activeFirstName,
            activeProfile: activeFirstName,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /users/switch-profile
 * Bascule instantanément le profil actif entre Romain et Sophie
 */
router.post(
  "/switch-profile",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { profileName } = req.body;
      const targetProfile =
        profileName?.toLowerCase() === "sophie" ? "Sophie" : "Romain";

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

      const newToken = jwt.sign(
        { userId: user.id, activeProfile: targetProfile },
        getJwtSecret(),
        { expiresIn: "30d" }
      );

      return res.json({
        success: true,
        data: {
          user: {
            ...toPublicUser(user),
            firstName: targetProfile,
            activeProfile: targetProfile,
          },
          token: newToken,
        },
        message: `Profil basculé sur ${targetProfile}`,
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

      // Sémantique de la clé Gemini :
      // - champ absent  -> la clé existante est conservée
      // - chaîne vide ou null -> la clé est supprimée
      // - valeur valide -> la clé est remplacée
      const updateData: {
        firstName: string;
        lastName: string;
        email: string;
        geminiApiKey?: string | null;
      } = {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
      };

      if (body.geminiApiKey !== undefined) {
        updateData.geminiApiKey = body.geminiApiKey?.trim()
          ? body.geminiApiKey.trim()
          : null;
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        select: userSelect,
      });

      const activeFirstName = req.user?.firstName || updatedUser.firstName;

      return res.json({
        success: true,
        data: {
          user: {
            ...toPublicUser(updatedUser),
            firstName: activeFirstName,
            activeProfile: activeFirstName,
          },
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
