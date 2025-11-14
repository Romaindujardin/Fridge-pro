import api, { handleApiResponse, handleApiError } from "./api";
import type {
  FridgeItem,
  AddFridgeItemRequest,
  Ingredient,
  ExtractReceiptResponse,
} from "@/types";

export const fridgeService = {
  // Récupérer tous les éléments du frigo
  async getFridgeItems(): Promise<FridgeItem[]> {
    try {
      const response = await api.get("/fridge");
      const data = handleApiResponse<{ fridgeItems: FridgeItem[] }>(response);
      return data.fridgeItems;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Ajouter un élément au frigo
  async addFridgeItem(item: AddFridgeItemRequest): Promise<FridgeItem> {
    try {
      const response = await api.post("/fridge", item);
      const data = handleApiResponse<{ fridgeItem: FridgeItem }>(response);
      return data.fridgeItem;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Mettre à jour un élément du frigo
  async updateFridgeItem(
    id: string,
    updates: Partial<AddFridgeItemRequest>
  ): Promise<FridgeItem> {
    try {
      const response = await api.put(`/fridge/${id}`, updates);
      const data = handleApiResponse<{ fridgeItem: FridgeItem }>(response);
      return data.fridgeItem;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Supprimer un élément du frigo
  async deleteFridgeItem(id: string): Promise<void> {
    try {
      const response = await api.delete(`/fridge/${id}`);
      return handleApiResponse<void>(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Récupérer tous les ingrédients disponibles
  async getIngredients(): Promise<Ingredient[]> {
    try {
      const response = await api.get("/ingredients");
      const data = handleApiResponse<{ ingredients: Ingredient[] }>(response);
      return data.ingredients;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Rechercher des ingrédients
  async searchIngredients(query: string): Promise<Ingredient[]> {
    try {
      const response = await api.get(
        `/ingredients/search?q=${encodeURIComponent(query)}`
      );
      const data = handleApiResponse<{ ingredients: Ingredient[] }>(response);
      return data.ingredients;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Créer un nouvel ingrédient
  async createIngredient(ingredient: {
    name: string;
    categoryId?: string;
  }): Promise<Ingredient> {
    try {
      const response = await api.post("/ingredients", ingredient);
      const data = handleApiResponse<{ ingredient: Ingredient }>(response);
      return data.ingredient;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async scanReceipt(file: File): Promise<ExtractReceiptResponse> {
    try {
      const formData = new FormData();
      formData.append("receipt", file);

      const response = await api.post("/ai/extract-receipt", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return handleApiResponse<ExtractReceiptResponse>(response);
    } catch (error) {
      return handleApiError(error);
    }
  },
};
