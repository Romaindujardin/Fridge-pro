// Script de seed pour importer un corpus de recettes françaises réalistes.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Données brutes (titre, description, ingrédients...) utilisées pour l'import.
const frenchRecipes = [
  {
    name: "Boeuf Bourguignon",
    description:
      "Un classique de la cuisine française, ce ragoût de bœuf mijoté dans le vin rouge est un plat réconfortant parfait pour les soirées d'hiver.",
    instructions:
      "1. Faire revenir les lardons dans une cocotte. 2. Ajouter les morceaux de bœuf et les faire dorer. 3. Ajouter les légumes et faire revenir. 4. Déglacer avec le vin rouge et ajouter le bouillon. 5. Laisser mijoter 3 heures à feu doux. 6. Servir avec des pommes de terre ou des pâtes.",
    preparationTime: 30,
    cookingTime: 180,
    difficulty: "MEDIUM",
    servings: 6,
    category: "Plat principal",
    ingredients: [
      { name: "Bœuf à braiser", quantity: 1, unit: "kg" },
      { name: "Vin rouge", quantity: 75, unit: "cl" },
      { name: "Carottes", quantity: 3, unit: "pièces" },
      { name: "Oignons", quantity: 2, unit: "pièces" },
      { name: "Lardons", quantity: 200, unit: "g" },
      { name: "Champignons de Paris", quantity: 250, unit: "g" },
      { name: "Bouquet garni", quantity: 1, unit: "pièce" },
      { name: "Bouillon de bœuf", quantity: 50, unit: "cl" },
    ],
  },
  {
    name: "Coq au Vin",
    description:
      "Plat traditionnel français où le coq est mijoté dans du vin blanc ou rouge avec des légumes et des herbes.",
    instructions:
      "1. Découper le coq en morceaux. 2. Faire revenir dans une cocotte avec des lardons. 3. Ajouter les oignons et champignons. 4. Flamber au cognac puis ajouter le vin. 5. Laisser mijoter 1h30. 6. Servir avec du riz ou des pommes de terre.",
    preparationTime: 25,
    cookingTime: 90,
    difficulty: "MEDIUM",
    servings: 4,
    category: "Plat principal",
    ingredients: [
      { name: "Coq (ou poulet)", quantity: 1, unit: "pièce" },
      { name: "Vin blanc sec", quantity: 50, unit: "cl" },
      { name: "Lardons", quantity: 150, unit: "g" },
      { name: "Petits oignons", quantity: 12, unit: "pièces" },
      { name: "Champignons", quantity: 200, unit: "g" },
      { name: "Cognac", quantity: 5, unit: "cl" },
      { name: "Bouquet garni", quantity: 1, unit: "pièce" },
    ],
  },
  {
    name: "Ratatouille",
    description:
      "Spécialité provençale composée de légumes d'été mijotés ensemble. Un plat végétarien savoureux et coloré.",
    instructions:
      "1. Couper tous les légumes en dés. 2. Faire revenir les oignons et l'ail. 3. Ajouter les aubergines, puis les courgettes. 4. Incorporer les tomates et les poivrons. 5. Assaisonner avec les herbes de Provence. 6. Laisser mijoter 45 minutes.",
    preparationTime: 20,
    cookingTime: 45,
    difficulty: "EASY",
    servings: 4,
    category: "Plat principal",
    ingredients: [
      { name: "Aubergines", quantity: 2, unit: "pièces" },
      { name: "Courgettes", quantity: 2, unit: "pièces" },
      { name: "Tomates", quantity: 4, unit: "pièces" },
      { name: "Poivrons rouges", quantity: 2, unit: "pièces" },
      { name: "Oignons", quantity: 2, unit: "pièces" },
      { name: "Ail", quantity: 4, unit: "gousses" },
      { name: "Herbes de Provence", quantity: 2, unit: "cuillères à café" },
      { name: "Huile d'olive", quantity: 4, unit: "cuillères à soupe" },
    ],
  },
  {
    name: "Cassoulet",
    description:
      "Plat traditionnel du Sud-Ouest à base de haricots blancs, de saucisses et de confit de canard.",
    instructions:
      "1. Faire tremper les haricots une nuit. 2. Les cuire avec des aromates. 3. Faire revenir les saucisses et le confit. 4. Mélanger avec les haricots dans une cocotte. 5. Enfourner 2 heures en remuant régulièrement. 6. Servir bien chaud.",
    preparationTime: 30,
    cookingTime: 180,
    difficulty: "HARD",
    servings: 8,
    category: "Plat principal",
    ingredients: [
      { name: "Haricots blancs secs", quantity: 500, unit: "g" },
      { name: "Confit de canard", quantity: 4, unit: "cuisses" },
      { name: "Saucisse de Toulouse", quantity: 400, unit: "g" },
      { name: "Lardons", quantity: 200, unit: "g" },
      { name: "Tomates", quantity: 3, unit: "pièces" },
      { name: "Oignons", quantity: 2, unit: "pièces" },
      { name: "Ail", quantity: 4, unit: "gousses" },
      { name: "Bouquet garni", quantity: 1, unit: "pièce" },
    ],
  },
  {
    name: "Quiche Lorraine",
    description:
      "Tarte salée emblématique de la Lorraine, garnie d'une préparation aux œufs, crème et lardons.",
    instructions:
      "1. Étaler la pâte dans un moule. 2. Faire revenir les lardons. 3. Battre les œufs avec la crème et assaisonner. 4. Répartir les lardons sur la pâte. 5. Verser l'appareil à quiche. 6. Enfourner 35 minutes à 180°C.",
    preparationTime: 15,
    cookingTime: 35,
    difficulty: "EASY",
    servings: 6,
    category: "Entrée",
    ingredients: [
      { name: "Pâte brisée", quantity: 1, unit: "pièce" },
      { name: "Lardons", quantity: 200, unit: "g" },
      { name: "Œufs", quantity: 3, unit: "pièces" },
      { name: "Crème fraîche", quantity: 20, unit: "cl" },
      { name: "Gruyère râpé", quantity: 100, unit: "g" },
      { name: "Muscade", quantity: 1, unit: "pincée" },
    ],
  },
  {
    name: "Pot-au-feu",
    description:
      "Plat familial traditionnel composé de légumes et de viande de bœuf bouillis ensemble.",
    instructions:
      "1. Mettre la viande dans une grande marmite d'eau froide. 2. Porter à ébullition et écumer. 3. Ajouter les os à moelle et le bouquet garni. 4. Laisser mijoter 2h. 5. Ajouter les légumes et cuire 1h de plus. 6. Servir avec du gros sel et de la moutarde.",
    preparationTime: 20,
    cookingTime: 180,
    difficulty: "EASY",
    servings: 6,
    category: "Plat principal",
    ingredients: [
      { name: "Jarret de bœuf", quantity: 1, unit: "kg" },
      { name: "Os à moelle", quantity: 3, unit: "pièces" },
      { name: "Carottes", quantity: 6, unit: "pièces" },
      { name: "Navets", quantity: 4, unit: "pièces" },
      { name: "Poireaux", quantity: 3, unit: "pièces" },
      { name: "Céleri-rave", quantity: 1, unit: "pièce" },
      { name: "Pommes de terre", quantity: 6, unit: "pièces" },
      { name: "Bouquet garni", quantity: 1, unit: "pièce" },
    ],
  },
  {
    name: "Tarte Tatin",
    description:
      "Célèbre tarte aux pommes caramélisées, cuite à l'envers et originaire de la région de Sologne.",
    instructions:
      "1. Éplucher et couper les pommes en quartiers. 2. Faire un caramel dans un moule. 3. Disposer les pommes sur le caramel. 4. Recouvrir de pâte feuilletée. 5. Enfourner 25 minutes. 6. Démouler rapidement à la sortie du four.",
    preparationTime: 20,
    cookingTime: 25,
    difficulty: "MEDIUM",
    servings: 8,
    category: "Dessert",
    ingredients: [
      { name: "Pommes Golden", quantity: 8, unit: "pièces" },
      { name: "Pâte feuilletée", quantity: 1, unit: "pièce" },
      { name: "Sucre en poudre", quantity: 150, unit: "g" },
      { name: "Beurre", quantity: 50, unit: "g" },
      { name: "Cannelle", quantity: 1, unit: "pincée" },
    ],
  },
  {
    name: "Blanquette de Veau",
    description:
      "Ragoût de veau en sauce blanche, accompagné de légumes et servi traditionnellement avec du riz.",
    instructions:
      "1. Faire blanchir les morceaux de veau. 2. Les faire mijoter dans un bouillon avec des aromates. 3. Cuire les légumes séparément. 4. Préparer une sauce blanche avec un roux. 5. Lier avec des jaunes d'œufs et de la crème. 6. Servir avec du riz.",
    preparationTime: 30,
    cookingTime: 120,
    difficulty: "MEDIUM",
    servings: 6,
    category: "Plat principal",
    ingredients: [
      { name: "Épaule de veau", quantity: 1, unit: "kg" },
      { name: "Carottes", quantity: 4, unit: "pièces" },
      { name: "Champignons de Paris", quantity: 250, unit: "g" },
      { name: "Petits oignons", quantity: 12, unit: "pièces" },
      { name: "Bouquet garni", quantity: 1, unit: "pièce" },
      { name: "Crème fraîche", quantity: 20, unit: "cl" },
      { name: "Œufs", quantity: 2, unit: "jaunes" },
      { name: "Farine", quantity: 40, unit: "g" },
    ],
  },
];

export async function seedFrenchRecipes() {
  console.log("🇫🇷 Ajout des recettes françaises...");

  try {
    // Créer ou récupérer les catégories
    const categories = await Promise.all([
      prisma.category.upsert({
        where: { name: "Légumes" },
        update: {},
        create: { name: "Légumes", color: "#4ade80", icon: "🥕" },
      }),
      prisma.category.upsert({
        where: { name: "Viandes" },
        update: {},
        create: { name: "Viandes", color: "#dc2626", icon: "🥩" },
      }),
      prisma.category.upsert({
        where: { name: "Produits laitiers" },
        update: {},
        create: { name: "Produits laitiers", color: "#fbbf24", icon: "🧀" },
      }),
      prisma.category.upsert({
        where: { name: "Épices et condiments" },
        update: {},
        create: { name: "Épices et condiments", color: "#f97316", icon: "🌿" },
      }),
      prisma.category.upsert({
        where: { name: "Fruits" },
        update: {},
        create: { name: "Fruits", color: "#f59e0b", icon: "🍎" },
      }),
      prisma.category.upsert({
        where: { name: "Céréales et féculents" },
        update: {},
        create: { name: "Céréales et féculents", color: "#d97706", icon: "🌾" },
      }),
    ]);

    console.log(`✅ ${categories.length} catégories créées/mises à jour`);

    // Créer un utilisateur test si nécessaire (propriétaire des recettes importées)
    const testUser = await prisma.user.upsert({
      where: { email: "chef@fridgepro.com" },
      update: {},
      create: {
        email: "chef@fridgepro.com",
        password: "$2b$10$hashedpassword", // Mot de passe haché
        firstName: "Chef",
        lastName: "Français",
      },
    });

    // Mapper les catégories
    const categoryMap = {
      Légumes: categories.find((c) => c.name === "Légumes")?.id,
      Viandes: categories.find((c) => c.name === "Viandes")?.id,
      "Produits laitiers": categories.find(
        (c) => c.name === "Produits laitiers"
      )?.id,
      "Épices et condiments": categories.find(
        (c) => c.name === "Épices et condiments"
      )?.id,
      Fruits: categories.find((c) => c.name === "Fruits")?.id,
      "Céréales et féculents": categories.find(
        (c) => c.name === "Céréales et féculents"
      )?.id,
    };

    // Fonction pour déterminer la catégorie d'un ingrédient
    const getIngredientCategory = (
      ingredientName: string
    ): string | undefined => {
      const name = ingredientName.toLowerCase();

      if (
        name.includes("tomate") ||
        name.includes("carotte") ||
        name.includes("oignon") ||
        name.includes("aubergine") ||
        name.includes("courgette") ||
        name.includes("poivron") ||
        name.includes("légume") ||
        name.includes("céleri") ||
        name.includes("navet") ||
        name.includes("poireau") ||
        name.includes("ail")
      ) {
        return categoryMap["Légumes"];
      }

      if (
        name.includes("bœuf") ||
        name.includes("veau") ||
        name.includes("porc") ||
        name.includes("poulet") ||
        name.includes("coq") ||
        name.includes("canard") ||
        name.includes("viande") ||
        name.includes("lardon") ||
        name.includes("saucisse")
      ) {
        return categoryMap["Viandes"];
      }

      if (
        name.includes("crème") ||
        name.includes("fromage") ||
        name.includes("gruyère") ||
        name.includes("œuf") ||
        name.includes("beurre") ||
        name.includes("lait")
      ) {
        return categoryMap["Produits laitiers"];
      }

      if (
        name.includes("herbe") ||
        name.includes("bouquet garni") ||
        name.includes("muscade") ||
        name.includes("cannelle") ||
        name.includes("huile") ||
        name.includes("vin") ||
        name.includes("cognac") ||
        name.includes("sel") ||
        name.includes("épice")
      ) {
        return categoryMap["Épices et condiments"];
      }

      if (name.includes("pomme") || name.includes("fruit")) {
        return categoryMap["Fruits"];
      }

      if (
        name.includes("farine") ||
        name.includes("pâte") ||
        name.includes("haricot") ||
        name.includes("pomme de terre") ||
        name.includes("riz")
      ) {
        return categoryMap["Céréales et féculents"];
      }

      return undefined;
    };

    let recipesCreated = 0;
    let ingredientsCreated = 0;

    // Boucle principale: création des ingrédients manquants puis des recettes.
    for (const recipeData of frenchRecipes) {
      console.log(`📝 Création de la recette: ${recipeData.name}`);

      // Créer les ingrédients s'ils n'existent pas
      const recipeIngredients = [];

      for (const ing of recipeData.ingredients) {
        let ingredient = await prisma.ingredient.findFirst({
          where: { name: { equals: ing.name, mode: "insensitive" } },
        });

        if (!ingredient) {
          ingredient = await prisma.ingredient.create({
            data: {
              name: ing.name,
              categoryId: getIngredientCategory(ing.name),
            },
          });
          ingredientsCreated++;
        }

        recipeIngredients.push({
          ingredientId: ingredient.id,
          quantity: ing.quantity,
          unit: ing.unit,
        });
      }

      // Créer la recette
      const recipe = await prisma.recipe.create({
        data: {
          title: recipeData.name,
          description: recipeData.description,
          instructions: recipeData.instructions
            .split(/\d+\.\s/)
            .filter((step) => step.trim().length > 0),
          prepTime: recipeData.preparationTime,
          cookTime: recipeData.cookingTime,
          difficulty: recipeData.difficulty.toLowerCase(),
          servings: recipeData.servings,
          source: "imported",
          createdById: testUser.id,
          ingredients: {
            create: recipeIngredients,
          },
        },
        include: {
          ingredients: {
            include: {
              ingredient: true,
            },
          },
        },
      });

      recipesCreated++;
      console.log(
        `✅ Recette "${recipe.title}" créée avec ${recipeIngredients.length} ingrédients`
      );
    }

    console.log(`\n🎉 Seed terminé avec succès !`);
    console.log(`📊 Résumé:`);
    console.log(`   - ${recipesCreated} recettes créées`);
    console.log(`   - ${ingredientsCreated} nouveaux ingrédients créés`);
    console.log(`   - ${categories.length} catégories configurées`);
  } catch (error) {
    console.error("❌ Erreur lors du seed:", error);
    throw error;
  }
}

// Permet d'exécuter `ts-node src/scripts/seedFrenchRecipes.ts`.
if (require.main === module) {
  seedFrenchRecipes()
    .then(() => {
      console.log("✨ Seed des recettes françaises terminé !");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Erreur fatale:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
