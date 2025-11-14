import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  Plus,
  ShoppingCart,
  Check,
  X,
  Edit3,
  Trash2,
  Calendar,
  Package,
  ChefHat,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { shoppingListService } from "@/services/shoppingListService";
import { fridgeService } from "@/services/fridgeService";
import type {
  ShoppingList,
  CreateShoppingListRequest,
  AddShoppingListItemRequest,
  Ingredient,
} from "@/types";

// Schémas de validation
const createListSchema = z.object({
  name: z.string().min(1, "Le nom de la liste est requis"),
});

const addItemSchema = z.object({
  ingredientId: z.string().min(1, "Veuillez sélectionner un ingrédient"),
  quantity: z.number().min(0.1, "La quantité doit être supérieure à 0"),
  unit: z.string().min(1, "Veuillez spécifier une unité"),
  notes: z.string().optional(),
});

type CreateListForm = z.infer<typeof createListSchema>;
type AddItemForm = z.infer<typeof addItemSchema>;

export function ShoppingListPage() {
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientInputValue, setIngredientInputValue] = useState("");
  const queryClient = useQueryClient();

  // Récupérer les listes de courses
  const { data: shoppingLists = [], isLoading } = useQuery({
    queryKey: ["shoppingLists"],
    queryFn: shoppingListService.getShoppingLists,
  });

  // Récupérer les ingrédients pour le formulaire
  const { data: ingredients = [] } = useQuery({
    queryKey: ["ingredients", ingredientSearch],
    queryFn: () =>
      ingredientSearch
        ? fridgeService.searchIngredients(ingredientSearch)
        : fridgeService.getIngredients(),
    enabled: !!ingredientSearch || isAddItemModalOpen,
  });

  // Mutations
  const createListMutation = useMutation({
    mutationFn: shoppingListService.createShoppingList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingLists"] });
      toast.success("Liste créée !");
      setIsCreateListModalOpen(false);
      createListForm.reset();
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: shoppingListService.deleteShoppingList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingLists"] });
      toast.success("Liste supprimée !");
    },
  });

  const addItemMutation = useMutation({
    mutationFn: ({
      listId,
      item,
    }: {
      listId: string;
      item: AddShoppingListItemRequest;
    }) => shoppingListService.addItemToShoppingList(listId, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingLists"] });
      toast.success("Article ajouté !");
      setIsAddItemModalOpen(false);
      addItemForm.reset();
      setIngredientInputValue("");
      setIngredientSearch("");
      setSelectedList(null);
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: ({
      listId,
      itemId,
      purchased,
    }: {
      listId: string;
      itemId: string;
      purchased: boolean;
    }) => shoppingListService.toggleItemPurchased(listId, itemId, purchased),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingLists"] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      shoppingListService.deleteShoppingListItem(listId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingLists"] });
      toast.success("Article supprimé !");
    },
  });

  // Formulaires
  const createListForm = useForm<CreateListForm>({
    resolver: zodResolver(createListSchema),
    defaultValues: { name: "" },
  });

  const addItemForm = useForm<AddItemForm>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      ingredientId: "",
      quantity: 1,
      unit: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!isAddItemModalOpen) {
      setIngredientInputValue("");
      setIngredientSearch("");
      addItemForm.reset();
    }
  }, [isAddItemModalOpen, addItemForm]);

  // Gestionnaires d'événements
  const handleCreateList = (data: CreateListForm) => {
    createListMutation.mutate(data);
  };

  const handleDeleteList = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette liste ?")) {
      deleteListMutation.mutate(id);
    }
  };

  const handleAddItem = (data: AddItemForm) => {
    if (!selectedList) return;

    const itemData: AddShoppingListItemRequest = {
      ingredientId: data.ingredientId,
      quantity: data.quantity,
      unit: data.unit,
      notes: data.notes || undefined,
    };

    addItemMutation.mutate({ listId: selectedList.id, item: itemData });
  };

  const handleIngredientSelection = async (ingredient: Ingredient) => {
    try {
      let selected = ingredient;

      if (ingredient.id.startsWith("off_")) {
        const created = await fridgeService.createIngredient({
          name: ingredient.name,
          categoryId:
            ingredient.category && ingredient.category.id !== "external"
              ? ingredient.category.id
              : undefined,
        });
        selected = created;
      }

      addItemForm.setValue("ingredientId", selected.id, {
        shouldValidate: true,
      });
      addItemForm.clearErrors("ingredientId");
      setIngredientInputValue(selected.name);
      setIngredientSearch("");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Impossible de sélectionner cet ingrédient"
      );
    }
  };

  const handleToggleItem = (
    listId: string,
    itemId: string,
    purchased: boolean
  ) => {
    toggleItemMutation.mutate({ listId, itemId, purchased: !purchased });
  };

  const handleDeleteItem = (listId: string, itemId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet article ?")) {
      deleteItemMutation.mutate({ listId, itemId });
    }
  };

  // Calculer les statistiques
  const totalItems = shoppingLists.reduce(
    (acc, list) => acc + list.items.length,
    0
  );
  const purchasedItems = shoppingLists.reduce(
    (acc, list) => acc + list.items.filter((item) => item.purchased).length,
    0
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Liste de courses</h1>
          <p className="text-gray-600">
            Organisez vos achats et ne manquez plus d'ingrédients
          </p>
        </div>

        <Button
          onClick={() => setIsCreateListModalOpen(true)}
          className="flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle liste
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-lg p-3">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {shoppingLists.length}
                </h3>
                <p className="text-sm text-gray-600">Listes actives</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="bg-orange-100 rounded-lg p-3">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {totalItems}
                </h3>
                <p className="text-sm text-gray-600">Articles total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-lg p-3">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {purchasedItems}
                </h3>
                <p className="text-sm text-gray-600">Articles achetés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Listes de courses */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : shoppingLists.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <ShoppingCart className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune liste de courses
            </h3>
            <p className="text-gray-500 mb-6">
              Créez votre première liste pour commencer à organiser vos achats
            </p>
            <Button onClick={() => setIsCreateListModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Créer ma première liste
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {shoppingLists.map((list) => {
            const completedItems = list.items.filter(
              (item) => item.purchased
            ).length;
            const totalListItems = list.items.length;
            const completionRate =
              totalListItems > 0 ? (completedItems / totalListItems) * 100 : 0;

            return (
              <Card key={list.id} hover>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{list.name}</CardTitle>
                      <p className="text-sm text-gray-500">
                        Créée le{" "}
                        {new Date(list.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedList(list);
                          addItemForm.reset();
                          setIngredientInputValue("");
                          setIngredientSearch("");
                          setIsAddItemModalOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteList(list.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Progression */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progression</span>
                      <span>
                        {completedItems}/{totalListItems}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${completionRate}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Articles */}
                  {list.items.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Liste vide</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {list.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            item.purchased
                              ? "bg-green-50 border-green-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() =>
                                handleToggleItem(
                                  list.id,
                                  item.id,
                                  item.purchased
                                )
                              }
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                item.purchased
                                  ? "bg-green-600 border-green-600 text-white"
                                  : "border-gray-300 hover:border-green-600"
                              }`}
                            >
                              {item.purchased && <Check className="w-3 h-3" />}
                            </button>

                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {item.ingredient.category?.icon || "🥬"}
                              </span>
                              <div>
                                <div
                                  className={`font-medium ${
                                    item.purchased
                                      ? "line-through text-gray-500"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {item.ingredient.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {item.quantity} {item.unit}
                                  {item.notes && ` • ${item.notes}`}
                                </div>
                              </div>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteItem(list.id, item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal création de liste */}
      <Modal
        isOpen={isCreateListModalOpen}
        onClose={() => {
          setIsCreateListModalOpen(false);
          createListForm.reset();
        }}
        title="Créer une nouvelle liste"
        size="sm"
      >
        <form
          onSubmit={createListForm.handleSubmit(handleCreateList)}
          className="space-y-4"
        >
          <Input
            label="Nom de la liste"
            placeholder="Ma liste de courses"
            error={createListForm.formState.errors.name?.message}
            {...createListForm.register("name")}
          />

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateListModalOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" loading={createListMutation.isPending}>
              Créer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal ajout d'article */}
      <Modal
        isOpen={isAddItemModalOpen}
        onClose={() => {
          setIsAddItemModalOpen(false);
          setSelectedList(null);
          addItemForm.reset();
          setIngredientInputValue("");
          setIngredientSearch("");
        }}
        title={`Ajouter un article à "${selectedList?.name}"`}
        size="md"
      >
        <form
          onSubmit={addItemForm.handleSubmit(handleAddItem)}
          className="space-y-6"
        >
          {/* Sélection de l'ingrédient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ingrédient
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher un ingrédient..."
                value={ingredientInputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setIngredientInputValue(value);
                  setIngredientSearch(value);

                  if (addItemForm.getValues("ingredientId")) {
                    addItemForm.setValue("ingredientId", "");
                  }
                  addItemForm.clearErrors("ingredientId");
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              {ingredients.length > 0 && ingredientSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {ingredients.map((ingredient) => (
                    <button
                      key={ingredient.id}
                      type="button"
                      onClick={() => {
                        handleIngredientSelection(ingredient);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-3"
                    >
                      <span className="text-lg">
                        {ingredient.category?.icon || "🥬"}
                      </span>
                      <div>
                        <div className="font-medium">{ingredient.name}</div>
                        <div className="text-sm text-gray-500">
                          {ingredient.category?.name}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {addItemForm.formState.errors.ingredientId && (
              <p className="mt-1 text-sm text-red-600">
                {addItemForm.formState.errors.ingredientId.message}
              </p>
            )}
          </div>

          {/* Quantité et unité */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantité"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="1"
              error={addItemForm.formState.errors.quantity?.message}
              {...addItemForm.register("quantity", { valueAsNumber: true })}
            />
            <Input
              label="Unité"
              placeholder="kg, g, pièce..."
              error={addItemForm.formState.errors.unit?.message}
              {...addItemForm.register("unit")}
            />
          </div>

          {/* Notes */}
          <Input
            label="Notes (optionnel)"
            placeholder="Marque préférée, magasin spécifique..."
            error={addItemForm.formState.errors.notes?.message}
            {...addItemForm.register("notes")}
          />

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddItemModalOpen(false);
                setSelectedList(null);
                addItemForm.reset();
              }}
            >
              Annuler
            </Button>
            <Button type="submit" loading={addItemMutation.isPending}>
              Ajouter
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
