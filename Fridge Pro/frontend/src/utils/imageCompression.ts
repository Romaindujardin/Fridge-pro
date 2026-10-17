/**
 * Compresse une photo (ticket de caisse) avant de la stocker dans l'historique :
 * redimensionnée à `maxSide` px maximum et encodée en JPEG pour rester légère.
 * En cas d'échec (format non supporté...), le fichier d'origine est renvoyé.
 */
export async function compressImageForStorage(
  file: File,
  maxSide = 1800,
  quality = 0.75
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    return blob ?? file;
  } catch {
    return file;
  }
}
