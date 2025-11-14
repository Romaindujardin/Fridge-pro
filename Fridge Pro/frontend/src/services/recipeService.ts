import api, { handleApiResponse, handleApiError } from "./api";
import type {
  Recipe,
  CreateRecipeRequest,
  FavoriteRecipe,
  GenerateRecipeAIRequest,
} from "@/types";

export const recipeService = {
  // Récupérer toutes les recettes
  async getRecipes(params?: {
    search?: string;
    difficulty?: string;
    makeable?: boolean;
    favorites?: boolean;
  }): Promise<Recipe[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append("search", params.search);
      if (params?.difficulty)
        queryParams.append("difficulty", params.difficulty);
      if (params?.makeable) queryParams.append("makeable", "true");
      if (params?.favorites) queryParams.append("favorites", "true");

      const url = queryParams.toString()
        ? `/recipes?${queryParams}`
        : "/recipes";
      const response = await api.get(url);
      const data = handleApiResponse<{ recipes: Recipe[] }>(response);
      return data.recipes;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Récupérer une recette par ID
  async getRecipe(id: string): Promise<Recipe> {
    try {
      const response = await api.get(`/recipes/${id}`);
      const data = handleApiResponse<{ recipe: Recipe }>(response);
      return data.recipe;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Créer une nouvelle recette
  async createRecipe(recipe: CreateRecipeRequest): Promise<Recipe> {
    try {
      const response = await api.post("/recipes", recipe);
      const data = handleApiResponse<{ recipe: Recipe }>(response);
      return data.recipe;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Mettre à jour une recette
  async updateRecipe(
    id: string,
    updates: Partial<CreateRecipeRequest>
  ): Promise<Recipe> {
    try {
      const response = await api.put(`/recipes/${id}`, updates);
      const data = handleApiResponse<{ recipe: Recipe }>(response);
      return data.recipe;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Supprimer une recette
  async deleteRecipe(id: string): Promise<void> {
    try {
      const response = await api.delete(`/recipes/${id}`);
      return handleApiResponse<void>(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Récupérer les recettes suggérées basées sur les ingrédients disponibles
  async getSuggestedRecipes(): Promise<Recipe[]> {
    try {
      const response = await api.get("/recipes/suggestions");
      const data = handleApiResponse<{ suggestions: Recipe[] }>(response);
      return data.suggestions;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Ajouter/retirer une recette des favoris
  async toggleFavorite(recipeId: string): Promise<{ isFavorite: boolean }> {
    try {
      const response = await api.post(`/recipes/${recipeId}/favorite`);
      const data = handleApiResponse<{ isFavorite: boolean }>(response);
      return data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Retirer une recette des favoris
  async removeFavorite(recipeId: string): Promise<{ isFavorite: boolean }> {
    try {
      const response = await api.delete(`/recipes/${recipeId}/favorite`);
      const data = handleApiResponse<{ isFavorite: boolean }>(response);
      return data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Récupérer les recettes favorites
  async getFavoriteRecipes(): Promise<FavoriteRecipe[]> {
    try {
      const response = await api.get("/recipes/favorites");
      const data = handleApiResponse<{ favorites: FavoriteRecipe[] }>(response);
      return data.favorites;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async generateRecipeWithAI(
    payload: GenerateRecipeAIRequest
  ): Promise<Recipe> {
    try {
      const response = await api.post("/ai/generate-recipe", payload);
      const data = handleApiResponse<{ recipe: Recipe }>(response);
      return data.recipe;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
