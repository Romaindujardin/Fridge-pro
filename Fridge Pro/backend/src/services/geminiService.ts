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
        quantity: z.union([z.number(), z.string()]).nullish(),
        unit: z.string().nullish(),
        notes: z.string().nullish(),
      })
    )
    .default([]),
});

export type ReceiptAnalysis = z.infer<typeof RECEIPT_SCHEMA>;

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Instancie le client Gemini en vérifiant la présence de la clé API.
const getModel = (apiKey: string) => {
  if (!apiKey) {
    throw new Error(
      "Aucune clé Gemini n'a été fournie. Merci de configurer votre clé dans votre profil."
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  return genAI.getGenerativeModel({
    model: MODEL_NAME,
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
 * Analyse une image de ticket et renvoie les lignes produits.
 */
export const analyzeReceiptImage = async (params: {
  base64Image: string;
  mimeType: string;
  apiKey: string;
}): Promise<ReceiptAnalysis> => {
  const model = getModel(params.apiKey);

  const prompt = `
Tu es un assistant expert en extraction de données de tickets de caisse.

Objectif :
1. Vérifie si l'image fournie est réellement un ticket de caisse.
2. Si ce n'est pas un ticket de caisse, renvoie strictement le JSON:
{
  "isReceipt": false,
  "items": []
}
3. Si c'est un ticket de caisse, détecte les lignes correspondant aux produits achetés.
   - Chaque ingrédient doit avoir un nom clair (en français si possible).
   - Tente d'inférer la quantité (nombre) si elle est indiquée, sinon mets 1.
   - Tente d'inférer l'unité (pièce, kg, g, L, cl, paquet, etc.) si elle est indiquée, sinon laisse null.
   - Ajoute des notes éventuelles (bio, promotion, etc.) si pertinent, sinon null.
4. Répond STRICTEMENT avec un JSON valide, sans texte additionnel ni commentaire.

Format attendu:
{
  "isReceipt": boolean,
  "items": [
    {
      "name": "Nom du produit",
      "quantity": nombre ou null,
      "unit": "unité" ou null,
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
  description: z.string().optional(),
  servings: z.union([z.number(), z.string()]).optional(),
  prepTime: z.union([z.number(), z.string()]).optional(),
  cookTime: z.union([z.number(), z.string()]).optional(),
  difficulty: z.string().optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.union([z.number(), z.string()]).optional(),
        unit: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .min(1),
  instructions: z.array(z.string().min(1)).min(1),
  imageUrl: z.string().url().optional(),
  tips: z.array(z.string().min(1)).optional(),
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
  apiKey: string;
  fridgeItems?: {
    name: string;
    quantity?: number | null;
    unit?: string | null;
  }[];
}): Promise<GeneratedRecipe> => {
  const model = getModel(params.apiKey);

  const fridgeContext = params.fridgeItems?.length
    ? `L'utilisateur dispose des ingrédients suivants (nom - quantité - unité lorsqu'elles sont connues) :
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
    : "L'utilisateur n'a pas fourni de liste d'ingrédients disponibles.";

  const systemPrompt = `
Tu es un chef cuisinier créatif et précis. Ta mission est de générer une recette détaillée en français.

Contraintes :
- Si des ingrédients disponibles sont fournis, privilégie-les absolument dans la recette, et complète seulement si nécessaire.
- Donne un titre accrocheur.
- Fournis une description courte et appétissante.
- Propose un nombre de portions adapté (par défaut 4 si non précisé).
- Indique un temps de préparation et un temps de cuisson (en minutes, même approximatifs).
- Donne un niveau de difficulté parmi: "easy", "medium", "hard".
- Liste les ingrédients avec quantité numérique (si possible) et unité.
- Les instructions doivent être une liste d'étapes claires (chaque étape sous forme de phrase).
- Optionnel : ajoute quelques astuces ou conseils dans un tableau "tips".

Répond STRICTEMENT avec un JSON valide correspondant exactement au format suivant :
{
  "title": "...",
  "description": "...",
  "servings": nombre,
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

${fridgeContext}
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
    servings: normalizeNumber(raw.servings, 4),
    prepTime: normalizeNumber(raw.prepTime, 15, true),
    cookTime: normalizeNumber(raw.cookTime, 0, true),
    difficulty: difficultyNormalized,
    ingredients,
    instructions,
    imageUrl: raw.imageUrl,
    tips: raw.tips?.map((tip) => tip.trim()).filter(Boolean),
  };
};
