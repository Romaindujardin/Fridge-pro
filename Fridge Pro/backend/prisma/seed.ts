// ici on peuple la base de données avec des données de test

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Nettoyer la base de données (optionnel - décommentez si nécessaire)
  // await prisma.user.deleteMany();
  // await prisma.category.deleteMany();
  // await prisma.ingredient.deleteMany();

  // Créer les catégories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: "Les fruits & légumes" },
      update: { color: "#16a34a", icon: "🥬" },
      create: { name: "Les fruits & légumes", color: "#16a34a", icon: "🥬" },
    }),
    prisma.category.upsert({
      where: { name: "Les viandes" },
      update: { color: "#dc2626", icon: "🥩" },
      create: { name: "Les viandes", color: "#dc2626", icon: "🥩" },
    }),
    prisma.category.upsert({
      where: { name: "Féculents" },
      update: { color: "#d97706", icon: "🍝" },
      create: { name: "Féculents", color: "#d97706", icon: "🍝" },
    }),
    prisma.category.upsert({
      where: { name: "Surgelés" },
      update: { color: "#0284c7", icon: "❄️" },
      create: { name: "Surgelés", color: "#0284c7", icon: "❄️" },
    }),
    prisma.category.upsert({
      where: { name: "Produits laitiers" },
      update: { color: "#eab308", icon: "🧀" },
      create: { name: "Produits laitiers", color: "#eab308", icon: "🧀" },
    }),
    prisma.category.upsert({
      where: { name: "Conserves" },
      update: { color: "#64748b", icon: "🥫" },
      create: { name: "Conserves", color: "#64748b", icon: "🥫" },
    }),
    prisma.category.upsert({
      where: { name: "Boissons" },
      update: { color: "#06b6d4", icon: "🥤" },
      create: { name: "Boissons", color: "#06b6d4", icon: "🥤" },
    }),
    prisma.category.upsert({
      where: { name: "Sauces" },
      update: { color: "#ea580c", icon: "🥣" },
      create: { name: "Sauces", color: "#ea580c", icon: "🥣" },
    }),
    prisma.category.upsert({
      where: { name: "Produits secs" },
      update: { color: "#854d0e", icon: "🌾" },
      create: { name: "Produits secs", color: "#854d0e", icon: "🌾" },
    }),
    prisma.category.upsert({
      where: { name: "Petit déjeuner" },
      update: { color: "#f59e0b", icon: "☕" },
      create: { name: "Petit déjeuner", color: "#f59e0b", icon: "☕" },
    }),
    prisma.category.upsert({
      where: { name: "Gâteaux" },
      update: { color: "#ec4899", icon: "🍪" },
      create: { name: "Gâteaux", color: "#ec4899", icon: "🍪" },
    }),
    prisma.category.upsert({
      where: { name: "Apéritifs" },
      update: { color: "#8b5cf6", icon: "🥨" },
      create: { name: "Apéritifs", color: "#8b5cf6", icon: "🥨" },
    }),
  ]);

  // Créer des ingrédients
  const ingredients = await Promise.all([
    // Légumes
    prisma.ingredient.upsert({
      where: { name: "Tomate" },
      update: {},
      create: {
        name: "Tomate",
        categoryId: categories[0].id,
        calories: 18,
        protein: 0.9,
        carbs: 3.9,
        fat: 0.2,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Oignon" },
      update: {},
      create: {
        name: "Oignon",
        categoryId: categories[0].id,
        calories: 40,
        protein: 1.1,
        carbs: 9.3,
        fat: 0.1,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Carotte" },
      update: {},
      create: {
        name: "Carotte",
        categoryId: categories[0].id,
        calories: 41,
        protein: 0.9,
        carbs: 9.6,
        fat: 0.2,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Pomme de terre" },
      update: {},
      create: {
        name: "Pomme de terre",
        categoryId: categories[0].id,
        calories: 77,
        protein: 2.0,
        carbs: 17.5,
        fat: 0.1,
      },
    }),
    // Fruits
    prisma.ingredient.upsert({
      where: { name: "Pomme" },
      update: {},
      create: {
        name: "Pomme",
        categoryId: categories[1].id,
        calories: 52,
        protein: 0.3,
        carbs: 13.8,
        fat: 0.2,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Banane" },
      update: {},
      create: {
        name: "Banane",
        categoryId: categories[1].id,
        calories: 89,
        protein: 1.1,
        carbs: 22.8,
        fat: 0.3,
      },
    }),
    // Viandes
    prisma.ingredient.upsert({
      where: { name: "Poulet" },
      update: {},
      create: {
        name: "Poulet",
        categoryId: categories[2].id,
        calories: 165,
        protein: 31.0,
        carbs: 0.0,
        fat: 3.6,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Saumon" },
      update: {},
      create: {
        name: "Saumon",
        categoryId: categories[2].id,
        calories: 208,
        protein: 25.4,
        carbs: 0.0,
        fat: 12.4,
      },
    }),
    // Produits laitiers
    prisma.ingredient.upsert({
      where: { name: "Lait" },
      update: {},
      create: {
        name: "Lait",
        categoryId: categories[3].id,
        calories: 42,
        protein: 3.4,
        carbs: 5.0,
        fat: 1.0,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Fromage" },
      update: {},
      create: {
        name: "Fromage",
        categoryId: categories[3].id,
        calories: 113,
        protein: 7.0,
        carbs: 1.0,
        fat: 9.0,
      },
    }),
    // Céréales
    prisma.ingredient.upsert({
      where: { name: "Riz" },
      update: {},
      create: {
        name: "Riz",
        categoryId: categories[4].id,
        calories: 130,
        protein: 2.7,
        carbs: 28.0,
        fat: 0.3,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Pâtes" },
      update: {},
      create: {
        name: "Pâtes",
        categoryId: categories[4].id,
        calories: 131,
        protein: 5.0,
        carbs: 25.0,
        fat: 1.1,
      },
    }),
  ]);

  // Créer des utilisateurs de test
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "demo@fridgepro.com" },
      update: {},
      create: {
        email: "demo@fridgepro.com",
        password: await bcrypt.hash("demo123", 10),
        firstName: "Demo",
        lastName: "User",
      },
    }),
    prisma.user.upsert({
      where: { email: "test@fridgepro.com" },
      update: {},
      create: {
        email: "test@fridgepro.com",
        password: await bcrypt.hash("test123", 10),
        firstName: "Test",
        lastName: "User",
      },
    }),
    prisma.user.upsert({
      where: { email: "admin@fridgepro.com" },
      update: {},
      create: {
        email: "admin@fridgepro.com",
        password: await bcrypt.hash("admin123", 10),
        firstName: "Admin",
        lastName: "User",
      },
    }),
  ]);

  // Ajouter quelques éléments au frigo du premier utilisateur
  const fridgeItems = await Promise.all([
    prisma.fridgeItem.create({
      data: {
        userId: users[0].id,
        ingredientId: ingredients[0].id, // Tomate
        quantity: 3,
        unit: "pièces",
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Dans 5 jours
        notes: "Tomates bien mûres",
      },
    }),
    prisma.fridgeItem.create({
      data: {
        userId: users[0].id,
        ingredientId: ingredients[6].id, // Poulet
        quantity: 500,
        unit: "g",
        expiryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Dans 2 jours
        notes: "Filets de poulet",
      },
    }),
    prisma.fridgeItem.create({
      data: {
        userId: users[0].id,
        ingredientId: ingredients[10].id, // Riz
        quantity: 1,
        unit: "kg",
        notes: "Riz basmati",
      },
    }),
  ]);

  // Créer quelques recettes d'exemple
  const recipes = await Promise.all([
    prisma.recipe.create({
      data: {
        title: "Poulet aux tomates",
        description:
          "Un délicieux plat de poulet mijoté avec des tomates fraîches",
        instructions: [
          "Couper le poulet en morceaux",
          "Faire revenir les oignons dans une poêle",
          "Ajouter le poulet et faire dorer",
          "Ajouter les tomates et laisser mijoter 20 minutes",
          "Assaisonner et servir avec du riz",
        ],
        prepTime: 15,
        cookTime: 25,
        servings: 4,
        difficulty: "easy",
        createdById: users[0].id,
        ingredients: {
          create: [
            {
              ingredientId: ingredients[6].id, // Poulet
              quantity: 400,
              unit: "g",
            },
            {
              ingredientId: ingredients[0].id, // Tomate
              quantity: 3,
              unit: "pièces",
            },
            {
              ingredientId: ingredients[1].id, // Oignon
              quantity: 1,
              unit: "pièce",
            },
            {
              ingredientId: ingredients[10].id, // Riz
              quantity: 200,
              unit: "g",
            },
          ],
        },
      },
    }),
    prisma.recipe.create({
      data: {
        title: "Saumon grillé aux légumes",
        description: "Saumon grillé accompagné de légumes de saison",
        instructions: [
          "Préchauffer le four à 200°C",
          "Couper les légumes en morceaux",
          "Assaisonner le saumon",
          "Enfourner le saumon et les légumes",
          "Cuire 20 minutes et servir",
        ],
        prepTime: 10,
        cookTime: 20,
        servings: 2,
        difficulty: "medium",
        createdById: users[0].id,
        ingredients: {
          create: [
            {
              ingredientId: ingredients[7].id, // Saumon
              quantity: 300,
              unit: "g",
            },
            {
              ingredientId: ingredients[2].id, // Carotte
              quantity: 2,
              unit: "pièces",
            },
            {
              ingredientId: ingredients[3].id, // Pomme de terre
              quantity: 3,
              unit: "pièces",
            },
          ],
        },
      },
    }),
  ]);

  // Créer une liste de courses d'exemple
  const shoppingList = await prisma.shoppingList.create({
    data: {
      name: "Courses de la semaine",
      userId: users[0].id,
      items: {
        create: [
          {
            ingredientId: ingredients[4].id, // Pomme
            quantity: 6,
            unit: "pièces",
            purchased: false,
          },
          {
            ingredientId: ingredients[5].id, // Banane
            quantity: 1,
            unit: "régime",
            purchased: true,
          },
          {
            ingredientId: ingredients[8].id, // Lait
            quantity: 1,
            unit: "litre",
            purchased: false,
          },
        ],
      },
    },
  });

  console.log("✅ Database seeded successfully!");
  console.log("\n🔑 Comptes de test disponibles:");
  console.log("📧 Email: demo@fridgepro.com | 🔒 Mot de passe: demo123");
  console.log("📧 Email: test@fridgepro.com | 🔒 Mot de passe: test123");
  console.log("📧 Email: admin@fridgepro.com | 🔒 Mot de passe: admin123");
  console.log("\n📊 Données créées:");
  console.log(`   - ${categories.length} catégories`);
  console.log(`   - ${ingredients.length} ingrédients`);
  console.log(`   - ${users.length} utilisateurs`);
  console.log(`   - ${fridgeItems.length} éléments de frigo`);
  console.log(`   - ${recipes.length} recettes`);
  console.log(`   - 1 liste de courses avec 3 articles`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
