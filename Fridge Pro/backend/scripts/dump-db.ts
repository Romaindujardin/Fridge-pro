// ici on exporte la base de données dans un fichier texte

import { writeFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const data = {
    users: await prisma.user.findMany({
      include: {
        fridgeItems: {
          include: {
            ingredient: {
              include: {
                category: true,
              },
            },
          },
        },
        recipes: {
          include: {
            ingredients: {
              include: {
                ingredient: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
        favoriteRecipes: {
          include: {
            recipe: true,
          },
        },
        shoppingLists: {
          include: {
            items: {
              include: {
                ingredient: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    categories: await prisma.category.findMany({
      include: {
        ingredients: true,
      },
    }),
    ingredients: await prisma.ingredient.findMany({
      include: {
        category: true,
      },
    }),
    fridgeItems: await prisma.fridgeItem.findMany({
      include: {
        user: true,
        ingredient: {
          include: {
            category: true,
          },
        },
      },
    }),
    recipes: await prisma.recipe.findMany({
      include: {
        createdBy: true,
        ingredients: {
          include: {
            ingredient: {
              include: {
                category: true,
              },
            },
          },
        },
        favoriteRecipes: {
          include: {
            user: true,
          },
        },
      },
    }),
    recipeIngredients: await prisma.recipeIngredient.findMany({
      include: {
        recipe: true,
        ingredient: true,
      },
    }),
    favoriteRecipes: await prisma.favoriteRecipe.findMany({
      include: {
        user: true,
        recipe: true,
      },
    }),
    shoppingLists: await prisma.shoppingList.findMany({
      include: {
        user: true,
        items: {
          include: {
            ingredient: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    }),
    shoppingListItems: await prisma.shoppingListItem.findMany({
      include: {
        shoppingList: true,
        ingredient: true,
      },
    }),
  };

  const outputPath = resolve(__dirname, "../../db_dump.txt");
  writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");

  console.log(`✅ Base de données exportée dans ${outputPath}`);
}

main()
  .catch((error) => {
    console.error("❌ Erreur lors de l'export de la base de données :", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
