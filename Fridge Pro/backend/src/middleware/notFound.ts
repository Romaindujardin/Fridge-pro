// Middleware catch-all pour les routes inexistantes.
import { Request, Response, NextFunction } from "express";
import { createApiError } from "./errorHandler";

// Crée une erreur 404 standardisée et la transmet au handler global.
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = createApiError(`Route non trouvée: ${req.originalUrl}`, 404);
  next(error);
};
