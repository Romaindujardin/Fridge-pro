import { useState, useRef, ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Calendar,
  Trash2,
  Edit3,
  AlertTriangle,
  Upload,
  ScanLine,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { fridgeService } from "@/services/fridgeService";
import type { FridgeItem, AddFridgeItemRequest, Ingredient } from "@/types";

// Schéma de validation
const fridgeItemSchema = z.object({
  ingredientId: z.string().min(1, "Veuillez sélectionner un ingrédient"),
  quantity: z.number().min(0.1, "La quantité doit être supérieure à 0"),
  unit: z.string().min(1, "Veuillez spécifier une unité"),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

type FridgeItemForm = z.infer<typeof fridgeItemSchema>;

export function FridgePage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FridgeItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientInputValue, setIngredientInputValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  // Formulaire
  const form = useForm<FridgeItemForm>({
    resolver: zodResolver(fridgeItemSchema),
    defaultValues: {
      ingredientId: "",
      quantity: 1,
      unit: "",
      expiryDate: "",
      notes: "",
    },
  });

  // Récupérer les éléments du frigo
  const { data: fridgeItems = [], isLoading } = useQuery({
    queryKey: ["fridgeItems"],
    queryFn: fridgeService.getFridgeItems,
  });

  // Récupérer les ingrédients pour le formulaire
  const { data: ingredients = [] } = useQuery({
    queryKey: ["ingredients", ingredientSearch],
    queryFn: () =>
      ingredientSearch
        ? fridgeService.searchIngredients(ingredientSearch)
        : fridgeService.getIngredients(),
    enabled: !!ingredientSearch || isAddModalOpen || !!editingItem,
  });

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingItem(null);
    form.reset();
    setIngredientInputValue("");
    setIngredientSearch("");
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

      form.setValue("ingredientId", selected.id, { shouldValidate: true });
      form.clearErrors("ingredientId");
      setIngredientInputValue(selected.name);
      setIngredientSearch("");
    } catch (error: any) {
      if (error?.statusCode === 400 || error?.response?.status === 400) {
        try {
          const existingIngredients = await fridgeService.getIngredients();
          const existing = existingIngredients.find(
            (item) =>
              !item.id.startsWith("off_") &&
              item.name.toLowerCase() === ingredient.name.toLowerCase()
          );

          if (existing) {
            form.setValue("ingredientId", existing.id, {
              shouldValidate: true,
            });
            form.clearErrors("ingredientId");
            setIngredientInputValue(existing.name);
            setIngredientSearch("");
            return;
          }
        } catch {
          // ignore and fall back to error message below
        }
      }

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Impossible d'ajouter cet ingrédient"
      );
    }
  };

  const handleScanTicketClick = () => {
    if (isScanning) return;
    fileInputRef.current?.click();
  };

  const handleReceiptChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = "";
      return;
    }

    setIsScanning(true);

    try {
      const result = await fridgeService.scanReceipt(file);
      await queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      toast.success(
        result.message || "Ingrédients ajoutés depuis le ticket de caisse !"
      );
    } catch (error: any) {
      const message =
        error?.message || "Erreur lors de l'analyse du ticket de caisse.";
      toast.error(message);
    } finally {
      setIsScanning(false);
      event.target.value = "";
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    form.reset();
    setIngredientInputValue("");
    setIngredientSearch("");
    setIsAddModalOpen(true);
  };

  // Mutations
  const addMutation = useMutation({
    mutationFn: fridgeService.addFridgeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      toast.success("Ingrédient ajouté au frigo !");
      closeModal();
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AddFridgeItemRequest>;
    }) => fridgeService.updateFridgeItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      toast.success("Ingrédient modifié !");
      closeModal();
    },
    onError: () => {
      toast.error("Erreur lors de la modification");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: fridgeService.deleteFridgeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      toast.success("Ingrédient supprimé !");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  // Filtrer les éléments du frigo
  const filteredItems = fridgeItems.filter(
    (item) =>
      item.ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ingredient.category?.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  // Calculer les statistiques
  const now = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const stats = {
    total: fridgeItems.length,
    expiringSoon: fridgeItems.filter((item) => {
      if (!item.expiryDate) return false;
      const expiryDate = new Date(item.expiryDate);
      return expiryDate >= now && expiryDate <= threeDaysFromNow;
    }).length,
    expired: fridgeItems.filter((item) => {
      if (!item.expiryDate) return false;
      return new Date(item.expiryDate) < now;
    }).length,
  };

  // Gestionnaires d'événements
  const handleSubmit = async (data: FridgeItemForm) => {
    const itemData: AddFridgeItemRequest = {
      ingredientId: data.ingredientId,
      quantity: data.quantity,
      unit: data.unit,
      expiryDate: data.expiryDate || undefined,
      notes: data.notes || undefined,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: itemData });
    } else {
      addMutation.mutate(itemData);
    }
  };

  const handleEdit = (item: FridgeItem) => {
    setIsAddModalOpen(false);
    setEditingItem(item);
    form.reset({
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit,
      expiryDate: item.expiryDate ? item.expiryDate.split("T")[0] : "",
      notes: item.notes || "",
    });
    setIngredientInputValue(item.ingredient.name);
    setIngredientSearch("");
  };

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet ingrédient ?")) {
      deleteMutation.mutate(id);
    }
  };

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;

    const expiry = new Date(expiryDate);
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    if (expiry < now) {
      return { status: "expired", color: "text-red-600", bg: "bg-red-50" };
    } else if (expiry <= threeDaysFromNow) {
      return {
        status: "expiring",
        color: "text-orange-600",
        bg: "bg-orange-50",
      };
    }
    return { status: "fresh", color: "text-green-600", bg: "bg-green-50" };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mon Frigo</h1>
          <p className="text-gray-600">
            Gérez vos ingrédients et suivez leurs dates d'expiration
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleReceiptChange}
          />
          <Button
            variant="outline"
            onClick={handleScanTicketClick}
            loading={isScanning}
            className="flex items-center"
          >
            <ScanLine className="w-4 h-4 mr-2" />
            Scanner ticket
          </Button>
          <Button onClick={openAddModal} className="flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter ingrédient
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-lg p-3">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {stats.total}
                </h3>
                <p className="text-sm text-gray-600">Ingrédients total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="bg-orange-100 rounded-lg p-3">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {stats.expiringSoon}
                </h3>
                <p className="text-sm text-gray-600">Expirent bientôt</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="bg-red-100 rounded-lg p-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {stats.expired}
                </h3>
                <p className="text-sm text-gray-600">Expirés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Rechercher des ingrédients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Liste des ingrédients */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? "Aucun résultat" : "Votre frigo est vide"}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm
                ? "Essayez avec d'autres mots-clés"
                : "Commencez par ajouter des ingrédients à votre frigo"}
            </p>
            {!searchTerm && (
              <Button onClick={openAddModal}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter le premier ingrédient
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const expiryStatus = getExpiryStatus(item.expiryDate);
            return (
              <Card key={item.id} hover className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {item.ingredient.category?.icon || "🥬"}
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {item.ingredient.name}
                        </CardTitle>
                        <p className="text-sm text-gray-500">
                          {item.ingredient.category?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(item)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Quantité :</span>
                      <span className="font-medium">{item.quantity}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Unité :</span>
                      <span className="font-medium">{item.unit}</span>
                    </div>

                    {item.expiryDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Expire le:</span>
                        <span className={`font-medium ${expiryStatus?.color}`}>
                          {new Date(item.expiryDate).toLocaleDateString(
                            "fr-FR"
                          )}
                        </span>
                      </div>
                    )}

                    {item.notes && (
                      <div className="text-sm text-gray-600 italic">
                        {item.notes}
                      </div>
                    )}
                  </div>

                  {expiryStatus && (
                    <div
                      className={`mt-3 px-2 py-1 rounded-full text-xs font-medium ${expiryStatus.bg} ${expiryStatus.color}`}
                    >
                      {expiryStatus.status === "expired" && "🔴 Expiré"}
                      {expiryStatus.status === "expiring" &&
                        "🟡 Expire bientôt"}
                      {expiryStatus.status === "fresh" && "🟢 Frais"}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal d'ajout/modification */}
      <Modal
        isOpen={isAddModalOpen || !!editingItem}
        onClose={closeModal}
        title={editingItem ? "Modifier l'ingrédient" : "Ajouter un ingrédient"}
        size="md"
      >
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
                  if (form.getValues("ingredientId")) {
                    form.setValue("ingredientId", "");
                  }
                  form.clearErrors("ingredientId");
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              {ingredients.length > 0 && ingredientSearch.trim() && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {ingredients.map((ingredient) => (
                    <button
                      key={ingredient.id}
                      type="button"
                      onClick={async () => {
                        await handleIngredientSelection(ingredient);
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
            {form.formState.errors.ingredientId && (
              <p className="mt-1 text-sm text-red-600">
                {form.formState.errors.ingredientId.message}
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
              error={form.formState.errors.quantity?.message}
              {...form.register("quantity", { valueAsNumber: true })}
            />
            <Input
              label="Unité"
              placeholder="kg, g, pièce..."
              error={form.formState.errors.unit?.message}
              {...form.register("unit")}
            />
          </div>

          {/* Date d'expiration */}
          <Input
            label="Date d'expiration (optionnel)"
            type="date"
            error={form.formState.errors.expiryDate?.message}
            {...form.register("expiryDate")}
          />

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optionnel)
            </label>
            <textarea
              placeholder="Notes supplémentaires..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
              {...form.register("notes")}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button
              type="submit"
              loading={addMutation.isPending || updateMutation.isPending}
            >
              {editingItem ? "Modifier" : "Ajouter"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
