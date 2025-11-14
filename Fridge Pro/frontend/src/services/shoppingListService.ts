import api, { handleApiResponse, handleApiError } from "./api";
import type {
  ShoppingList,
  CreateShoppingListRequest,
  AddShoppingListItemRequest,
  ShoppingListItem,
} from "@/types";

export const shoppingListService = {
  // Récupérer toutes les listes de courses
  async getShoppingLists(): Promise<ShoppingList[]> {
    try {
      const response = await api.get("/shopping-lists");
      const data = handleApiResponse<{ shoppingLists: ShoppingList[] }>(
        response
      );
      return data.shoppingLists;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Récupérer une liste de courses par ID
  async getShoppingList(id: string): Promise<ShoppingList> {
    try {
      const response = await api.get(`/shopping-lists/${id}`);
      const data = handleApiResponse<{ shoppingList: ShoppingList }>(response);
      return data.shoppingList;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Créer une nouvelle liste de courses
  async createShoppingList(
    data: CreateShoppingListRequest
  ): Promise<ShoppingList> {
    try {
      const response = await api.post("/shopping-lists", data);
      const payload = handleApiResponse<{ shoppingList: ShoppingList }>(
        response
      );
      return payload.shoppingList;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Supprimer une liste de courses
  async deleteShoppingList(id: string): Promise<void> {
    try {
      const response = await api.delete(`/shopping-lists/${id}`);
      return handleApiResponse<void>(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Ajouter un élément à une liste de courses
  async addItemToShoppingList(
    listId: string,
    item: AddShoppingListItemRequest
  ): Promise<ShoppingListItem> {
    try {
      const response = await api.post(`/shopping-lists/${listId}/items`, item);
      const data = handleApiResponse<{ item: ShoppingListItem }>(response);
      return data.item;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Mettre à jour un élément de liste de courses
  async updateShoppingListItem(
    listId: string,
    itemId: string,
    updates: Partial<AddShoppingListItemRequest & { purchased: boolean }>
  ): Promise<ShoppingListItem> {
    try {
      const response = await api.put(
        `/shopping-lists/${listId}/items/${itemId}`,
        updates
      );
      const data = handleApiResponse<{ item: ShoppingListItem }>(response);
      return data.item;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Supprimer un élément de liste de courses
  async deleteShoppingListItem(listId: string, itemId: string): Promise<void> {
    try {
      const response = await api.delete(
        `/shopping-lists/${listId}/items/${itemId}`
      );
      return handleApiResponse<void>(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Marquer un élément comme acheté/non acheté
  async toggleItemPurchased(
    listId: string,
    itemId: string,
    purchased: boolean
  ): Promise<ShoppingListItem> {
    try {
      const response = await api.patch(
        `/shopping-lists/${listId}/items/${itemId}`,
        { purchased }
      );
      const data = handleApiResponse<{ item: ShoppingListItem }>(response);
      return data.item;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Générer une liste de courses à partir d'une recette
  async generateFromRecipe(
    recipeId: string,
    listName?: string
  ): Promise<ShoppingList> {
    try {
      const response = await api.post("/shopping-lists/generate-from-recipe", {
        recipeId,
        listName: listName || `Liste pour recette`,
      });
      return handleApiResponse<ShoppingList>(response);
    } catch (error) {
      return handleApiError(error);
    }
  },
};
