import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Plus,
  Clock,
  ChefHat,
  ScanLine,
  ArrowRight,
  Coins,
  Calendar,
  Snowflake,
  Check,
  ShieldCheck,
  Flame,
  Refrigerator,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { useAuth } from "@/hooks/useAuth";
import { fridgeService } from "@/services/fridgeService";
import { recipeService } from "@/services/recipeService";
import { formatImageUrl } from "@/utils/imageUtils";
import { isItemFrozen } from "@/utils/frozenUtils";
import { getFridgeItemName } from "@/utils/itemName";
import type { FridgeItem } from "@/types";

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"suggested" | "favorites">("suggested");
  const [expiryModalItem, setExpiryModalItem] = useState<FridgeItem | null>(null);
  const [quickExpiryDate, setQuickExpiryDate] = useState("");
  const queryClient = useQueryClient();

  // Données du frigo en temps réel
  const { data: fridgeItems = [], isError: fridgeError } = useQuery({
    queryKey: ["fridgeItems"],
    queryFn: fridgeService.getFridgeItems,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fridgeService.updateFridgeItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Aliment mis à jour !");
      setExpiryModalItem(null);
    },
    onError: () => {
      toast.error("Erreur lors de la modification");
    },
  });

  const finishMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      fridgeService.finishFridgeItem(id, { status: "consumed", finishAll: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseHistory"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Aliment marqué comme consommé !");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const handleFreezeItem = async (item: FridgeItem) => {
    let categories: any[] = [];
    try {
      categories = await fridgeService.getCategories();
    } catch {
      // continuer
    }
    let freezerCat = categories.find(
      (c) =>
        c.name.toLowerCase().includes("surgele") ||
        c.name.toLowerCase().includes("surgelé") ||
        c.name.toLowerCase().includes("congel")
    );
    let freezerCatId = freezerCat?.id;
    if (!freezerCatId) {
      try {
        const newCat = await fridgeService.createCategory({
          name: "Surgelés",
          color: "#06b6d4",
          icon: "🧊",
        });
        freezerCatId = newCat.id;
        queryClient.invalidateQueries({ queryKey: ["categories"] });
      } catch {
        // continuer
      }
    }

    updateMutation.mutate({
      id: item.id,
      data: {
        categoryId: freezerCatId,
        expiryDate: "",
        addedDate: new Date().toISOString(),
      },
    });
    toast.success(`"${getFridgeItemName(item)}" mis en congélation !`);
  };

  const handleQuickExpirySave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expiryModalItem) return;
    updateMutation.mutate({
      id: expiryModalItem.id,
      data: {
        expiryDate: quickExpiryDate || "",
      },
    });
  };

  const { data: suggestedRecipes = [] } = useQuery({
    queryKey: ["suggestedRecipes"],
    queryFn: recipeService.getSuggestedRecipes,
  });

  const { data: favoriteRecipes = [] } = useQuery({
    queryKey: ["favoriteRecipes"],
    queryFn: recipeService.getFavoriteRecipes,
  });

  // Recettes véritablement réalisables (0 ingrédient manquant)
  const { data: makeableRecipes = [] } = useQuery({
    queryKey: ["recipes", { makeable: true }],
    queryFn: () => recipeService.getRecipes({ makeable: true, limit: 500 }),
  });

  // Aliments avec date de péremption (exclut formellement les surgelés/congelés non périssables)
  const expiringItems = useMemo(() => {
    return [...fridgeItems]
      .filter((item) => !isItemFrozen(item) && !!item.expiryDate)
      .sort(
        (a, b) =>
          new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime()
      );
  }, [fridgeItems]);

  const urgentItemsCount = useMemo(() => {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    return expiringItems.filter(
      (item) => new Date(item.expiryDate!) <= sevenDaysFromNow
    ).length;
  }, [expiringItems]);

  // Calcul du score de fraîcheur / santé du frigo (anti-gaspillage)
  const fridgeHealthScore = useMemo(() => {
    if (fridgeItems.length === 0) return 100;
    const ratio = Math.max(0, 100 - (urgentItemsCount / Math.max(fridgeItems.length, 1)) * 100);
    return Math.round(ratio);
  }, [fridgeItems.length, urgentItemsCount]);

  // Recette vedette du moment (100% faisable en priorité, ou suggérée)
  const featuredRecipe = useMemo(() => {
    if (makeableRecipes.length > 0) return makeableRecipes[0];
    if (suggestedRecipes.length > 0) return suggestedRecipes[0];
    return null;
  }, [makeableRecipes, suggestedRecipes]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  return (
    <div className="space-y-7 sm:space-y-9">
      {/* 1. Header Zen & Actions Rapides */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-800 border border-primary-200/80 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
            Cuisine intelligente & anti-gaspillage
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1A1C19] tracking-tight">
            {getGreeting()}{user?.firstName ? `, ${user.firstName}` : ""} 👋
          </h1>
          <p className="text-[#6F726D] text-xs sm:text-sm mt-1">
            Gérez votre stock en un coup d'œil et découvrez ce que vous pouvez cuisiner ce soir.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-xl border-[#E8E5DF] hover:border-[#D5D2CB] text-[#1A1C19] bg-white shadow-soft-xs"
          >
            <Link to="/fridge">
              <ScanLine className="w-4 h-4 mr-1.5 text-primary-600" />
              Scanner ticket
            </Link>
          </Button>
          <Button
            asChild
            variant="primary"
            size="sm"
            className="rounded-xl bg-[#183328] hover:bg-[#12261e] text-white shadow-soft-xs"
          >
            <Link to="/fridge">
              <Plus className="w-4 h-4 mr-1.5" />
              Ajouter au frigo
            </Link>
          </Button>
        </div>
      </div>

      {/* Alerte discrète si reconnexion réseau */}
      {fridgeError && (
        <div className="flex items-center justify-between p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-xs sm:text-sm text-amber-800 animate-fade-in shadow-soft-xs">
          <div className="flex items-center gap-2">
            <span>⏳</span>
            <span>Le serveur se réveille ou la connexion a été interrompue.</span>
          </div>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries()}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-xs shadow-xs transition-colors shrink-0"
          >
            Actualiser
          </button>
        </div>
      )}

      {/* 2. Bento Grid : Les 2 Indicateurs Clés (Épuré & Impactant) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* KPI 1 : Santé du Frigo & Anti-gaspi */}
        <Link
          to="/fridge"
          className="group relative flex flex-col justify-between p-5 sm:p-6 rounded-3xl bg-white border border-[#E8E5DF] shadow-soft hover:shadow-card-hover hover:border-primary-400/40 transition-all duration-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0 border border-primary-200/80 group-hover:scale-105 transition-transform">
                <Refrigerator className="w-6 h-6 text-primary-700" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#6F726D] uppercase tracking-wider">
                  Santé du Frigo
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-[#1A1C19] tracking-tight">
                    {fridgeHealthScore}%
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-800 border border-primary-200/80">
                    {urgentItemsCount === 0 ? "Optimisé" : `${urgentItemsCount} urgent${urgentItemsCount > 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-[#FAF8F5] group-hover:bg-primary-50 text-[#8E918B] group-hover:text-primary-700 flex items-center justify-center transition-colors shrink-0">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="w-full bg-[#F2EFE9] h-2 rounded-full overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-primary-600 to-primary-700 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(15, fridgeHealthScore))}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-[#6F726D] font-medium">
              <span>{fridgeItems.length} ingrédients en réserve</span>
              <span className="text-primary-800 font-semibold">
                {urgentItemsCount === 0 ? "Zéro gaspillage ✨" : "À surveiller"}
              </span>
            </div>
          </div>
        </Link>

        {/* KPI 2 : Recettes Prêtes (0 ingrédient manquant) */}
        <Link
          to="/recipes?makeable=true"
          className="group relative flex flex-col justify-between p-5 sm:p-6 rounded-3xl bg-white border border-[#E8E5DF] shadow-soft hover:shadow-card-hover hover:border-coral-400/40 transition-all duration-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-coral-50 text-coral-600 flex items-center justify-center shrink-0 border border-coral-200/80 group-hover:scale-105 transition-transform">
                <ChefHat className="w-6 h-6 text-coral-600" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#6F726D] uppercase tracking-wider">
                  Prêt à cuisiner
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-[#1A1C19] tracking-tight">
                    {makeableRecipes.length}
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-coral-50 text-coral-800 border border-coral-200/80">
                    Recettes 100% réalisables
                  </span>
                </div>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-[#FAF8F5] group-hover:bg-coral-50 text-[#8E918B] group-hover:text-coral-600 flex items-center justify-center transition-colors shrink-0">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#E8E5DF] flex items-center justify-between text-xs text-[#6F726D]">
            <span className="flex items-center gap-1.5 font-medium">
              <Flame className="w-3.5 h-3.5 text-coral-500" />
              Avec 0 course à faire
            </span>
            <span className="text-coral-600 font-bold group-hover:underline">
              Cuisiner maintenant →
            </span>
          </div>
        </Link>
      </div>

      {/* 3. Section Bento : À Consommer en Priorité */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
                À consommer en priorité
                {expiringItems.length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {urgentItemsCount > 0 ? `${urgentItemsCount} urgent${urgentItemsCount > 1 ? "s" : ""}` : expiringItems.length}
                  </span>
                )}
              </h2>
            </div>
          </div>

          <Link
            to="/fridge"
            className="text-xs sm:text-sm font-semibold text-[#6F726D] hover:text-primary-700 flex items-center gap-1 transition-colors"
          >
            Gérer tout le frigo
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {expiringItems.length === 0 ? (
          <div className="p-6 rounded-3xl bg-white border border-[#E8E5DF] shadow-soft text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 mx-auto flex items-center justify-center mb-2.5 border border-primary-200/80">
              <ShieldCheck className="w-6 h-6 text-primary-700" />
            </div>
            <h3 className="text-base font-bold text-[#1A1C19] mb-1">
              Tout est frais & paré !
            </h3>
            <p className="text-xs sm:text-sm text-[#6F726D] max-w-md mx-auto mb-4">
              Aucun aliment périssable ne nécessite votre attention immédiate. Vos surgelés et produits secs sont en sécurité.
            </p>
            <Button asChild variant="outline" size="sm" className="rounded-xl border-[#E8E5DF] text-[#1A1C19]">
              <Link to="/fridge">Consulter mon inventaire</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {expiringItems.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#E8E5DF] shadow-soft hover:shadow-card-hover hover:border-amber-400/40 transition-all duration-200"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4
                        className="font-bold text-[#1A1C19] text-sm truncate group-hover:text-primary-700 transition-colors"
                        title={getFridgeItemName(item)}
                      >
                        {getFridgeItemName(item)}
                      </h4>
                      {item.brand && (
                        <span className="text-[11px] text-stone-400 truncate block">
                          {item.brand}
                        </span>
                      )}
                    </div>
                    {item.ingredient.category && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-offset-1"
                        style={{
                          backgroundColor:
                            item.ingredient.category.color || "#10b981",
                        }}
                        title={item.ingredient.category.name}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-100">
                    <span>Quantité</span>
                    <span className="font-semibold text-stone-800">
                      {item.quantity} {item.unit}
                      {(item.itemCount || 1) > 1 && ` (x${item.itemCount})`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>Date limite</span>
                    <span className="font-semibold text-stone-700">
                      {new Date(item.expiryDate!).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </div>

                <div className="pt-3 mt-2 border-t border-stone-100 space-y-2">
                  <FreshnessBadge
                    expiryDate={item.expiryDate}
                    isEstimated={item.isExpiryEstimated}
                    showDays={true}
                    className="w-full justify-center py-1 text-[11px]"
                  />

                  {/* Actions rapides 1-clic */}
                  <div className="flex items-center gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setExpiryModalItem(item);
                        setQuickExpiryDate(
                          item.expiryDate
                            ? new Date(item.expiryDate).toISOString().split("T")[0]
                            : ""
                        );
                      }}
                      className="flex-1 h-7 text-[11px] font-semibold px-1 rounded-lg text-stone-600 hover:text-amber-700 hover:bg-amber-50 flex items-center justify-center gap-1 transition-colors border border-stone-100"
                      title="Modifier ou retirer la date"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Date</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFreezeItem(item)}
                      className="flex-1 h-7 text-[11px] font-semibold px-1 rounded-lg text-stone-600 hover:text-cyan-700 hover:bg-cyan-50 flex items-center justify-center gap-1 transition-colors border border-stone-100"
                      title="Mettre au congélateur (ne périme plus)"
                    >
                      <Snowflake className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      <span>Congeler</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Marquer "${getFridgeItemName(item)}" comme consommé ?`)) {
                          finishMutation.mutate({ id: item.id });
                        }
                      }}
                      className="h-7 w-7 rounded-lg text-[#8E918B] hover:text-primary-700 hover:bg-primary-50 flex items-center justify-center transition-colors border border-[#E8E5DF] shrink-0"
                      title="Marquer comme consommé"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Button
                    asChild
                    variant="ghost"
                    size="xs"
                    className="w-full text-xs text-primary-700 hover:text-primary-800 hover:bg-primary-50"
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
      </div>

      {/* 4. Bento Hero : L'Idée du Chef IA pour ce soir (Nordic Pine & Sage) */}
      {featuredRecipe && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#183328] to-[#0F221A] text-white border border-[#214334] shadow-float p-6 sm:p-8">
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary-400/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-coral-400/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex-1 space-y-3">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md text-primary-200 border border-white/10">
                L'Idée du Chef pour ce soir
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white line-clamp-1">
                {featuredRecipe.title}
              </h3>

              {featuredRecipe.description && (
                <p className="text-stone-300 text-xs sm:text-sm line-clamp-2 max-w-xl">
                  {featuredRecipe.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-stone-300">
                {featuredRecipe.prepTime && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    {featuredRecipe.prepTime + (featuredRecipe.cookTime || 0)} min
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                  {featuredRecipe.servings} pers.
                </span>
                {featuredRecipe.estimatedCost && featuredRecipe.estimatedCost > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-500/20 text-primary-200 border border-primary-500/30 font-semibold">
                    <Coins className="w-3.5 h-3.5 text-primary-300" />
                    ~{featuredRecipe.estimatedCost.toFixed(2)} €
                  </span>
                )}
                {(featuredRecipe.missingIngredientsCount ?? 0) === 0 ? (
                  <span className="px-2.5 py-1 rounded-lg bg-primary-400/20 text-primary-200 font-bold border border-primary-400/30">
                    100% faisable ce soir
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-coral-500/20 text-coral-200 font-bold border border-coral-500/30">
                    {featuredRecipe.missingIngredientsCount} manquant(s)
                  </span>
                )}
              </div>
            </div>

            <div className="flex sm:flex-row flex-col items-center gap-4 w-full lg:w-auto shrink-0">
              {featuredRecipe.imageUrl && (
                <div className="w-full sm:w-44 h-32 rounded-2xl overflow-hidden border border-white/10 bg-white/5 shrink-0">
                  <img
                    src={formatImageUrl(featuredRecipe.imageUrl)}
                    alt={featuredRecipe.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <Button
                asChild
                variant="coral"
                size="lg"
                className="w-full sm:w-auto rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-bold shadow-md shadow-coral-500/25 px-6"
              >
                <Link to="/recipes">
                  Cuisiner ce soir
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Suggestions & Favoris (Onglets & Cartes épurées) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center p-1 bg-[#F2EFE9] rounded-2xl border border-[#E8E5DF] w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("suggested")}
              className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === "suggested"
                  ? "bg-white text-[#183328] shadow-soft-xs"
                  : "text-[#6F726D] hover:text-[#1A1C19]"
              }`}
            >
              Suggérées selon frigo ({suggestedRecipes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("favorites")}
              className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === "favorites"
                  ? "bg-white text-[#183328] shadow-soft-xs"
                  : "text-[#6F726D] hover:text-[#1A1C19]"
              }`}
            >
              Favoris ({favoriteRecipes.length})
            </button>
          </div>

          <Button asChild variant="outline" size="sm" className="rounded-xl border-[#E8E5DF] text-[#1A1C19] w-fit">
            <Link to="/recipes">Voir toutes les recettes</Link>
          </Button>
        </div>

        {(activeTab === "suggested" ? suggestedRecipes : favoriteRecipes).length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-[#E8E5DF] shadow-soft text-center">
            <ChefHat className="w-12 h-12 mx-auto mb-3 text-[#8E918B]" />
            <h3 className="text-base font-bold text-[#1A1C19] mb-1">
              {activeTab === "favorites"
                ? "Vous n'avez pas encore de recette favorite"
                : "Aucune recette suggérée pour l'instant"}
            </h3>
            <p className="text-xs sm:text-sm text-[#6F726D] mb-4 max-w-md mx-auto">
              {activeTab === "favorites"
                ? "Ajoutez des recettes en favori avec l'étoile pour les retrouver ici."
                : "Ajoutez davantage d'ingrédients à votre frigo ou générez de nouvelles recettes par IA."}
            </p>
            <Button asChild variant="primary" size="sm" className="rounded-xl bg-[#183328] text-white">
              <Link to={activeTab === "favorites" ? "/recipes" : "/fridge"}>
                {activeTab === "favorites" ? "Explorer les recettes" : "Ajouter des ingrédients"}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
                  <div
                    key={recipe.id}
                    onClick={() => navigate("/recipes")}
                    className="group cursor-pointer rounded-3xl bg-white border border-[#E8E5DF] shadow-soft hover:shadow-card-hover hover:border-primary-400/40 transition-all duration-200 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-36 bg-[#F2EFE9] overflow-hidden">
                        {recipe.imageUrl ? (
                          <img
                            src={formatImageUrl(recipe.imageUrl)}
                            alt={recipe.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const fallback = parent.querySelector(".home-img-fallback");
                                if (fallback) fallback.classList.remove("hidden");
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-full h-full flex items-center justify-center text-[#8E918B] home-img-fallback ${
                            recipe.imageUrl ? "hidden" : ""
                          }`}
                        >
                          <ChefHat className="w-8 h-8" />
                        </div>

                        {(recipe.missingIngredientsCount ?? 0) === 0 ? (
                          <div className="absolute top-2.5 right-2.5">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary-600 text-white shadow-soft-xs">
                              100% Réalisable
                            </span>
                          </div>
                        ) : (recipe.missingIngredientsCount ?? 0) > 0 ? (
                          <div className="absolute top-2.5 right-2.5">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-soft-xs">
                              {recipe.missingIngredientsCount} manquant(s)
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="p-4 sm:p-5">
                        <h4 className="font-bold text-[#1A1C19] text-base mb-1 group-hover:text-primary-700 transition-colors line-clamp-1">
                          {recipe.title}
                        </h4>
                        {recipe.description && (
                          <p className="text-xs text-[#6F726D] mb-3 line-clamp-2">
                            {recipe.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-xs text-[#6F726D] pt-2 border-t border-[#E8E5DF]">
                          <div className="flex items-center gap-2">
                            {recipe.prepTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-[#8E918B]" />
                                {recipe.prepTime + (recipe.cookTime || 0)} min
                              </span>
                            )}
                            <span>{recipe.servings} pers.</span>
                          </div>

                          <span className="text-primary-800 font-bold">
                            {availableCount}/{recipe.ingredients.length} ingr.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Modal d'action rapide : Changer la date de péremption depuis le Dashboard */}
      <Modal
        isOpen={!!expiryModalItem}
        onClose={() => setExpiryModalItem(null)}
        title={`Date de péremption : ${getFridgeItemName(expiryModalItem)}`}
        size="sm"
      >
        <form onSubmit={handleQuickExpirySave} className="space-y-4">
          <Input
            label="Date limite de consommation"
            type="date"
            value={quickExpiryDate}
            onChange={(e) => setQuickExpiryDate(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">
              Raccourcis rapides :
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 3);
                  setQuickExpiryDate(d.toISOString().split("T")[0]);
                }}
                className="text-xs px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold text-stone-700 transition-colors"
              >
                +3 jours
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  setQuickExpiryDate(d.toISOString().split("T")[0]);
                }}
                className="text-xs px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold text-stone-700 transition-colors"
              >
                +1 semaine
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 14);
                  setQuickExpiryDate(d.toISOString().split("T")[0]);
                }}
                className="text-xs px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold text-stone-700 transition-colors"
              >
                +2 semaines
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + 1);
                  setQuickExpiryDate(d.toISOString().split("T")[0]);
                }}
                className="text-xs px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold text-stone-700 transition-colors"
              >
                +1 mois
              </button>
              <button
                type="button"
                onClick={() => setQuickExpiryDate("")}
                className="text-xs px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-semibold transition-colors"
              >
                Aucune date
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-stone-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExpiryModalItem(null)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              loading={updateMutation.isPending}
            >
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
