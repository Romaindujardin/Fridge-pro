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
  Sparkles,
  DollarSign,
  Users,
  CheckCircle2,
  SlidersHorizontal,
  Search,
  History,
  Minus,
  Repeat,
  Ban,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { shoppingListService } from "@/services/shoppingListService";
import { fridgeService } from "@/services/fridgeService";
import { recipeService } from "@/services/recipeService";
import type {
  ShoppingList,
  CreateShoppingListRequest,
  AddShoppingListItemRequest,
  Ingredient,
  GenerateShoppingListAIRequest,
  GenerateShoppingListAIResponse,
} from "@/types";

// Convertit et normalise un nombre décimal (gère virgule et point)
const parseDecimalNumber = (val: unknown): number | unknown => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return undefined;
    const normalized = trimmed.replace(",", ".");
    if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(normalized)) {
      return val;
    }
    const num = parseFloat(normalized);
    return isNaN(num) ? val : num;
  }
  return val;
};

// Schémas de validation
const createListSchema = z.object({
  name: z.string().min(1, "Le nom de la liste est requis"),
});

const addItemSchema = z.object({
  ingredientId: z.string().optional(),
  name: z.string().optional(),
  quantity: z.preprocess(
    parseDecimalNumber,
    z.number({ invalid_type_error: "La quantité doit être un nombre valide" })
      .positive("La quantité doit être supérieure à 0")
  ),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

type CreateListForm = z.infer<typeof createListSchema>;
type AddItemForm = z.infer<typeof addItemSchema>;

const getRecipeCategoryBadge = (category?: string) => {
  switch (category) {
    case "petit-dejeuner":
      return {
        label: "Petit-déj",
        color: "bg-amber-100 text-amber-800 border-amber-200",
        icon: "🍳",
      };
    case "dessert":
      return {
        label: "Dessert",
        color: "bg-pink-100 text-pink-800 border-pink-200",
        icon: "🍰",
      };
    case "autre":
      return {
        label: "Autre",
        color: "bg-purple-100 text-purple-800 border-purple-200",
        icon: "🥨",
      };
    case "repas":
    default:
      return {
        label: "Repas",
        color: "bg-emerald-100 text-emerald-800 border-emerald-200",
        icon: "🍽️",
      };
  }
};

export function ShoppingListPage() {
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientInputValue, setIngredientInputValue] = useState("");
  const queryClient = useQueryClient();

  // Modale & options de génération IA
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [aiDaysCount, setAiDaysCount] = useState<number>(4);
  const [aiDessertsCount, setAiDessertsCount] = useState<number>(0);
  const [aiServings, setAiServings] = useState<number>(2);
  const [aiMaxBudget, setAiMaxBudget] = useState<string>("");
  const [aiIncludePantryBasics, setAiIncludePantryBasics] = useState<boolean>(false);
  const [aiIncludeArchivedItems, setAiIncludeArchivedItems] = useState<boolean>(true);
  const [aiSuggestNewRecipes, setAiSuggestNewRecipes] = useState<boolean>(true);
  const [aiSuggestedRecipesCount, setAiSuggestedRecipesCount] = useState<number>(2);
  const [aiAllowRepeatMeals, setAiAllowRepeatMeals] = useState<boolean>(true);
  const [aiSelectedRecipeIds, setAiSelectedRecipeIds] = useState<string[]>([]);
  const [aiRecipeSearch, setAiRecipeSearch] = useState<string>("");
  const [aiEnableExcludeRecipes, setAiEnableExcludeRecipes] = useState<boolean>(false);
  const [aiExcludedRecipeIds, setAiExcludedRecipeIds] = useState<string[]>([]);
  const [aiExcludeRecipeSearch, setAiExcludeRecipeSearch] = useState<string>("");
  const [aiUserPrompt, setAiUserPrompt] = useState<string>("");

  // Modale récapitulatif post-génération IA
  const [aiSummaryData, setAiSummaryData] = useState<{
    listName: string;
    summary: GenerateShoppingListAIResponse["summary"];
  } | null>(null);
  const [isAiSummaryModalOpen, setIsAiSummaryModalOpen] = useState(false);
  const [generatingRecipeId, setGeneratingRecipeId] = useState<string | null>(null);

  const handleGenerateSuggestedRecipe = async (idea: {
    title: string;
    description?: string;
    mainIngredients?: string[];
  }) => {
    try {
      setGeneratingRecipeId(idea.title);
      const prompt = `Crée la recette complète : ${idea.title}.${idea.description ? ` Description : ${idea.description}.` : ""}${idea.mainIngredients?.length ? ` Ingrédients clés à inclure : ${idea.mainIngredients.join(", ")}.` : ""}`;
      await recipeService.generateRecipeWithAI({
        userPrompt: prompt,
        servings: aiServings,
      });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success(`Recette "${idea.title}" ajoutée à votre carnet !`);
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors de la création de la recette");
    } finally {
      setGeneratingRecipeId(null);
    }
  };

  // Récupérer les listes de courses
  const { data: shoppingLists = [], isLoading } = useQuery({
    queryKey: ["shoppingLists"],
    queryFn: shoppingListService.getShoppingLists,
  });

  // Récupérer les recettes existantes pour la sélection IA
  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => recipeService.getRecipes({ limit: 100 }),
    staleTime: 60 * 1000,
  });

  // Récupérer les aliments du frigo
  const { data: fridgeItems = [] } = useQuery({
    queryKey: ["fridgeItems"],
    queryFn: fridgeService.getFridgeItems,
    staleTime: 60 * 1000,
  });

  // Récupérer l'historique des achats / consommations pour le contexte IA
  const { data: historyData } = useQuery({
    queryKey: ["purchaseHistory", "ai-context"],
    queryFn: () => fridgeService.getHistory({ limit: 1 }),
    staleTime: 60 * 1000,
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

  // Mutation génération automatique IA
  const generateAiListMutation = useMutation({
    mutationFn: (payload: GenerateShoppingListAIRequest) =>
      shoppingListService.generateShoppingListWithAI(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shoppingLists"] });
      setIsAiModalOpen(false);
      setAiUserPrompt("");
      setAiSelectedRecipeIds([]);
      setAiExcludedRecipeIds([]);
      setAiEnableExcludeRecipes(false);
      setAiSummaryData({
        listName: data.shoppingList.name,
        summary: data.summary,
      });
      setIsAiSummaryModalOpen(true);
      toast.success("Liste de courses générée avec succès !");
    },
    onError: (error: any) => {
      toast.error(
        error?.message ||
          "Erreur lors de la génération IA de la liste de courses"
      );
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
      name: "",
      quantity: 1,
      unit: "pièce",
      notes: "",
    },
  });

  useEffect(() => {
    if (!isAddItemModalOpen) {
      setIngredientInputValue("");
      setIngredientSearch("");
      addItemForm.reset({
        ingredientId: "",
        name: "",
        quantity: 1,
        unit: "pièce",
        notes: "",
      });
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

    const itemName = (ingredientInputValue || data.name || "").trim();
    if (!itemName && !data.ingredientId) {
      toast.error("Veuillez saisir un nom d'article ou choisir un ingrédient");
      return;
    }

    const itemData: AddShoppingListItemRequest = {
      ingredientId: data.ingredientId || undefined,
      name: itemName || undefined,
      quantity: data.quantity || 1,
      unit: data.unit?.trim() || "pièce",
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
      addItemForm.setValue("name", selected.name);
      addItemForm.clearErrors("ingredientId");
      addItemForm.clearErrors("name");
      setIngredientInputValue(selected.name);
      setIngredientSearch("");
    } catch {
      // En cas de souci avec l'API externe, on permet quand même la saisie libre avec ce nom
      addItemForm.setValue("name", ingredient.name);
      setIngredientInputValue(ingredient.name);
      setIngredientSearch("");
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

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center"
          >
            <Sparkles className="w-4 h-4 mr-2 text-primary-600" />
            Génération Auto (IA)
          </Button>

          <Button
            onClick={() => setIsCreateListModalOpen(true)}
            className="flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle liste
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-2 sm:gap-6 mt-0">
        <Card hover className="flex flex-col justify-center">
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <h3 className="text-xl sm:text-3xl font-bold text-emerald-600 mb-0.5 sm:mb-1">
                {shoppingLists.length}
              </h3>
              <p className="text-[11px] sm:text-sm text-gray-600 font-medium">Listes actives</p>
            </div>
          </CardContent>
        </Card>

        <Card hover className="flex flex-col justify-center">
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <h3 className="text-xl sm:text-3xl font-bold text-blue-600 mb-0.5 sm:mb-1">
                {totalItems}
              </h3>
              <p className="text-[11px] sm:text-sm text-gray-600 font-medium">Articles total</p>
            </div>
          </CardContent>
        </Card>

        <Card hover className="flex flex-col justify-center">
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <h3 className="text-xl sm:text-3xl font-bold text-amber-600 mb-0.5 sm:mb-1">
                {purchasedItems}
              </h3>
              <p className="text-[11px] sm:text-sm text-gray-600 font-medium">Articles achetés</p>
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsAiModalOpen(true)}
                className="flex items-center"
              >
                <Sparkles className="w-4 h-4 mr-2 text-primary-600" />
                Génération Auto (IA)
              </Button>
              <Button onClick={() => setIsCreateListModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Créer manuellement
              </Button>
            </div>
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
          {/* Sélection ou saisie libre de l'article */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Article ou ingrédient
              </label>
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                Saisie libre
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex : Lessive, Éponges, Lait, Pâtes..."
                value={ingredientInputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setIngredientInputValue(value);
                  setIngredientSearch(value);
                  addItemForm.setValue("name", value);
                  if (addItemForm.getValues("ingredientId")) {
                    addItemForm.setValue("ingredientId", "");
                  }
                  addItemForm.clearErrors("name");
                  addItemForm.clearErrors("ingredientId");
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              />
              {ingredients.length > 0 && ingredientSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-50">
                  {ingredients.map((ingredient) => (
                    <button
                      key={ingredient.id}
                      type="button"
                      onClick={() => {
                        handleIngredientSelection(ingredient);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/60 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{ingredient.name}</div>
                        {ingredient.category?.name && (
                          <div className="text-xs text-gray-500">
                            {ingredient.category?.name}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-emerald-600 font-medium">Choisir</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {addItemForm.formState.errors.name && (
              <p className="mt-1 text-sm text-red-600">
                {addItemForm.formState.errors.name.message}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Tapez n'importe quel article (alimentaire ou produit du quotidien comme de la lessive)
            </p>
          </div>

          {/* Quantité et unité */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantité"
              type="text"
              inputMode="decimal"
              placeholder="Ex : 1.5 ou 500"
              error={addItemForm.formState.errors.quantity?.message}
              {...addItemForm.register("quantity", {
                setValueAs: parseDecimalNumber,
              })}
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

      {/* Modale Génération Auto IA */}
      <Modal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        title="Génération automatique de liste (IA)"
        size="lg"
      >
        <div className="space-y-6">
          {/* Explication d'optimisation */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-gray-900">
              Optimisation intelligente des courses
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              L'IA croise vos recettes prévues avec les stocks réels de votre frigo (<strong>{fridgeItems.length} aliments en stock</strong>){aiIncludeArchivedItems && (historyData?.pagination?.total ?? 0) > 0 ? ` et vos consommations (${historyData?.pagination.total} archivés)` : ""}. Règle du foyer : 1 recette = 1 repas pour 2 (adapté selon vos portions). Elle déduit vos stocks et mutualise les formats de magasin sans omettre d'ingrédients.
            </p>
          </div>

          {/* Mode par défaut en résumé rapide */}
          <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-gray-700">
              <div className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-primary-600" />
                <span>{aiDaysCount} {aiDaysCount > 1 ? "repas prévus" : "repas prévu"}</span>
              </div>
              {aiDessertsCount > 0 && (
                <div className="flex items-center gap-1.5 font-medium text-pink-700">
                  <span>🍰 {aiDessertsCount} {aiDessertsCount > 1 ? "desserts" : "dessert"}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 font-medium">
                <Users className="w-4 h-4 text-primary-600" />
                <span>{aiServings} {aiServings > 1 ? "personnes" : "personne"}</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <ChefHat className="w-4 h-4 text-primary-600" />
                <span>
                  {aiSelectedRecipeIds.length > 0
                    ? `${aiSelectedRecipeIds.length} recette(s) choisie(s)`
                    : "Sélection automatique selon le frigo"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <History className={`w-4 h-4 ${aiIncludeArchivedItems ? "text-primary-600" : "text-gray-400"}`} />
                <span>
                  {aiIncludeArchivedItems ? "Historique inclus" : "Sans historique"}
                </span>
              </div>
              {aiAllowRepeatMeals && (
                <div className="flex items-center gap-1.5 font-medium text-purple-700">
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Batch cooking (quantités mutualisées)</span>
                </div>
              )}
              {aiIncludePantryBasics && (
                <div className="flex items-center gap-1.5 font-medium text-blue-700">
                  <Package className="w-3.5 h-3.5" />
                  <span>Essentiels & boissons</span>
                </div>
              )}
              {aiSuggestNewRecipes && (
                <div className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Idées recettes ({aiSuggestedRecipesCount})</span>
                </div>
              )}
              {aiEnableExcludeRecipes && aiExcludedRecipeIds.length > 0 && (
                <div className="flex items-center gap-1.5 font-medium text-rose-700">
                  <Ban className="w-3.5 h-3.5" />
                  <span>{aiExcludedRecipeIds.length} exclue(s)</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
              className="text-primary-700 hover:text-primary-800 font-semibold flex items-center gap-1 underline underline-offset-2 ml-auto"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {isCustomizeOpen ? "Réduire les options" : "Personnaliser les critères"}
            </button>
          </div>

          {/* Section personnalisation (accordéon) */}
          {isCustomizeOpen && (
            <div className="space-y-5 pt-1 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* 1. Nombre de repas, douceurs sucrées et portions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary-600" />
                    Repas prévus (salés)
                  </label>
                  <div className="flex items-center gap-2.5">
                    <div className="inline-flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setAiDaysCount((prev) => Math.max(1, prev - 1))}
                        disabled={aiDaysCount <= 1}
                        className="px-2.5 py-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Diminuer le nombre de repas"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={aiDaysCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) {
                            setAiDaysCount(Math.min(30, Math.max(1, val)));
                          }
                        }}
                        className="w-12 text-center py-2 text-sm font-semibold text-gray-900 border-x border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setAiDaysCount((prev) => Math.min(30, prev + 1))}
                        disabled={aiDaysCount >= 30}
                        className="px-2.5 py-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Augmenter le nombre de repas"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-xs font-medium text-gray-600">
                      {aiDaysCount > 1 ? "repas" : "repas"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Déjeuners & dîners.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <span className="text-sm">🍰</span>
                    Desserts & douceurs
                  </label>
                  <div className="flex items-center gap-2.5">
                    <div className="inline-flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setAiDessertsCount((prev) => Math.max(0, prev - 1))}
                        disabled={aiDessertsCount <= 0}
                        className="px-2.5 py-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Diminuer le nombre de desserts"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={aiDessertsCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) {
                            setAiDessertsCount(Math.min(10, Math.max(0, val)));
                          }
                        }}
                        className="w-12 text-center py-2 text-sm font-semibold text-gray-900 border-x border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setAiDessertsCount((prev) => Math.min(10, prev + 1))}
                        disabled={aiDessertsCount >= 10}
                        className="px-2.5 py-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Augmenter le nombre de desserts"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-xs font-medium text-gray-600">
                      {aiDessertsCount > 1 ? "desserts" : "dessert"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Gâteaux, crêpes, tartes...
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary-600" />
                    Nombre de personnes
                  </label>
                  <div className="flex items-center gap-2.5">
                    <div className="inline-flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setAiServings((prev) => Math.max(1, prev - 1))}
                        disabled={aiServings <= 1}
                        className="px-2.5 py-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Diminuer le nombre de personnes"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={aiServings}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) {
                            setAiServings(Math.min(20, Math.max(1, val)));
                          }
                        }}
                        className="w-12 text-center py-2 text-sm font-semibold text-gray-900 border-x border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setAiServings((prev) => Math.min(20, prev + 1))}
                        disabled={aiServings >= 20}
                        className="px-2.5 py-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Augmenter le nombre de personnes"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-xs font-medium text-gray-600">
                      {aiServings > 1 ? "personnes" : "personne"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Portions adaptées.
                  </p>
                </div>
              </div>

              {/* 2. Budget max estimé (optionnel) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Budget maximum estimé (€) (optionnel)
                </label>
                <Input
                  type="number"
                  min="5"
                  max="500"
                  step="5"
                  placeholder="Ex : 40 € (laisser vide pour sans limite)"
                  value={aiMaxBudget}
                  onChange={(e) => setAiMaxBudget(e.target.value)}
                  className="text-xs py-2 bg-white"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  L'IA privilégiera les conditionnements économiques et ingrédients abordables.
                </p>
              </div>

              {/* Options supplémentaires (cases à cocher) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option Mutualiser les quantités (Batch cooking / Multi-repas) */}
                <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                  <input
                    type="checkbox"
                    id="aiAllowRepeatMeals"
                    checked={aiAllowRepeatMeals}
                    onChange={(e) => setAiAllowRepeatMeals(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                  <div>
                    <label
                      htmlFor="aiAllowRepeatMeals"
                      className="text-xs font-semibold text-gray-800 leading-snug cursor-pointer select-none flex items-center gap-1.5"
                    >
                      <Repeat className="w-3.5 h-3.5 text-purple-600" />
                      Mutualiser les quantités (batch cooking)
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Si un gros conditionnement est acheté (ex: 1kg de pâtes + 1kg bolo, grand gratin, chili...), rentabiliser en couvrant plusieurs repas (2, 3 ou plus selon les portions).
                    </p>
                  </div>
                </div>

                {/* Option Suggestions de nouvelles recettes pour mutualiser */}
                <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="aiSuggestNewRecipes"
                      checked={aiSuggestNewRecipes}
                      onChange={(e) => setAiSuggestNewRecipes(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="aiSuggestNewRecipes"
                        className="text-xs font-semibold text-gray-800 leading-snug cursor-pointer select-none flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Suggérer de nouvelles recettes
                      </label>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                        Idées pour rentabiliser les gros formats et surplus d'ingrédients (ex: paquet 1kg de pâtes, viande hachée...).
                      </p>
                    </div>
                  </div>

                  {aiSuggestNewRecipes && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 pl-6">
                      <span className="text-[11px] font-medium text-gray-700">
                        Suggestions d'idées (sur vos {aiDaysCount} repas) :
                      </span>
                      <div className="inline-flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                        <button
                          type="button"
                          onClick={() =>
                            setAiSuggestedRecipesCount((prev) => Math.max(1, prev - 1))
                          }
                          disabled={aiSuggestedRecipesCount <= 1}
                          className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Diminuer les suggestions"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={Math.max(1, aiDaysCount)}
                          value={aiSuggestedRecipesCount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              setAiSuggestedRecipesCount(
                                Math.min(Math.max(1, aiDaysCount), Math.max(1, val))
                              );
                            }
                          }}
                          className="w-10 text-center py-1 text-xs font-semibold text-gray-900 border-x border-gray-300 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setAiSuggestedRecipesCount((prev) =>
                              Math.min(Math.max(1, aiDaysCount), prev + 1)
                            )
                          }
                          disabled={aiSuggestedRecipesCount >= Math.max(1, aiDaysCount)}
                          className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Augmenter les suggestions"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Option Aliments archivés */}
                <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                  <input
                    type="checkbox"
                    id="aiIncludeArchivedItems"
                    checked={aiIncludeArchivedItems}
                    onChange={(e) => setAiIncludeArchivedItems(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                  <div>
                    <label
                      htmlFor="aiIncludeArchivedItems"
                      className="text-xs font-semibold text-gray-800 leading-snug cursor-pointer select-none flex items-center gap-1.5"
                    >
                      <History className="w-3.5 h-3.5 text-amber-600" />
                      Inclure les aliments archivés
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Permet à l'IA de savoir ce qui a été consommé récemment pour identifier vos besoins de réapprovisionnement.
                    </p>
                  </div>
                </div>

                {/* Option Essentiels du quotidien & boissons */}
                <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                  <input
                    type="checkbox"
                    id="aiIncludePantryBasics"
                    checked={aiIncludePantryBasics}
                    onChange={(e) => setAiIncludePantryBasics(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                  <div>
                    <label
                      htmlFor="aiIncludePantryBasics"
                      className="text-xs font-semibold text-gray-800 leading-snug cursor-pointer select-none flex items-center gap-1.5"
                    >
                      <Package className="w-3.5 h-3.5 text-blue-600" />
                      Essentiels du quotidien & boissons
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Boissons habituelles (Coca-Cola, jus, eau), petit-déj (pain, brioche, café, lait, beurre), encas et fruits, notamment ceux en rupture.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Sélection des recettes spécifiques (optionnel) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <ChefHat className="w-3.5 h-3.5 text-indigo-600" />
                    Choisir des recettes précises (optionnel)
                  </label>
                  {aiSelectedRecipeIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAiSelectedRecipeIds([])}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Désélectionner tout ({aiSelectedRecipeIds.length})
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-gray-500">
                  Par défaut, l'IA choisit les meilleures recettes selon votre frigo. Vous pouvez cocher ci-dessous celles que vous voulez absolument cuisiner.
                </p>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Filtrer mes recettes..."
                    value={aiRecipeSearch}
                    onChange={(e) => setAiRecipeSearch(e.target.value)}
                    className="pl-8 text-xs py-1.5 bg-white"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
                  {recipes
                    .filter((r) =>
                      aiRecipeSearch.trim()
                        ? r.title.toLowerCase().includes(aiRecipeSearch.toLowerCase())
                        : true
                    )
                    .map((recipe) => {
                      const isExcluded =
                        aiEnableExcludeRecipes && aiExcludedRecipeIds.includes(recipe.id);
                      const isSelected =
                        aiSelectedRecipeIds.includes(recipe.id) && !isExcluded;
                      return (
                        <label
                          key={recipe.id}
                          className={`flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                            isExcluded
                              ? "bg-gray-100/80 opacity-50 cursor-not-allowed select-none"
                              : isSelected
                              ? "bg-primary-50/70 cursor-pointer"
                              : "hover:bg-gray-50 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isExcluded}
                              onChange={() => {
                                if (isExcluded) return;
                                if (isSelected) {
                                  setAiSelectedRecipeIds(
                                    aiSelectedRecipeIds.filter((id) => id !== recipe.id)
                                  );
                                } else {
                                  setAiSelectedRecipeIds([...aiSelectedRecipeIds, recipe.id]);
                                }
                              }}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <span
                              className={`font-medium ${
                                isExcluded
                                  ? "line-through text-gray-400"
                                  : isSelected
                                  ? "text-primary-900 font-semibold"
                                  : "text-gray-800"
                              }`}
                            >
                              {recipe.title}
                            </span>
                            {(() => {
                              const badge = getRecipeCategoryBadge(recipe.category);
                              return (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-1 ${badge.color}`}
                                >
                                  <span>{badge.icon}</span>
                                  <span>{badge.label}</span>
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2">
                            {isExcluded && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-medium">
                                ⛔ Exclue ci-dessous
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {recipe.ingredients.length} ingrédient(s)
                            </span>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* 4. Exclure des recettes (optionnel) */}
              <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="aiEnableExcludeRecipes"
                      checked={aiEnableExcludeRecipes}
                      onChange={(e) => {
                        setAiEnableExcludeRecipes(e.target.checked);
                        if (!e.target.checked) {
                          setAiExcludedRecipeIds([]);
                        }
                      }}
                      className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <label
                      htmlFor="aiEnableExcludeRecipes"
                      className="text-xs font-semibold text-gray-800 leading-snug cursor-pointer select-none flex items-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5 text-rose-600" />
                      Exclure des recettes de la sélection (optionnel)
                    </label>
                  </div>
                  {aiEnableExcludeRecipes && aiExcludedRecipeIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAiExcludedRecipeIds([])}
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      Désélectionner tout ({aiExcludedRecipeIds.length})
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-gray-500">
                  Par défaut, toutes vos recettes sont éligibles. Cochez ci-dessous celles que vous refusez de cuisiner : elles seront grisées dans la liste ci-dessus et interdites à l'IA.
                </p>

                {aiEnableExcludeRecipes && (
                  <div className="pt-2 border-t border-gray-200/70 space-y-2 animate-in fade-in duration-150">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Filtrer les recettes à exclure..."
                        value={aiExcludeRecipeSearch}
                        onChange={(e) => setAiExcludeRecipeSearch(e.target.value)}
                        className="pl-8 text-xs py-1.5 bg-white"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
                      {recipes
                        .filter((r) =>
                          aiExcludeRecipeSearch.trim()
                            ? r.title.toLowerCase().includes(aiExcludeRecipeSearch.toLowerCase())
                            : true
                        )
                        .map((recipe) => {
                          const isExcluded = aiExcludedRecipeIds.includes(recipe.id);
                          return (
                            <label
                              key={recipe.id}
                              className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                                isExcluded ? "bg-rose-50/80" : "hover:bg-gray-50"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isExcluded}
                                  onChange={() => {
                                    if (isExcluded) {
                                      setAiExcludedRecipeIds(
                                        aiExcludedRecipeIds.filter((id) => id !== recipe.id)
                                      );
                                    } else {
                                      setAiExcludedRecipeIds([...aiExcludedRecipeIds, recipe.id]);
                                      // Retirer de la sélection des recettes ci-dessus
                                      setAiSelectedRecipeIds((prev) =>
                                        prev.filter((id) => id !== recipe.id)
                                      );
                                    }
                                  }}
                                  className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                />
                                <span
                                  className={`font-medium ${
                                    isExcluded ? "text-rose-900 font-semibold" : "text-gray-800"
                                  }`}
                                >
                                  {recipe.title}
                                </span>
                                {(() => {
                                  const badge = getRecipeCategoryBadge(recipe.category);
                                  return (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-1 ${badge.color}`}
                                    >
                                      <span>{badge.icon}</span>
                                      <span>{badge.label}</span>
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-2">
                                {isExcluded && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-medium">
                                    ⛔ Exclue
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {recipe.ingredients.length} ingrédient(s)
                                </span>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Consigne ou demande libre */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Consigne particulière pour l'IA (optionnel)
                </label>
                <Input
                  placeholder="Ex : Repas légers pour le soir, privilégier des légumes, pas de porc..."
                  value={aiUserPrompt}
                  onChange={(e) => setAiUserPrompt(e.target.value)}
                  className="text-xs py-2 bg-white"
                />
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAiModalOpen(false)}
              disabled={generateAiListMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => {
                const parsedBudget = aiMaxBudget ? parseFloat(aiMaxBudget) : null;
                generateAiListMutation.mutate({
                  daysCount: aiDaysCount,
                  dessertsCount: aiDessertsCount,
                  servings: aiServings,
                  maxBudget: parsedBudget && parsedBudget > 0 ? parsedBudget : null,
                  includePantryBasics: aiIncludePantryBasics,
                  includeArchivedItems: aiIncludeArchivedItems,
                  suggestNewRecipes: aiSuggestNewRecipes,
                  suggestedRecipesCount: aiSuggestNewRecipes ? aiSuggestedRecipesCount : undefined,
                  allowRepeatMeals: aiAllowRepeatMeals,
                  targetRecipeIds: aiSelectedRecipeIds.length > 0 ? aiSelectedRecipeIds : undefined,
                  excludedRecipeIds:
                    aiEnableExcludeRecipes && aiExcludedRecipeIds.length > 0
                      ? aiExcludedRecipeIds
                      : undefined,
                  userPrompt: aiUserPrompt.trim() || undefined,
                });
              }}
              loading={generateAiListMutation.isPending}
            >
              Générer la liste
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modale Récapitulatif IA post-génération */}
      <Modal
        isOpen={isAiSummaryModalOpen}
        onClose={() => setIsAiSummaryModalOpen(false)}
        title="✨ Votre liste de courses est prête !"
        size="lg"
      >
        {aiSummaryData && (
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-emerald-900">
              <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{aiSummaryData.listName}</span>
              </h4>
              <p className="text-xs text-emerald-800">
                La liste a été créée et ajoutée à vos listes actives avec tous ses articles mutualisés et classés par rayon.
              </p>
            </div>

            {/* Répartition du planning des repas (mealPlan) */}
            {aiSummaryData.summary.mealPlan && aiSummaryData.summary.mealPlan.length > 0 ? (
              <div>
                <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary-600" />
                  Planning des repas prévus ({aiSummaryData.summary.mealPlan.length} repas)
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {aiSummaryData.summary.mealPlan.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between text-xs p-2.5 rounded-xl border transition-colors ${
                        m.isRepeatOrLeftover
                          ? "bg-amber-50/70 border-amber-200/80 text-amber-950"
                          : "bg-white border-gray-200/80 text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="font-bold text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          #{m.mealIndex}
                        </span>
                        <span className="font-semibold truncate">{m.dishName}</span>
                      </div>
                      {m.isRepeatOrLeftover ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 shrink-0">
                          <Repeat className="w-2.5 h-2.5" />
                          {m.details || "Multi-repas / batch cooking"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500 shrink-0">
                          {m.details || "Repas frais"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              aiSummaryData.summary.coveredRecipes.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ChefHat className="w-3.5 h-3.5 text-primary-600" />
                    Plats prévus ({aiSummaryData.summary.coveredRecipes.length})
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {aiSummaryData.summary.coveredRecipes.map((r, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium border border-primary-200"
                      >
                        🍽️ {r}
                      </span>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* Suggestions de nouvelles recettes pour rentabiliser les courses */}
            {aiSummaryData.summary.suggestedNewRecipes &&
              aiSummaryData.summary.suggestedNewRecipes.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Idées de recettes pour mutualiser vos achats ({aiSummaryData.summary.suggestedNewRecipes.length})
                    </h5>
                    <span className="text-[11px] text-indigo-600 font-medium">
                      Zéro gaspillage & gros formats
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {aiSummaryData.summary.suggestedNewRecipes.map((idea, idx) => (
                      <div
                        key={idx}
                        className="bg-indigo-50/50 hover:bg-indigo-50/80 border border-indigo-100 rounded-xl p-3 flex flex-col justify-between transition-colors"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h6 className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                              <span>🍽️</span>
                              <span>{idea.title}</span>
                            </h6>
                          </div>

                          {idea.whySuggested && (
                            <p className="text-[11px] text-indigo-700 font-medium bg-white/80 border border-indigo-100 rounded-lg px-2 py-1 mb-2">
                              💡 {idea.whySuggested}
                            </p>
                          )}

                          {idea.description && (
                            <p className="text-[11px] text-gray-600 mb-2 leading-relaxed">
                              {idea.description}
                            </p>
                          )}

                          {idea.mainIngredients && idea.mainIngredients.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2.5">
                              {idea.mainIngredients.map((ing, iIdx) => (
                                <span
                                  key={iIdx}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-white text-gray-700 border border-gray-200"
                                >
                                  {ing}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-indigo-100/60 flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-[11px] py-1 px-2.5 h-auto text-indigo-700 border-indigo-200 hover:bg-indigo-100/70"
                            onClick={() => handleGenerateSuggestedRecipe(idea)}
                            loading={generatingRecipeId === idea.title}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Ajouter à mes recettes
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Ingrédients économisés grâce au frigo */}
            {aiSummaryData.summary.alreadyInFridge.length > 0 && (
              <div>
                <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  Économisé grâce à votre frigo ({aiSummaryData.summary.alreadyInFridge.length})
                </h5>
                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto text-xs">
                  {aiSummaryData.summary.alreadyInFridge.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <div>
                        <strong className="text-gray-900">{item.name}</strong>
                        {item.substitutionNote && (
                          <span className="text-gray-500 italic ml-1">
                            ({item.substitutionNote})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Astuces & Budget */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs">
              {aiSummaryData.summary.estimatedTotalCost !== undefined && (
                <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Budget estimé : ~{aiSummaryData.summary.estimatedTotalCost} €</span>
                </div>
              )}
              {aiSummaryData.summary.tips && aiSummaryData.summary.tips.length > 0 && (
                <div className="w-full text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl p-2.5">
                  💡 {aiSummaryData.summary.tips[0]}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setIsAiSummaryModalOpen(false)}
                className="w-full sm:w-auto"
              >
                Accéder à mes courses
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
