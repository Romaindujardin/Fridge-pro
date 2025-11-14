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
  icon: string;
}

export interface Ingredient {
  id: string;
  name: string;
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
  quantity: number;
  unit: string;
  expiryDate?: string;
  addedDate: string;
  notes?: string;
  ingredient: Ingredient;
}

export interface AddFridgeItemRequest {
  ingredientId: string;
  quantity: number;
  unit: string;
  expiryDate?: string;
  notes?: string;
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
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredient[];
  isFavorite?: boolean;
  canMake?: boolean;
  missingIngredients?: number;
  compatibilityScore?: number;
  missingIngredientsCount?: number;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string;
  ingredient: Ingredient;
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
    ingredientId: string;
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
