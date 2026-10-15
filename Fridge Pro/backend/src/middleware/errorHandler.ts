// Middleware global pour capturer et formater les erreurs API.
import { Request, Response, NextFunction } from "express";
import multer from "multer";

// Étend Error avec des métadonnées HTTP utiles aux contrôleurs.
export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

const isProduction = process.env.NODE_ENV === "production";

// Messages de refus des fileFilter multer (upload de tickets / photos de recettes).
const REJECTED_UPLOAD_MESSAGES = [
  "Seuls les fichiers image sont autorisés.",
  "Seuls les fichiers image sont acceptés.",
];

/**
 * Middleware Express standard à 4 arguments.
 * Formate la réponse JSON, loggue en développement et n'expose jamais
 * les détails internes (stack, messages Prisma/SDK) en production.
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Erreur interne du serveur";

  // Erreurs multer (upload) : messages propres et codes HTTP adaptés.
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      statusCode = 413;
      message = "Fichier trop volumineux. Réduisez la taille de l'image et réessayez.";
    } else {
      statusCode = 400;
      message = `Fichier refusé (${err.code}).`;
    }
  } else if (REJECTED_UPLOAD_MESSAGES.includes(err.message)) {
    statusCode = 400;
    message = err.message;
  }

  // Log détaillé uniquement en dev pour éviter les fuites en prod
  if (!isProduction) {
    console.error("🚨 Erreur:", {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
    });
  }

  // En production, les erreurs serveur (5xx) ne révèlent jamais leur message interne.
  const isServerError = statusCode >= 500;
  const publicMessage =
    isProduction && isServerError ? "Erreur interne du serveur" : message;

  // Structure de réponse homogène pour le frontend
  res.status(statusCode).json({
    success: false,
    message: publicMessage,
    ...(!isProduction && { stack: err.stack }),
  });
};

// Helper pour générer des erreurs opérationnelles cohérentes.
export const createApiError = (
  message: string,
  statusCode: number
): ApiError => {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
