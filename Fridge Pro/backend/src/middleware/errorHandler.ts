// Middleware global pour capturer et formater les erreurs API.
import { Request, Response, NextFunction } from "express";

// Étend Error avec des métadonnées HTTP utiles aux contrôleurs.
export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Middleware Express standard à 4 arguments.
 * Formate la réponse JSON et loggue en développement.
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Erreur interne du serveur";

  // Log détaillé uniquement en dev pour éviter les fuites en prod
  if (process.env.NODE_ENV === "development") {
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

  // Structure de réponse homogène pour le frontend
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
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
