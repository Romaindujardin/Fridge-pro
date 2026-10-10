import { matchIngredientNames, normalizeIngredient } from "./ingredientMatcher";

export interface PlannerRecipeIngredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

export interface PlannerRecipe {
  id: string;
  title: string;
  servings?: number | null;
  category?: string | null;
  ingredients: PlannerRecipeIngredient[];
}

export interface PlannerFridgeItem {
  name: string;
  brand?: string | null;
  quantity?: number | null;
  unit?: string | null;
}

export interface PlannerMealHint {
  dishName: string;
  details?: string;
}

export interface PlannerPantryItem {
  name: string;
  brand?: string | null;
  unit?: string | null;
}

export interface PlannedShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  category?: string;
}

export interface PlannedMeal {
  mealIndex: number;
  dishName: string;
  isRepeatOrLeftover: boolean;
  details?: string;
}

export interface ShoppingPlan {
  coveredRecipes: string[];
  mealPlan: PlannedMeal[];
  itemsToBuy: PlannedShoppingItem[];
  alreadyInFridge: {
    name: string;
    usedFor: string;
    substitutionNote?: string;
  }[];
  warnings: string[];
}

interface UnitValue {
  type: "weight" | "volume" | "count" | "package" | "other";
  value: number;
  unit: string;
}

interface Demand {
  name: string;
  quantity: number;
  unit: string;
  recipeTitles: Set<string>;
}

interface WorkingStock extends PlannerFridgeItem {
  originalName: string;
  remaining: number;
  remainingUnit: string;
  usedFor: Set<string>;
}

const SWEET_RECIPE_PATTERN =
  /dessert|g[aâ]teau|cookie|muffin|brownie|crumble|pancake|sucr[ée]|chocolat chaud|pain perdu|gaufre/i;
const MAIN_CATEGORIES = new Set([
  "repas",
  "plat",
  "plat principal",
  "entree",
  "autre",
  undefined,
  null,
]);
const DEFAULT_PANTRY_BASICS: PlannerPantryItem[] = [
  { name: "Pain de mie complet", unit: "paquet" },
  { name: "Lait demi-écrémé", unit: "bouteille 1L" },
  { name: "Beurre doux", unit: "plaquette" },
  { name: "Café", unit: "paquet" },
  { name: "Bananes", unit: "kg" },
  { name: "Pommes", unit: "kg" },
  { name: "Essuie-tout", unit: "paquet" },
];
const PANTRY_ITEM_PATTERN =
  /cafe|the|cola|soda|jus|eau|boisson|pain|brioche|lait|beurre|fruit|pomme|banane|raisin|cereale|muesli|confiture|huile|sel|poivre|essuie|papier|menage/i;

function normalizeUnit(unit?: string | null): string {
  return (unit || "pièce")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toUnitValue(quantity: number, unit?: string | null): UnitValue {
  const normalized = normalizeUnit(unit);
  if (
    ["kg", "kilo", "kilos", "kilogramme", "kilogrammes"].includes(normalized)
  ) {
    return { type: "weight", value: quantity * 1000, unit: "g" };
  }
  if (["g", "gramme", "grammes", "gr"].includes(normalized)) {
    return { type: "weight", value: quantity, unit: "g" };
  }
  if (["l", "litre", "litres"].includes(normalized)) {
    return { type: "volume", value: quantity * 100, unit: "cl" };
  }
  if (["cl", "centilitre", "centilitres"].includes(normalized)) {
    return { type: "volume", value: quantity, unit: "cl" };
  }
  if (["ml", "millilitre", "millilitres"].includes(normalized)) {
    return { type: "volume", value: quantity / 10, unit: "cl" };
  }
  if (
    ["c a soupe", "cuillere a soupe", "cuilleres a soupe", "cas"].includes(
      normalized,
    )
  ) {
    return { type: "volume", value: quantity * 1.5, unit: "cl" };
  }
  if (
    ["c a cafe", "cuillere a cafe", "cuilleres a cafe", "cac"].includes(
      normalized,
    )
  ) {
    return { type: "volume", value: quantity * 0.5, unit: "cl" };
  }
  if (
    [
      "piece",
      "pieces",
      "unite",
      "unites",
      "tranche",
      "tranches",
      "gousse",
      "gousses",
    ].includes(normalized)
  ) {
    return {
      type: "count",
      value: quantity,
      unit: normalized.startsWith("tranche") ? "tranche" : "pièce",
    };
  }
  if (
    [
      "paquet",
      "paquets",
      "pot",
      "pots",
      "sachet",
      "sachets",
      "barquette",
      "barquettes",
      "bouteille",
      "bouteilles",
    ].includes(normalized)
  ) {
    return { type: "package", value: quantity, unit: normalized };
  }
  return { type: "other", value: quantity, unit: normalized || "pièce" };
}

function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  const from = toUnitValue(quantity, fromUnit);
  const to = toUnitValue(1, toUnit);
  if (from.type !== to.type || from.type === "other" || from.type === "package")
    return null;
  return from.value / to.value;
}

function isSavoryRecipe(recipe: PlannerRecipe): boolean {
  const category = recipe.category || undefined;
  return (
    MAIN_CATEGORIES.has(category) &&
    !SWEET_RECIPE_PATTERN.test(`${recipe.title} ${recipe.category || ""}`)
  );
}

function cleanMealName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+repas\s+\d+(?:\/\d+)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findRecipeByHint(
  hint: string,
  recipes: PlannerRecipe[],
): PlannerRecipe | undefined {
  const cleaned = normalizeIngredient(cleanMealName(hint));
  return recipes.find((recipe) => {
    const title = normalizeIngredient(recipe.title);
    return (
      title === cleaned || title.includes(cleaned) || cleaned.includes(title)
    );
  });
}

function getCategory(name: string): string {
  const norm = normalizeIngredient(name);
  if (
    /\b(eau|eaux|coca|cola|soda|sodas|jus|boisson|boissons|biere|bieres|vin|vins|cafe|cafes|the|thes|sirop|sirops|ice tea|oasis|sprite|fanta|schweppes|perrier|evian|volvic|cristaline)\b/i.test(
      norm,
    )
  ) {
    return "Boissons";
  }
  if (
    /(fruits?|legumes?|salades?|tomates?|oignons?|courgettes?|carottes?|poireaux?|poivrons?|champignons?|pommes? de terre|patates?|avocats?|concombres?|radis|brocolis?|choux?|navets?|celeri|aubergines?|epinards?|haricots? vert|ails?|\bail\b|echalotes?|persil|basilic|menthe|coriandre|ciboulette|estragon|thym|romarin|gingembre|\bpommes?\b|\bpoires?\b|bananes?|fraises?|framboises?|citrons?|oranges?|clementines?|mandarines?|raisins?|\bpeches?\b|abricots?)/i.test(
      norm,
    )
  ) {
    return "Fruits & Légumes";
  }
  if (
    /(poulets?|dindes?|canards?|volailles?|boeufs?|\bsteaks?\b|viandes?|haches?|porcs?|veaux?|agneaux?|lardons?|bacons?|jambons?|saucisses?|merguez|chipolatas?|chorizos?|charcuteries?|tenders?|nuggets?|poissons?|saumons?|cabillauds?|thons?|colins?|merlus?|crevettes?|gambas|moules?|saint-jacques|crabes?|fruits? de mer|escalopes?)/i.test(
      norm,
    )
  ) {
    return "Boucherie & Poissonnerie";
  }
  if (
    /(\blaits?\b|cremes?|beurres?|oeufs?|fromages?|gorgonzola|mozzarella|parmesan|grana|gruyere|comte|cheddar|mascarpone|ricotta|feta|chevres?|yaourts?|yogourts?|fromage blanc|petit suisse|cantal|reblochon|beaufort|emmental|roquefort|\bbleus?\b|\bbries?\b|camembert|saint-nectaire|maroilles|pecorino|burrata)/i.test(
      norm,
    )
  ) {
    return "Produits Frais & Crémerie";
  }
  if (/(surgels?|glaces?|sorbets?)/i.test(norm)) {
    return "Surgelés";
  }
  if (
    /(pains? burger|pains? a burger|pains? hamburger|pains? de mie|tortillas?|wraps?|pains? pita|pains? kebab|naans?|\bbaguettes?\b|\bpains?\b)/i.test(
      norm,
    ) &&
    !/(pain au chocolat|pains au chocolat|pain d'epice|pain perdu)/i.test(norm)
  ) {
    return "Épicerie salée";
  }
  if (
    /(sucres?|chocolats?|cacao|biscuits?|gateaux?|cookies?|muffins?|confitures?|miel|nutella|pate a tartiner|compotes?|cereales?|muesli|brioches?|croissants?|pains? au chocolat|bonbons?|caramels?|vanille)/i.test(
      norm,
    )
  ) {
    return "Épicerie sucrée";
  }
  return "Épicerie salée";
}

function purchaseFormat(
  name: string,
  quantity: number,
  unit: string,
): { quantity: number; unit: string; note: string } {
  const normalized = normalizeIngredient(name);
  const converted = toUnitValue(quantity, unit);
  if (converted.type === "weight") {
    let packageSize = 500;
    let packageLabel = `paquet de ${packageSize} g`;
    if (/pesto/.test(normalized)) {
      packageSize = 190;
      packageLabel = "pot de 190 g";
    } else if (/mascarpone/.test(normalized)) {
      packageSize = 250;
      packageLabel = "pot de 250 g";
    } else if (/sauce chili/.test(normalized)) {
      packageSize = 350;
      packageLabel = "bocal de 350 g";
    } else if (/grana|parmesan/.test(normalized)) {
      packageSize = 100;
      packageLabel = "sachet de 100 g";
    } else if (/farine|sucre/.test(normalized)) {
      packageSize = 1000;
      packageLabel = "paquet de 1 kg";
    } else if (/pate|riz|couscous|crozet|semoule/.test(normalized)) {
      packageSize = 500;
      packageLabel = "paquet de 500 g";
    } else if (/lardon|bacon/.test(normalized)) {
      packageSize = 200;
      packageLabel = "barquette de 200 g";
    } else if (/fromage|gruyere|comte/.test(normalized)) {
      packageSize = 200;
      packageLabel = " morceau de 200 g";
    }
    const packages = Math.ceil(converted.value / packageSize);
    return {
      quantity: packages,
      unit: packageLabel.trim(),
      note: `Format magasin mutualisé (${packages * packageSize >= 1000 ? `${(packages * packageSize) / 1000} kg` : `${packages * packageSize} g`} au total)`,
    };
  }
  if (converted.type === "volume") {
    const packageSize = /creme|lait/.test(normalized) ? 20 : 50;
    const packages = Math.ceil(converted.value / packageSize);
    return {
      quantity: packages,
      unit: `bouteille ${packageSize} cl`,
      note: `Format magasin couvrant ${Math.round(converted.value)} cl nécessaires`,
    };
  }
  if (converted.type === "count") {
    const packageSize = /wrap|galette/.test(normalized)
      ? 6
      : /oeuf/.test(normalized)
        ? 6
        : /burger|pain/.test(normalized)
          ? 4
          : 1;
    const packages = Math.ceil(converted.value / packageSize);
    return {
      quantity: packages,
      unit: packageSize === 1 ? "pièce" : `paquet de ${packageSize} pièces`,
      note:
        packageSize === 1
          ? "Quantité calculée pour les recettes prévues"
          : `Format magasin couvrant ${Math.round(converted.value)} pièces nécessaires`,
    };
  }
  return {
    quantity,
    unit,
    note: "Quantité calculée pour les recettes prévues",
  };
}

function addDemand(
  demands: Map<string, Demand>,
  ingredient: PlannerRecipeIngredient,
  recipe: PlannerRecipe,
  multiplier: number,
) {
  const quantity = Number(ingredient.quantity || 1) * multiplier;
  const unit = ingredient.unit || "pièce";
  const key =
    normalizeIngredient(ingredient.name) + `|${toUnitValue(1, unit).type}`;
  const existing = demands.get(key);
  if (existing) {
    existing.quantity += quantity;
    existing.recipeTitles.add(recipe.title);
  } else {
    demands.set(key, {
      name: ingredient.name,
      quantity,
      unit,
      recipeTitles: new Set([recipe.title]),
    });
  }
}

export function planShoppingList(params: {
  recipes: PlannerRecipe[];
  fridgeItems: PlannerFridgeItem[];
  pantryItems?: PlannerPantryItem[];
  includePantryBasics?: boolean;
  mealHints?: PlannerMealHint[];
  targetRecipeIds?: string[];
  excludedRecipeIds?: string[];
  daysCount: number;
  dessertsCount?: number;
  servings: number;
  allowRepeatMeals: boolean;
}): ShoppingPlan {
  const excluded = new Set(params.excludedRecipeIds || []);
  const allowed = params.recipes.filter(
    (recipe) => !excluded.has(recipe.id) && isSavoryRecipe(recipe),
  );
  const targets = params.targetRecipeIds?.length
    ? allowed.filter((recipe) => params.targetRecipeIds!.includes(recipe.id))
    : allowed;
  if (!targets.length)
    throw new Error(
      "Aucune recette salée autorisée ne permet de construire le planning demandé.",
    );
  if (!params.allowRepeatMeals && params.daysCount > targets.length) {
    throw new Error(
      `Impossible de planifier ${params.daysCount} repas distincts avec seulement ${targets.length} recettes autorisées.`,
    );
  }

  const hintedRecipes = (params.mealHints || [])
    .map((hint) => findRecipeByHint(hint.dishName, targets))
    .filter((recipe): recipe is PlannerRecipe => Boolean(recipe));
  const selected: PlannerRecipe[] = [];
  for (let index = 0; index < params.daysCount; index++) {
    const hinted = hintedRecipes[index];
    const recipe = hinted || targets[index % targets.length];
    if (
      !params.allowRepeatMeals &&
      selected.some((item) => item.id === recipe.id)
    ) {
      const next = targets.find(
        (candidate) => !selected.some((item) => item.id === candidate.id),
      );
      if (!next)
        throw new Error(
          "Le planning proposé ne respecte pas l'absence de répétition.",
        );
      selected.push(next);
    } else {
      selected.push(recipe);
    }
  }

  const mealCounts = new Map<string, number>();
  const demands = new Map<string, Demand>();
  const mealPlan = selected.map((recipe, index) => {
    const occurrence = (mealCounts.get(recipe.id) || 0) + 1;
    mealCounts.set(recipe.id, occurrence);
    const baseServings =
      recipe.servings && recipe.servings > 0
        ? recipe.servings
        : params.servings;
    const multiplier = params.servings / baseServings;
    const details =
      occurrence > 1
        ? `x${occurrence}`
        : `Préparation calculée pour ${params.servings} personne(s)`;
    for (const ingredient of recipe.ingredients)
      addDemand(demands, ingredient, recipe, multiplier);
    return {
      mealIndex: index + 1,
      dishName: recipe.title,
      isRepeatOrLeftover: occurrence > 1,
      details,
    };
  });

  // Prise en compte déterministe des desserts demandés
  const dessertCandidates = params.recipes.filter(
    (recipe) =>
      !excluded.has(recipe.id) &&
      (recipe.category === "dessert" ||
        recipe.category === "petit-dejeuner" ||
        SWEET_RECIPE_PATTERN.test(`${recipe.title} ${recipe.category || ""}`)),
  );
  const selectedDesserts: PlannerRecipe[] = [];
  const dessertsCount = Math.max(0, params.dessertsCount || 0);
  if (dessertsCount > 0 && dessertCandidates.length > 0) {
    const hintedDesserts = (params.mealHints || [])
      .map((hint) => findRecipeByHint(hint.dishName, dessertCandidates))
      .filter((recipe): recipe is PlannerRecipe => Boolean(recipe));

    for (let index = 0; index < dessertsCount; index++) {
      const hinted = hintedDesserts[index];
      const recipe =
        hinted ||
        dessertCandidates.find(
          (c) => !selectedDesserts.some((s) => s.id === c.id),
        ) ||
        dessertCandidates[index % dessertCandidates.length];
      if (recipe) {
        selectedDesserts.push(recipe);
        const baseServings =
          recipe.servings && recipe.servings > 0
            ? recipe.servings
            : params.servings;
        const multiplier = params.servings / baseServings;
        for (const ingredient of recipe.ingredients) {
          addDemand(demands, ingredient, recipe, multiplier);
        }
      }
    }
  }

  const stocks: WorkingStock[] = params.fridgeItems.map((item) => ({
    ...item,
    originalName: item.name,
    remaining: Number(item.quantity || 0),
    remainingUnit: item.unit || "pièce",
    usedFor: new Set<string>(),
  }));
  const purchases = new Map<string, PlannedShoppingItem>();
  const alreadyInFridge = new Map<
    string,
    { name: string; usedFor: Set<string>; substitutionNote?: string }
  >();

  for (const demand of demands.values()) {
    let remaining = demand.quantity;
    const demandValue = toUnitValue(demand.quantity, demand.unit);
    const matchingStocks = stocks.filter((stock) =>
      matchIngredientNames(demand.name, stock.name, stock.brand),
    );
    for (const stock of matchingStocks) {
      if (remaining <= 0) break;
      const stockValue = toUnitValue(stock.remaining, stock.remainingUnit);
      if (
        stockValue.type !== demandValue.type ||
        stockValue.type === "other" ||
        stockValue.type === "package"
      )
        continue;
      const usable = Math.min(demandValue.value, stockValue.value);
      const stockUsed = convertQuantity(
        usable,
        stockValue.unit,
        stock.remainingUnit,
      );
      const demandCovered = convertQuantity(
        usable,
        demandValue.unit,
        demand.unit,
      );
      if (!stockUsed || !demandCovered) continue;
      stock.remaining = Math.max(0, stock.remaining - stockUsed);
      remaining -= demandCovered;
      stock.usedFor = new Set([...stock.usedFor, ...demand.recipeTitles]);
      const existing = alreadyInFridge.get(stock.originalName);
      if (existing) {
        demand.recipeTitles.forEach((title: string) =>
          existing.usedFor.add(title),
        );
      } else {
        alreadyInFridge.set(stock.originalName, {
          name: stock.originalName,
          usedFor: new Set(demand.recipeTitles),
          substitutionNote:
            normalizeIngredient(stock.originalName) ===
            normalizeIngredient(demand.name)
              ? undefined
              : `Utilisé à la place de ${demand.name}`,
        });
      }
    }
    if (remaining > 0.0001) {
      const format = purchaseFormat(demand.name, remaining, demand.unit);
      const key = `${normalizeIngredient(demand.name)}|${format.unit}`;
      const existing = purchases.get(key);
      const note = `${format.note}. Pour : ${[...demand.recipeTitles].join(", ")}`;
      if (existing) existing.quantity += format.quantity;
      else
        purchases.set(key, {
          name: demand.name,
          quantity: format.quantity,
          unit: format.unit,
          notes: note,
          category: getCategory(demand.name),
        });
    }
  }

  if (params.includePantryBasics) {
    const existingNames = new Set(
      [...purchases.values()].map((item) => normalizeIngredient(item.name)),
    );
    const pantryItems = [
      ...(params.pantryItems || []).filter((item) =>
        PANTRY_ITEM_PATTERN.test(normalizeIngredient(item.name)),
      ),
      ...DEFAULT_PANTRY_BASICS,
    ];
    for (const pantryItem of pantryItems) {
      const key = normalizeIngredient(pantryItem.name);
      if (!key || existingNames.has(key)) continue;
      if (
        stocks.some(
          (stock) =>
            stock.remaining > 0 &&
            matchIngredientNames(pantryItem.name, stock.name, stock.brand),
        )
      )
        continue;
      existingNames.add(key);
      purchases.set(`pantry|${key}`, {
        name: pantryItem.name,
        quantity: 1,
        unit: pantryItem.unit || "pièce",
        notes:
          "Réapprovisionnement d'un article habituellement consommé et actuellement en rupture",
        category: getCategory(pantryItem.name),
      });
    }
  }

  const coveredRecipes = [...mealCounts.entries()].map(([id, count]) => {
    const recipe = selected.find((item) => item.id === id)!;
    return `${recipe.title} (x${count} repas)`;
  });
  for (const dessert of selectedDesserts) {
    coveredRecipes.push(`${dessert.title} (Dessert)`);
  }
  const warnings: string[] = [];
  if (hintedRecipes.length < params.daysCount)
    warnings.push(
      "Certains plats proposés par l'IA n'étaient pas des recettes autorisées et ont été remplacés.",
    );

  return {
    coveredRecipes,
    mealPlan,
    itemsToBuy: [...purchases.values()],
    alreadyInFridge: [...alreadyInFridge.values()].map((item) => ({
      name: item.name,
      usedFor: [...item.usedFor].join(", "),
      substitutionNote: item.substitutionNote,
    })),
    warnings,
  };
}
