/**
 * Utilitaire de détection intelligente de correspondance d'ingrédients
 * entre le frigo de l'utilisateur et les recettes (gestion du pluriel, des accents,
 * des synonymes culinaires français, des formats et des marques).
 */

export interface FridgeItemForMatching {
  ingredientId: string;
  ingredient: {
    id?: string;
    name: string;
  };
  brand?: string | null;
}

/**
 * Normalise une chaîne pour la comparaison :
 * - Minuscules
 * - Suppression des accents (diacritiques)
 * - Suppression des unités et quantités packaging (ex: 500g, 1.25 L, 15 % MG, 1 kg)
 * - Remplacement de la ponctuation par des espaces
 */
export function normalizeIngredient(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // é -> e, à -> a...
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:%|mg|kg|g|cl|ml|l|oz|lb)\b/gi, " ")
    .replace(/\b\d+\s*%\s*(?:mg|matiere\s+grasse)?\b/gi, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mettre au singulier en français les mots courants
 */
export function singularizeFr(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("s") || word.endsWith("x")) {
    return word.slice(0, -1);
  }
  return word;
}

const STOP_WORDS = new Set([
  "de", "d", "du", "des", "a", "au", "aux", "la", "le", "les", "un", "une",
  "en", "et", "ou", "par", "pour", "avec", "sans", "sur", "sous", "facon",
  "bio", "frais", "fraiche", "fraiches", "maison", "sachet", "boite", "bocal",
  "pot", "paquet", "barquette", "tranche", "tranches", "morceau", "morceaux",
  "piece", "pieces", "grain", "grains", "poudre", "pure", "pur", "leger",
  "legere", "legers", "legeres", "entier", "entiere", "doux", "sale", "rape",
  "rapee", "rapes", "rapees", "cuit", "cuite", "cuits", "cuites", "fume",
  "fumee", "fumes", "fumees", "moyen", "moyens"
]);

export function getTokens(str: string): string[] {
  return normalizeIngredient(str)
    .split(" ")
    .map(singularizeFr)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// Groupes de concepts & synonymes culinaires en français
const CONCEPTS: Array<{ id: string; aliases: string[] }> = [
  {
    id: "WRAP",
    aliases: [
      "wrap",
      "wraps",
      "galette de wrap",
      "galettes de wrap",
      "tortilla",
      "tortillas",
      "fajita",
      "fajitas",
      "galette tortilla",
      "galettes tortilla",
    ],
  },
  {
    id: "PESTO",
    aliases: [
      "pesto",
      "pesto genovese",
      "pesto verde",
      "pesto rosso",
      "pesto basilic",
      "pesto au basilic",
    ],
  },
  {
    id: "LARDON_BACON",
    aliases: [
      "lardon",
      "lardons",
      "bacon",
      "allumette de bacon",
      "allumettes de bacon",
      "allumette de porc",
      "allumettes de porc",
      "poitrine fumee",
    ],
  },
  {
    id: "BEURRE_CACAHUETE",
    aliases: [
      "beurre de cacahuete",
      "beurre de cacahouete",
      "pate a tartiner cacahuete",
      "pate de cacahuete",
      "peanut butter",
    ],
  },
  {
    id: "CREME",
    aliases: [
      "creme",
      "creme fraiche",
      "creme liquide",
      "creme fluide",
      "creme fleurette",
      "creme epaisse",
      "creme legere",
    ],
  },
  {
    id: "SUCRE",
    aliases: [
      "sucre",
      "sucre en poudre",
      "sucre semoule",
      "sucre blanc",
      "cassonade",
      "sucre cassonade",
      "sucre roux",
    ],
  },
  {
    id: "FARINE",
    aliases: [
      "farine",
      "farine de ble",
      "farine blanche",
      "farine t55",
      "farine t45",
    ],
  },
  {
    id: "RIZ",
    aliases: [
      "riz",
      "riz basmati",
      "riz thai",
      "riz long",
      "riz rond",
      "riz blanc",
      "riz complet",
    ],
  },
  {
    id: "TOMATE",
    aliases: [
      "tomate",
      "tomates",
      "tomate cerise",
      "tomates cerises",
    ],
  },
  {
    id: "SAUCE_BOLO",
    aliases: [
      "sauce bolognaise",
      "bolognaise",
      "sauce bolognese",
      "sauce bolo",
    ],
  },
  {
    id: "SAUCE_TOMATE",
    aliases: [
      "sauce tomate",
      "coulis de tomate",
      "puree de tomate",
      "tomates concassees",
      "pulpe de tomate",
      "passata",
    ],
  },
  {
    id: "POULET",
    aliases: [
      "poulet",
      "filet de poulet",
      "filets de poulet",
      "blanc de poulet",
      "blancs de poulet",
      "aiguillette de poulet",
      "aiguillettes de poulet",
      "escalope de poulet",
      "escalopes de poulet",
      "tenders de poulet",
      "poulet croustillant",
    ],
  },
  {
    id: "BOEUF_HACHE",
    aliases: [
      "steak hache",
      "steaks haches",
      "viande hachee",
      "boeuf hache",
      "viande hachee de boeuf",
      "steak hache de boeuf",
    ],
  },
  {
    id: "BOEUF_PIECE",
    aliases: [
      "piece de boeuf",
      "faux filet",
      "entrecote",
      "bavette",
      "bavette de boeuf",
      "steak de boeuf",
      "pave de boeuf",
    ],
  },
  {
    id: "PAIN_BURGER",
    aliases: [
      "pain burger",
      "pain burger brioche",
      "pain a burger",
      "buns burger",
      "bun",
      "buns",
    ],
  },
  {
    id: "OIGNON",
    aliases: [
      "oignon",
      "oignons",
      "oignon jaune",
      "oignons jaunes",
      "oignon blanc",
      "oignons blancs",
    ],
  },
  {
    id: "POMME_DE_TERRE",
    aliases: [
      "pomme de terre",
      "pommes de terre",
      "patate",
      "patates",
      "frites",
      "tater tots",
    ],
  },
  {
    id: "CHOCOLAT",
    aliases: [
      "chocolat",
      "chocolat noir",
      "chocolat au lait",
      "pepites de chocolat",
    ],
  },
  {
    id: "BRIOCHE",
    aliases: [
      "brioche",
      "brioche nature",
      "brioche tressee",
    ],
  },
  {
    id: "CHEDDAR",
    aliases: [
      "cheddar",
      "cheddar en tranche",
      "cheddar en tranches",
      "tranche de cheddar",
      "tranches de cheddar",
    ],
  },
  {
    id: "PARMESAN",
    aliases: [
      "parmesan",
      "parmesan rape",
      "grana padano",
      "grana padano rape",
    ],
  },
  {
    id: "MOZZARELLA",
    aliases: [
      "mozzarella",
      "mozzarella rapee",
      "mozzarella di bufala",
      "mozza",
    ],
  },
  {
    id: "HARICOTS_VERTS",
    aliases: [
      "haricot vert",
      "haricots verts",
    ],
  },
  {
    id: "JAMBON",
    aliases: [
      "jambon",
      "jambon blanc",
      "jambon cuit",
      "tranche de jambon",
      "tranches de jambon",
      "des de jambon",
    ],
  },
  {
    id: "CHAMPIGNONS",
    aliases: [
      "champignon",
      "champignons",
      "champignon de paris",
      "champignons de paris",
    ],
  },
  {
    id: "SAUMON",
    aliases: [
      "saumon",
      "pave de saumon",
      "paves de saumon",
      "filet de saumon",
      "filets de saumon",
    ],
  },
  {
    id: "HUILE_OLIVE",
    aliases: [
      "huile d olive",
      "huile d'olive",
      "huile olive",
    ],
  },
  {
    id: "BEURRE",
    aliases: [
      "beurre",
      "beurre doux",
      "beurre demi sel",
      "beurre doux ramolli",
    ],
  },
];

const PASTA_SPECIFIC = [
  "spaghetti",
  "coquillette",
  "penne",
  "tagliatelle",
  "fusilli",
  "macaroni",
  "farfalle",
  "linguine",
  "lasagne",
  "crozet",
  "nouille",
  "rigatoni",
];

function matchesPasta(recipeName: string, fridgeName: string): boolean {
  const rNorm = normalizeIngredient(recipeName);
  const fNorm = normalizeIngredient(fridgeName);
  const fTokens = getTokens(fridgeName);

  // Si la recette demande des "Pâtes" ou "Pâtes courtes" au sens général
  const isRecipeGenericPasta =
    rNorm === "pates" || rNorm === "pate" || rNorm === "pates courtes";
  const isFridgePasta =
    PASTA_SPECIFIC.some((p) => fNorm.includes(p) || fTokens.includes(p)) ||
    fNorm.includes("pate");

  if (isRecipeGenericPasta && isFridgePasta) return true;

  // Si la recette demande un type de pâtes précis (ex: "Pâtes penne" vs "Penne Rigate")
  for (const pasta of PASTA_SPECIFIC) {
    if (rNorm.includes(pasta) && fNorm.includes(pasta)) return true;
  }
  return false;
}

function getMatchingConcepts(normText: string): Set<string> {
  const matches = new Set<string>();

  // Si le texte est un burger ("pain burger brioché"), ne pas l'associer au concept de brioche sucrée
  if (normText.includes("pain burger") || normText.includes("burger")) {
    matches.add("PAIN_BURGER");
    return matches;
  }

  for (const c of CONCEPTS) {
    for (const alias of c.aliases) {
      const normAlias = normalizeIngredient(alias);
      const regex = new RegExp(`(^|\\s)${normAlias}(\\s|$)`, "i");
      if (regex.test(normText) || normText === normAlias) {
        matches.add(c.id);
        break;
      }
    }
  }
  return matches;
}

/**
 * Compare le nom d'un ingrédient de recette avec le nom/marque d'un ingrédient du frigo
 */
export function matchIngredientNames(recipeName: string, fridgeItemName: string): boolean {
  if (matchesPasta(recipeName, fridgeItemName)) return true;

  const rNorm = normalizeIngredient(recipeName);
  const fNorm = normalizeIngredient(fridgeItemName);

  // 1. Égalité exacte après normalisation
  if (rNorm === fNorm) return true;

  // 2. Égalité singulier
  const rSingular = rNorm.split(" ").map(singularizeFr).join(" ");
  const fSingular = fNorm.split(" ").map(singularizeFr).join(" ");
  if (rSingular === fSingular) return true;

  // 3. Correspondance de sous-chaîne avec délimiteur de mot
  const rRegex = new RegExp(`(^|\\s)${rSingular}(\\s|$)`, "i");
  const fRegex = new RegExp(`(^|\\s)${fSingular}(\\s|$)`, "i");
  if (rRegex.test(fSingular) || fRegex.test(rSingular)) return true;

  // 4. Concepts et synonymes culinaires
  const rConcepts = getMatchingConcepts(rNorm);
  const fConcepts = getMatchingConcepts(fNorm);
  for (const cId of rConcepts) {
    if (fConcepts.has(cId)) return true;
  }

  // 5. Comparaison des tokens signifiants (exclusion des mots trop génériques)
  const rTokens = getTokens(recipeName);
  const fTokens = getTokens(fridgeItemName);
  const genericTokens = new Set([
    "sauce",
    "pain",
    "huile",
    "fromage",
    "viande",
    "pate",
    "blanc",
    "noir",
    "rouge",
    "vert",
  ]);

  const rMeaningful = rTokens.filter((t) => !genericTokens.has(t));
  const fMeaningful = fTokens.filter((t) => !genericTokens.has(t));

  if (rMeaningful.length > 0 && fMeaningful.length > 0) {
    // Si tous les tokens signifiants de la recette sont présents dans l'ingrédient du frigo
    if (rMeaningful.every((t) => fMeaningful.includes(t))) return true;
    // Si le frigo a un seul token bien spécifique présent dans la recette (ex: "concombre", "gorgonzola")
    if (fMeaningful.length === 1 && rMeaningful.includes(fMeaningful[0])) return true;
  }

  return false;
}

/**
 * Détermine si un ingrédient de recette est disponible dans la liste des ingrédients du frigo
 */
export function isIngredientAvailable(
  recipeIngredientId: string,
  recipeIngredientName: string,
  fridgeItems: FridgeItemForMatching[]
): boolean {
  for (const item of fridgeItems) {
    // 1. Vérification exacte par ID
    if (item.ingredientId === recipeIngredientId || item.ingredient?.id === recipeIngredientId) {
      return true;
    }

    const fridgeName = item.ingredient?.name;
    if (!fridgeName) continue;

    // 2. Vérification par nom d'ingrédient
    if (matchIngredientNames(recipeIngredientName, fridgeName)) {
      return true;
    }

    // 3. Vérification combinée avec la marque si présente
    if (item.brand) {
      const combined = `${fridgeName} ${item.brand}`;
      if (matchIngredientNames(recipeIngredientName, combined)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Trouve l'élément correspondant dans la liste des ingrédients utilisateur
 */
export function findMatchingItem<T extends FridgeItemForMatching>(
  recipeIngredientId: string,
  recipeIngredientName: string,
  items: T[]
): T | undefined {
  for (const item of items) {
    if (
      item.ingredientId === recipeIngredientId ||
      item.ingredient?.id === recipeIngredientId
    ) {
      return item;
    }

    const itemName = item.ingredient?.name;
    if (!itemName) continue;

    if (matchIngredientNames(recipeIngredientName, itemName)) {
      return item;
    }

    if (item.brand) {
      const combined = `${itemName} ${item.brand}`;
      if (matchIngredientNames(recipeIngredientName, combined)) {
        return item;
      }
    }
  }

  return undefined;
}

