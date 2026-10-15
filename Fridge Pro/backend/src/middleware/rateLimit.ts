// Limiteur de débit simple, en mémoire (par instance de serveur).
// Objectif : freiner les attaques par force brute et l'abus des endpoints coûteux (IA).
// Note : en déploiement multi-instances, chaque instance possède son propre compteur ;
// c'est suffisant comme première barrière sans dépendance supplémentaire.

import { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  /** Durée de la fenêtre en millisecondes. */
  windowMs: number;
  /** Nombre maximal de requêtes autorisées par fenêtre et par clé. */
  max: number;
  /** Message renvoyé en cas de dépassement. */
  message?: string;
  /** Fonction de clé personnalisée (par défaut : adresse IP). */
  keyGenerator?: (req: Request) => string;
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = "Trop de requêtes. Veuillez réessayer dans quelques instants.",
    keyGenerator,
  } = options;

  const buckets = new Map<string, Bucket>();

  // Nettoyage périodique pour éviter la croissance mémoire (unref : ne bloque pas l'arrêt du process).
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.min(windowMs, 60_000));
  cleanup.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || "unknown";
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    return next();
  };
}
