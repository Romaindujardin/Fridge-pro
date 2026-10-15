// Accès centralisé et validé aux variables d'environnement sensibles.
// Aucune valeur par défaut secrète n'est tolérée : mieux vaut un échec au démarrage
// qu'un secret prévisible en production.

/**
 * Retourne le secret de signature des JWT.
 * Lève une erreur explicite si la variable est absente : un fallback silencieux
 * ("your-secret-key") rendrait tous les tokens falsifiables.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "JWT_SECRET est manquant. Définissez une variable d'environnement JWT_SECRET " +
        "(chaîne aléatoire de 32+ caractères). Aucun secret par défaut n'est autorisé.",
    );
  }
  return secret;
}

/**
 * Convertit une taille exprimée en octets ("10485760") ou en unités
 * lisibles ("10mb", "1.5 GB", "500kb") en nombre d'octets.
 * Retourne `fallback` si la valeur est absente ou invalide.
 */
export function parseFileSize(
  value: string | number | undefined,
  fallback: number,
): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(b|kb|mb|gb)?$/);
    if (match) {
      const amount = parseFloat(match[1].replace(",", "."));
      const multipliers: Record<string, number> = {
        b: 1,
        kb: 1024,
        mb: 1024 * 1024,
        gb: 1024 * 1024 * 1024,
      };
      const multiplier = multipliers[match[2] || "b"] ?? 1;
      const bytes = Math.floor(amount * multiplier);
      if (Number.isFinite(bytes) && bytes > 0) {
        return bytes;
      }
    }
  }

  return fallback;
}
