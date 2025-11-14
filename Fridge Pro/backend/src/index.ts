import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Import des routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import ingredientRoutes from "./routes/ingredients";
import fridgeRoutes from "./routes/fridge";
import recipeRoutes from "./routes/recipes";
import shoppingListRoutes from "./routes/shopping-lists";
import aiRoutes from "./routes/ai";

// Middleware d'erreur
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";

// Configuration
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Instance Prisma
export const prisma = new PrismaClient();

// Middleware de sécurité
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Parsing JSON
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.MAX_FILE_SIZE || "10mb",
  })
);

// Servir les fichiers statiques (uploads)
app.use("/uploads", express.static("uploads"));

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ingredients", ingredientRoutes);
app.use("/api/fridge", fridgeRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/shopping-lists", shoppingListRoutes);
app.use("/api/ai", aiRoutes);

// Route de santé
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Middleware d'erreur
app.use(notFound);
app.use(errorHandler);

// Démarrage du serveur
async function startServer() {
  try {
    // Test de connexion à la base de données
    await prisma.$connect();
    console.log("✅ Base de données connectée");

    app.listen(port, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
      console.log(`📚 API Health check: http://localhost:${port}/api/health`);
    });
  } catch (error) {
    console.error("❌ Erreur de démarrage du serveur:", error);
    process.exit(1);
  }
}

// Gestion propre de l'arrêt
process.on("SIGINT", async () => {
  console.log("\n🛑 Arrêt du serveur...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Arrêt du serveur...");
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
