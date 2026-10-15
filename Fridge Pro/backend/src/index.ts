import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { PrismaClient } from "@prisma/client";

// Import des routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import ingredientRoutes from "./routes/ingredients";
import fridgeRoutes from "./routes/fridge";
import recipeRoutes from "./routes/recipes";
import shoppingListRoutes from "./routes/shopping-lists";
import aiRoutes from "./routes/ai";
import categoryRoutes from "./routes/categories";

// Middleware d'erreur
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { rateLimit } from "./middleware/rateLimit";
import { getJwtSecret, parseFileSize } from "./utils/security";

const app = express();
const port = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

// Derrière Render/Azure, req.ip doit refléter l'adresse client réelle
// (nécessaire pour que le rate limiting soit efficace).
app.set("trust proxy", 1);

// Instance Prisma
export const prisma = new PrismaClient();

// Middleware de sécurité
app.use(helmet());

// CORS strict : seules les origines explicitement autorisées peuvent appeler l'API.
// FRONTEND_URL accepte plusieurs origines séparées par des virgules.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Requêtes sans origine (curl, apps mobiles natives, outils) : autorisées.
      if (!origin) return callback(null, true);

      const normalized = origin.replace(/\/+$/, "");
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
        normalized,
      );
      const isExplicitlyAllowed = allowedOrigins.includes(normalized);
      const isDev = !isProduction;

      if (isExplicitlyAllowed || (isDev && isLocalhost)) {
        return callback(null, true);
      }

      console.warn(
        `[CORS] Origine refusée : ${origin}. Origines autorisées : ${
          allowedOrigins.join(", ") || "(aucune — configurez FRONTEND_URL)"
        }`,
      );
      return callback(null, false);
    },
    credentials: true,
  })
);

// Limite de taille des requêtes JSON (accepte "10mb", "10485760", etc.)
const maxRequestSize = parseFileSize(
  process.env.MAX_FILE_SIZE,
  10 * 1024 * 1024,
);

// Parsing JSON
app.use(express.json({ limit: maxRequestSize }));
app.use(
  express.urlencoded({
    extended: true,
    limit: maxRequestSize,
  })
);

// Limiteurs de débit : protection contre le force brute et l'abus des endpoints coûteux.
const globalLimiter = rateLimit({ windowMs: 60_000, max: 300 });
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  message:
    "Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.",
});

// Servir les fichiers statiques (uploads)
app.use("/uploads", express.static("uploads"));

// Routes API
app.use("/api", globalLimiter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
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
    // Échec explicite au démarrage si la configuration sécurité est incomplète.
    getJwtSecret();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL est manquant.");
    }
    if (!process.env.GEMINI_API_KEY) {
      console.warn(
        "⚠️  GEMINI_API_KEY non défini : seules les clés saisies par les utilisateurs dans leur profil seront utilisées.",
      );
    }
    if (!allowedOrigins.length) {
      console.warn(
        "⚠️  FRONTEND_URL non défini : en production, aucune origine externe ne sera autorisée par CORS.",
      );
    }

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
