import { findMatchingItem, FridgeItemForMatching } from "./ingredientMatcher";

export interface ItemWithPrice extends FridgeItemForMatching {
  quantity: number;
  unit: string;
  price?: number | null;
  itemCount?: number | null;
}

export interface RecipeIngredientForCost {
  id?: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  ingredient: {
    id?: string;
    name: string;
  };
}

export interface EstimatedRecipeCost {
  totalCost: number; // Coût estimé total de la recette
  costPerServing: number; // Coût par personne
  hasPricing: boolean; // Si au moins un ingrédient a pu être chiffré
  ingredientCosts: Record<string, number | null>; // ingredientId -> coût calculé
}

function normalizeUnit(unit: string): string {
  const u = (unit || "").toLowerCase().trim();
  if (["g", "gr", "gramme", "grammes"].includes(u)) return "g";
  if (["kg", "kilo", "kilos", "kilogramme", "kilogrammes"].includes(u)) return "kg";
  if (["ml", "millilitre", "millilitres"].includes(u)) return "ml";
  if (["cl", "centilitre", "centilitres"].includes(u)) return "cl";
  if (["dl", "decilitre", "décilitre", "decilitres", "décilitres"].includes(u)) return "dl";
  if (["l", "litre", "litres"].includes(u)) return "l";
  if (["piece", "pieces", "pièce", "pièces", "unite", "unités", "unites"].includes(u)) return "piece";
  if (["tranche", "tranches"].includes(u)) return "tranche";
  if (["gousse", "gousses"].includes(u)) return "gousse";
  if (["sachet", "sachets"].includes(u)) return "sachet";
  if (["pot", "pots"].includes(u)) return "pot";
  if (["boite", "boites", "boîte", "boîtes"].includes(u)) return "boite";
  return u;
}

function convertToBaseUnit(
  qty: number,
  unit: string
): { baseQty: number; type: "weight" | "volume" | "count" | "other" } {
  const u = normalizeUnit(unit);
  if (u === "g") return { baseQty: qty, type: "weight" };
  if (u === "kg") return { baseQty: qty * 1000, type: "weight" };
  if (u === "ml") return { baseQty: qty, type: "volume" };
  if (u === "cl") return { baseQty: qty * 10, type: "volume" };
  if (u === "dl") return { baseQty: qty * 100, type: "volume" };
  if (u === "l") return { baseQty: qty * 1000, type: "volume" };
  if (u === "piece") return { baseQty: qty, type: "count" };
  return { baseQty: qty, type: "other" };
}

export function calculateIngredientCost(
  recipeQty: number,
  recipeUnit: string,
  stockQty: number,
  stockUnit: string,
  stockPrice: number
): number {
  if (stockQty <= 0 || stockPrice <= 0 || recipeQty <= 0) return 0;

  const recipeNorm = convertToBaseUnit(recipeQty, recipeUnit);
  const stockNorm = convertToBaseUnit(stockQty, stockUnit);

  if (recipeNorm.type === stockNorm.type && recipeNorm.type !== "other") {
    const costPerBase = stockPrice / stockNorm.baseQty;
    const cost = costPerBase * recipeNorm.baseQty;
    return Math.round(cost * 100) / 100;
  }

  // Si unités textuellement identiques (ex: "tranche" ↔ "tranche")
  if (normalizeUnit(recipeUnit) === normalizeUnit(stockUnit)) {
    const cost = (stockPrice / stockQty) * recipeQty;
    return Math.round(cost * 100) / 100;
  }

  // Fallback heuristique proportionnel raisonnable
  const ratio = Math.min(2, recipeQty / stockQty);
  const cost = stockPrice * (ratio > 0 ? ratio : 1);
  return Math.round(cost * 100) / 100;
}

export function estimateRecipeCost(
  ingredients: RecipeIngredientForCost[],
  servings: number = 4,
  userItemsWithPrice: ItemWithPrice[]
): EstimatedRecipeCost {
  let total = 0;
  let pricedCount = 0;
  const ingredientCosts: Record<string, number | null> = {};

  for (const ri of ingredients) {
    const match = findMatchingItem(
      ri.ingredientId,
      ri.ingredient?.name || "",
      userItemsWithPrice
    );

    if (match && match.price && match.price > 0 && match.quantity > 0) {
      const cost = calculateIngredientCost(
        ri.quantity,
        ri.unit,
        match.quantity,
        match.unit,
        match.price
      );
      ingredientCosts[ri.ingredientId] = cost;
      total += cost;
      pricedCount++;
    } else {
      ingredientCosts[ri.ingredientId] = null;
    }
  }

  const roundedTotal = Math.round(total * 100) / 100;
  const numServings = servings > 0 ? servings : 4;
  const costPerServing =
    roundedTotal > 0 ? Math.round((roundedTotal / numServings) * 100) / 100 : 0;

  return {
    totalCost: roundedTotal,
    costPerServing,
    hasPricing: pricedCount > 0,
    ingredientCosts,
  };
}
