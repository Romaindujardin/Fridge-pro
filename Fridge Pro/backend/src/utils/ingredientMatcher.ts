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

const INVARIABLE_WORDS = new Set([
  "doux",
  "faux",
  "roux",
  "cremeux",
  "onctueux",
  "frais",
  "radis",
  "mais",
  "pois",
  "ananas",
]);

/**
 * Mettre au singulier en français les mots courants
 */
export function singularizeFr(word: string): string {
  if (word.length <= 3 || INVARIABLE_WORDS.has(word)) return word;
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

const GENERIC_TOKENS = new Set([
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

interface CompiledConcept {
  id: string;
  normAliases: string[];
  regexes: RegExp[];
}

const COMPILED_CONCEPTS: CompiledConcept[] = CONCEPTS.map((c) => {
  const normAliases = c.aliases.map((a) => normalizeIngredient(a));
  const regexes = normAliases.map(
    (na) =>
      new RegExp(
        "(^|\\s)" + na.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s|$)",
        "i"
      )
  );
  return { id: c.id, normAliases, regexes };
});

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

const NON_PASTA_PATTERNS = [
  "feuilletee",
  "brisee",
  "sablee",
  "pizza",
  "tarte",
  "tartiner",
  "curry",
  "arachide",
  "sesame",
  "amande",
  "filo",
  "brick",
];

function isPastaCandidate(norm: string, tokens: string[]): boolean {
  if (NON_PASTA_PATTERNS.some((p) => norm.includes(p) || tokens.includes(p))) {
    return false;
  }
  return (
    PASTA_SPECIFIC.some((p) => norm.includes(p) || tokens.includes(p)) ||
    tokens.includes("pate") ||
    tokens.includes("nouille") ||
    norm === "pates" ||
    norm === "pate"
  );
}

function matchesPasta(recipeName: string, fridgeName: string): boolean {
  const rNorm = normalizeIngredient(recipeName);
  const fNorm = normalizeIngredient(fridgeName);
  const rTokens = getTokens(recipeName);
  const fTokens = getTokens(fridgeName);

  if (!isPastaCandidate(fNorm, fTokens)) return false;

  // Si la recette demande des "Pâtes" ou "Pâtes courtes" au sens général
  const isRecipeGenericPasta =
    !NON_PASTA_PATTERNS.some((p) => rNorm.includes(p) || rTokens.includes(p)) &&
    (rNorm === "pates" || rNorm === "pate" || rNorm === "pates courtes");

  if (isRecipeGenericPasta) return true;

  // Si la recette demande un type de pâtes précis (ex: "Pâtes penne" vs "Penne Rigate")
  for (const pasta of PASTA_SPECIFIC) {
    if (rNorm.includes(pasta) && fNorm.includes(pasta)) return true;
  }
  return false;
}

/**
 * Termes désignant un plat préparé, produit fini ou porteur composite.
 * Un article de frigo contenant un de ces termes ne peut JAMAIS valider un ingrédient brut,
 * sauf si la recette demande expressément ce plat/porteur.
 */
export const CARRIER_WORDS = new Set([
  // Plats cuisinés & street food
  "pizza",
  "quiche",
  "tarte",
  "tourte",
  "chausson",
  "sandwich",
  "burger",
  "hamburger",
  "panini",
  "kebab",
  "tacos",
  "burrito",
  "croque",
  "friand",
  "feuillete",

  // Plats traiteur & cuisinés
  "lasagne",
  "ravioli",
  "tortellini",
  "cannelloni",
  "nugget",
  "cordon", // cordon bleu
  "poelee",
  "wok",
  "taboule",
  "parmentier",
  "paella",
  "couscous",
  "risotto",
  "samoussa",
  "nem",

  // Viennoiseries, biscuits & snacks
  "viennoiserie",
  "croissant",
  "biscuit",
  "gateau",
  "gaufre",
  "muffin",
  "beignet",
  "cookie",
  "chips",
  "cracker",
  "popcorn",

  // Desserts / Produits laitiers finis
  "glace",
  "sorbet",
  "yaourt",
  "yogourt",
  "flan",
  "mousse",
  "compote",

  // Boissons (un jus de fruit n'est pas un fruit entier brut)
  "jus",
  "sirop",
  "nectar",
  "soda",
  "boisson",

  // Sauces préparées & bouillons (sauce bolognaise != viande hachée)
  "sauce",
  "bouillon",
  "vinaigrette",
  "mayonnaise",
  "ketchup",
]);

export function getCarrierTokens(normText: string): Set<string> {
  const carriers = new Set<string>();
  if (!normText) return carriers;

  // Exceptions où le mot porteur a un usage culinaire comme ingrédient brut ou viennoiseries
  const cleaned = normText
    .replace(/\bsucre glace\b/g, "sucre_glace")
    .replace(/\bpain (?:a )?burger\b/g, "pain_burger")
    .replace(/\bpain aux? (?:chocolat|raisin)s?\b/g, "viennoiserie")
    .replace(/\bchocolatine\b/g, "viennoiserie");

  const tokens = cleaned.split(" ").map(singularizeFr);
  for (const t of tokens) {
    if (CARRIER_WORDS.has(t)) {
      carriers.add(t);
    }
  }
  return carriers;
}

export function hasCarrierConflict(recipeNorm: string, fridgeNorm: string): boolean {
  const rCarriers = getCarrierTokens(recipeNorm);
  const fCarriers = getCarrierTokens(fridgeNorm);

  for (const fc of fCarriers) {
    if (!rCarriers.has(fc)) {
      return true;
    }
  }
  return false;
}

/**
 * Qualificatifs, découpes, textures et modes de conservation autorisés comme tokens supplémentaires.
 * Permet par ex. à "chorizo doux", "steak haché surgelé" ou "poulet fermier" de matcher "chorizo", "steak" ou "poulet".
 */
export const ALLOWED_MODIFIERS = new Set([
  // Goûts, intensités & assaisonnements
  "doux", "fort", "piquant", "epice", "nature", "fume", "sale", "demi-sel",
  "sucre", "acidule", "aromatise",

  // Couleurs & variétés végétales / animales
  "blanc", "blanche", "jaune", "rouge", "vert", "verte", "noir", "noire",
  "rose", "brun", "brune", "marron", "orange", "violet", "violette", "dore",
  "golden", "gala", "granny", "fuji", "chantecler", "roma", "cerise",
  "bintje", "charlotte", "amandine", "ratte",

  // Textures, consistances & matières grasses
  "liquide", "fluide", "epais", "epaisse", "semi-epais", "semi-epaisse",
  "onctueux", "onctueuse", "cremeux", "cremeuse", "fondant", "fondante",
  "allege", "allegee", "maigre", "entier", "entiere", "ecreme", "ecremee",
  "demi-ecreme", "demi-ecremee", "brut", "pur", "concentre",

  // Découpes, formats & états
  "tranche", "tranchee", "emince", "emincee", "hache", "hachee", "rape", "rapee",
  "concasse", "concassee", "cube", "cubes", "des", "allumette", "allumettes",
  "morceau", "morceaux", "filet", "filets", "pave", "paves", "cuisse", "cuisses",
  "aile", "ailes", "aiguillette", "aiguillettes", "cote", "cotes", "escalope",
  "escalopes", "longe", "steack", "steak", "rondelle", "rondelles",
  "egoutte", "egouttee", "pele", "pelee", "seche", "sechee", "moulu", "moulue",
  "poudre", "grain", "grains", "gousse", "gousses",

  // Modes de conservation & cuisson (dont surgelé / congelé)
  "frais", "fraiche", "cru", "crue", "cuit", "cuite", "pre-cuit", "precuit",
  "roti", "rotie", "grille", "grillee", "vapeur", "pasteurise", "pasteurisee",
  "sterilise", "sterilisee", "surgele", "surfelee", "congele", "congelee",
  "conserve",

  // Origines & labels
  "bio", "fermier", "fermiere", "sauvage", "elevage", "artisan", "artisanal",
  "artisanale", "tradition", "traditionnel", "traditionnelle", "origine",
  "france", "francais", "francaise", "italie", "italien", "italienne",
  "espagne", "espagnol", "espagnole", "grece", "grec", "grecque",
  "aop", "aoc", "igp", "label", "plein", "air", "sol", "extra", "aloyau",
  "patissier", "patissiere",
]);

export function areExtraTokensAllowed(
  rMeaningful: string[],
  fMeaningful: string[],
  brand?: string | null
): boolean {
  const brandTokens = brand ? getTokens(brand) : [];
  const extraTokens = fMeaningful.filter((t) => !rMeaningful.includes(t));

  return extraTokens.every(
    (t) =>
      ALLOWED_MODIFIERS.has(t) ||
      brandTokens.includes(t) ||
      STOP_WORDS.has(t) ||
      GENERIC_TOKENS.has(t)
  );
}

export function getMatchingConcepts(normText: string): Set<string> {
  const matches = new Set<string>();

  // Si le texte est un burger ("pain burger brioché"), ne pas l'associer au concept de brioche sucrée
  if (normText.includes("pain burger") || normText.includes("burger")) {
    matches.add("PAIN_BURGER");
    return matches;
  }

  for (const c of COMPILED_CONCEPTS) {
    for (let i = 0; i < c.normAliases.length; i++) {
      if (normText === c.normAliases[i] || c.regexes[i].test(normText)) {
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
export function matchIngredientNames(
  recipeName: string,
  fridgeItemName: string,
  brand?: string | null
): boolean {
  if (matchesPasta(recipeName, fridgeItemName)) return true;

  const rNorm = normalizeIngredient(recipeName);
  const fNorm = normalizeIngredient(fridgeItemName);

  // 0. Vérification anti-faux-positifs : conflit de plat préparé / porteur
  if (hasCarrierConflict(rNorm, fNorm)) {
    return false;
  }

  // 1. Égalité exacte après normalisation
  if (rNorm === fNorm) return true;

  // 2. Égalité singulier
  const rSingular = rNorm.split(" ").map(singularizeFr).join(" ");
  const fSingular = fNorm.split(" ").map(singularizeFr).join(" ");
  if (rSingular === fSingular) return true;

  // 3. Concepts et synonymes culinaires
  const rConcepts = getMatchingConcepts(rNorm);
  const fConcepts = getMatchingConcepts(fNorm);
  for (const cId of rConcepts) {
    if (fConcepts.has(cId)) return true;
  }

  // 4. Comparaison des tokens signifiants (exclusion des mots trop génériques)
  const rTokens = getTokens(recipeName);
  const fTokens = getTokens(fridgeItemName);

  const rMeaningful = rTokens.filter((t) => !GENERIC_TOKENS.has(t));
  const fMeaningful = fTokens.filter((t) => !GENERIC_TOKENS.has(t));

  if (rMeaningful.length > 0 && fMeaningful.length > 0) {
    // Si tous les tokens signifiants de la recette sont présents dans l'ingrédient du frigo
    if (rMeaningful.every((t) => fMeaningful.includes(t))) {
      if (areExtraTokensAllowed(rMeaningful, fMeaningful, brand)) {
        return true;
      }
    }
    // Si le frigo a un seul token bien spécifique présent dans la recette (ex: "poulet" pour "filet de poulet")
    if (fMeaningful.length === 1 && rMeaningful.includes(fMeaningful[0])) {
      return true;
    }
  }

  // 5. Correspondance de sous-chaîne avec délimiteur de mot (avec vérification des tokens extra)
  const rRegex = new RegExp(
    `(^|\\s)${rSingular.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`,
    "i"
  );
  if (rRegex.test(fSingular)) {
    if (areExtraTokensAllowed(rMeaningful, fMeaningful, brand)) {
      return true;
    }
  }
  const fRegex = new RegExp(
    `(^|\\s)${fSingular.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`,
    "i"
  );
  if (fRegex.test(rSingular)) {
    return true;
  }

  return false;
}

export interface IndexedItem<T extends FridgeItemForMatching> {
  raw: T;
  id: string;
  name: string;
  brand?: string | null;
  norm: string;
  singular: string;
  combined?: string;
  tokens: string[];
  meaningfulTokens: string[];
  concepts: Set<string>;
  isPasta: boolean;
}

/**
 * Index ultra-rapide en mémoire pour les ingrédients de l'utilisateur.
 * Transforme le matching coûteux O(N*M) avec regexes en requêtes O(1) indexées et mémoïsées.
 */
export class FridgeIndex<T extends FridgeItemForMatching = FridgeItemForMatching> {
  public readonly items: IndexedItem<T>[] = [];
  public readonly byId = new Map<string, T>();
  public readonly byNorm = new Map<string, T>();
  public readonly bySingular = new Map<string, T>();
  public readonly byConcept = new Map<string, T>();
  public readonly byMeaningfulToken = new Map<string, IndexedItem<T>[]>();
  public readonly pastaItems: IndexedItem<T>[] = [];
  private readonly memo = new Map<string, T | null>();

  constructor(fridgeItems: T[]) {
    for (const raw of fridgeItems) {
      const id = raw.ingredientId || raw.ingredient?.id || "";
      const name = raw.ingredient?.name || "";
      const brand = raw.brand || null;
      const norm = normalizeIngredient(name);
      const singular = norm.split(" ").map(singularizeFr).join(" ");
      const combined = brand ? normalizeIngredient(`${name} ${brand}`) : undefined;
      const tokens = getTokens(name);
      const meaningfulTokens = tokens.filter((t) => !GENERIC_TOKENS.has(t));
      const concepts = getMatchingConcepts(norm);
      if (combined) {
        for (const c of getMatchingConcepts(combined)) {
          concepts.add(c);
        }
      }
      const isPasta = isPastaCandidate(norm, tokens);

      const indexed: IndexedItem<T> = {
        raw,
        id,
        name,
        brand,
        norm,
        singular,
        combined,
        tokens,
        meaningfulTokens,
        concepts,
        isPasta,
      };

      this.items.push(indexed);

      if (id) this.byId.set(id, raw);
      if (raw.ingredient?.id) this.byId.set(raw.ingredient.id, raw);

      if (norm && !this.byNorm.has(norm)) this.byNorm.set(norm, raw);
      if (singular && !this.bySingular.has(singular)) this.bySingular.set(singular, raw);
      if (combined && !this.byNorm.has(combined)) this.byNorm.set(combined, raw);

      for (const c of concepts) {
        if (!this.byConcept.has(c)) this.byConcept.set(c, raw);
      }
      for (const t of meaningfulTokens) {
        if (!this.byMeaningfulToken.has(t)) this.byMeaningfulToken.set(t, []);
        this.byMeaningfulToken.get(t)!.push(indexed);
      }
      if (isPasta) {
        this.pastaItems.push(indexed);
      }
    }
  }

  public match(recipeIngredientId?: string, recipeIngredientName?: string): T | null {
    const memoKey = `${recipeIngredientId || ""}:${recipeIngredientName || ""}`;
    if (this.memo.has(memoKey)) {
      return this.memo.get(memoKey)!;
    }

    // 1. Par ID direct (O(1))
    if (recipeIngredientId && this.byId.has(recipeIngredientId)) {
      const found = this.byId.get(recipeIngredientId)!;
      this.memo.set(memoKey, found);
      return found;
    }

    if (!recipeIngredientName) {
      this.memo.set(memoKey, null);
      return null;
    }

    const rNorm = normalizeIngredient(recipeIngredientName);

    const rTokens = getTokens(recipeIngredientName);

    // Gestion intelligente des pâtes
    const isRecipeGenericPasta =
      !NON_PASTA_PATTERNS.some((p) => rNorm.includes(p) || rTokens.includes(p)) &&
      (rNorm === "pates" || rNorm === "pate" || rNorm === "pates courtes");
    if (isRecipeGenericPasta && this.pastaItems.length > 0) {
      const found = this.pastaItems[0].raw;
      this.memo.set(memoKey, found);
      return found;
    }
    for (const pasta of PASTA_SPECIFIC) {
      if (rNorm.includes(pasta)) {
        const found = this.pastaItems.find((p) => p.norm.includes(pasta));
        if (found) {
          this.memo.set(memoKey, found.raw);
          return found.raw;
        }
      }
    }

    // 2. Égalité exacte normalisée (O(1)) avec vérification porteur
    if (this.byNorm.has(rNorm)) {
      const found = this.byNorm.get(rNorm)!;
      const fNorm = normalizeIngredient(found.ingredient?.name || "");
      if (!hasCarrierConflict(rNorm, fNorm)) {
        this.memo.set(memoKey, found);
        return found;
      }
    }

    // 3. Égalité exacte au singulier (O(1)) avec vérification porteur
    const rSingular = rNorm.split(" ").map(singularizeFr).join(" ");
    if (this.bySingular.has(rSingular)) {
      const found = this.bySingular.get(rSingular)!;
      const fNorm = normalizeIngredient(found.ingredient?.name || "");
      if (!hasCarrierConflict(rNorm, fNorm)) {
        this.memo.set(memoKey, found);
        return found;
      }
    }

    // 4. Concepts et synonymes culinaires (O(1) lookup par concept) avec vérification porteur
    const rConcepts = getMatchingConcepts(rNorm);
    for (const c of rConcepts) {
      if (this.byConcept.has(c)) {
        const found = this.byConcept.get(c)!;
        const fNorm = normalizeIngredient(found.ingredient?.name || "");
        if (!hasCarrierConflict(rNorm, fNorm)) {
          this.memo.set(memoKey, found);
          return found;
        }
      }
    }

    // 5. Tokens signifiants (intersection de tokens)
    const rMeaningful = rTokens.filter((t) => !GENERIC_TOKENS.has(t));
    if (rMeaningful.length > 0) {
      for (const t of rMeaningful) {
        const candidates = this.byMeaningfulToken.get(t);
        if (candidates) {
          for (const cand of candidates) {
            // Anti-faux-positifs porteur (ex: "pizza chorizo" ne matchera pas "chorizo")
            if (hasCarrierConflict(rNorm, cand.norm)) {
              continue;
            }

            if (rMeaningful.every((rmt) => cand.meaningfulTokens.includes(rmt))) {
              if (areExtraTokensAllowed(rMeaningful, cand.meaningfulTokens, cand.brand)) {
                this.memo.set(memoKey, cand.raw);
                return cand.raw;
              }
            }
            if (
              cand.meaningfulTokens.length === 1 &&
              cand.meaningfulTokens[0] === t
            ) {
              this.memo.set(memoKey, cand.raw);
              return cand.raw;
            }
          }
        }
      }
    }

    // 6. Correspondance de sous-chaîne (fallback avec vérifications)
    const rEscaped = rSingular.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rRegex = new RegExp(`(^|\\s)${rEscaped}(\\s|$)`, "i");
    for (const item of this.items) {
      if (hasCarrierConflict(rNorm, item.norm)) {
        continue;
      }

      if (rRegex.test(item.singular)) {
        if (areExtraTokensAllowed(rMeaningful, item.meaningfulTokens, item.brand)) {
          this.memo.set(memoKey, item.raw);
          return item.raw;
        }
      }
      const itemEscaped = item.singular.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const itemRegex = new RegExp(`(^|\\s)${itemEscaped}(\\s|$)`, "i");
      if (itemRegex.test(rSingular)) {
        this.memo.set(memoKey, item.raw);
        return item.raw;
      }
    }

    this.memo.set(memoKey, null);
    return null;
  }

  public isAvailable(recipeIngredientId?: string, recipeIngredientName?: string): boolean {
    return this.match(recipeIngredientId, recipeIngredientName) !== null;
  }
}

export function buildFridgeIndex<T extends FridgeItemForMatching>(items: T[]): FridgeIndex<T> {
  return new FridgeIndex(items);
}

/**
 * Détermine si un ingrédient de recette est disponible dans la liste des ingrédients du frigo
 */
export function isIngredientAvailable(
  recipeIngredientId: string,
  recipeIngredientName: string,
  fridgeItems: FridgeItemForMatching[] | FridgeIndex
): boolean {
  if (fridgeItems instanceof FridgeIndex) {
    return fridgeItems.isAvailable(recipeIngredientId, recipeIngredientName);
  }
  const index = new FridgeIndex(fridgeItems);
  return index.isAvailable(recipeIngredientId, recipeIngredientName);
}

/**
 * Trouve l'élément correspondant dans la liste des ingrédients utilisateur
 */
export function findMatchingItem<T extends FridgeItemForMatching>(
  recipeIngredientId: string,
  recipeIngredientName: string,
  items: T[] | FridgeIndex<T>
): T | undefined {
  if (items instanceof FridgeIndex) {
    return items.match(recipeIngredientId, recipeIngredientName) || undefined;
  }
  const index = new FridgeIndex(items);
  return index.match(recipeIngredientId, recipeIngredientName) || undefined;
}


