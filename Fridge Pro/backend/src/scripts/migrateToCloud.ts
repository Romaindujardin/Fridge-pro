/**
 * Script de migration et sauvegarde de la base locale vers Neon (Cloud PostgreSQL)
 *
 * Utilisation :
 * 1. Sauvegarde locale seule :
 *    npx tsx src/scripts/migrateToCloud.ts
 *
 * 2. Migration vers Neon (Cloud) :
 *    TARGET_DATABASE_URL="postgresql://..." npx tsx src/scripts/migrateToCloud.ts
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const localPrisma = new PrismaClient();

async function main() {
  console.log("📦 Étape 1 : Export des données depuis la base de données locale...");

  const users = await localPrisma.user.findMany();
  const categories = await localPrisma.category.findMany();
  const ingredients = await localPrisma.ingredient.findMany();
  const fridgeItems = await localPrisma.fridgeItem.findMany();
  const recipes = await localPrisma.recipe.findMany();
  const recipeIngredients = await localPrisma.recipeIngredient.findMany();
  const purchaseHistory = await localPrisma.purchaseHistory.findMany();
  const shoppingLists = await localPrisma.shoppingList.findMany({
    include: { items: true },
  });
  const favoriteRecipes = await localPrisma.favoriteRecipe.findMany();

  const backupData = {
    exportedAt: new Date().toISOString(),
    counts: {
      users: users.length,
      categories: categories.length,
      ingredients: ingredients.length,
      fridgeItems: fridgeItems.length,
      recipes: recipes.length,
      recipeIngredients: recipeIngredients.length,
      purchaseHistory: purchaseHistory.length,
      shoppingLists: shoppingLists.length,
      favoriteRecipes: favoriteRecipes.length,
    },
    data: {
      users,
      categories,
      ingredients,
      fridgeItems,
      recipes,
      recipeIngredients,
      purchaseHistory,
      shoppingLists,
      favoriteRecipes,
    },
  };

  const backupPath = path.join(__dirname, "backup_dump.json");
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`✅ Sauvegarde réussie dans : ${backupPath}`);
  console.log("📊 Données exportées :");
  console.log(`   - Utilisateurs : ${users.length}`);
  console.log(`   - Catégories : ${categories.length}`);
  console.log(`   - Ingrédients : ${ingredients.length}`);
  console.log(`   - Articles Frigo : ${fridgeItems.length}`);
  console.log(`   - Recettes : ${recipes.length}`);
  console.log(`   - Historique d'achats : ${purchaseHistory.length}`);

  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.CLOUD_DATABASE_URL;

  if (!targetUrl) {
    console.log("\n💡 Pour migrer ces données vers votre base Neon en ligne, exécutez :");
    console.log('   TARGET_DATABASE_URL="postgresql://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require" npx tsx src/scripts/migrateToCloud.ts');
    return;
  }

  console.log("\n☁️ Étape 2 : Initialisation du schéma sur la base Neon distante...");
  try {
    execSync("npx prisma db push --skip-generate", {
      env: { ...process.env, DATABASE_URL: targetUrl },
      stdio: "inherit",
    });
    console.log("✅ Schéma Prisma synchronisé sur Neon.");
  } catch (err) {
    console.error("❌ Erreur lors de prisma db push:", err);
    process.exit(1);
  }

  console.log("\n🚀 Étape 3 : Import des données vers Neon...");
  const cloudPrisma = new PrismaClient({
    datasources: {
      db: { url: targetUrl },
    },
  });

  try {
    // 1. Utilisateurs
    console.log(`  -> Import de ${users.length} utilisateur(s)...`);
    for (const u of users) {
      await cloudPrisma.user.upsert({
        where: { id: u.id },
        update: u,
        create: u,
      });
    }

    // 2. Catégories
    console.log(`  -> Import de ${categories.length} catégories...`);
    for (const c of categories) {
      await cloudPrisma.category.upsert({
        where: { id: c.id },
        update: c,
        create: c,
      });
    }

    // 3. Ingrédients
    console.log(`  -> Import de ${ingredients.length} ingrédients...`);
    for (const ing of ingredients) {
      await cloudPrisma.ingredient.upsert({
        where: { id: ing.id },
        update: ing,
        create: ing,
      });
    }

    // 4. Frigo
    console.log(`  -> Import de ${fridgeItems.length} aliments du frigo...`);
    for (const item of fridgeItems) {
      await cloudPrisma.fridgeItem.upsert({
        where: { id: item.id },
        update: item,
        create: item,
      });
    }

    // 5. Recettes
    console.log(`  -> Import de ${recipes.length} recettes...`);
    for (const r of recipes) {
      await cloudPrisma.recipe.upsert({
        where: { id: r.id },
        update: r,
        create: r,
      });
    }

    // 6. Ingrédients de recettes
    console.log(`  -> Import de ${recipeIngredients.length} liaisons recette-ingrédient...`);
    for (const ri of recipeIngredients) {
      await cloudPrisma.recipeIngredient.upsert({
        where: { id: ri.id },
        update: ri,
        create: ri,
      });
    }

    // 7. Historique d'achat
    console.log(`  -> Import de ${purchaseHistory.length} historiques d'achats...`);
    for (const ph of purchaseHistory) {
      await cloudPrisma.purchaseHistory.upsert({
        where: { id: ph.id },
        update: ph,
        create: ph,
      });
    }

    // 8. Listes de courses
    for (const sl of shoppingLists) {
      const { items, ...listData } = sl;
      await cloudPrisma.shoppingList.upsert({
        where: { id: listData.id },
        update: listData,
        create: listData,
      });
      if (items && items.length > 0) {
        for (const it of items) {
          await cloudPrisma.shoppingListItem.upsert({
            where: { id: it.id },
            update: it,
            create: it,
          });
        }
      }
    }

    // 9. Favoris
    for (const fav of favoriteRecipes) {
      await cloudPrisma.favoriteRecipe.upsert({
        where: { id: fav.id },
        update: fav,
        create: fav,
      });
    }

    console.log("\n🎉 TOUTES LES DONNÉES ONT ÉTÉ TRANSFÉRÉES SUR NEON AVEC SUCCÈS !");
  } catch (error) {
    console.error("❌ Erreur pendant l'importation sur Neon :", error);
  } finally {
    await cloudPrisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error("Erreur fatale:", e);
  })
  .finally(async () => {
    await localPrisma.$disconnect();
  });
