import React, { useState } from "react";
import { Search, Plus, Loader } from "lucide-react";

interface Ingredient {
  id: string;
  name: string;
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
  image?: string;
  isFromAPI?: boolean;
  source?: string;
  nutritionalInfo?: {
    calories: number;
    proteins: number;
    carbohydrates: number;
    fat: number;
  };
}

const OpenFoodFactsTest: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchIngredients = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ingredients/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Erreur lors de la recherche");
      }

      const data = await response.json();
      setIngredients(data.data.ingredients || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const searchExternal = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ingredients/external/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Erreur lors de la recherche");
      }

      const data = await response.json();
      setIngredients(data.data.ingredients || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchIngredients();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        🇫🇷 Test Open Food Facts - Recherche d'Ingrédients
      </h2>

      {/* Barre de recherche */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Rechercher un ingrédient (ex: tomate, bœuf, fromage...)"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={searchIngredients}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Base + OpenFF
          </button>

          <button
            onClick={searchExternal}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            OpenFF seul
          </button>
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Résultats */}
      {ingredients.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Résultats ({ingredients.length})
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            {ingredients.map((ingredient) => (
              <div
                key={ingredient.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  {ingredient.image && (
                    <img
                      src={ingredient.image}
                      alt={ingredient.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900">
                        {ingredient.name}
                      </h4>
                      {ingredient.source === "openfoodfacts" && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          OpenFF
                        </span>
                      )}
                    </div>

                    {ingredient.category && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">
                          {ingredient.category.icon}
                        </span>
                        <span
                          className="text-xs px-2 py-1 rounded text-white"
                          style={{ backgroundColor: ingredient.category.color }}
                        >
                          {ingredient.category.name}
                        </span>
                      </div>
                    )}

                    {ingredient.nutritionalInfo && (
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>
                          🔥 {ingredient.nutritionalInfo.calories} kcal/100g
                        </div>
                        <div>
                          🥩 {ingredient.nutritionalInfo.proteins}g | 🍞{" "}
                          {ingredient.nutritionalInfo.carbohydrates}g | 🧈{" "}
                          {ingredient.nutritionalInfo.fat}g
                        </div>
                      </div>
                    )}
                  </div>

                  <button className="text-blue-600 hover:text-blue-800">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">
          ℹ️ Comment ça marche ?
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            • <strong>"Base + OpenFF"</strong> : Recherche d'abord dans notre
            base, puis complète avec Open Food Facts
          </li>
          <li>
            • <strong>"OpenFF seul"</strong> : Recherche uniquement dans Open
            Food Facts (base française de 3M+ produits)
          </li>
          <li>
            • Les résultats OpenFF incluent les informations nutritionnelles
            automatiquement
          </li>
          <li>
            • Essayez : "tomate", "bœuf", "fromage", "pomme", "baguette"...
          </li>
        </ul>
      </div>
    </div>
  );
};

export default OpenFoodFactsTest;
