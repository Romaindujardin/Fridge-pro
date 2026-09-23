// Types utilisateur
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  geminiApiKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Types catégories et ingrédients
export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  _count?: {
    ingredients: number;
  };
}

export interface CreateCategoryRequest {
  name: string;
  color?: string;
  icon?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  brand?: string;
  packageQuantity?: string;
  detectedQuantity?: number;
  detectedUnit?: string;
  categoryId?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  category?: Category;
}

// Types frigo
export interface FridgeItem {
  id: string;
  userId: string;
  ingredientId: string;
  itemCount?: number;
  initialItemCount?: number | null;
  quantity: number;
  initialQuantity?: number | null;
  unit: string;
  brand?: string;
  price?: number | null;
  expiryDate?: string;
  addedDate: string;
  notes?: string;
  ingredient: Ingredient;
}

export interface AddFridgeItemRequest {
  ingredientId: string;
  itemCount?: number;
  initialItemCount?: number;
  quantity: number;
  initialQuantity?: number;
  unit: string;
  brand?: string;
  price?: number;
  categoryId?: string;
  expiryDate?: string;
  notes?: string;
}

// Types historique d'achat & consommation
export interface PurchaseHistoryItem {
  id: string;
  userId: string;
  ingredientId: string;
  itemCount?: number | null;
  quantity: number;
  unit: string;
  brand?: string | null;
  price?: number | null;
  status: "consumed" | "expired";
  boughtDate: string;
  finishedDate?: string | null;
  notes?: string | null;
  ingredient: Ingredient;
}

export interface HistoryStats {
  totalSpent: number;
  spentThisMonth: number;
  consumedCount: number;
  expiredCount: number;
  totalItems: number;
  averagePrice: number;
}

export interface GetHistoryResponse {
  items: PurchaseHistoryItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: HistoryStats;
}

// Types recettes
export interface Recipe {
  id: string;
  title: string;
  description?: string;
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings: number;
  difficulty: "easy" | "medium" | "hard";
  imageUrl?: string;
  source?: string;
  createdById?: string;
  createdBy?: {
    firstName: string;
    lastName?: string;
  };
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredient[];
  isFavorite?: boolean;
  canMake?: boolean;
  missingIngredients?: number;
  compatibilityScore?: number;
  missingIngredientsCount?: number;
  estimatedCost?: number | null;
  costPerServing?: number | null;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string;
  ingredient: Ingredient;
  available?: boolean;
  estimatedPrice?: number | null;
}

export interface CreateRecipeRequest {
  title: string;
  description?: string;
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings: number;
  difficulty: "easy" | "medium" | "hard";
  ingredients: {
    ingredientId?: string;
    ingredientName?: string;
    quantity: number;
    unit: string;
    notes?: string;
  }[];
}

// Types favoris
export interface FavoriteRecipe {
  id: string;
  userId: string;
  recipeId: string;
  addedAt: string;
  recipe: Recipe;
}

// Types listes de courses
export interface ShoppingList {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: ShoppingListItem[];
}

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  purchased: boolean;
  notes?: string;
  ingredient: Ingredient;
}

export interface CreateShoppingListRequest {
  name: string;
}

export interface AddShoppingListItemRequest {
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

// Types IA
export interface ExtractReceiptRequest {
  image: File;
}

export interface ExtractReceiptResponse {
  items: FridgeItem[];
  addedCount: number;
  message: string;
}

export interface GenerateRecipeAIRequest {
  prompt: string;
  useFridge?: boolean;
}

export interface GenerateRecipeAIResponse {
  recipe: Recipe;
}

// Types API
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
}

// Types dashboard
export interface DashboardStats {
  fridgeItemsCount: number;
  recipesCount: number;
  favoritesCount: number;
  shoppingListItemsCount: number;
  suggestedRecipes: Recipe[];
}
