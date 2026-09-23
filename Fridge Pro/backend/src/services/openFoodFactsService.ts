// Client OpenFoodFacts pour enrichir les ingrédients/produits côté app.
import axios from "axios";

interface OpenFoodFactsProduct {
  code: string;
  product: {
    product_name?: string;
    product_name_fr?: string;
    brands?: string;
    categories?: string;
    quantity?: string;
    ingredients_text?: string;
    ingredients_text_fr?: string;
    nutriments?: {
      energy_kcal_100g?: number;
      proteins_100g?: number;
      carbohydrates_100g?: number;
      fat_100g?: number;
      fiber_100g?: number;
      salt_100g?: number;
      sugars_100g?: number;
    };
    allergens_tags?: string[];
    traces_tags?: string[];
    image_url?: string;
    image_front_url?: string;
  };
}

interface SearchResult {
  products: OpenFoodFactsProduct["product"][];
  count: number;
  page: number;
  page_count: number;
  page_size: number;
}

export interface ParsedIngredientQuery {
  rawQuery: string;
  cleanQuery: string;
  singularQuery?: string;
  detectedQuantity?: number;
  detectedUnit?: string;
}

export class OpenFoodFactsService {
  private readonly baseUrls = [
    "https://world.openfoodfacts.org",
    "https://fr.openfoodfacts.net",
    "https://world.openfoodfacts.net",
    "https://fr.openfoodfacts.org",
  ];
  private readonly userAgent = "FridgeProApp/1.0 (contact@fridgepro.com)";
  private cache = new Map<string, { data: any[]; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Effectue un appel GET résilient sur les miroirs OpenFoodFacts
   */
  private async fetchFromOFF(endpoint: string, params: Record<string, any>): Promise<any> {
    for (const base of this.baseUrls) {
      try {
        const response = await axios.get(`${base}${endpoint}`, {
          params,
          headers: { "User-Agent": this.userAgent },
          timeout: 4500,
        });
        if (response.data) {
          return response.data;
        }
      } catch {
        // Essayer le miroir suivant en cas d'erreur ou timeout
      }
    }
    return null;
  }

  /**
   * Analyse et nettoie une requête comme "spaghettis 1kg", "lait 1L", "beurre 250g"
   */
  parseQueryAndQuantity(raw: string): ParsedIngredientQuery {
    const trimmed = raw.trim();
    // Regex pour détecter quantité + unité (ex: 1kg, 500 g, 1.5 L, 250ml)
    const qtyRegex = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|cl|ml|pièces?|paquets?|pots?)(?:\s|$)/i;
    const match = trimmed.match(qtyRegex);

    let detectedQuantity: number | undefined;
    let detectedUnit: string | undefined;
    let cleanQuery = trimmed;

    if (match) {
      detectedQuantity = parseFloat(match[1].replace(",", "."));
      detectedUnit = match[2].toLowerCase();
      cleanQuery = trimmed.replace(match[0], " ").replace(/\s+/g, " ").trim();
    }

    // Gestion du pluriel simple en français (ex: spaghettis -> spaghetti, pommes -> pomme)
    let singularQuery: string | undefined;
    if (cleanQuery.endsWith("s") && cleanQuery.length > 3) {
      singularQuery = cleanQuery.slice(0, -1);
    }

    return {
      rawQuery: trimmed,
      cleanQuery: cleanQuery || trimmed,
      singularQuery,
      detectedQuantity,
      detectedUnit,
    };
  }

  /**
   * Recherche des produits par nom (en français)
   */
  async searchProducts(
    query: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<SearchResult> {
    try {
      const data = await this.fetchFromOFF("/cgi/search.pl", {
        search_terms: query,
        search_simple: 1,
        action: "process",
        json: 1,
        page: page,
        page_size: pageSize,
        fields:
          "code,product_name,product_name_fr,brands,categories,quantity,nutriments,image_front_url",
      });

      return data || { products: [], count: 0, page: 1, page_count: 0, page_size: pageSize };
    } catch (error) {
      console.warn("Erreur lors de la recherche OpenFoodFacts searchProducts:", error);
      return { products: [], count: 0, page: 1, page_count: 0, page_size: pageSize };
    }
  }

  /**
   * Récupère un produit par son code-barres
   */
  async getProductByBarcode(
    barcode: string
  ): Promise<OpenFoodFactsProduct | null> {
    try {
      for (const base of this.baseUrls) {
        try {
          const response = await axios.get(
            `${base}/api/v0/product/${barcode}.json`,
            {
              headers: { "User-Agent": this.userAgent },
              timeout: 4000,
            }
          );
          if (response.data?.status === 1) {
            return response.data;
          }
        } catch {
          // essayer miroir suivant
        }
      }
      return null;
    } catch (error) {
      console.warn("Erreur lors de la récupération du produit par code-barres:", error);
      return null;
    }
  }

  /**
   * Recherche des ingrédients avec nettoyage de quantité et fallback intelligent
   */
  async searchIngredients(query: string): Promise<any[]> {
    const parsed = this.parseQueryAndQuantity(query);
    if (!parsed.cleanQuery || parsed.cleanQuery.length < 3) {
      return [];
    }

    const cacheKey = parsed.cleanQuery.toLowerCase();

    // Vérifier le cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return this.enrichWithDetectedQuantity(cached.data, parsed);
    }

    // Essayer successivement : cleanQuery, singularQuery (si différent)
    const queriesToTry = [parsed.cleanQuery];
    if (parsed.singularQuery && parsed.singularQuery !== parsed.cleanQuery) {
      queriesToTry.push(parsed.singularQuery);
    }
    if (parsed.rawQuery !== parsed.cleanQuery) {
      queriesToTry.push(parsed.rawQuery);
    }

    for (const term of queriesToTry) {
      if (!term || term.length < 3) continue;

      try {
        const data = await this.fetchFromOFF("/cgi/search.pl", {
          search_terms: term,
          search_simple: 1,
          action: "process",
          json: 1,
          page_size: 20,
          fields:
            "code,product_name,product_name_fr,brands,categories,quantity,nutriments,image_front_url",
        });

        if (data && Array.isArray(data.products) && data.products.length > 0) {
          const ingredientsMap = new Map<string, any>();

          data.products.forEach((product: any) => {
            const name = (product.product_name_fr || product.product_name || "").trim();
            if (!name) return;

            const brand = product.brands ? product.brands.split(",")[0].trim() : undefined;
            const packageQuantity = product.quantity ? product.quantity.trim() : undefined;

            const key = `${name.toLowerCase()}_${(brand || "").toLowerCase()}`;
            if (!ingredientsMap.has(key)) {
              ingredientsMap.set(key, {
                name: name,
                brand: brand,
                packageQuantity: packageQuantity,
                category: this.extractMainCategory(product.categories),
                nutritionalInfo: product.nutriments
                  ? {
                      calories: product.nutriments.energy_kcal_100g || 0,
                      proteins: product.nutriments.proteins_100g || 0,
                      carbohydrates: product.nutriments.carbohydrates_100g || 0,
                      fat: product.nutriments.fat_100g || 0,
                      fiber: product.nutriments.fiber_100g || 0,
                      salt: product.nutriments.salt_100g || 0,
                      sugars: product.nutriments.sugars_100g || 0,
                    }
                  : null,
                image: product.image_front_url || null,
                source: "openfoodfacts",
                sourceId: product.code,
              });
            }
          });

          const results = Array.from(ingredientsMap.values()).slice(0, 20);
          if (results.length > 0) {
            this.cache.set(cacheKey, { data: results, timestamp: Date.now() });
            return this.enrichWithDetectedQuantity(results, parsed);
          }
        }
      } catch (err: any) {
        console.warn(`[OpenFoodFacts] Recherche "${term}" temporairement indisponible (${err.message})`);
      }
    }

    return [];
  }

  private enrichWithDetectedQuantity(results: any[], parsed: ParsedIngredientQuery): any[] {
    return results.map((item) => ({
      ...item,
      detectedQuantity: parsed.detectedQuantity,
      detectedUnit: parsed.detectedUnit,
    }));
  }

  /**
   * Extrait la catégorie principale d'un produit
   */
  private extractMainCategory(categories: string): string {
    if (!categories) return "Autre";

    const categoryList = categories.split(",").map((cat) => cat.trim());

    // Priorité aux catégories françaises courantes
    const frenchCategories = categoryList.filter(
      (cat) =>
        cat.includes("fr:") ||
        [
          "Fruits",
          "Légumes",
          "Viandes",
          "Poissons",
          "Produits laitiers",
          "Céréales",
          "Pâtes",
          "Épicerie",
          "Boissons",
          "Colas",
          "Sodas",
        ].some((mainCat) => cat.toLowerCase().includes(mainCat.toLowerCase()))
    );

    if (frenchCategories.length > 0) {
      return frenchCategories[0].replace(/^(?:fr|en|es|de):/, "").trim();
    }

    return (categoryList[0] || "Autre").replace(/^(?:fr|en|es|de):/, "").trim();
  }

  /**
   * Convertit un produit OpenFoodFacts en format d'ingrédient pour notre base
   */
  convertToIngredient(
    product: OpenFoodFactsProduct["product"],
    customName?: string
  ) {
    const name =
      customName ||
      product.product_name_fr ||
      product.product_name ||
      "Produit inconnu";

    return {
      name: name,
      brand: product.brands ? product.brands.split(",")[0].trim() : undefined,
      category: this.extractMainCategory(product.categories || ""),
      nutritionalInfo: product.nutriments
        ? {
            calories: product.nutriments.energy_kcal_100g || 0,
            proteins: product.nutriments.proteins_100g || 0,
            carbohydrates: product.nutriments.carbohydrates_100g || 0,
            fat: product.nutriments.fat_100g || 0,
            fiber: product.nutriments.fiber_100g || 0,
            salt: product.nutriments.salt_100g || 0,
            sugars: product.nutriments.sugars_100g || 0,
          }
        : null,
      allergens:
        product.allergens_tags?.map((tag) => tag.replace("en:", "")) || [],
      image: product.image_front_url || null,
      source: "openfoodfacts",
    };
  }
}

export const openFoodFactsService = new OpenFoodFactsService();
