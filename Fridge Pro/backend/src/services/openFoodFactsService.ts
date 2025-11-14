// Client OpenFoodFacts pour enrichir les ingrédients/produits côté app.
import axios from "axios";

interface OpenFoodFactsProduct {
  code: string;
  product: {
    product_name?: string;
    product_name_fr?: string;
    brands?: string;
    categories?: string;
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

export class OpenFoodFactsService {
  private readonly baseUrl = "https://world.openfoodfacts.org";

  /**
   * Recherche des produits par nom (en français)
   */
  async searchProducts(
    query: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<SearchResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/cgi/search.pl`, {
        params: {
          search_terms: query,
          search_simple: 1,
          action: "process",
          json: 1,
          page: page,
          page_size: pageSize,
          fields:
            "code,product_name,product_name_fr,brands,categories,ingredients_text,ingredients_text_fr,nutriments,allergens_tags,traces_tags,image_url,image_front_url",
          countries: "France",
          lang: "fr",
        },
      });

      return response.data;
    } catch (error) {
      console.error("Erreur lors de la recherche OpenFoodFacts:", error);
      throw new Error("Impossible de rechercher les produits");
    }
  }

  /**
   * Récupère un produit par son code-barres
   */
  async getProductByBarcode(
    barcode: string
  ): Promise<OpenFoodFactsProduct | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v0/product/${barcode}.json`
      );

      if (response.data.status === 1) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error("Erreur lors de la récupération du produit:", error);
      return null;
    }
  }

  /**
   * Recherche des ingrédients spécifiquement
   */
  async searchIngredients(query: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/cgi/search.pl`, {
        params: {
          search_terms: query,
          search_simple: 1,
          action: "process",
          json: 1,
          page_size: 50,
          fields:
            "code,product_name,product_name_fr,brands,categories,ingredients_text_fr,nutriments,image_front_url",
          countries: "France",
          lang: "fr",
        },
      });

      if (!response.data.products) {
        return [];
      }

      // Filtrer et transformer les résultats pour extraire les ingrédients
      const ingredients = new Map<string, any>();

      response.data.products.forEach((product: any) => {
        const name = product.product_name_fr || product.product_name;
        if (name && !ingredients.has(name.toLowerCase())) {
          ingredients.set(name.toLowerCase(), {
            name: name,
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

      return Array.from(ingredients.values()).slice(0, 20);
    } catch (error) {
      console.error("Erreur lors de la recherche d'ingrédients:", error);
      return [];
    }
  }

  /**
   * Extrait la catégorie principale d'un produit
   */
  private extractMainCategory(categories: string): string {
    if (!categories) return "Autre";

    const categoryList = categories.split(",").map((cat) => cat.trim());

    // Priorité aux catégories françaises et plus spécifiques
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
        ].some((mainCat) => cat.includes(mainCat))
    );

    if (frenchCategories.length > 0) {
      return frenchCategories[0].replace("fr:", "").trim();
    }

    return categoryList[0] || "Autre";
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
