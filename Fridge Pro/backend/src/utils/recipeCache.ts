import { PrismaClient } from "@prisma/client";
import { ItemWithPrice } from "./costEstimator";

const prisma = new PrismaClient();

// Cache pour les recettes de base (partagées entre utilisateurs)
interface CachedRecipes {
  data: any[];
  timestamp: number;
}
let cachedRecipes: CachedRecipes | null = null;
const RECIPES_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateRecipeCache() {
  cachedRecipes = null;
}

export async function getCachedBaseRecipes(): Promise<any[]> {
  const now = Date.now();
  if (cachedRecipes && now - cachedRecipes.timestamp < RECIPES_TTL) {
    return cachedRecipes.data;
  }

  const recipes = await prisma.recipe.findMany({
    include: {
      ingredients: {
        include: {
          ingredient: {
            include: {
              category: true,
            },
          },
        },
      },
      createdBy: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  cachedRecipes = {
    data: recipes,
    timestamp: now,
  };
  return recipes;
}

// Cache pour l'inventaire et les prix d'un utilisateur (évite de réinterroger la DB sur chaque vue de recette)
interface UserInventoryCache {
  userFridgeItems: any[];
  pricedItems: ItemWithPrice[];
  favoriteIds: Set<string>;
  timestamp: number;
}
const userInventoryCacheMap = new Map<string, UserInventoryCache>();
const USER_INVENTORY_TTL = 30 * 1000; // 30 secondes

export function invalidateUserInventory(userId?: string) {
  if (userId) {
    userInventoryCacheMap.delete(userId);
  } else {
    userInventoryCacheMap.clear();
  }
}

export async function getCachedUserInventory(userId: string): Promise<{
  userFridgeItems: any[];
  pricedItems: ItemWithPrice[];
  favoriteIds: Set<string>;
}> {
  const now = Date.now();
  const cached = userInventoryCacheMap.get(userId);
  if (cached && now - cached.timestamp < USER_INVENTORY_TTL) {
    return {
      userFridgeItems: cached.userFridgeItems,
      pricedItems: cached.pricedItems,
      favoriteIds: cached.favoriteIds,
    };
  }

  const [fridgeItems, historyItems, favorites] = await Promise.all([
    prisma.fridgeItem.findMany({
      where: { userId },
      include: { ingredient: true },
    }),
    prisma.purchaseHistory.findMany({
      where: { userId, price: { gt: 0 } },
      select: {
        ingredientId: true,
        quantity: true,
        unit: true,
        price: true,
        brand: true,
        ingredient: { select: { id: true, name: true } },
      },
      orderBy: { finishedDate: "desc" },
    }),
    prisma.favoriteRecipe.findMany({
      where: { userId },
      select: { recipeId: true },
    }),
  ]);

  const pricedItems: ItemWithPrice[] = [
    ...fridgeItems.map((f) => ({
      ingredientId: f.ingredientId,
      quantity: f.quantity,
      unit: f.unit,
      price: f.price,
      brand: f.brand,
      ingredient: f.ingredient,
    })),
    ...historyItems.map((h) => ({
      ingredientId: h.ingredientId,
      quantity: h.quantity,
      unit: h.unit,
      price: h.price,
      brand: h.brand,
      ingredient: h.ingredient,
    })),
  ];

  const favoriteIds = new Set(favorites.map((fav) => fav.recipeId));

  const result = {
    userFridgeItems: fridgeItems,
    pricedItems,
    favoriteIds,
    timestamp: now,
  };

  userInventoryCacheMap.set(userId, result);
  return {
    userFridgeItems: result.userFridgeItems,
    pricedItems: result.pricedItems,
    favoriteIds: result.favoriteIds,
  };
}
