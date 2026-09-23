import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Search,
  Heart,
  Clock,
  Users,
  ChefHat,
  Plus,
  Sparkles,
  Trash2,
  Camera,
  Upload,
  Edit3,
  Coins,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { recipeService } from "@/services/recipeService";
import { fridgeService } from "@/services/fridgeService";
import { shoppingListService } from "@/services/shoppingListService";
import type { Recipe } from "@/types";
import { useAuthStore } from "@/stores/authStore";

const generateRecipeSchema = z.object({
  prompt: z
    .string()
    .min(
      10,
      "Décrivez ce que vous souhaitez cuisiner (au moins 10 caractères)."
    ),
  useFridge: z.boolean().optional().default(true),
});

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

const createRecipeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Le titre doit contenir au moins 3 caractères"),
  description: z
    .string()
    .trim()
    .max(500, "La description ne doit pas dépasser 500 caractères")
    .optional()
    .or(z.literal("")),
  prepTime: z.coerce
    .number({
      invalid_type_error: "Le temps de préparation doit être un nombre",
    })
    .min(0, "Le temps de préparation doit être positif")
    .default(0),
  cookTime: z.coerce
    .number({ invalid_type_error: "Le temps de cuisson doit être un nombre" })
    .min(0, "Le temps de cuisson doit être positif")
    .default(0),
  servings: z.coerce
    .number({ invalid_type_error: "Le nombre de personnes doit être un nombre" })
    .int("Le nombre de personnes doit être un entier")
    .min(1, "Au moins 1 personne"),
  difficulty: z.enum(["easy", "medium", "hard"], {
    invalid_type_error: "Choisissez une difficulté",
  }),
  ingredients: z
    .array(
      z.object({
        ingredientName: z.string().trim().min(1, "Le nom de l'ingrédient est requis"),
        quantity: z.preprocess(
          parseDecimalNumber,
          z
            .number({ invalid_type_error: "Quantité invalide" })
            .positive("La quantité doit être positive")
        ),
        unit: z.string().trim().min(1, "L'unité est requise"),
        notes: z.string().trim().max(120, "Notes trop longues").optional(),
      })
    )
    .min(1, "Ajoutez au moins un ingrédient"),
  instructions: z
    .array(
      z.object({
        text: z.string().trim().min(1, "Décrivez l'étape"),
      })
    )
    .min(1, "Ajoutez au moins une étape"),
});

export function RecipesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("");
  const [showOnlyMakeable, setShowOnlyMakeable] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showOnlyAI, setShowOnlyAI] = useState(false);
  const [showOnlyMyRecipes, setShowOnlyMyRecipes] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardFileInputRef = useRef<HTMLInputElement>(null);
  const [targetRecipeIdForUpload, setTargetRecipeIdForUpload] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  // Récupérer les listes de courses pour ajouter des ingrédients
  const { data: shoppingLists = [] } = useQuery({
    queryKey: ["shoppingLists"],
    queryFn: shoppingListService.getShoppingLists,
    staleTime: 5 * 60 * 1000,
  });

  const generateRecipeForm = useForm<z.infer<typeof generateRecipeSchema>>({
    resolver: zodResolver(generateRecipeSchema),
    defaultValues: {
      prompt: "",
      useFridge: true,
    },
  });

  const {
    register: generateRegister,
    handleSubmit: handleGenerateSubmit,
    reset: resetGenerateForm,
    formState: { errors: generateErrors },
  } = generateRecipeForm;

  const createRecipeForm = useForm<z.infer<typeof createRecipeSchema>>({
    resolver: zodResolver(createRecipeSchema),
    defaultValues: {
      title: "",
      description: "",
      prepTime: 15,
      cookTime: 0,
      servings: 4,
      difficulty: "medium",
      ingredients: [
        {
          ingredientName: "",
          quantity: 1,
          unit: "",
          notes: "",
        },
      ],
      instructions: [
        {
          text: "",
        },
      ],
    },
  });

  const {
    control,
    register: createRegister,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
    formState: { errors: createErrors },
  } = createRecipeForm;

  const {
    fields: ingredientFields,
    append: appendIngredient,
    remove: removeIngredient,
  } = useFieldArray({
    control,
    name: "ingredients",
  });

  const {
    fields: instructionFields,
    append: appendInstruction,
    remove: removeInstruction,
  } = useFieldArray({
    control,
    name: "instructions",
  });


  // Récupérer les recettes avec mise en cache
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => recipeService.getRecipes({ limit: 200 }),
    staleTime: 60 * 1000,
  });

  // Mutation pour toggle favoris
  const favoriteMutation = useMutation({
    mutationFn: async ({
      recipeId,
      isFavorite,
    }: {
      recipeId: string;
      isFavorite: boolean;
    }) => {
      if (isFavorite) {
        return await recipeService.removeFavorite(recipeId);
      } else {
        return await recipeService.toggleFavorite(recipeId);
      }
    },
    onSuccess: (data, { recipeId, isFavorite }) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["favoriteRecipes"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedRecipes"] });
      const message = !isFavorite
        ? "Recette ajoutée aux favoris !"
        : "Recette retirée des favoris !";
      toast.success(message);
      setSelectedRecipe((current) =>
        current && current.id === recipeId
          ? { ...current, isFavorite: !isFavorite }
          : current
      );
    },
    onError: () => {
      toast.error("Erreur lors de la modification des favoris");
    },
  });

  const generateRecipeMutation = useMutation({
    mutationFn: (payload: z.infer<typeof generateRecipeSchema>) =>
      recipeService.generateRecipeWithAI(payload),
    onSuccess: (recipe) => {
      toast.success("Recette générée avec succès !");
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedRecipes"] });
      resetGenerateForm();
      setIsGenerateModalOpen(false);
      setSelectedRecipe(recipe);
    },
    onError: (error: any) => {
      toast.error(
        error?.message || "Erreur lors de la génération de la recette"
      );
    },
  });

  const createRecipeMutation = useMutation({
    mutationFn: async (values: z.infer<typeof createRecipeSchema>) => {
      const formattedInstructions = values.instructions.map((step) =>
        step.text.trim()
      );

      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        instructions: formattedInstructions,
        prepTime: values.prepTime ?? undefined,
        cookTime: values.cookTime ?? undefined,
        servings: values.servings,
        difficulty: values.difficulty,
        ingredients: values.ingredients.map((ingredient) => ({
          ingredientName: ingredient.ingredientName.trim(),
          quantity: ingredient.quantity,
          unit: ingredient.unit.trim(),
          notes: ingredient.notes?.trim() || undefined,
        })),
      };

      return recipeService.createRecipe(payload);
    },
    onSuccess: (recipe) => {
      toast.success("Recette ajoutée !");
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedRecipes"] });
      queryClient.invalidateQueries({ queryKey: ["favoriteRecipes"] });
      resetCreateForm();
      setIsCreateModalOpen(false);
      setSelectedRecipe(recipe);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de la création de la recette");
    },
  });

  const updateRecipeMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: z.infer<typeof createRecipeSchema>;
    }) => {
      const formattedInstructions = values.instructions.map((step) =>
        step.text.trim()
      );

      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        instructions: formattedInstructions,
        prepTime: values.prepTime ?? undefined,
        cookTime: values.cookTime ?? undefined,
        servings: values.servings,
        difficulty: values.difficulty,
        ingredients: values.ingredients.map((ingredient) => ({
          ingredientName: ingredient.ingredientName.trim(),
          quantity: ingredient.quantity,
          unit: ingredient.unit.trim(),
          notes: ingredient.notes?.trim() || undefined,
        })),
      };

      return recipeService.updateRecipe(id, payload);
    },
    onSuccess: (updatedRecipe) => {
      toast.success("Recette modifiée avec succès !");
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedRecipes"] });
      queryClient.invalidateQueries({ queryKey: ["favoriteRecipes"] });
      resetCreateForm();
      setIsCreateModalOpen(false);
      setEditingRecipe(null);
      setSelectedRecipe(updatedRecipe);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de la modification de la recette");
    },
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: async (recipeId: string) =>
      recipeService.deleteRecipe(recipeId),
    onSuccess: () => {
      toast.success("Recette supprimée avec succès !");
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedRecipes"] });
      queryClient.invalidateQueries({ queryKey: ["favoriteRecipes"] });
      setSelectedRecipe(null);
    },
    onError: () => {
      toast.error("Erreur lors de la suppression de la recette");
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({
      recipeId,
      fileOrUrl,
    }: {
      recipeId: string;
      fileOrUrl: File | string;
    }) => {
      return recipeService.uploadRecipeImage(recipeId, fileOrUrl);
    },
    onSuccess: (data, variables) => {
      toast.success("Photo de la recette enregistrée !");
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedRecipes"] });
      setSelectedRecipe((current) =>
        current && current.id === variables.recipeId
          ? { ...current, imageUrl: data.imageUrl }
          : current
      );
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de l'enregistrement de la photo");
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      return recipeService.deleteRecipeImage(recipeId);
    },
    onSuccess: (_, recipeId) => {
      toast.success("Photo supprimée");
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedRecipes"] });
      setSelectedRecipe((current) =>
        current && current.id === recipeId
          ? { ...current, imageUrl: undefined }
          : current
      );
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de la suppression de la photo");
    },
  });

  // Filtrer les recettes côté client pour la recherche et les filtres instantanés
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      !searchTerm ||
      recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (recipe.description &&
        recipe.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDifficulty = selectedDifficulty
      ? recipe.difficulty === selectedDifficulty
      : true;

    const matchesMakeable = showOnlyMakeable
      ? (recipe.missingIngredientsCount ?? 0) === 0
      : true;

    const matchesFavorite = showOnlyFavorites ? recipe.isFavorite : true;

    const matchesAI = showOnlyAI ? recipe.source === "ai_generated" : true;

    const matchesMyRecipes = showOnlyMyRecipes
      ? recipe.createdById === currentUser?.id
      : true;

    return (
      matchesSearch &&
      matchesDifficulty &&
      matchesMakeable &&
      matchesFavorite &&
      matchesAI &&
      matchesMyRecipes
    );
  });

  const handleToggleFavorite = (recipeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const recipe = recipes.find((r) => r.id === recipeId);
    if (recipe) {
      favoriteMutation.mutate({
        recipeId,
        isFavorite: recipe.isFavorite || false,
      });
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "hard":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "Facile";
      case "medium":
        return "Moyen";
      case "hard":
        return "Difficile";
      default:
        return difficulty;
    }
  };

  const deletableRecipe = selectedRecipe;

  const openCreateModal = () => {
    setEditingRecipe(null);
    resetCreateForm({
      title: "",
      description: "",
      difficulty: "medium",
      prepTime: 0,
      cookTime: 0,
      servings: 4,
      ingredients: [{ ingredientName: "", quantity: 1, unit: "pièce", notes: "" }],
      instructions: [{ text: "" }],
    });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (recipe: Recipe) => {
    setSelectedRecipe(null);
    setEditingRecipe(recipe);
    resetCreateForm({
      title: recipe.title,
      description: recipe.description || "",
      difficulty: recipe.difficulty,
      prepTime: recipe.prepTime ?? 0,
      cookTime: recipe.cookTime ?? 0,
      servings: recipe.servings,
      ingredients:
        recipe.ingredients && recipe.ingredients.length > 0
          ? recipe.ingredients.map((ing) => ({
              ingredientName: ing.ingredient?.name || "",
              quantity: ing.quantity,
              unit: ing.unit,
              notes: ing.notes || "",
            }))
          : [{ ingredientName: "", quantity: 1, unit: "pièce", notes: "" }],
      instructions:
        recipe.instructions && recipe.instructions.length > 0
          ? recipe.instructions.map((text) => ({ text }))
          : [{ text: "" }],
    });
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recettes</h1>
          <p className="text-gray-600">
            Découvrez des recettes adaptées à vos ingrédients
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => setIsGenerateModalOpen(true)}
            className="flex items-center"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Générer avec IA
          </Button>
          <Button
            onClick={openCreateModal}
            className="flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Créer recette
          </Button>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher des recettes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Difficulté */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Toutes difficultés</option>
            <option value="easy">Facile</option>
            <option value="medium">Moyen</option>
            <option value="hard">Difficile</option>
          </select>

          {/* Filtres avancés */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyMakeable}
                onChange={(e) => setShowOnlyMakeable(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Réalisables
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyFavorites}
                onChange={(e) => setShowOnlyFavorites(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Favoris</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyAI}
                onChange={(e) => setShowOnlyAI(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Recette IA
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyMyRecipes}
                onChange={(e) => setShowOnlyMyRecipes(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Mes recettes
              </span>
            </label>
          </div>

          {/* Stats */}
          <div className="text-sm text-gray-600">
            {filteredRecipes.length} recette
            {filteredRecipes.length !== 1 ? "s" : ""} trouvée
            {filteredRecipes.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Liste des recettes */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <ChefHat className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune recette trouvée
            </h3>
            <p className="text-gray-500 mb-6">
              Essayez de modifier vos filtres ou créez votre première recette
            </p>
            <Button
              onClick={() => {
                /* TODO: Create recipe */
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Créer ma première recette
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => (
            <Card
              key={recipe.id}
              hover
              className="cursor-pointer"
              onClick={() => setSelectedRecipe(recipe)}
            >
              {/* Image de la recette */}
              <div className="relative h-48 bg-gray-100 rounded-t-lg overflow-hidden group">
                {recipe.imageUrl ? (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 group-hover:bg-gray-100 transition-colors">
                    <ChefHat className="w-12 h-12 mb-1 text-gray-300" />
                    <span className="text-xs font-medium text-gray-400 flex items-center">
                      <Camera className="w-3.5 h-3.5 mr-1" /> Ajouter photo
                    </span>
                  </div>
                )}

                {/* Badge difficulté & auteur */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium shadow-sm ${getDifficultyColor(
                      recipe.difficulty
                    )}`}
                  >
                    {getDifficultyLabel(recipe.difficulty)}
                  </span>
                  {recipe.source === "ai_generated" && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 shadow-sm">
                      IA
                    </span>
                  )}
                  {recipe.createdById === currentUser?.id && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 shadow-sm">
                      Ma recette
                    </span>
                  )}
                </div>

                {/* Actions rapides en haut à droite : modifier, photo & favoris */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(recipe);
                    }}
                    title="Modifier la recette"
                    className="p-1.5 rounded-full bg-white/85 hover:bg-white text-gray-700 hover:text-primary-600 shadow-sm transition-all hover:scale-105"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetRecipeIdForUpload(recipe.id);
                      cardFileInputRef.current?.click();
                    }}
                    title="Ajouter ou modifier la photo"
                    className="p-1.5 rounded-full bg-white/85 hover:bg-white text-gray-700 hover:text-primary-600 shadow-sm transition-all hover:scale-105"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleToggleFavorite(recipe.id, e)}
                    className="p-1.5 rounded-full bg-white/85 hover:bg-white shadow-sm transition-all hover:scale-105"
                    title={recipe.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        recipe.isFavorite
                          ? "fill-red-500 text-red-500"
                          : "text-gray-400 hover:text-red-500"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <CardHeader className="pb-3">
                <CardTitle className="text-lg line-clamp-2">
                  {recipe.title}
                </CardTitle>
                {recipe.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {recipe.description}
                  </p>
                )}
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                  <div className="flex items-center space-x-4">
                    {recipe.prepTime && (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {recipe.prepTime + (recipe.cookTime || 0)} min
                        </span>
                      </div>
                    )}

                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{recipe.servings} pers.</span>
                    </div>
                  </div>
                </div>

                {/* Affichage des ingrédients disponibles */}
                <div className="text-sm font-medium text-blue-600">
                  {recipe.ingredients.length - (recipe.missingIngredientsCount || 0)} / {recipe.ingredients.length} ingrédients disponibles
                </div>

                {/* Coût estimé */}
                {recipe.estimatedCost !== undefined && recipe.estimatedCost !== null && recipe.estimatedCost > 0 && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-emerald-600" />
                      Coût estimé :
                    </span>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      ~{recipe.estimatedCost.toFixed(2)} €
                      {recipe.costPerServing ? ` (${recipe.costPerServing.toFixed(2)} €/p.)` : ""}
                    </span>
                  </div>
                )}

                {/* Ingrédients preview */}
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">
                    Ingrédients principaux:
                  </div>
                  <div className="text-sm text-gray-700">
                    {recipe.ingredients && recipe.ingredients.length > 0
                      ? recipe.ingredients
                          .slice(0, 3)
                          .map((ing) => ing.ingredient?.name || "Ingrédient")
                          .join(", ")
                      : "Aucun ingrédient"}
                    {recipe.ingredients &&
                      recipe.ingredients.length > 3 &&
                      "..."}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal génération IA */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => {
          setIsGenerateModalOpen(false);
          resetGenerateForm();
        }}
        title="Générer une recette avec l'IA"
        size="xl"
      >
        <form
          onSubmit={handleGenerateSubmit((values) =>
            generateRecipeMutation.mutate({
              prompt: values.prompt.trim(),
              useFridge: !!values.useFridge,
            })
          )}
          className="space-y-6"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Décrivez vos envies
            </label>
            <textarea
              rows={5}
              placeholder="Ex : J'aimerais un plat italien végétarien pour ce soir."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              {...generateRegister("prompt")}
            />
            {generateErrors.prompt && (
              <p className="mt-1 text-sm text-red-600">
                {generateErrors.prompt.message}
              </p>
            )}
          </div>

          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="useFridge"
              className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              {...generateRegister("useFridge")}
            />
            <label
              htmlFor="useFridge"
              className="text-sm text-gray-700 leading-relaxed"
            >
              Utiliser les ingrédients disponibles dans mon frigo pour adapter
              la recette.
            </label>
          </div>

          <p className="text-sm text-gray-500">
            Conseil : précisez le type de plat, l'inspiration culinaire, le
            nombre de personnes et les contraintes éventuelles. Exemple :
            &ldquo;Menu végétarien pour 2 personnes ce soir avec des pâtes et
            des légumes.&rdquo;
          </p>

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsGenerateModalOpen(false);
                resetGenerateForm();
              }}
              disabled={generateRecipeMutation.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" loading={generateRecipeMutation.isPending}>
              Générer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal création / modification manuelle */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingRecipe(null);
          resetCreateForm();
        }}
        title={editingRecipe ? "Modifier la recette" : "Créer une recette"}
        size="xl"
      >
        <form
          onSubmit={handleCreateSubmit((values) => {
            if (editingRecipe) {
              updateRecipeMutation.mutate({ id: editingRecipe.id, values });
            } else {
              createRecipeMutation.mutate(values);
            }
          })}
          className="space-y-6 max-h-[80vh] overflow-y-auto pr-1"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titre *
              </label>
              <input
                type="text"
                placeholder="Ex : Poulet rôti aux herbes"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                {...createRegister("title")}
              />
              {createErrors.title && (
                <p className="mt-1 text-sm text-red-600">
                  {createErrors.title.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulté *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                {...createRegister("difficulty")}
              >
                <option value="easy">Facile</option>
                <option value="medium">Moyen</option>
                <option value="hard">Difficile</option>
              </select>
              {createErrors.difficulty && (
                <p className="mt-1 text-sm text-red-600">
                  {createErrors.difficulty.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              rows={4}
              placeholder="Décrivez brièvement la recette..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              {...createRegister("description")}
            />
            {createErrors.description && (
              <p className="mt-1 text-sm text-red-600">
                {createErrors.description.message as string}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Préparation (min)
              </label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                {...createRegister("prepTime")}
              />
              {createErrors.prepTime && (
                <p className="mt-1 text-sm text-red-600">
                  {createErrors.prepTime.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cuisson (min)
              </label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                {...createRegister("cookTime")}
              />
              {createErrors.cookTime && (
                <p className="mt-1 text-sm text-red-600">
                  {createErrors.cookTime.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de personnes *
              </label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                {...createRegister("servings")}
              />
              {createErrors.servings && (
                <p className="mt-1 text-sm text-red-600">
                  {createErrors.servings.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Ingrédients
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  appendIngredient({
                    ingredientName: "",
                    quantity: 1,
                    unit: "",
                    notes: "",
                  })
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un ingrédient
              </Button>
            </div>

            <div className="space-y-4">
              {ingredientFields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ingrédient *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Tomate, Oignon, Beurre..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        {...createRegister(
                          `ingredients.${index}.ingredientName` as const
                        )}
                      />
                      {createErrors.ingredients?.[index]?.ingredientName && (
                        <p className="mt-1 text-sm text-red-600">
                          {
                            createErrors.ingredients?.[index]?.ingredientName
                              ?.message
                          }
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantité *
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex : 1.5 ou 200"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        {...createRegister(
                          `ingredients.${index}.quantity` as const,
                          {
                            setValueAs: parseDecimalNumber,
                          }
                        )}
                      />
                      {createErrors.ingredients?.[index]?.quantity && (
                        <p className="mt-1 text-sm text-red-600">
                          {createErrors.ingredients?.[index]?.quantity?.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unité *
                      </label>
                      <input
                        type="text"
                        placeholder="g, ml, pièce..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        {...createRegister(
                          `ingredients.${index}.unit` as const
                        )}
                      />
                      {createErrors.ingredients?.[index]?.unit && (
                        <p className="mt-1 text-sm text-red-600">
                          {createErrors.ingredients?.[index]?.unit?.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes (optionnel)
                      </label>
                      <input
                        type="text"
                        placeholder="Bio, découpé, température, ..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        {...createRegister(
                          `ingredients.${index}.notes` as const
                        )}
                      />
                      {createErrors.ingredients?.[index]?.notes && (
                        <p className="mt-1 text-sm text-red-600">
                          {createErrors.ingredients?.[index]?.notes?.message}
                        </p>
                      )}
                    </div>

                    {ingredientFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeIngredient(index)}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Étapes</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  appendInstruction({
                    text: "",
                  })
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une étape
              </Button>
            </div>

            <div className="space-y-4">
              {instructionFields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <textarea
                      rows={3}
                      placeholder={`Décrivez l'étape ${index + 1}`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      {...createRegister(`instructions.${index}.text` as const)}
                    />
                    {createErrors.instructions?.[index]?.text && (
                      <p className="mt-1 text-sm text-red-600">
                        {createErrors.instructions?.[index]?.text?.message}
                      </p>
                    )}
                  </div>
                  {instructionFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeInstruction(index)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingRecipe(null);
                resetCreateForm();
              }}
              disabled={createRecipeMutation.isPending || updateRecipeMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              loading={createRecipeMutation.isPending || updateRecipeMutation.isPending}
            >
              {editingRecipe ? "Enregistrer les modifications" : "Créer la recette"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal détail recette */}
      <Modal
        isOpen={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        title={selectedRecipe?.title}
        size="xl"
      >
        {selectedRecipe && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
            {/* Image et infos principales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shadow-inner">
                  {selectedRecipe.imageUrl ? (
                    <img
                      src={selectedRecipe.imageUrl}
                      alt={selectedRecipe.title}
                      className="w-full h-64 object-cover"
                    />
                  ) : (
                    <div className="w-full h-64 flex flex-col items-center justify-center text-gray-400 p-6 text-center bg-gray-50">
                      <ChefHat className="w-16 h-16 mb-2 text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">
                        Aucune photo pour cette recette
                      </p>
                    </div>
                  )}

                  {/* Actions overlay sur l'image */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-white/95 hover:bg-white text-gray-800 shadow flex items-center"
                      loading={uploadImageMutation.isPending}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4 mr-1.5" />
                      {selectedRecipe.imageUrl ? "Changer la photo" : "Ajouter une photo"}
                    </Button>
                    {selectedRecipe.imageUrl && (
                      <Button
                        size="sm"
                        variant="danger"
                        className="shadow flex items-center"
                        loading={deleteImageMutation.isPending}
                        onClick={() => {
                          if (window.confirm("Voulez-vous supprimer cette photo ?")) {
                            deleteImageMutation.mutate(selectedRecipe.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Bouton visible pour ajouter/modifier la photo */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 flex items-center justify-center text-gray-700"
                    loading={uploadImageMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4 mr-2 text-primary-600" />
                    {selectedRecipe.imageUrl ? "Changer la photo" : "Ajouter une photo depuis mon appareil"}
                  </Button>
                  {selectedRecipe.imageUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 border-red-200 flex items-center"
                      title="Supprimer la photo"
                      loading={deleteImageMutation.isPending}
                      onClick={() => {
                        if (window.confirm("Voulez-vous supprimer la photo de cette recette ?")) {
                          deleteImageMutation.mutate(selectedRecipe.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {selectedRecipe.description && (
                  <p className="text-gray-600">{selectedRecipe.description}</p>
                )}
              </div>

              <div className="space-y-4">
                {/* Badges et infos */}
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(
                      selectedRecipe.difficulty
                    )}`}
                  >
                    {getDifficultyLabel(selectedRecipe.difficulty)}
                  </span>
                  {selectedRecipe.isFavorite && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      ❤️ Favori
                    </span>
                  )}
                  {selectedRecipe.source === "ai_generated" && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                      ✨ Générée par l'IA
                    </span>
                  )}
                </div>

                {/* Temps, portions et coût */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="font-medium text-gray-900">Temps total</div>
                    <div className="text-gray-600">
                      {(selectedRecipe.prepTime || 0) +
                        (selectedRecipe.cookTime || 0)}{" "}
                      minutes
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="font-medium text-gray-900">Portions</div>
                    <div className="text-gray-600">
                      {selectedRecipe.servings} personne
                      {selectedRecipe.servings > 1 ? "s" : ""}
                    </div>
                  </div>
                  {selectedRecipe.estimatedCost !== undefined && selectedRecipe.estimatedCost !== null && (
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg col-span-2 sm:col-span-1">
                      <div className="font-medium text-emerald-900 flex items-center gap-1">
                        <Coins className="w-4 h-4 text-emerald-600" />
                        Coût estimé
                      </div>
                      <div className="text-emerald-700 font-semibold text-base">
                        ~{selectedRecipe.estimatedCost.toFixed(2)} €
                      </div>
                      {selectedRecipe.costPerServing && (
                        <div className="text-xs text-emerald-600">
                          {selectedRecipe.costPerServing.toFixed(2)} € / pers.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex space-x-3">
                  <Button
                    onClick={(e) => handleToggleFavorite(selectedRecipe.id, e)}
                    variant={selectedRecipe.isFavorite ? "danger" : "outline"}
                    className="flex-1"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    {selectedRecipe.isFavorite
                      ? "Retirer des favoris"
                      : "Ajouter aux favoris"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Ingrédients */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Ingrédients ({selectedRecipe.ingredients.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedRecipe.ingredients.map((ingredient, index) => {
                  const isAvailable = ingredient.available ?? false;
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isAvailable
                          ? "bg-green-50 border border-green-200"
                          : "bg-red-50 border border-red-200"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              isAvailable ? "text-green-800" : "text-red-800"
                            }`}
                          >
                            {ingredient.ingredient?.name || "Ingrédient"}
                          </span>
                          {ingredient.estimatedPrice !== undefined && ingredient.estimatedPrice !== null && ingredient.estimatedPrice > 0 && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ~{ingredient.estimatedPrice.toFixed(2)} €
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-sm ${
                            isAvailable ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {ingredient.quantity} {ingredient.unit}
                        </div>
                      </div>
                      {!isAvailable && shoppingLists.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                          onClick={async () => {
                            if (!selectedListId && shoppingLists.length > 0) {
                              setSelectedListId(shoppingLists[0].id);
                            }
                            const listId = selectedListId || shoppingLists[0].id;
                            try {
                              if (!ingredient.ingredientId || !ingredient.unit) {
                                toast.error("Impossible d'ajouter cet ingrédient : données incomplètes");
                                return;
                              }
                              await shoppingListService.addItemToShoppingList(
                                listId,
                                {
                                  ingredientId: ingredient.ingredientId,
                                  quantity: ingredient.quantity,
                                  unit: ingredient.unit,
                                  notes: ingredient.notes || undefined,
                                }
                              );
                              toast.success(
                                `${ingredient.ingredient?.name} ajouté à la liste de courses !`
                              );
                            } catch (error: any) {
                              toast.error(
                                error?.message ||
                                  "Erreur lors de l'ajout à la liste de courses"
                              );
                            }
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Instructions
              </h3>
              <ol className="space-y-3">
                {selectedRecipe.instructions.map((instruction, index) => (
                  <li key={index} className="flex space-x-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white text-sm font-medium rounded-full flex items-center justify-center">
                      {index + 1}
                    </span>
                    <p className="text-gray-700">{instruction}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap gap-2 justify-between items-center pt-4 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                {selectedRecipe.createdBy
                  ? `Par ${selectedRecipe.createdBy.firstName}`
                  : "Recette du catalogue"}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => openEditModal(selectedRecipe)}
                  className="flex items-center"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Modifier la recette
                </Button>

                {deletableRecipe && (
                  <Button
                    variant="danger"
                    loading={deleteRecipeMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Êtes-vous sûr de vouloir supprimer définitivement la recette "${deletableRecipe.title}" ?`
                        )
                      ) {
                        deleteRecipeMutation.mutate(deletableRecipe.id);
                      }
                    }}
                    className="flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer cette recette
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Inputs cachés pour le téléversement de photos */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && selectedRecipe) {
            uploadImageMutation.mutate({
              recipeId: selectedRecipe.id,
              fileOrUrl: file,
            });
          }
          e.target.value = "";
        }}
      />

      <input
        type="file"
        ref={cardFileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && targetRecipeIdForUpload) {
            uploadImageMutation.mutate({
              recipeId: targetRecipeIdForUpload,
              fileOrUrl: file,
            });
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
