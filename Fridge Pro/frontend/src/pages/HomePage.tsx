import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus,
  TrendingUp,
  Clock,
  Star,
  ChefHat,
  Sparkles,
  ScanLine,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { fridgeService } from "@/services/fridgeService";
import { recipeService } from "@/services/recipeService";
import { shoppingListService } from "@/services/shoppingListService";

export function HomePage() {
  const { user } = useAuth();
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
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {stats.fridgeItemsCount}
              </h3>
              <p className="text-sm text-gray-600">Ingrédients disponibles</p>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {stats.recipesCount}
              </h3>
              <p className="text-sm text-gray-600">Recettes réalisables</p>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {stats.favoritesCount}
              </h3>
              <p className="text-sm text-gray-600">Recettes favorites</p>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
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
              <Button asChild variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                <Link to="/fridge">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter manuellement
                </Link>
              </Button>
              <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                <ScanLine className="w-4 h-4 mr-2" />
                Scanner ticket
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Générer une recette</h3>
            <p className="text-gray-600 mb-4 text-sm">
              Laissez l'IA créer une recette avec vos ingrédients
            </p>
            <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
              <Sparkles className="w-4 h-4 mr-2" />
              Générer avec IA
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recettes recommandées */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              Recettes recommandées pour vous
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/recipes">Voir toutes</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {favoriteRecipes.length === 0 ? (
            <div className="text-center py-8">
              <ChefHat className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Vous n'avez pas encore de recette favorite
              </h3>
              <p className="text-gray-500 mb-4">
                Ajoutez des recettes en favori pour les retrouver ici
                rapidement.
              </p>
              <Button asChild>
                <Link to="/recipes">
                  <Star className="w-4 h-4 mr-2" />
                  Parcourir les recettes
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {favoriteRecipes.slice(0, 3).map((recipe) => (
                <Card key={recipe.id} hover className="cursor-pointer">
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
                      {(recipe.compatibilityScore ?? 0) >= 80 ? (
                        <span className="text-green-600 font-medium">
                          Réalisable
                        </span>
                      ) : (
                        <span className="text-orange-600 font-medium">
                          {recipe.missingIngredientsCount || 0} manquant
                          {(recipe.missingIngredientsCount || 0) > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
