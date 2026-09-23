import { useState, useRef, useEffect, useMemo, ChangeEvent } from "react";
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
  ScanLine,
  Tags,
  Check,
  History,
  CheckCircle2,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { fridgeService } from "@/services/fridgeService";
import type {
  FridgeItem,
  AddFridgeItemRequest,
  Ingredient,
  Category,
} from "@/types";

// Hook de debouncing pour fluidifier la recherche et éviter les spams d'API
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// Couleurs prédéfinies pour les catégories
const CATEGORY_COLORS = [
  "#3b82f6", // Bleu
  "#10b981", // Vert
  "#f97316", // Orange
  "#ef4444", // Rouge
  "#8b5cf6", // Violet
  "#ec4899", // Rose
  "#eab308", // Jaune
  "#06b6d4", // Cyan
];

// Unités culinaires courantes
const COMMON_UNITS = [
  { value: "pièce", label: "pièce(s)" },
  { value: "g", label: "g (grammes)" },
  { value: "kg", label: "kg (kilogrammes)" },
  { value: "ml", label: "ml (millilitres)" },
  { value: "cl", label: "cl (centilitres)" },
  { value: "L", label: "L (litres)" },
  { value: "portion", label: "portion(s)" },
  { value: "tranche", label: "tranche(s)" },
  { value: "paquet", label: "paquet(s)" },
  { value: "boîte", label: "boîte(s)" },
  { value: "bouteille", label: "bouteille(s)" },
  { value: "pot", label: "pot(s)" },
  { value: "sachet", label: "sachet(s)" },
  { value: "barquette", label: "barquette(s)" },
  { value: "c. à soupe", label: "c. à soupe" },
  { value: "c. à café", label: "c. à café" },
];

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

// Détecte et extrait quantité, unité et count d'une chaîne packageQuantity (ex: "1.5 L", "33 cl", "6 x 33 cl")
function parsePackageQuantity(pkgStr?: string): { quantity?: number; unit?: string; count?: number } {
  if (!pkgStr) return {};
  const cleaned = pkgStr.trim();

  // Détection de pack éventuel (ex: "6 x 33 cl", "4x100g")
  const packMatch = cleaned.match(/^(\d+)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*([a-zA-ZÀ-ÿ]+)/i);
  if (packMatch) {
    const count = parseInt(packMatch[1], 10);
    const qty = parseFloat(packMatch[2].replace(",", "."));
    const rawUnit = packMatch[3].trim();
    return {
      count: isNaN(count) ? 1 : count,
      quantity: isNaN(qty) ? 1 : qty,
      unit: rawUnit,
    };
  }

  // Détection standard (ex: "1.5 L", "500 g", "33cl")
  const match = cleaned.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|cl|ml|pièces?|paquets?|pots?|bouteilles?|boîtes?)/i);
  if (match) {
    const qty = parseFloat(match[1].replace(",", "."));
    return {
      quantity: isNaN(qty) ? undefined : qty,
      unit: match[2].trim(),
    };
  }

  return {};
}

const PREFERRED_CATEGORY_ORDER = [
  "Les fruits & légumes",
  "Les viandes",
  "Féculents",
  "Surgelés",
  "Produits laitiers",
  "Conserves",
  "Boissons",
  "Sauces",
  "Produits secs",
  "Petit déjeuner",
  "Gâteaux",
  "Apéritifs",
];

// Recherche intelligente de la catégorie la plus pertinente
function findBestMatchingCategory(
  offCatName: string,
  ingredientName: string,
  categories: Category[]
): Category | undefined {
  if (!categories || categories.length === 0) return undefined;
  const offNorm = (offCatName || "").toLowerCase();
  const ingNorm = (ingredientName || "").toLowerCase();
  const combined = `${offNorm} ${ingNorm}`;

  const getCat = (pattern: RegExp) => categories.find((c) => pattern.test(c.name));

  // 1. Correspondance exacte
  const exact = categories.find(
    (c) => c.name.toLowerCase() === offNorm || c.name.toLowerCase() === ingNorm
  );
  if (exact) return exact;

  // 2. Sous-chaîne
  const sub = categories.find(
    (c) =>
      (offNorm &&
        (offNorm.includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(offNorm))) ||
      (ingNorm && c.name.toLowerCase().includes(ingNorm))
  );
  if (sub) return sub;

  // 3. Mots-clés sémantiques ciblés

  // Surgelés (glaces, surgelés...)
  if (/surgel|congel|glace|sorbet|frozen/i.test(combined)) {
    const cat = getCat(/surgel/i);
    if (cat) return cat;
  }

  // Conserves
  if (/conserve|boîte de|concentré de tomate|haricot.*boîte|thon.*boîte|sardine.*boîte|canned/i.test(combined)) {
    const cat = getCat(/conserve/i);
    if (cat) return cat;
  }

  // Sauces & condiments liquides
  if (/sauce|pesto|mayo|ketchup|vinaigre|vinaigrette|moutarde|aïoli|béarnaise/i.test(combined)) {
    const cat = getCat(/sauce/i);
    if (cat) return cat;
  }

  // Apéritifs (chips, biscuits salés...)
  if (/chips|apéritif|aperitif|bretzel|biscuit salé|tapenade|olives vertes|olives noires/i.test(combined)) {
    const cat = getCat(/apéritif/i);
    if (cat) return cat;
  }

  // Petit déjeuner
  if (/brioche|croissant|pain au chocolat|confiture|nocciolata|nutella|pâte à tartiner|be nuts|beurre de cacahuète|muesli|granola|céréales de petit déjeuner|biscotte/i.test(combined)) {
    const cat = getCat(/petit déjeuner/i);
    if (cat) return cat;
  }

  // Gâteaux & chocolats
  if (/gâteau|gateau|cookie|biscuit|chocolat|muffin|cake|madeleine|sablé|brownie|pépites de chocolat/i.test(combined) && !/pâte à tartiner/i.test(combined)) {
    const cat = getCat(/gâteau/i);
    if (cat) return cat;
  }

  // Boissons
  if (/boisson|soda|cola|jus|eau|bière|vin|thé|café|expresso|sirop|cidre|coca|pepsi|sprite|fanta|oasis|lipton/i.test(combined) && !/eau de cuisson/i.test(combined)) {
    const cat = getCat(/boisson/i);
    if (cat) return cat;
  }

  // Produits laitiers
  if (/lait|fromage|yaourt|beurre|crème|creme|dairy|cheese|yogurt|mozzarella|parmesan|gorgonzola|comté|beaufort|cheddar|gruyère|mascarpone|petit suisse|œufs|oeuf/i.test(combined)) {
    const cat = getCat(/lait|fromage|produits laitiers/i);
    if (cat) return cat;
  }

  // Les viandes (& poissons)
  if (/\bcoq\b|poulet|viande|bœuf|boeuf|veau|porc|volaille|dinde|canard|steak|lardon|bacon|saucisse|jambon|chorizo|charcuterie|saumon|poisson|thon|crevette|colin|cabillaud|os à moelle|jarret|entrecôte|bavette|meat|fish/i.test(combined)) {
    const cat = getCat(/viande/i);
    if (cat) return cat;
  }

  // Féculents
  if (/coquillette|spaghetti|tagliatelle|penne|fusilli|crozet|lasagne|\briz\b|couscous|semoule|wrap|\bpain\b|\bmie\b|burger|pomme.*terre|frites|tater tots|galette.*sarrasin|udon|nouille|féculent|feculent/i.test(combined) || (/pâte/i.test(combined) && !/pâte à tartiner/i.test(combined))) {
    const cat = getCat(/féculent/i);
    if (cat) return cat;
  }

  // Les fruits & légumes
  if (/légume|legume|fruit|tomate|carotte|oignon|aubergine|courgette|poivron|salade|avocat|concombre|champignon|épinard|haricot|poireau|navet|céleri|brocoli|ail|pomme|banane|orange|citron|fraise|raisin|pastèque|pasteque|soja|coriandre|basilic|persil/i.test(combined)) {
    if (!/haricots blancs secs|oignons crispy/i.test(combined)) {
      const cat = getCat(/fruit.*légume|légume|fruit/i);
      if (cat) return cat;
    }
  }

  // Produits secs
  if (/farine|sucre|cassonade|sel|poivre|épice|epice|herbe|paprika|cannelle|muscade|levure|bouillon|vanille|cacao|huile|sec|secs/i.test(combined)) {
    const cat = getCat(/produits secs|sec/i);
    if (cat) return cat;
  }

  return undefined;
}

// Schéma de validation
const fridgeItemSchema = z.object({
  ingredientId: z.string().optional(),
  itemCount: z
    .preprocess(
      (val) => {
        if (typeof val === "string") {
          const trimmed = val.trim();
          if (trimmed === "") return 1;
          const num = parseInt(trimmed, 10);
          return isNaN(num) ? val : num;
        }
        return val;
      },
      z.number({ invalid_type_error: "Le nombre d'exemplaires doit être un nombre" })
        .int("Le nombre d'exemplaires doit être un entier")
        .min(1, "Au moins 1 exemplaire")
        .default(1)
    ),
  quantity: z
    .preprocess(
      parseDecimalNumber,
      z.number({ invalid_type_error: "La quantité doit être un nombre valide" })
        .positive("La quantité doit être supérieure à 0")
    ),
  initialQuantity: z
    .preprocess(
      parseDecimalNumber,
      z.number({ invalid_type_error: "Le stock d'origine doit être un nombre valide" })
        .positive("Le stock d'origine doit être supérieur à 0")
        .optional()
    ),
  unit: z.string().min(1, "Veuillez choisir une unité"),
  brand: z.string().optional(),
  price: z
    .preprocess(
      parseDecimalNumber,
      z
        .number({ invalid_type_error: "Le prix doit être un nombre valide" })
        .nonnegative("Le prix ne peut pas être négatif")
        .optional()
    ),
  categoryId: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

type FridgeItemForm = z.infer<typeof fridgeItemSchema>;

export function FridgePage() {
  // Onglet actif : "fridge" (en stock) ou "history" (historique & dépenses)
  const [activeTab, setActiveTab] = useState<"fridge" | "history">("fridge");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");

  const [editingItem, setEditingItem] = useState<FridgeItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const debouncedIngredientSearch = useDebounce(ingredientSearch, 350);

  // État de l'historique
  const [historySearch, setHistorySearch] = useState("");
  const debouncedHistorySearch = useDebounce(historySearch, 350);

  // Modal pour terminer un ingrédient
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishingItem, setFinishingItem] = useState<FridgeItem | null>(null);
  const [finishQuantity, setFinishQuantity] = useState<string>("");
  const [finishCount, setFinishCount] = useState<number>(1);
  const [finishNotes, setFinishNotes] = useState<string>("");

  const [ingredientInputValue, setIngredientInputValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  // Formulaire
  const form = useForm<FridgeItemForm>({
    resolver: zodResolver(fridgeItemSchema),
    defaultValues: {
      ingredientId: "",
      itemCount: 1,
      quantity: 1,
      initialQuantity: undefined,
      unit: "pièce",
      brand: "",
      price: undefined,
      categoryId: "",
      expiryDate: "",
      notes: "",
    },
  });

  // Récupérer les éléments du frigo
  const { data: fridgeItems = [], isLoading } = useQuery({
    queryKey: ["fridgeItems"],
    queryFn: fridgeService.getFridgeItems,
  });

  // Récupérer les catégories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: fridgeService.getCategories,
  });

  // Trier les catégories selon l'ordre préférentiel
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const idxA = PREFERRED_CATEGORY_ORDER.indexOf(a.name);
      const idxB = PREFERRED_CATEGORY_ORDER.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, "fr");
    });
  }, [categories]);

  // Récupérer les ingrédients pour le formulaire (avec debounced search)
  const { data: ingredients = [], isFetching: isFetchingIngredients } = useQuery({
    queryKey: ["ingredients", debouncedIngredientSearch],
    queryFn: () =>
      debouncedIngredientSearch
        ? fridgeService.searchIngredients(debouncedIngredientSearch)
        : fridgeService.getIngredients(),
    enabled: !!debouncedIngredientSearch || isAddModalOpen || !!editingItem,
  });

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingItem(null);
    form.reset({
      ingredientId: "",
      itemCount: 1,
      quantity: 1,
      initialQuantity: undefined,
      unit: "pièce",
      brand: "",
      categoryId: "",
      expiryDate: "",
      notes: "",
    });
    setIngredientInputValue("");
    setIngredientSearch("");
  };

  const handleIngredientSelection = async (ingredient: Ingredient) => {
    try {
      let selected = ingredient;

      // Déterminer la catégorie la plus adaptée
      let targetCategoryId: string | undefined = undefined;
      if (selected.categoryId) {
        targetCategoryId = selected.categoryId;
      } else if (ingredient.category?.id && ingredient.category.id !== "external") {
        targetCategoryId = ingredient.category.id;
      } else {
        const catName = ingredient.category?.name || "";
        const matched = findBestMatchingCategory(catName, ingredient.name, categories);
        if (matched) {
          targetCategoryId = matched.id;
        }
      }

      if (ingredient.id.startsWith("off_")) {
        const created = await fridgeService.createIngredient({
          name: ingredient.name,
          categoryId: targetCategoryId,
        });
        selected = created;
      }

      form.setValue("ingredientId", selected.id, { shouldValidate: true });
      form.clearErrors("ingredientId");
      setIngredientInputValue(selected.name);
      setIngredientSearch("");

      // 1. Pré-remplissage de la catégorie
      if (targetCategoryId) {
        form.setValue("categoryId", targetCategoryId);
      } else if (selected.categoryId) {
        form.setValue("categoryId", selected.categoryId);
      }

      // 2. Pré-remplissage de la marque
      if (ingredient.brand) {
        form.setValue("brand", ingredient.brand);
      } else if (!form.getValues("brand")) {
        if (/coca[-\s]?cola/i.test(ingredient.name)) {
          form.setValue("brand", "Coca-Cola");
        }
      }

      // 3. Pré-remplissage de la quantité, unité et pack
      let targetQty: number | undefined = ingredient.detectedQuantity;
      let targetUnit: string | undefined = ingredient.detectedUnit;
      let targetCount: number | undefined = undefined;

      if (ingredient.packageQuantity) {
        const parsedPkg = parsePackageQuantity(ingredient.packageQuantity);
        if (parsedPkg.quantity !== undefined && !targetQty) {
          targetQty = parsedPkg.quantity;
        }
        if (parsedPkg.unit && !targetUnit) {
          targetUnit = parsedPkg.unit;
        }
        if (parsedPkg.count) {
          targetCount = parsedPkg.count;
        }
      }

      if (targetCount && targetCount > 1) {
        form.setValue("itemCount", targetCount);
      }
      if (targetQty !== undefined) {
        form.setValue("quantity", targetQty);
      }
      if (targetUnit) {
        const norm = targetUnit.trim().toLowerCase();
        const matchedUnit = COMMON_UNITS.find(
          (u) => u.value.toLowerCase() === norm
        );
        if (matchedUnit) {
          form.setValue("unit", matchedUnit.value);
        } else if (norm === "l" || norm === "litre" || norm === "litres") {
          form.setValue("unit", "L");
        } else {
          form.setValue("unit", targetUnit);
        }
      }
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

            const catId = existing.categoryId || findBestMatchingCategory(ingredient.category?.name || "", ingredient.name, categories)?.id;
            if (catId) {
              form.setValue("categoryId", catId);
            }
            if (ingredient.brand) {
              form.setValue("brand", ingredient.brand);
            } else if (/coca[-\s]?cola/i.test(ingredient.name)) {
              form.setValue("brand", "Coca-Cola");
            }

            let targetQty = ingredient.detectedQuantity;
            let targetUnit = ingredient.detectedUnit;
            if (ingredient.packageQuantity) {
              const parsedPkg = parsePackageQuantity(ingredient.packageQuantity);
              if (parsedPkg.quantity !== undefined && !targetQty) {
                targetQty = parsedPkg.quantity;
              }
              if (parsedPkg.unit && !targetUnit) {
                targetUnit = parsedPkg.unit;
              }
              if (parsedPkg.count && parsedPkg.count > 1) {
                form.setValue("itemCount", parsedPkg.count);
              }
            }
            if (targetQty !== undefined) {
              form.setValue("quantity", targetQty);
            }
            if (targetUnit) {
              const norm = targetUnit.trim().toLowerCase();
              const matchedUnit = COMMON_UNITS.find(
                (u) => u.value.toLowerCase() === norm
              );
              if (matchedUnit) {
                form.setValue("unit", matchedUnit.value);
              } else if (norm === "l" || norm === "litre" || norm === "litres") {
                form.setValue("unit", "L");
              } else {
                form.setValue("unit", targetUnit);
              }
            }
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

  const handleCreateCustomIngredient = async (name: string) => {
    try {
      const cleanName = typeof name === "string" ? name.trim() : "";
      if (!cleanName) return;

      const rawCatId = form.getValues("categoryId");
      let categoryId = typeof rawCatId === "string" && rawCatId ? rawCatId : undefined;
      if (!categoryId) {
        const matched = findBestMatchingCategory("", cleanName, categories);
        if (matched) {
          categoryId = matched.id;
          form.setValue("categoryId", matched.id);
        }
      }

      const created = await fridgeService.createIngredient({ name: cleanName, categoryId });
      form.setValue("ingredientId", created.id, { shouldValidate: true });
      form.clearErrors("ingredientId");
      setIngredientInputValue(created.name);
      setIngredientSearch("");
      toast.success("Ingrédient créé avec succès !");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Impossible de créer cet ingrédient"
      );
    }
  };

  // Vérifier si le texte saisi correspond exactement à un ingrédient existant
  const hasExactMatch = ingredients.some(
    (ing) => ing.name.toLowerCase() === ingredientInputValue.trim().toLowerCase()
  );

  // Afficher l'option personnalisée si le texte saisi ne correspond pas exactement
  const showCustomOption =
    ingredientInputValue.trim().length > 0 &&
    !hasExactMatch &&
    ingredientSearch.trim().length > 0;

  const handleScanTicketClick = () => {
    fileInputRef.current?.click();
  };

  const handleReceiptChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsScanning(true);
      const result = await fridgeService.scanReceipt(file);

      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });

      toast.success(
        `Ticket analysé : ${result.items?.length || result.addedCount || 0} ingrédient(s) extrait(s)`
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

  const openAddModal = (defaultCatId?: any) => {
    setEditingItem(null);
    const initialCatId = typeof defaultCatId === "string" ? defaultCatId : "";
    form.reset({
      ingredientId: "",
      itemCount: 1,
      quantity: 1,
      unit: "pièce",
      brand: "",
      price: undefined,
      categoryId: initialCatId,
      expiryDate: "",
      notes: "",
    });
    setIngredientInputValue("");
    setIngredientSearch("");
    setIsAddModalOpen(true);
  };

  const openFinishModal = (item: FridgeItem) => {
    setFinishingItem(item);
    setFinishQuantity(String(item.quantity));
    setFinishCount(item.itemCount || 1);
    setFinishNotes(item.notes || "");
    setIsFinishModalOpen(true);
  };

  // Récupérer l'historique des achats / consommations
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["purchaseHistory", debouncedHistorySearch],
    queryFn: () =>
      fridgeService.getHistory({
        search: debouncedHistorySearch || undefined,
      }),
  });

  // Mutations pour les éléments du frigo
  const addMutation = useMutation({
    mutationFn: fridgeService.addFridgeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
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
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Ingrédient modifié !");
      closeModal();
    },
    onError: () => {
      toast.error("Erreur lors de la modification");
    },
  });

  const finishMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        status?: "consumed" | "expired";
        price?: number;
        quantity?: number;
        itemCount?: number;
        finishAll?: boolean;
        notes?: string;
      };
    }) => fridgeService.finishFridgeItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseHistory"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Aliment mis à jour et archivé dans l'historique !");
      setIsFinishModalOpen(false);
      setFinishingItem(null);
    },
    onError: () => {
      toast.error("Erreur lors de l'archivage de l'aliment");
    },
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: fridgeService.deleteHistoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseHistory"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Entrée supprimée de l'historique !");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression de l'historique");
    },
  });

  const reAddMutation = useMutation({
    mutationFn: ({
      id,
      destination,
    }: {
      id: string;
      destination: "fridge" | "shopping";
    }) => fridgeService.reAddFromHistory(id, destination),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["shoppingLists"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success(res.message);
    },
    onError: () => {
      toast.error("Erreur lors du réajout");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: fridgeService.deleteFridgeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Ingrédient supprimé !");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  // Mutations pour les catégories
  const createCategoryMutation = useMutation({
    mutationFn: fridgeService.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewCategoryName("");
      toast.success("Catégorie créée avec succès !");
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Erreur lors de la création de la catégorie"
      );
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: fridgeService.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["fridgeItems"] });
      toast.success("Catégorie supprimée");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression de la catégorie");
    },
  });

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast.error("Veuillez saisir un nom de catégorie");
      return;
    }
    createCategoryMutation.mutate({
      name: newCategoryName.trim(),
      color: newCategoryColor,
    });
  };

  // Filtrer les éléments du frigo (recherche texte + filtre catégorie)
  const filteredItems = fridgeItems.filter((item) => {
    const matchesSearch =
      item.ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.ingredient.category?.name &&
        item.ingredient.category.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategory === null ||
      item.ingredient.category?.name === selectedCategory ||
      item.ingredient.category?.id === selectedCategory;

    return matchesSearch && matchesCategory;
  });

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
    let ingredientId = data.ingredientId;
    const currentInputName = ingredientInputValue.trim();

    // Si aucun ingrédient n'a été sélectionné dans la liste mais qu'un nom a été saisi
    if (!ingredientId && currentInputName) {
      try {
        const rawCatId = data.categoryId || form.getValues("categoryId");
        let catId = typeof rawCatId === "string" && rawCatId ? rawCatId : undefined;
        if (!catId) {
          const matched = findBestMatchingCategory("", currentInputName, categories);
          if (matched) catId = matched.id;
        }

        const created = await fridgeService.createIngredient({
          name: currentInputName,
          categoryId: catId,
        });
        ingredientId = created.id;
        form.setValue("ingredientId", created.id);
        if (catId) {
          form.setValue("categoryId", catId);
        }
      } catch (err: any) {
        const existingIngredients = await fridgeService.getIngredients();
        const existing = existingIngredients.find(
          (item) => item.name.toLowerCase() === currentInputName.toLowerCase()
        );
        if (existing) {
          ingredientId = existing.id;
          form.setValue("ingredientId", existing.id);
        } else {
          toast.error("Impossible d'ajouter cet ingrédient");
          return;
        }
      }
    }

    if (!ingredientId) {
      form.setError("ingredientId", {
        message: "Veuillez saisir ou choisir un ingrédient",
      });
      return;
    }

    const itemData: AddFridgeItemRequest = {
      ingredientId,
      itemCount: typeof data.itemCount === "number" ? data.itemCount : 1,
      quantity: typeof data.quantity === "number" ? data.quantity : 1,
      initialQuantity: typeof data.initialQuantity === "number" ? data.initialQuantity : undefined,
      unit: typeof data.unit === "string" && data.unit ? data.unit : "pièce",
      brand: typeof data.brand === "string" && data.brand.trim() ? data.brand.trim() : undefined,
      price: typeof data.price === "number" ? data.price : undefined,
      categoryId: typeof data.categoryId === "string" && data.categoryId ? data.categoryId : undefined,
      expiryDate: typeof data.expiryDate === "string" && data.expiryDate ? data.expiryDate : undefined,
      notes: typeof data.notes === "string" && data.notes ? data.notes : undefined,
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
      itemCount: item.itemCount || 1,
      quantity: item.quantity,
      initialQuantity: item.initialQuantity || undefined,
      unit: item.unit,
      brand: item.brand || "",
      price: item.price !== null && item.price !== undefined ? item.price : undefined,
      categoryId: item.ingredient.categoryId || item.ingredient.category?.id || "",
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

  const renderItemCard = (item: FridgeItem) => {
    return (
      <Card key={item.id} hover className="relative flex flex-col justify-between">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-bold text-gray-900">
                  {item.ingredient.name}
                </CardTitle>
                {item.brand && (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium border border-gray-200">
                    {item.brand}
                  </span>
                )}
              </div>
              {item.ingredient.category?.name && (
                <div className="mt-1">
                  <span
                    className="text-xs px-2.5 py-0.5 rounded-full text-white font-medium"
                    style={{
                      backgroundColor:
                        item.ingredient.category.color || "#3b82f6",
                    }}
                  >
                    {item.ingredient.category.name}
                  </span>
                </div>
              )}
            </div>
            <div className="flex space-x-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                title="Marquer comme terminé / consommé"
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => openFinishModal(item)}
              >
                <CheckCircle2 className="w-4 h-4" />
              </Button>
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

        <CardContent className="pt-2">
          <div className="space-y-2">
            {/* Exemplaire(s) et Quantité */}
            {item.itemCount && item.itemCount > 1 && (
              <div className="flex justify-between text-sm py-1 border-b border-gray-100">
                <span className="text-gray-600">Exemplaire(s) :</span>
                <span className="font-semibold text-gray-900">
                  {item.itemCount}
                  {item.initialItemCount && item.initialItemCount > item.itemCount ? (
                    <span className="text-gray-400 font-normal ml-1">/ {item.initialItemCount}</span>
                  ) : null}
                </span>
              </div>
            )}

            {/* Section Quantité / Stock Restant */}
            {item.initialQuantity && item.initialQuantity > item.quantity ? (
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2.5 space-y-1.5 my-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Restant :
                  </span>
                  <span className="font-bold text-emerald-800">
                    {item.quantity} {item.unit}
                    <span className="text-emerald-600/80 font-normal ml-1">
                      / {item.initialQuantity} {item.unit}
                    </span>
                  </span>
                </div>
                {/* Barre de progression du stock restant */}
                <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(5, Math.round((item.quantity / item.initialQuantity) * 100)))}%`,
                    }}
                  />
                </div>
                <div className="text-[11px] text-emerald-700 font-medium text-right">
                  {Math.round((item.quantity / item.initialQuantity) * 100)}% restant
                </div>
              </div>
            ) : (
              <div className="flex justify-between text-sm py-1 border-b border-gray-100">
                <span className="text-gray-600">Quantité :</span>
                <span className="font-medium text-gray-900">
                  {item.quantity} {item.unit}
                </span>
              </div>
            )}

            {/* Prix d'achat si renseigné */}
            {item.price !== null && item.price !== undefined && (
              <div className="flex justify-between text-sm py-1 border-b border-gray-100">
                <span className="text-gray-600">Prix payé :</span>
                <span className="font-semibold text-emerald-700">
                  {item.price.toFixed(2)} €
                  {item.itemCount && item.itemCount > 1 ? (
                    <span className="text-xs text-gray-500 font-normal ml-1">
                      ({(item.price / item.itemCount).toFixed(2)} €/u)
                    </span>
                  ) : null}
                </span>
              </div>
            )}

            {item.expiryDate && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">Expire le :</span>
                <span className="font-medium">
                  {new Date(item.expiryDate).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}

            {item.notes && (
              <div className="text-xs text-gray-500 italic mt-1 bg-gray-50 p-2 rounded">
                {item.notes}
              </div>
            )}
          </div>

          {item.expiryDate && (
            <div className="mt-3 flex justify-center">
              <FreshnessBadge
                expiryDate={item.expiryDate}
                showDays={true}
                className="w-full justify-center py-1 text-xs font-medium"
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header & Boutons d'action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mon Frigo</h1>
          <p className="text-gray-600">
            Gérez vos ingrédients et suivez leurs dates d'expiration
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleReceiptChange}
          />
          {/* Bouton Gestion des Catégories */}
          <Button
            variant="outline"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center"
          >
            <Tags className="w-4 h-4 mr-2 text-primary-600" />
            Catégories
          </Button>

          {/* Bouton Scanner ticket */}
          <Button
            variant="outline"
            onClick={handleScanTicketClick}
            loading={isScanning}
            className="flex items-center"
          >
            <ScanLine className="w-4 h-4 mr-2" />
            Scanner ticket
          </Button>

          {/* Bouton Ajouter ingrédient */}
          <Button onClick={() => openAddModal()} className="flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter ingrédient
          </Button>
        </div>
      </div>

      {/* Sélecteur d'onglets : Mon Frigo / Historique & Dépenses */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("fridge")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "fridge"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <span>🧊 En stock</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === "fridge"
                ? "bg-primary-50 text-primary-700 font-bold"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {fridgeItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "history"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Historique & Dépenses</span>
          {historyData?.stats.totalItems ? (
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === "history"
                  ? "bg-primary-50 text-primary-700 font-bold"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {historyData.stats.totalItems}
            </span>
          ) : null}
        </button>
      </div>

      {activeTab === "fridge" ? (
        <div className="space-y-8">
          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-0">
        <Card>
          <CardContent className="px-6 py-6">
            <div className="flex flex-col items-center text-center pt-1">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {stats.total}
              </h3>
              <p className="text-sm text-gray-600">Ingrédients total</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-6 py-6">
            <div className="flex flex-col items-center text-center pt-1">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {stats.expiringSoon}
              </h3>
              <p className="text-sm text-gray-600">Expirent bientôt</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-6 py-6">
            <div className="flex flex-col items-center text-center pt-1">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {stats.expired}
              </h3>
              <p className="text-sm text-gray-600">Expirés</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barre de filtre par Catégories */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === null
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Tous ({fridgeItems.length})
          </button>
          {sortedCategories.map((cat) => {
            const count = fridgeItems.filter(
              (i) =>
                i.ingredient.category?.id === cat.id ||
                i.ingredient.category?.name === cat.name
            ).length;
            const isSelected = selectedCategory === cat.name;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  setSelectedCategory(isSelected ? null : cat.name)
                }
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "text-white shadow-sm ring-2 ring-offset-1"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={{
                  backgroundColor: isSelected ? cat.color || "#3b82f6" : undefined,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: isSelected ? "#ffffff" : cat.color || "#3b82f6",
                  }}
                />
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Recherche textuelle */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par nom, marque ou catégorie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Liste des ingrédients */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : selectedCategory !== null ? (
        /* Vue filtrée sur une catégorie spécifique */
        filteredItems.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Calendar className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun aliment dans la catégorie "{selectedCategory}"
              </h3>
              <p className="text-gray-500 mb-6">
                Ajoutez des aliments à cette catégorie ou réinitialisez le filtre.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setSelectedCategory(null)}>
                  Voir toutes les catégories
                </Button>
                {(() => {
                  const cat = categories.find(
                    (c) => c.name === selectedCategory || c.id === selectedCategory
                  );
                  return (
                    <Button onClick={() => openAddModal(cat?.id)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter dans cette catégorie
                    </Button>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(renderItemCard)}
          </div>
        )
      ) : (
        /* Vue "Tous" : affichage par catégorie pour les catégories contenant des aliments */
        <div className="space-y-8">
          {sortedCategories.map((cat) => {
            const itemsInCat = filteredItems.filter(
              (i) =>
                i.ingredient.category?.id === cat.id ||
                i.ingredient.category?.name === cat.name
            );

            // Si aucun élément dans cette catégorie, ne pas l'afficher dans la vue "Tous"
            if (itemsInCat.length === 0) {
              return null;
            }

            return (
              <div
                key={cat.id}
                className="space-y-4 bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-sm"
              >
                {/* En-tête de la catégorie */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full ring-2 ring-offset-1"
                      style={{
                        backgroundColor: cat.color || "#3b82f6",
                      }}
                    />
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {cat.name}
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {itemsInCat.length}
                      </span>
                    </h3>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openAddModal(cat.id)}
                    className="text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 flex items-center h-8 px-2.5"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Ajouter
                  </Button>
                </div>

                {/* Éléments de la catégorie */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                  {itemsInCat.map(renderItemCard)}
                </div>
              </div>
            );
          })}

          {/* Section Sans Catégorie si des aliments du frigo n'ont pas de catégorie */}
          {(() => {
            const uncategorizedItems = filteredItems.filter(
              (i) => !i.ingredient.category
            );
            if (uncategorizedItems.length === 0) return null;

            return (
              <div className="space-y-4 bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-gray-400 ring-2 ring-offset-1 ring-gray-400" />
                    <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                      Sans catégorie
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {uncategorizedItems.length}
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                  {uncategorizedItems.map(renderItemCard)}
                </div>
              </div>
            );
          })()}

          {/* Si recherche active et aucun résultat nulle part */}
          {searchTerm.trim() && filteredItems.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Calendar className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun résultat pour "{searchTerm}"
                </h3>
                <p className="text-gray-500 mb-4">
                  Vérifiez l'orthographe ou réinitialisez votre recherche.
                </p>
                <Button variant="outline" onClick={() => setSearchTerm("")}>
                  Effacer la recherche
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Si le frigo est totalement vide */}
          {!searchTerm.trim() && filteredItems.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Calendar className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Votre frigo est vide
                </h3>
                <p className="text-gray-500 mb-6">
                  Commencez par ajouter des ingrédients à votre frigo
                </p>
                <Button onClick={() => openAddModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter le premier ingrédient
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
        </div>
      ) : (
        /* Vue Historique & Dépenses */
        <div className="space-y-6">
          {/* Barre de recherche */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rechercher dans l'historique (nom, marque...)"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            {historyData?.pagination.total !== undefined && historyData.pagination.total > 0 && (
              <span className="text-xs text-gray-500 font-medium px-2 shrink-0">
                {historyData.pagination.total} aliment(s) archivé(s)
              </span>
            )}
          </div>

          {/* Liste des éléments de l'historique */}
          {isHistoryLoading ? (
            <div className="text-center py-12 text-gray-500">
              Chargement de votre historique...
            </div>
          ) : !historyData?.items || historyData.items.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <History className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Aucun aliment dans l'historique
                </h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
                  Lorsque vous terminez ou consommez des aliments de votre frigo, ils sont automatiquement archivés ici avec leurs prix et statistiques.
                </p>
                <Button variant="outline" onClick={() => setActiveTab("fridge")}>
                  Retourner à mon frigo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historyData.items.map((item) => (
                <Card key={item.id} hover className="relative flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base font-bold text-gray-900">
                            {item.ingredient.name}
                          </CardTitle>
                          {item.brand && (
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium border border-gray-200">
                              {item.brand}
                            </span>
                          )}
                        </div>

                        {item.ingredient.category?.name && (
                          <div className="mt-1">
                            <span
                              className="text-xs px-2.5 py-0.5 rounded-full text-white font-medium"
                              style={{
                                backgroundColor:
                                  item.ingredient.category.color || "#3b82f6",
                              }}
                            >
                              {item.ingredient.category.name}
                            </span>
                          </div>
                        )}
                      </div>

                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Check className="w-3 h-3" />
                        Terminé
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-2 space-y-3">
                    <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50/70 p-2.5 rounded-lg border border-gray-100">
                      <div className="flex justify-between">
                        <span>Quantité :</span>
                        <span className="font-semibold text-gray-900">
                          {item.quantity} {item.unit}
                          {item.itemCount && item.itemCount > 1 ? ` (${item.itemCount} pièces)` : ""}
                        </span>
                      </div>

                      {item.price !== null && item.price !== undefined && (
                        <div className="flex justify-between border-t border-gray-200/60 pt-1">
                          <span>Prix payé :</span>
                          <span className="font-bold text-emerald-700">
                            {item.price.toFixed(2)} €
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between border-t border-gray-200/60 pt-1 text-gray-500">
                        <span>Acheté :</span>
                        <span>
                          {new Date(item.boughtDate).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {item.finishedDate && (
                        <div className="flex justify-between text-gray-500">
                          <span>Terminé :</span>
                          <span>
                            {new Date(item.finishedDate).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}

                      {item.notes && (
                        <div className="text-gray-500 italic pt-1 border-t border-gray-200/60">
                          "{item.notes}"
                        </div>
                      )}
                    </div>

                    {/* Actions de l'historique */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={reAddMutation.isPending}
                        onClick={() => reAddMutation.mutate({ id: item.id, destination: "fridge" })}
                        className="flex-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        title="Remettre cet aliment dans le frigo"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Remettre au frigo
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        loading={reAddMutation.isPending}
                        onClick={() => reAddMutation.mutate({ id: item.id, destination: "shopping" })}
                        className="text-xs text-blue-600 hover:bg-blue-50"
                        title="Ajouter à la liste de courses"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        loading={deleteHistoryMutation.isPending}
                        onClick={() => {
                          if (confirm("Supprimer cette entrée de l'historique ?")) {
                            deleteHistoryMutation.mutate(item.id);
                          }
                        }}
                        className="text-xs text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Gestion des Catégories */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Gérer les catégories"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Créez des catégories (ex: Produits laitiers, Viandes...) pour organiser votre frigo.
          </p>

          {/* Formulaire de création compact */}
          <form
            onSubmit={handleCreateCategory}
            className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2.5"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nom (ex: Viandes, Sauces...)"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 bg-white"
              />
              <Button
                type="submit"
                size="sm"
                loading={createCategoryMutation.isPending}
                className="shrink-0"
              >
                Ajouter
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 font-medium">Couleur :</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewCategoryColor(c)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      newCategoryColor === c
                        ? "ring-2 ring-offset-1 ring-gray-900 scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {newCategoryColor === c && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* Liste des catégories existantes */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Catégories existantes ({categories.length})
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {categories.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2 text-center">
                  Aucune catégorie créée pour le moment
                </p>
              ) : (
                sortedCategories.map((cat) => {
                  const inFridgeCount = fridgeItems.filter(
                    (i) =>
                      i.ingredient.category?.id === cat.id ||
                      i.ingredient.category?.name === cat.name
                  ).length;

                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || "#3b82f6" }}
                        />
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {cat.name}
                        </span>
                        {inFridgeCount > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                            {inFridgeCount} dans le frigo
                          </span>
                        )}
                      </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Supprimer la catégorie "${cat.name}" ?`)) {
                          deleteCategoryMutation.mutate(cat.id);
                        }
                      }}
                      className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                      title="Supprimer la catégorie"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              Fermer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal d'Ajout / Modification d'ingrédient */}
      <Modal
        isOpen={isAddModalOpen || !!editingItem}
        onClose={closeModal}
        title={editingItem ? "Modifier l'ingrédient" : "Ajouter un ingrédient"}
      >
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Sélection de l'ingrédient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ingrédient
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher un ingrédient (ex: spaghettis 1kg, beurre, lait...)"
                value={ingredientInputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setIngredientInputValue(value);
                  setIngredientSearch(value);
                  if (!value) {
                    form.setValue("ingredientId", "");
                  }
                  form.clearErrors("ingredientId");
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              {(isFetchingIngredients || showCustomOption || ingredients.length > 0) &&
                ingredientSearch.trim() && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {/* Indicateur de chargement */}
                    {isFetchingIngredients && (
                      <div className="px-4 py-3 flex items-center space-x-3 text-gray-600">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                        <span className="text-sm">Recherche des ingrédients...</span>
                      </div>
                    )}
                    {/* Option pour créer un ingrédient personnalisé */}
                    {showCustomOption && (
                      <button
                        type="button"
                        onClick={async () => {
                          await handleCreateCustomIngredient(
                            ingredientInputValue.trim()
                          );
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center space-x-3 border-b border-gray-200 bg-blue-50/30"
                      >
                        <span className="text-base">➕</span>
                        <div>
                          <div className="font-medium text-blue-600 text-sm">
                            Ajouter "{ingredientInputValue.trim()}"
                          </div>
                          <div className="text-xs text-gray-500">
                            Créer un nouvel ingrédient
                          </div>
                        </div>
                      </button>
                    )}
                    {/* Suggestions existantes / OpenFoodFacts */}
                    {!isFetchingIngredients &&
                      ingredients.map((ingredient) => (
                        <button
                          key={ingredient.id}
                          type="button"
                          onClick={async () => {
                            await handleIngredientSelection(ingredient);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div>
                            <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                              <span>{ingredient.name}</span>
                              {ingredient.brand && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-normal">
                                  {ingredient.brand}
                                </span>
                              )}
                              {ingredient.packageQuantity && (
                                <span className="text-xs text-gray-500 font-normal">
                                  ({ingredient.packageQuantity})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                              {ingredient.category?.name && (
                                <span>{ingredient.category.name}</span>
                              )}
                              {ingredient.id.startsWith("off_") && (
                                <span className="text-blue-600 font-medium">
                                  • OpenFoodFacts
                                </span>
                              )}
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

          {/* Ligne Marque et Catégorie */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Marque (optionnel)"
              placeholder="ex: Barilla, Danone, Panzani..."
              error={form.formState.errors.brand?.message}
              {...form.register("brand")}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Catégorie
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-xs text-primary-600 hover:text-primary-700 hover:underline font-medium"
                >
                  + Gérer
                </button>
              </div>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                {...form.register("categoryId")}
              >
                <option value="">-- Sans catégorie --</option>
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ligne : Exemplaire, Stock restant, Stock initial et Unité */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label="Exemplaire(s)"
              type="number"
              step="1"
              min="1"
              placeholder="1"
              error={form.formState.errors.itemCount?.message}
              {...form.register("itemCount", {
                setValueAs: (val) => {
                  if (typeof val === "number") return val;
                  if (typeof val === "string") {
                    const trimmed = val.trim();
                    if (trimmed === "") return 1;
                    const num = parseInt(trimmed, 10);
                    return isNaN(num) ? val : num;
                  }
                  return val;
                },
              })}
            />
            <Input
              label="Stock restant"
              type="text"
              inputMode="decimal"
              placeholder="Ex : 30 ou 500"
              error={form.formState.errors.quantity?.message}
              {...form.register("quantity", {
                setValueAs: parseDecimalNumber,
              })}
            />
            <Input
              label="Stock d'origine (optionnel)"
              type="text"
              inputMode="decimal"
              placeholder="Ex : 100 (si entamé)"
              error={form.formState.errors.initialQuantity?.message}
              {...form.register("initialQuantity", {
                setValueAs: parseDecimalNumber,
              })}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Unité
              </label>
              <select
                className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                  form.formState.errors.unit
                    ? "border-red-500 focus-visible:ring-red-500"
                    : "border-gray-300"
                }`}
                {...form.register("unit")}
              >
                <option value="" disabled>
                  Sélectionner...
                </option>
                {COMMON_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
                {form.watch("unit") &&
                  !COMMON_UNITS.some((u) => u.value === form.watch("unit")) && (
                    <option value={form.watch("unit")}>
                      {form.watch("unit")}
                    </option>
                  )}
              </select>
              {form.formState.errors.unit && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.unit.message}
                </p>
              )}
            </div>
          </div>

          {/* Date d'expiration et Prix d'achat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Date d'expiration (optionnel)"
              type="date"
              error={form.formState.errors.expiryDate?.message}
              {...form.register("expiryDate")}
            />

            <Input
              label="Prix d'achat (€, optionnel)"
              type="text"
              inputMode="decimal"
              placeholder="ex: 2.49"
              error={form.formState.errors.price?.message}
              {...form.register("price", {
                setValueAs: (val) => {
                  if (typeof val === "number") return val;
                  if (typeof val === "string") {
                    const norm = val.trim().replace(",", ".");
                    if (norm === "") return undefined;
                    const parsed = parseFloat(norm);
                    return isNaN(parsed) ? val : parsed;
                  }
                  return val;
                },
              })}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optionnel)
            </label>
            <textarea
              placeholder="Notes supplémentaires..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
              rows={2}
              {...form.register("notes")}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-2">
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

      {/* Modal pour terminer / consommer un aliment */}
      <Modal
        isOpen={isFinishModalOpen}
        onClose={() => {
          setIsFinishModalOpen(false);
          setFinishingItem(null);
        }}
        title="Marquer un aliment comme terminé"
      >
        {finishingItem && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="font-semibold text-gray-900 text-base">
                {finishingItem.ingredient?.name || "Aliment"}
              </div>
              <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                {finishingItem.brand && (
                  <span className="font-medium text-gray-700 bg-gray-200/60 px-2 py-0.5 rounded">
                    {finishingItem.brand}
                  </span>
                )}
                <span>
                  Stock actuel :{" "}
                  <strong className="text-gray-900 font-bold">
                    {finishingItem.quantity} {finishingItem.unit}
                  </strong>
                </span>
                {finishingItem.itemCount && finishingItem.itemCount > 1 ? (
                  <span className="text-gray-400">
                    • {finishingItem.itemCount} exemplaire(s)
                  </span>
                ) : null}
              </div>
            </div>

            {/* Quantité consommée */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Quantité consommée
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setFinishQuantity(String(finishingItem.quantity));
                    if (finishingItem.itemCount) setFinishCount(finishingItem.itemCount);
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors"
                >
                  Tout terminer ({finishingItem.quantity} {finishingItem.unit})
                </button>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min={0.001}
                  max={finishingItem.quantity}
                  value={finishQuantity}
                  onChange={(e) => setFinishQuantity(e.target.value)}
                  placeholder={`ex: ${finishingItem.quantity >= 10 ? 200 : finishingItem.quantity}`}
                  className="w-full pl-3 pr-14 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <span className="absolute right-3 top-2 text-gray-500 text-sm font-semibold pointer-events-none">
                  {finishingItem.unit}
                </span>
              </div>

              {/* Aperçu dynamique du stock restant */}
              {(() => {
                const parsed = parseFloat(finishQuantity.replace(",", "."));
                if (isNaN(parsed) || parsed <= 0) return null;
                if (parsed >= finishingItem.quantity) {
                  return (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200/60 flex items-center gap-1.5">
                      <span>✨</span>
                      <span>Tout le stock sera consommé. L'aliment sera retiré du frigo et archivé.</span>
                    </div>
                  );
                }
                const remaining = Math.round((finishingItem.quantity - parsed) * 1000) / 1000;
                return (
                  <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200/60 flex items-center justify-between">
                    <span>Il restera dans votre frigo :</span>
                    <span className="font-bold text-emerald-900 text-sm">
                      {remaining} {finishingItem.unit}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Si plusieurs exemplaires, choix du nombre d'exemplaires */}
            {(finishingItem.itemCount || 1) > 1 && (
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre d'exemplaires concernés
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={finishingItem.itemCount || 1}
                    value={finishCount}
                    onChange={(e) =>
                      setFinishCount(
                        Math.max(
                          1,
                          Math.min(
                            finishingItem.itemCount || 1,
                            parseInt(e.target.value, 10) || 1
                          )
                        )
                      )
                    }
                    className="w-20 p-2 border border-gray-300 rounded-md text-sm text-center font-bold"
                  />
                  <span className="text-xs text-gray-500">
                    sur {finishingItem.itemCount || 1} exemplaire(s)
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsFinishModalOpen(false);
                  setFinishingItem(null);
                }}
              >
                Annuler
              </Button>

              <Button
                type="button"
                loading={finishMutation.isPending}
                onClick={() => {
                  if (!finishingItem) return;
                  const parsedQuantity = finishQuantity.trim()
                    ? parseFloat(finishQuantity.trim().replace(",", "."))
                    : undefined;
                  const isAll = parsedQuantity !== undefined ? parsedQuantity >= finishingItem.quantity : true;
                  finishMutation.mutate({
                    id: finishingItem.id,
                    data: {
                      status: "consumed",
                      quantity: !isNaN(parsedQuantity as number) && (parsedQuantity as number) > 0 ? parsedQuantity : finishingItem.quantity,
                      itemCount: finishCount,
                      finishAll: isAll,
                      notes: finishNotes.trim() || undefined,
                    },
                  });
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Valider
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
