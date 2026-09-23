import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  TrendingUp,
  Clock,
  Star,
  ChefHat,
  Sparkles,
  ScanLine,
  ArrowRight,
  Coins,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { useAuth } from "@/hooks/useAuth";
import { fridgeService } from "@/services/fridgeService";
import { recipeService } from "@/services/recipeService";
import { shoppingListService } from "@/services/shoppingListService";

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"favorites" | "suggested">("favorites");
  const queryClient = useQueryClient();

  // Récupérer les données du dashboard
  const { data: fridgeItems = [], isError: fridgeError } = useQuery({
    queryKey: ["fridgeItems"],
    queryFn: fridgeService.getFridgeItems,
    retry: false,
  });

  const { data: suggestedRecipes = [], isError: recipesError } = useQuery({
    queryKey: ["suggestedRecipes"],
    queryFn: recipeService.getSuggestedRecipes,
    retry: false,
  });

  const { data: favoriteRecipes = [], isError: favoritesError } = useQuery({
    queryKey: ["favoriteRecipes"],
    queryFn: recipeService.getFavoriteRecipes,
    retry: false,
  });

  const { data: shoppingLists = [], isError: shoppingError } = useQuery({
    queryKey: ["shoppingLists"],
    queryFn: shoppingListService.getShoppingLists,
    retry: false,
  });

  // Calculer les statistiques
  const stats = {
    fridgeItemsCount: fridgeItems.length,
    recipesCount: Array.isArray(suggestedRecipes)
      ? suggestedRecipes.filter((r) => (r.compatibilityScore ?? 0) >= 80).length
      : 0,
    favoritesCount: Array.isArray(favoriteRecipes) ? favoriteRecipes.length : 0,
    shoppingListItemsCount: Array.isArray(shoppingLists)
      ? shoppingLists.reduce(
          (acc, list) =>
            acc + (list.items?.filter((item) => !item.purchased)?.length || 0),
          0
        )
      : 0,
  };

  // Aliments avec date de péremption, triés par date la plus proche (les plus urgents en premier)
  const expiringItems = useMemo(() => {
    return [...fridgeItems]
      .filter((item) => !!item.expiryDate)
      .sort(
        (a, b) =>
          new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime()
      );
  }, [fridgeItems]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  return (
    <div className="space-y-8">
      {/* Header personnalisé */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">
          {getGreeting()} {user?.firstName} !
        </h1>
        <p className="text-gray-600 text-base">
          Que préparez-vous aujourd'hui ? Découvrez des recettes adaptées à vos
          ingrédients disponibles.
        </p>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-0">
        <Card hover>
          <CardContent className="px-6 py-6">
            <div className="flex flex-col items-center text-center pt-1">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {stats.fridgeItemsCount}
              </h3>
              <p className="text-sm text-gray-600">Ingrédients disponibles</p>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="px-6 py-6">
            <div className="flex flex-col items-center text-center pt-1">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {stats.recipesCount}
              </h3>
              <p className="text-sm text-gray-600">Recettes réalisables</p>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="px-6 py-6">
            <div className="flex flex-col items-center text-center pt-1">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {stats.favoritesCount}
              </h3>
              <p className="text-sm text-gray-600">Recettes favorites</p>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="px-6 py-6">
            <div className="flex flex-col items-center text-center pt-1">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {stats.shoppingListItemsCount}
              </h3>
              <p className="text-sm text-gray-600">Articles en liste</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-0">
        <Card hover>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              Ajouter des ingrédients
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              Scannez votre ticket de caisse ou ajoutez manuellement
            </p>
            <div className="flex space-x-3">
              <Button
                asChild
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Link to="/fridge">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter manuellement
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Link to="/fridge">
                  <ScanLine className="w-4 h-4 mr-2" />
                  Scanner ticket
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              <Link to="/recipes">Générer une recette</Link>
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              Laissez l'IA créer une recette avec vos ingrédients
            </p>
            <Button
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Générer avec IA
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Aliments qui périment bientôt */}
      <Card>
        <CardHeader className="pb-3 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Aliments qui périment bientôt
                  {expiringItems.length > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {expiringItems.length}
                    </span>
                  )}
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Consommez ces ingrédients en priorité pour éviter le gaspillage alimentaire
                </p>
              </div>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link to="/fridge" className="flex items-center">
                Gérer mon frigo
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {expiringItems.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Aucun aliment avec date de péremption renseignée
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Ajoutez des dates de péremption à vos aliments pour les suivre automatiquement ici.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/fridge">Ajouter des dates dans mon frigo</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {expiringItems.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between p-4 rounded-xl border border-gray-200/90 bg-white hover:border-primary-300 hover:shadow-md transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4
                          className="font-semibold text-gray-900 text-sm truncate group-hover:text-primary-600 transition-colors"
                          title={item.ingredient.name}
                        >
                          {item.ingredient.name}
                        </h4>
                        {item.brand && (
                          <span className="text-xs text-gray-500 truncate block">
                            {item.brand}
                          </span>
                        )}
                      </div>
                      {item.ingredient.category && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-offset-1"
                          style={{
                            backgroundColor:
                              item.ingredient.category.color || "#3b82f6",
                          }}
                          title={item.ingredient.category.name}
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 pt-1 border-t border-gray-100">
                      <span>Quantité</span>
                      <span className="font-medium text-gray-900">
                        {item.quantity} {item.unit}
                        {(item.itemCount || 1) > 1 && ` (x${item.itemCount})`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Date limite</span>
                      <span className="font-medium text-gray-700">
                        {new Date(item.expiryDate!).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 mt-2 border-t border-gray-100 space-y-2">
                    <FreshnessBadge
                      expiryDate={item.expiryDate}
                      showDays={true}
                      className="w-full justify-center py-1 text-xs"
                    />

                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                    >
                      <Link
                        to={`/recipes?search=${encodeURIComponent(
                          item.ingredient.name
                        )}`}
                      >
                        Trouver une recette
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recettes recommandées & favorites */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("favorites")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "favorites"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Vos favoris ({favoriteRecipes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("suggested")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "suggested"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Suggérées selon frigo ({suggestedRecipes.length})
              </button>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/recipes">Voir toutes</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(activeTab === "favorites" ? favoriteRecipes : suggestedRecipes).length === 0 ? (
            <div className="text-center py-8">
              <ChefHat className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {activeTab === "favorites"
                  ? "Vous n'avez pas encore de recette favorite"
                  : "Aucune recette suggérée avec vos ingrédients actuels"}
              </h3>
              <p className="text-gray-500 mb-4">
                {activeTab === "favorites"
                  ? "Ajoutez des recettes en favori pour les retrouver ici rapidement."
                  : "Ajoutez davantage d'aliments dans votre frigo pour débloquer des recettes."}
              </p>
              <Button asChild>
                <Link to={activeTab === "favorites" ? "/recipes" : "/fridge"}>
                  {activeTab === "favorites" ? (
                    <>
                      <Star className="w-4 h-4 mr-2" />
                      Parcourir les recettes
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Gérer mon frigo
                    </>
                  )}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(activeTab === "favorites" ? favoriteRecipes : suggestedRecipes)
                .slice(0, 3)
                .map((recipe) => {
                  const availableCount =
                    recipe.ingredients.filter((ri) => ri.available).length ||
                    Math.max(
                      0,
                      recipe.ingredients.length -
                        (recipe.missingIngredientsCount ??
                          recipe.ingredients.length)
                    );

                  return (
                    <Card
                      key={recipe.id}
                      hover
                      className="cursor-pointer"
                      onClick={() => navigate("/recipes")}
                    >
                      <div className="relative h-32 bg-gray-200 rounded-t-lg overflow-hidden">
                        {recipe.imageUrl ? (
                          <img
                            src={recipe.imageUrl}
                            alt={recipe.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <ChefHat className="w-8 h-8" />
                          </div>
                        )}

                        {(recipe.compatibilityScore ?? 0) >= 80 && (
                          <div className="absolute top-2 right-2">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✅ Réalisable
                            </span>
                          </div>
                        )}
                      </div>

                      <CardContent className="p-4">
                        <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">
                          {recipe.title}
                        </h3>
                        {recipe.description && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {recipe.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center space-x-2">
                            {recipe.prepTime && (
                              <span className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {recipe.prepTime + (recipe.cookTime || 0)} min
                              </span>
                            )}
                            <span>{recipe.servings} pers.</span>
                          </div>
                          <span className="text-blue-600 font-medium">
                            {availableCount} / {recipe.ingredients.length} ingrédients
                          </span>
                        </div>

                        {recipe.estimatedCost !== undefined && recipe.estimatedCost !== null && recipe.estimatedCost > 0 && (
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-100 text-xs">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Coins className="w-3 h-3 text-emerald-600" />
                              Coût estimé
                            </span>
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] border border-emerald-100">
                              ~{recipe.estimatedCost.toFixed(2)} €
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
