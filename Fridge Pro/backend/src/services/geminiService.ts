// Client Gemini centralisé (analyse de tickets / génération de recettes).
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// Validation stricte de la réponse attendue lors de l'extraction de ticket.
const RECEIPT_SCHEMA = z.object({
  isReceipt: z.boolean(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        category: z.string().nullish(),
        quantity: z.union([z.number(), z.string()]).nullish(),
        unit: z.string().nullish(),
        price: z.union([z.number(), z.string()]).nullish(),
        estimatedDaysToExpire: z.union([z.number(), z.string()]).nullish(),
        notes: z.string().nullish(),
      })
    )
    .default([]),
});

export type ReceiptAnalysis = z.infer<typeof RECEIPT_SCHEMA>;

// Instancie le client Gemini en vérifiant la présence de la clé API.
const getModel = (apiKey?: string) => {
  const key = (apiKey || process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    throw new Error(
      "Aucune clé Gemini n'a été fournie. Merci de configurer votre clé dans votre profil ou dans le fichier .env."
    );
  }

  const modelName = (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite").trim();
  const genAI = new GoogleGenerativeAI(key);

  return genAI.getGenerativeModel({
    model: modelName,
  });
};

// Tente d'extraire un JSON valide (avec fallback si le modèle ajoute du texte).
const extractJson = (content: string) => {
  const trimmed = content.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  }

  throw new Error("Réponse du modèle IA invalide.");
};

/**
 * Analyse une image de ticket et renvoie les lignes produits avec catégorie, prix et péremption estimée.
 */
export const analyzeReceiptImage = async (params: {
  base64Image: string;
  mimeType: string;
  apiKey?: string;
}): Promise<ReceiptAnalysis> => {
  const model = getModel(params.apiKey);

  const prompt = `
Tu es un assistant expert en extraction de données de tickets de caisse de supermarché.

Objectif :
1. Vérifie si l'image fournie est réellement un ticket de caisse.
2. Si ce n'est pas un ticket de caisse, renvoie strictement le JSON:
{
  "isReceipt": false,
  "items": []
}
3. Si c'est un ticket de caisse, détecte les lignes correspondant aux produits alimentaires achetés (ignore les produits non alimentaires ou sacs).
   - Chaque ingrédient doit avoir un nom clair et explicite en français (ex: "Lardons fumés", "Crème fraîche", "Pâtes Penne").
   - Assigne obligatoirement la catégorie appropriée (category) parmi cette liste exacte :
     * "Les fruits & légumes" (légumes, fruits frais, herbes aromatiques)
     * "Les viandes" (viandes, volailles, charcuteries, poissons, crustacés)
     * "Produits laitiers" (laits, fromages, yaourts, beurres, crèmes, œufs)
     * "Féculents" (pâtes, riz, semoule, pommes de terre, pain de mie, pâtes à tarte)
     * "Conserves" (boîtes de conserve, bocaux)
     * "Boissons" (jus, eau, sodas, bières, vins)
     * "Sauces" (vinaigrettes, mayonnaise, moutarde, coulis de tomate)
     * "Produits secs" (farine, sucre, épices, huiles, sel, légumineuses)
     * "Petit déjeuner" (céréales, café, thé, confitures, pâtes à tartiner)
     * "Gâteaux" (biscuits, pâtisseries, viennoiseries)
     * "Apéritifs" (chips, gâteaux apéritifs, olives)
     * "Surgelés" (glaces, plats surgelés)
   - RÈGLE ESSENTIELLE SUR LE POIDS / VOLUME :
     * Si le produit mentionne un poids ou volume (ex: "320G", "500g", "1KG", "450ML", "50CL", "1L", "2X100G", "4X150G"):
       Tu DOIS impérativement mettre la valeur numérique du poids ou volume dans 'quantity' (ex: 320, 500, 1, 450, 200, 600) et l'unité correspondante dans 'unit' ("g", "kg", "ml", "cl", "L").
       Ne place JAMAIS le poids ou volume dans les 'notes' !
     * Si aucun grammage/volume n'est précisé et que c'est un produit unitaire (ex: 2 bavettes, 1 pizza, 6 oeufs, 1 concombre): mets le nombre dans 'quantity' et "pièce" dans 'unit'.
   - Tente d'extraire le prix en euros (nombre positif) s'il figure sur le ticket, sinon null.
   - Estime une durée de conservation réaliste en jours (estimatedDaysToExpire, entier positif) pour cet aliment non entamé stocké adéquatement (ex: poisson/viande fraîche: 3, volaille: 4, charcuterie: 14, crème/lait: 10, légumes frais/salade: 7, fruits: 10, yaourts/fromage: 21, oeufs: 21, conserves/pâtes/sec: 180).
   - Ajoute des notes éventuelles pour la marque ou variante (bio, marque, etc.) si pertinent, sinon null (sans répéter le poids).
4. Répond STRICTEMENT avec un JSON valide, sans texte additionnel ni commentaire markdown.

Format attendu:
{
  "isReceipt": boolean,
  "items": [
    {
      "name": "Nom de l'ingrédient",
      "category": "Nom de la catégorie parmi la liste exacte",
      "quantity": nombre ou null,
      "unit": "unité" ou null,
      "price": nombre ou null,
      "estimatedDaysToExpire": nombre de jours ou null,
      "notes": "commentaire" ou null
    }
  ]
}
`;

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        data: params.base64Image,
        mimeType: params.mimeType,
      },
    },
  ]);

  const responseText = result.response?.text()?.trim().replace(/\r/g, "");

  if (!responseText) {
    throw new Error("Aucune réponse reçue du modèle IA.");
  }

  const parsed = extractJson(responseText);

  return RECEIPT_SCHEMA.parse(parsed);
};

// Frontier des valeurs acceptées côté backend/DB.
const DIFFICULTY_VALUES = ["easy", "medium", "hard"] as const;

const GENERATED_RECIPE_SCHEMA = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  servings: z.union([z.number(), z.string()]).nullish(),
  prepTime: z.union([z.number(), z.string()]).nullish(),
  cookTime: z.union([z.number(), z.string()]).nullish(),
  difficulty: z.string().nullish(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.union([z.number(), z.string()]).nullish(),
        unit: z.string().nullish(),
        notes: z.string().nullish(),
      })
    )
    .min(1),
  instructions: z.array(z.string().min(1)).min(1),
  imageUrl: z.string().url().nullish(),
  tips: z.array(z.string().min(1)).nullish(),
});

export type GeneratedRecipe = {
  title: string;
  description?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  difficulty: (typeof DIFFICULTY_VALUES)[number];
  ingredients: {
    name: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  }[];
  instructions: string[];
  imageUrl?: string;
  tips?: string[];
};

/**
 * Génère une recette structurée via Gemini en tenant compte du frigo.
 */
export const generateRecipeFromPrompt = async (params: {
  prompt: string;
  servings?: number;
  apiKey?: string;
  fridgeItems?: {
    name: string;
    quantity?: number | null;
    unit?: string | null;
  }[];
  existingRecipes?: {
    id?: string;
    title: string;
    description?: string | null;
    ingredients: {
      name: string;
      quantity?: number | null;
      unit?: string | null;
    }[];
    instructions?: string[];
    isTarget?: boolean;
  }[];
}): Promise<GeneratedRecipe> => {
  const model = getModel(params.apiKey);
  const targetServings =
    typeof params.servings === "number" && params.servings > 0
      ? Math.round(params.servings)
      : 4;

  const fridgeContext = params.fridgeItems?.length
    ? `L'utilisateur dispose des ingrédients suivants au frigo (nom - quantité - unité lorsqu'elles sont connues) :
${params.fridgeItems
  .map((item) => {
    const parts = [item.name];
    if (item.quantity) {
      parts.push(String(item.quantity));
    }
    if (item.unit) {
      parts.push(item.unit);
    }
    return `- ${parts.join(" ")}`;
  })
  .join("\n")}`
    : "L'utilisateur n'a pas fourni de liste d'ingrédients disponibles au frigo.";

  let recipesContext = "";
  if (params.existingRecipes && params.existingRecipes.length > 0) {
    const targetRecipe = params.existingRecipes.find((r) => r.isTarget);
    if (targetRecipe) {
      recipesContext = `
Recette existante expressément ciblée par l'utilisateur : "${targetRecipe.title}"
${targetRecipe.description ? `Description d'origine : ${targetRecipe.description}\n` : ""}- Ingrédients d'origine : ${targetRecipe.ingredients
        .map(
          (ing) =>
            `${ing.name}${
              ing.quantity ? ` (${ing.quantity} ${ing.unit || ""})` : ""
            }`
        )
        .join(", ")}
${
  targetRecipe.instructions?.length
    ? `- Instructions d'origine : ${targetRecipe.instructions.join(" ; ")}\n`
    : ""
}
Consigne pour cette recette ciblée : Revois, adapte, décline ou allège cette recette spécifique selon la demande de l'utilisateur !

Autres recettes disponibles dans son carnet (${params.existingRecipes.length - 1} autres recettes) :
${params.existingRecipes
  .filter((r) => !r.isTarget)
  .slice(0, 30)
  .map(
    (r) =>
      `- "${r.title}" (Ingrédients clés : ${r.ingredients
        .slice(0, 6)
        .map((i) => i.name)
        .join(", ")})`
  )
  .join("\n")}
`;
    } else {
      recipesContext = `
Carnet des recettes déjà enregistrées par l'utilisateur (${params.existingRecipes.length} recettes au total) :
${params.existingRecipes
  .slice(0, 40)
  .map(
    (r) =>
      `- "${r.title}" (Ingrédients clés : ${r.ingredients
        .slice(0, 8)
        .map((i) => i.name)
        .join(", ")})`
  )
  .join("\n")}

Consigne concernant ces recettes existantes :
- Si la demande de l'utilisateur vise à MODIFIER, REVISITER ou DÉCLINER une de ces recettes, sers-toi de la recette correspondante comme base tout en appliquant les ajustements demandés.
- Si la demande de l'utilisateur vise à PROPOSER DES TRUCS QUI CHANGENT, DE LA NOUVEAUTÉ ou DE L'ORIGINALITÉ, observe attentivement ses habitudes culinaires ci-dessus afin de concevoir un plat innovant et savoureux qui n'apparaît PAS dans son carnet et apporte un vrai renouveau !
`;
    }
  }

  const systemPrompt = `
Tu es un chef cuisinier créatif et précis. Ta mission est de générer une recette détaillée en français.

Contraintes :
- Si des ingrédients disponibles au frigo sont fournis, privilégie-les absolument dans la recette, et complète seulement si nécessaire.
- Si un carnet de recettes existantes est fourni :
  * Si la demande porte sur la révision, l'adaptation ou la déclinaison d'une recette ou d'un plat du carnet, respecte son identité tout en appliquant les ajustements demandés par l'utilisateur.
  * Si la demande porte sur "des trucs qui changent", de la diversité ou une nouvelle idée, propose une création originale qui évite la redondance avec ses plats habituels.
- Donne un titre accrocheur.
- Fournis une description courte et appétissante.
- IMPORTANT : La recette et les quantités d'ingrédients DOIVENT être impérativement calculées et adaptées pour exactement ${targetServings} personne(s) (servings: ${targetServings}).
- Indique un temps de préparation et un temps de cuisson (en minutes, même approximatifs).
- Donne un niveau de difficulté parmi: "easy", "medium", "hard".
- Liste les ingrédients avec quantité numérique adaptée pour ${targetServings} personne(s) et unité.
- Les instructions doivent être une liste d'étapes claires (chaque étape sous forme de phrase).
- Optionnel : ajoute quelques astuces ou conseils dans un tableau "tips".

Répond STRICTEMENT avec un JSON valide correspondant exactement au format suivant :
{
  "title": "...",
  "description": "...",
  "servings": ${targetServings},
  "prepTime": nombre,
  "cookTime": nombre,
  "difficulty": "easy" | "medium" | "hard",
  "ingredients": [
    {
      "name": "...",
      "quantity": nombre,
      "unit": "...",
      "notes": "..."
    }
  ],
  "instructions": ["...", "..."],
  "imageUrl": "https://..." (optionnel),
  "tips": ["...", "..."] (optionnel)
}
Ne renvoie aucun autre texte que ce JSON.`;

  const userPrompt = `
Demande utilisateur :
${params.prompt}

Nombre de personnes / portions requis : ${targetServings} personne(s).

${fridgeContext}
${recipesContext ? `\n${recipesContext}` : ""}
`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt },
  ]);

  const responseText = result.response?.text()?.trim().replace(/\r/g, "");

  if (!responseText) {
    throw new Error("Aucune réponse reçue du modèle IA.");
  }

  const parsed = extractJson(responseText);
  const raw = GENERATED_RECIPE_SCHEMA.parse(parsed);

  // Utilitaire: convertit les champs numériques renvoyés sous forme string.
  const normalizeNumber = (
    value: number | string | undefined,
    defaultValue: number | undefined,
    allowZero = false
  ) => {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }
    const num =
      typeof value === "number"
        ? value
        : Number(String(value).replace(",", "."));
    if (!Number.isFinite(num)) {
      return defaultValue;
    }
    if (!allowZero && num <= 0) {
      return defaultValue;
    }
    return Math.round(num);
  };

  const difficultyNormalized = (() => {
    if (!raw.difficulty) return "medium" as const;
    const normalized = raw.difficulty.toLowerCase().trim();
    return DIFFICULTY_VALUES.includes(
      normalized as (typeof DIFFICULTY_VALUES)[number]
    )
      ? (normalized as (typeof DIFFICULTY_VALUES)[number])
      : ("medium" as const);
  })();

  const ingredients = raw.ingredients.map((ingredient) => {
    const quantity =
      ingredient.quantity !== undefined && ingredient.quantity !== null
        ? normalizeNumber(ingredient.quantity, undefined, false)
        : undefined;
    return {
      name: ingredient.name,
      quantity: quantity ? Number(quantity) : undefined,
      unit: ingredient.unit?.trim() || undefined,
      notes: ingredient.notes?.trim() || undefined,
    };
  });

  const instructions = raw.instructions
    .map((step) => step.trim())
    .filter(Boolean);

  if (instructions.length === 0) {
    instructions.push(
      "Suivez votre intuition culinaire pour assembler et servir cette recette."
    );
  }

  return {
    title: raw.title,
    description: raw.description?.trim() || undefined,
    servings: normalizeNumber(raw.servings ?? undefined, targetServings) || targetServings,
    prepTime: normalizeNumber(raw.prepTime ?? undefined, 15, true),
    cookTime: normalizeNumber(raw.cookTime ?? undefined, 0, true),
    difficulty: difficultyNormalized,
    ingredients,
    instructions,
    imageUrl: raw.imageUrl ?? undefined,
    tips: raw.tips?.map((tip) => tip.trim()).filter(Boolean),
  };
};

// Schéma de validation pour la génération intelligente de liste de courses
const GENERATED_SHOPPING_LIST_SCHEMA = z.object({
  listName: z.string().default("Courses de la semaine"),
  coveredRecipes: z.array(z.string()).default([]),
  mealPlan: z
    .array(
      z.object({
        mealIndex: z.number().nullish(),
        dishName: z.string(),
        isRepeatOrLeftover: z.boolean().nullish().default(false),
        details: z.string().nullish(),
      })
    )
    .nullish()
    .default([]),
  suggestedNewRecipes: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().nullish().default(""),
        mainIngredients: z.array(z.string()).nullish().default([]),
        whySuggested: z.string().nullish().default(""),
      })
    )
    .nullish()
    .default([]),
  itemsToBuy: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.union([z.number(), z.string()]).default(1),
        unit: z.string().default("pièce"),
        notes: z.string().nullish(),
        category: z.string().nullish(),
        estimatedPrice: z.union([z.number(), z.string()]).nullish(),
      })
    )
    .default([]),
  alreadyInFridge: z
    .array(
      z.object({
        name: z.string(),
        usedFor: z.string().nullish().default(""),
        substitutionNote: z.string().nullish(),
      })
    )
    .default([]),
  tips: z.array(z.string()).nullish(),
  estimatedTotalCost: z.union([z.number(), z.string()]).nullish(),
});

export type GeneratedShoppingList = {
  listName: string;
  coveredRecipes: string[];
  mealPlan?: {
    mealIndex?: number;
    dishName: string;
    isRepeatOrLeftover?: boolean;
    details?: string;
  }[];
  suggestedNewRecipes?: {
    title: string;
    description?: string;
    mainIngredients?: string[];
    whySuggested?: string;
  }[];
  itemsToBuy: {
    name: string;
    quantity: number;
    unit: string;
    notes?: string;
    category?: string;
    estimatedPrice?: number;
  }[];
  alreadyInFridge: {
    name: string;
    usedFor: string;
    substitutionNote?: string;
  }[];
  tips?: string[];
  estimatedTotalCost?: number;
};

/**
 * Génère une liste de courses mutualisée et intelligente avec Gemini
 * en prenant en compte le frigo, les équivalences (ex: gruyère vs emmental),
 * le nombre de repas, le budget et le conditionnement en supermarché.
 */
export const generateShoppingListWithAI = async (params: {
  apiKey?: string;
  fridgeItems: {
    name: string;
    brand?: string | null;
    quantity?: number | null;
    unit?: string | null;
    expiryDate?: Date | string | null;
  }[];
  archivedItems?: {
    name: string;
    brand?: string | null;
    quantity?: number | null;
    unit?: string | null;
    status?: string | null;
    finishedDate?: Date | string | null;
  }[];
  allRecipes: {
    id: string;
    title: string;
    description?: string | null;
    servings?: number | null;
    ingredients: {
      name: string;
      quantity?: number | null;
      unit?: string | null;
    }[];
  }[];
  targetRecipeIds?: string[];
  daysCount?: number;
  servings?: number;
  maxBudget?: number | null;
  includePantryBasics?: boolean;
  includeArchivedItems?: boolean;
  suggestNewRecipes?: boolean;
  allowRepeatMeals?: boolean;
  userPrompt?: string;
}): Promise<GeneratedShoppingList> => {
  const model = getModel(params.apiKey);
  const targetServings =
    params.servings && params.servings > 0 ? Math.round(params.servings) : 2;
  const days =
    params.daysCount && params.daysCount > 0 ? Math.round(params.daysCount) : 4;

  const targetRecipes = params.targetRecipeIds?.length
    ? params.allRecipes.filter((r) => params.targetRecipeIds!.includes(r.id))
    : [];

  const fridgeContext = params.fridgeItems.length
    ? `Contenu actuel du frigo et stocks de l'utilisateur (${params.fridgeItems.length} aliments enregistrés) :
${params.fridgeItems
  .map((i) => {
    const details = [i.name];
    if (i.brand) details.push(`(${i.brand})`);
    if (i.quantity) details.push(`${i.quantity} ${i.unit || ""}`);
    if (i.expiryDate) {
      const exp = new Date(i.expiryDate).toLocaleDateString("fr-FR");
      details.push(`[DLC: ${exp}]`);
    }
    return `- ${details.join(" ")}`;
  })
  .join("\n")}`
    : "Le frigo est actuellement vide.";

  const archivedContext =
    params.archivedItems && params.archivedItems.length > 0
      ? `Historique des aliments récemment consommés / archivés par l'utilisateur (${params.archivedItems.length} aliments archivés) :
${params.archivedItems
  .slice(0, 40)
  .map((i) => {
    const details = [i.name];
    if (i.brand) details.push(`(${i.brand})`);
    if (i.quantity) details.push(`${i.quantity} ${i.unit || ""}`);
    if (i.status === "consumed") details.push("[consommé/terminé]");
    else if (i.status === "expired") details.push("[périmé]");
    if (i.finishedDate) {
      const finished = new Date(i.finishedDate).toLocaleDateString("fr-FR");
      details.push(`le ${finished}`);
    }
    return `- ${details.join(" ")}`;
  })
  .join("\n")}`
      : "";

  let recipesContext = "";
  if (targetRecipes.length > 0) {
    recipesContext = `
Recettes expressément sélectionnées par l'utilisateur (${targetRecipes.length} recettes à préparer) :
${targetRecipes
  .map(
    (r, idx) => `### Recette ${idx + 1} : "${r.title}" (portion de base : ${r.servings || 2} personnes)
${r.description ? `Description : ${r.description}\n` : ""}Ingrédients requis :
${r.ingredients
  .map(
    (ing) =>
      `- ${ing.name}${
        ing.quantity ? ` : ${ing.quantity} ${ing.unit || ""}` : ""
      }`
  )
  .join("\n")}`
  )
  .join("\n\n")}
`;
  } else {
    recipesContext = `
L'utilisateur n'a pas imposé de recettes fixes. Voici son carnet de recettes disponibles (${params.allRecipes.length} recettes au total) :
${params.allRecipes
  .map(
    (r, idx) =>
      `### ${idx + 1}. "${r.title}" (${r.servings || 2} pers.) :
Ingrédients : ${r.ingredients
        .map(
          (i) =>
            `${i.name}${i.quantity ? ` (${i.quantity} ${i.unit || ""})` : ""}`
        )
        .join(", ")}`
  )
  .join("\n\n")}

Consignes impératives de sélection des recettes :
- L'utilisateur souhaite planifier EXACTEMENT ${days} repas pour ${targetServings} personne(s).
- RÈGLE DU FOYER : 1 RECETTE = 1 REPAS POUR 2 PERSONNES (sauf si un nombre différent de portions est expressément indiqué dans la recette).
- Tu dois sélectionner assez de recettes de son carnet pour couvrir précisément les ${days} repas demandés (par exemple ${days} repas complets).
- Pour chacune des recettes retenues, adapte les proportions pour ${targetServings} personne(s).
`;
  }

  const systemPrompt = `
Tu es un majordome et chef cuisinier expert en optimisation de courses ménagères et gestion intelligente de frigo.
Ton objectif est de créer une liste de courses ultra-optimisée, exhaustive, réaliste et économique pour ${targetServings} personne(s).

RÈGLES D'OR ABSOLUES :
1. BON SENS CULINAIRE ET ÉQUIVALENCES DU FRIGO :
   - Examine très attentivement le contenu du frigo de l'utilisateur.
   - Fais preuve d'intelligence culinaire et de bon sens : si une recette demande de l'emmental râpé et que le frigo contient du gruyère râpé, compte le gruyère du frigo comme équivalent et NE RAJOUTE PAS d'emmental à la liste !
   - De même pour les équivalences évidentes (lardons / bacon, crème liquide / crème fraîche, beurre doux / demi-sel, coulis / pulpe de tomate, oignons jaunes / blancs, etc.) et les stocks partiels.
   - Si un aliment au frigo a une DLC proche, privilégie son utilisation en priorité pour éviter le gaspillage !
   - Inscris TOUS les ingrédients évités grâce au frigo dans "alreadyInFridge" avec une note claire (ex: "Gruyère râpé (utilisé à la place de l'emmental râpé)").

2. MUTUALISATION ET CONDITIONNEMENTS RÉELS DE MAGASIN :
   - Ne crée PAS de petites quantités isolées impossibles à acheter.
   - GROUPE et CUMULE les ingrédients identiques ou compatibles entre plusieurs recettes (ex: si 2 recettes nécessitent des spaghettis, propose directement "Spaghettis" quantité "1", unité "kg" ou "paquet de 1kg" avec la mention en note).
   - Adapte aux formats réels de supermarché (boîte de 6 ou 12 œufs, plaquette de beurre 250g, brique de crème 20cl ou 50cl, filet d'oignons 1kg, etc.).
   ${
     params.maxBudget
       ? `- Budget maximal indicatif visé par l'utilisateur : environ ${params.maxBudget} €. Optimise les choix et conditionnements pour rester dans cette fourchette.`
       : ""
   }
   ${
     params.includePantryBasics
       ? "- Inclus également les indispensables du quotidien pour la semaine (ex: pain, lait, café/thé ou fruits frais pour dessert/snack)."
       : ""
   }

3. HISTORIQUE DES ALIMENTS CONSOMMÉS (ARCHIVÉS) :
   - Si un historique d'aliments consommés/archivés est fourni, analyse-le pour comprendre ce que le foyer consomme couramment et ce qui est récemment tombé en rupture de stock.
   - Si un ingrédient de base essentiel ou un aliment récurrent apprécié a été récemment terminé/consommé et n'est plus dans le frigo actuel, tu peux judicieusement proposer son réapprovisionnement dans la liste de courses si cela répond aux recettes ou aux besoins du foyer.

4. PLANIFICATION DES ${days} REPAS ET CUISINE EN DOUBLE PORTION (BATCH COOKING) :
   - RÈGLE FONDAMENTALE : 1 RECETTE = 1 REPAS POUR 2 PERSONNES (sauf si un nombre différent de portions est expressément indiqué dans la recette).
   ${
     params.allowRepeatMeals !== false
       ? `- TU PEUX PLANIFIER DE MANGER 2 FOIS LE MÊME PLAT (ex: "Lasagnes - Dîner soir 1" et "Lasagnes - Déjeuner midi 2", ou restes). C'est très avantageux et pratique pour le foyer, car cela évite de cuisiner à chaque repas !
   - Si tu prévois qu'un plat est mangé 2 fois, adapte les quantités de la recette pour 2 repas complets et note-le clairement dans "coveredRecipes" (ex: "Lasagnes traditionnelles (x2 repas)") et dans "mealPlan".`
       : `- Prévois des repas distincts sans répétition.`
   }
   - Tu dois obligatoirement couvrir l'ensemble des ${days} repas demandés.
   - NE TE LIMITE JAMAIS ARTIFICIELLEMENT EN NOMBRE D'ARTICLES ! Ne te restreins pas à 10 ou 11 aliments : ajoute ABSOLUMENT TOUS les ingrédients nécessaires pour réaliser l'intégralité des ${days} repas (légumes, viandes/poissons, crèmes, fromages, épicerie salée/sucrée, sauces, herbes) qui ne sont pas déjà au frigo.

5. SUGGESTIONS CRÉATIVES DE NOUVELLES RECETTES POUR RENTABILISER LES ACHATS :
   ${
     params.suggestNewRecipes !== false
       ? `- En plus des repas planifiés, propose dans "suggestedNewRecipes" entre 2 et 4 NOUVELLES IDÉES DE RECETTES qui réutilisent et rentabilisent les conditionnements achetés ou surplus d'ingrédients (ex: "Vous achetez 1kg de spaghettis : 500g pour les carbo + suggestion de Spaghettis à la viande hachée avec le surplus", ou "Avec le reste de barquette de viande hachée, suggestion de Légumes farcis au four").
   - Chaque suggestion doit contenir :
     * "title" : Nom du plat proposé
     * "description" : Explication courte et appétissante
     * "mainIngredients" : Liste des ingrédients achetés réutilisés
     * "whySuggested" : Explication claire de la mutualisation / rentabilisation du conditionnement supermarché.`
       : `- Laisse "suggestedNewRecipes" vide ([]).`
   }

6. CLASSEMENT PAR RAYONS :
   - Indique pour chaque article son rayon de supermarché parmi : "Fruits & Légumes", "Boucherie & Poissonnerie", "Produits Frais & Crémerie", "Épicerie salée", "Épicerie sucrée", "Boissons", "Surgelés".

Réponds STRICTEMENT avec un JSON valide suivant ce format :
{
  "listName": "Courses de la semaine (nom évocateur)",
  "coveredRecipes": ["Tagliatelles carbonara (x2 repas)", "Salade César"],
  "mealPlan": [
    { "mealIndex": 1, "dishName": "Tagliatelles carbonara", "isRepeatOrLeftover": false, "details": "Préparé en portion double pour 2 repas" },
    { "mealIndex": 2, "dishName": "Tagliatelles carbonara", "isRepeatOrLeftover": true, "details": "Deuxième repas (restes/batch cooking)" },
    { "mealIndex": 3, "dishName": "Salade César", "isRepeatOrLeftover": false, "details": "Repas frais du soir" }
  ],
  "suggestedNewRecipes": [
    {
      "title": "Spaghettis bolo express",
      "description": "Utilise les 500g de spaghettis restants du paquet de 1kg avec la viande hachée achetée.",
      "mainIngredients": ["Spaghettis", "Viande hachée"],
      "whySuggested": "Rentabilise le paquet de 1kg de spaghettis et mutualise la viande."
    }
  ],
  "itemsToBuy": [
    {
      "name": "Spaghettis",
      "quantity": 1,
      "unit": "kg",
      "notes": "Format 1kg pour couvrir les pâtes carbo et bolo",
      "category": "Épicerie salée",
      "estimatedPrice": 1.80
    }
  ],
  "alreadyInFridge": [
    {
      "name": "Gruyère râpé",
      "usedFor": "Pâtes carbonara",
      "substitutionNote": "Utilisé à la place de l'emmental râpé"
    }
  ],
  "tips": [
    "Format familial 1kg de pâtes choisi pour mutualiser les recettes."
  ],
  "estimatedTotalCost": 28.50
}
Ne renvoie aucun autre texte que ce JSON.`;

  const userPromptText = `
Demande utilisateur :
${params.userPrompt?.trim() || "Crée ma liste de courses optimisée pour la semaine."}

Nombre de repas prévus : EXACTEMENT ${days} repas (à couvrir sans omettre aucun ingrédient).
Nombre de personnes par repas : ${targetServings} personne(s).
Règle : 1 recette = 1 repas pour 2 personnes (sauf si un nombre différent de portions est précisé dans la recette).
${params.allowRepeatMeals !== false ? "Option active : Possibilité de cuisiner pour 2 repas (batch cooking / restes).\n" : ""}
${params.suggestNewRecipes !== false ? "Option active : Suggérer de nouvelles idées de recettes pour rentabiliser les conditionnements achetés.\n" : ""}
${params.maxBudget ? `Budget max souhaité : ${params.maxBudget} €\n` : ""}
${
  params.includePantryBasics
    ? `Option active : Inclure les basiques indispensables de la maison (pain, fruits, etc.)\n`
    : ""
}

${fridgeContext}

${archivedContext ? `${archivedContext}\n\n` : ""}${recipesContext}
`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPromptText },
  ]);

  const responseText = result.response?.text()?.trim().replace(/\r/g, "");
  if (!responseText) {
    throw new Error("Aucune réponse reçue du modèle IA.");
  }

  const parsed = extractJson(responseText);
  const raw = GENERATED_SHOPPING_LIST_SCHEMA.parse(parsed);

  const normalizeQty = (val: number | string | undefined | null) => {
    if (val === undefined || val === null || val === "") return 1;
    const n =
      typeof val === "number" ? val : Number(String(val).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  const normalizePrice = (val: number | string | undefined | null) => {
    if (val === undefined || val === null || val === "") return undefined;
    const n =
      typeof val === "number" ? val : Number(String(val).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
  };

  return {
    listName: raw.listName.trim() || "Courses optimisées IA",
    coveredRecipes: raw.coveredRecipes.map((r) => r.trim()).filter(Boolean),
    mealPlan: raw.mealPlan?.map((m, idx) => ({
      mealIndex: m.mealIndex || idx + 1,
      dishName: m.dishName.trim(),
      isRepeatOrLeftover: !!m.isRepeatOrLeftover,
      details: m.details?.trim() || undefined,
    })),
    suggestedNewRecipes: raw.suggestedNewRecipes?.map((s) => ({
      title: s.title.trim(),
      description: s.description?.trim() || "",
      mainIngredients: s.mainIngredients?.map((i) => i.trim()).filter(Boolean) || [],
      whySuggested: s.whySuggested?.trim() || "",
    })),
    itemsToBuy: raw.itemsToBuy.map((item) => ({
      name: item.name.trim(),
      quantity: normalizeQty(item.quantity),
      unit: item.unit?.trim() || "pièce",
      notes: item.notes?.trim() || undefined,
      category: item.category?.trim() || "Épicerie",
      estimatedPrice: normalizePrice(item.estimatedPrice),
    })),
    alreadyInFridge: raw.alreadyInFridge.map((f) => ({
      name: f.name.trim(),
      usedFor: f.usedFor?.trim() || "",
      substitutionNote: f.substitutionNote?.trim() || undefined,
    })),
    tips: raw.tips?.map((t) => t.trim()).filter(Boolean),
    estimatedTotalCost: normalizePrice(raw.estimatedTotalCost),
  };
};

