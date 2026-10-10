import assert from "node:assert/strict";
import { planShoppingList } from "./shoppingListPlanner";

const recipes = [
  {
    id: "pasta",
    title: "Pâtes à la crème",
    servings: 4,
    category: "repas",
    ingredients: [
      { name: "Pâtes", quantity: 400, unit: "g" },
      { name: "Crème fraîche", quantity: 20, unit: "cl" },
    ],
  },
  {
    id: "chili",
    title: "Chili express",
    servings: 4,
    category: "repas",
    ingredients: [
      { name: "Viande hachée", quantity: 400, unit: "g" },
      { name: "Riz", quantity: 200, unit: "g" },
    ],
  },
  {
    id: "dessert",
    title: "Cookies chocolat",
    servings: 8,
    category: "dessert",
    ingredients: [{ name: "Farine", quantity: 250, unit: "g" }],
  },
];

const plan = planShoppingList({
  recipes,
  fridgeItems: [
    { name: "Spaghetti 1 Kg", quantity: 500, unit: "g" },
    { name: "Crème épaisse", quantity: 10, unit: "cl" },
  ],
  mealHints: [
    { dishName: "Recette inventée par l'IA" },
    { dishName: "Pâtes à la crème" },
  ],
  targetRecipeIds: ["pasta", "chili"],
  excludedRecipeIds: ["dessert"],
  daysCount: 15,
  servings: 2,
  allowRepeatMeals: true,
});

assert.equal(plan.mealPlan.length, 15);
assert.equal(
  plan.mealPlan.some((meal) => /cookie|dessert/i.test(meal.dishName)),
  false,
);
assert.equal(
  plan.mealPlan.some((meal) => meal.dishName === "Recette inventée par l'IA"),
  false,
);
assert.equal(plan.warnings.length, 1);
assert.equal(
  plan.itemsToBuy.some((item) => item.name === "Pâtes"),
  true,
);
assert.equal(
  plan.alreadyInFridge.some((item) => item.name === "Spaghetti 1 Kg"),
  true,
);

const pantryPlan = planShoppingList({
  recipes: [
    {
      id: "wrap",
      title: "Wrap croustillant",
      servings: 2,
      category: "repas",
      ingredients: [{ name: "Galettes de wrap", quantity: 4, unit: "pièce" }],
    },
  ],
  fridgeItems: [{ name: "Wraps", quantity: 6, unit: "pièce" }],
  pantryItems: [
    { name: "Café", unit: "paquet" },
    { name: "Flammekueche", unit: "pièce" },
  ],
  includePantryBasics: true,
  targetRecipeIds: ["wrap"],
  daysCount: 1,
  servings: 2,
  allowRepeatMeals: true,
});
assert.equal(
  pantryPlan.itemsToBuy.some((item) => /wrap/i.test(item.name)),
  false,
);
assert.equal(
  pantryPlan.itemsToBuy.some((item) => item.name === "Café"),
  true,
);
assert.equal(
  pantryPlan.itemsToBuy.some((item) => item.name === "Flammekueche"),
  false,
);
assert.equal(
  pantryPlan.alreadyInFridge.some((item) => item.name === "Wraps"),
  true,
);

const generatedPlan = planShoppingList({
  recipes: [
    ...recipes.slice(0, 2),
    {
      id: "generated",
      title: "Shakshuka fumée",
      servings: 2,
      category: "repas",
      ingredients: [{ name: "Tomates", quantity: 2, unit: "pièce" }],
    },
  ],
  fridgeItems: [],
  mealHints: [
    { dishName: "Pâtes à la crème" },
    { dishName: "Chili express" },
    { dishName: "Pâtes à la crème" },
    { dishName: "Shakshuka fumée" },
  ],
  targetRecipeIds: ["pasta", "chili", "generated"],
  daysCount: 4,
  servings: 2,
  allowRepeatMeals: true,
});
assert.equal(
  generatedPlan.mealPlan.some((meal) => meal.dishName === "Shakshuka fumée"),
  true,
);

const packagePlan = planShoppingList({
  recipes: [
    {
      id: "formats",
      title: "Pesto et bacon",
      servings: 2,
      category: "repas",
      ingredients: [
        { name: "Pesto genovese", quantity: 190, unit: "g" },
        { name: "Lardons", quantity: 200, unit: "g" },
      ],
    },
  ],
  fridgeItems: [],
  targetRecipeIds: ["formats"],
  daysCount: 1,
  servings: 2,
  allowRepeatMeals: true,
});
assert.equal(
  packagePlan.itemsToBuy.some((item) => item.unit === "pot de 190 g"),
  true,
);
assert.equal(
  packagePlan.itemsToBuy.some((item) => item.unit === "barquette de 200 g"),
  true,
);

assert.throws(
  () =>
    planShoppingList({
      recipes: recipes.slice(0, 2),
      fridgeItems: [],
      targetRecipeIds: ["pasta", "chili"],
      daysCount: 3,
      servings: 2,
      allowRepeatMeals: false,
    }),
  /Impossible de planifier 3 repas distincts/,
);

console.log("shoppingListPlanner: all assertions passed");
