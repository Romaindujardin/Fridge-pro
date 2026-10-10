import { FridgeItem } from "@/types";

/**
 * Détecte si un aliment est dans une catégorie surgelés / congélation
 * ou porte une mention de congélation dans son nom ou ses notes.
 * Les aliments surgelés ne sont plus périssables à court terme.
 */
export function isItemFrozen(
  item?: {
    ingredient?: {
      name?: string;
      category?: { name?: string } | null;
    } | null;
    notes?: string | null;
  } | null
): boolean {
  if (!item) return false;

  const catName = (item.ingredient?.category?.name || "").toLowerCase();
  const itemName = (item.ingredient?.name || "").toLowerCase();
  const notes = (item.notes || "").toLowerCase();

  return (
    catName.includes("surgele") ||
    catName.includes("surgelé") ||
    catName.includes("congel") ||
    itemName.includes("surgelé") ||
    itemName.includes("surgele") ||
    itemName.includes("congelé") ||
    itemName.includes("congele") ||
    notes.includes("congel")
  );
}
