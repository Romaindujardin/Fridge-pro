import type { FridgeItem } from "@/types";

/**
 * Nom affiché d'un aliment du frigo : le titre personnalisé (« Changer le titre »)
 * s'il existe, sinon le nom de l'ingrédient (partagé avec les recettes).
 */
export function getFridgeItemName(
  item?:
    | (Pick<FridgeItem, "ingredient"> & { customName?: string | null })
    | null
): string {
  if (!item) return "Aliment";
  const custom = item.customName?.trim();
  if (custom) return custom;
  return item.ingredient?.name || "Aliment";
}
