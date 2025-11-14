// ici on vérifie si l'utilisateur est authentifié

// Middleware d'authentification JWT appliqué sur les routes protégées.
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Étend la requête Express pour attacher l'utilisateur authentifié.
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Vérifie l'en-tête Authorization, valide le token JWT
 * et injecte l'utilisateur Prisma dans la requête.
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Format attendu: "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token d'accès manquant",
      });
    }

    // Vérifier le token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as { userId: string };

    // Récupérer l'utilisateur correspondant en base
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Token invalide",
      });
    }

    // Ajouter l'utilisateur à la requête pour les middlewares/controllers suivants
    req.userId = user.id;
    req.user = user;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: "Token invalide",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Erreur d'authentification",
    });
  }
};
