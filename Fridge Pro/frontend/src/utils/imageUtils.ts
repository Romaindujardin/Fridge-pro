/**
 * Utilitaires pour la gestion, compression et affichage des images dans Fridge Pro.
 */

/**
 * Compresse une image côté client (navigateur / mobile) via l'API Canvas HTML5.
 * Réduit les photos de smartphone (souvent de 5 à 12 Mo) à ~100-250 Ko
 * pour un chargement instantané et une compatibilité totale avec les bases de données Cloud (Neon/Vercel).
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcul des nouvelles dimensions proportionnelles
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Lissage de l'image
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Export en JPEG optimisé
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };

      img.onerror = () => {
        resolve(e.target?.result as string);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Formate l'URL d'une image pour l'affichage dans l'interface utilisateur.
 * Gère :
 * - Les Data URLs (base64) : affichage direct sans requête HTTP supplémentaire
 * - Les URLs externes absolues (http/https)
 * - Les anciennes URLs relatives (/uploads/...) redirigées vers le backend API
 */
export function formatImageUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Data URLs base64 ou URLs absolues
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  // Anciennes URLs relatives (/uploads/...) : les préfixer avec le domaine de l'API backend
  const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim();
  const apiBase = rawApiUrl.replace(/\/api\/?$/, "");
  if (apiBase) {
    const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${apiBase}${cleanPath}`;
  }

  return trimmed;
}
