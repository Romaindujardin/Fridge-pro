import api, { handleApiResponse, handleApiError } from "./api";
import type {
  FridgeItem,
  AddFridgeItemRequest,
  Ingredient,
  ExtractReceiptResponse,
  GetHistoryResponse,
  PurchaseHistoryItem,
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
      const cleanItem: AddFridgeItemRequest = {
        ingredientId: String(item.ingredientId),
        itemCount: typeof item.itemCount === "number" ? item.itemCount : 1,
        initialItemCount: typeof item.initialItemCount === "number" ? item.initialItemCount : undefined,
        quantity: typeof item.quantity === "number" ? item.quantity : 1,
        initialQuantity: typeof item.initialQuantity === "number" ? item.initialQuantity : undefined,
        unit: String(item.unit || "pièce"),
        brand: typeof item.brand === "string" && item.brand.trim() ? item.brand.trim() : undefined,
        price: typeof item.price === "number" ? item.price : undefined,
        categoryId: typeof item.categoryId === "string" && item.categoryId.trim() ? item.categoryId.trim() : undefined,
        expiryDate: typeof item.expiryDate === "string" && item.expiryDate.trim() ? item.expiryDate.trim() : undefined,
        notes: typeof item.notes === "string" && item.notes.trim() ? item.notes.trim() : undefined,
      };
      const response = await api.post("/fridge", cleanItem);
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

  // Marquer un élément comme fini / consommé ou périmé
  async finishFridgeItem(
    id: string,
    options?: {
      status?: "consumed" | "expired";
      price?: number;
      quantity?: number;
      itemCount?: number;
      finishAll?: boolean;
      notes?: string;
    }
  ): Promise<{ historyItem: PurchaseHistoryItem; finishedAll: boolean }> {
    try {
      const response = await api.post(`/fridge/${id}/finish`, options || {});
      return handleApiResponse<{ historyItem: PurchaseHistoryItem; finishedAll: boolean }>(response);
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

  // Récupérer l'historique des achats / consommations avec KPI
  async getHistory(params?: {
    search?: string;
    status?: "consumed" | "expired";
    page?: number;
    limit?: number;
  }): Promise<GetHistoryResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set("search", params.search);
      if (params?.status) queryParams.set("status", params.status);
      if (params?.page) queryParams.set("page", String(params.page));
      if (params?.limit) queryParams.set("limit", String(params.limit));

      const url = `/fridge/history${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await api.get(url);
      return handleApiResponse<GetHistoryResponse>(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Supprimer une entrée d'historique
  async deleteHistoryItem(id: string): Promise<void> {
    try {
      const response = await api.delete(`/fridge/history/${id}`);
      return handleApiResponse<void>(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Racheter / réinsérer un aliment de l'historique dans le frigo ou la liste de courses
  async reAddFromHistory(
    id: string,
    destination: "fridge" | "shopping" = "fridge"
  ): Promise<{ message: string; fridgeItem?: FridgeItem }> {
    try {
      const response = await api.post(`/fridge/history/${id}/re-add`, {
        destination,
      });
      return handleApiResponse<{ message: string; fridgeItem?: FridgeItem }>(response);
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
      const cleanIngredient = {
        name: typeof ingredient.name === "string" ? ingredient.name.trim() : String(ingredient.name || "").trim(),
        categoryId:
          typeof ingredient.categoryId === "string" && ingredient.categoryId.trim()
            ? ingredient.categoryId.trim()
            : undefined,
      };
      const response = await api.post("/ingredients", cleanIngredient);
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

  // Récupérer toutes les catégories
  async getCategories(): Promise<any[]> {
    try {
      const response = await api.get("/categories");
      const data = handleApiResponse<{ categories: any[] }>(response);
      return data.categories;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Créer une nouvelle catégorie
  async createCategory(category: { name: string; color?: string; icon?: string }): Promise<any> {
    try {
      const response = await api.post("/categories", category);
      const data = handleApiResponse<{ category: any }>(response);
      return data.category;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Supprimer une catégorie
  async deleteCategory(id: string): Promise<void> {
    try {
      const response = await api.delete(`/categories/${id}`);
      return handleApiResponse<void>(response);
    } catch (error) {
      return handleApiError(error);
    }
  },
};
