import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

// Schémas de validation
const registerSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
});

const loginSchema = z.object({
  email: z.string().min(1, "Identifiant ou adresse email requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = registerSchema.parse(
      req.body
    );

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Un compte avec cette adresse email existe déjà",
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        geminiApiKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Générer le JWT
    const token = jwt.sign(
      { userId: user.id, activeProfile: user.firstName },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
      message: "Compte créé avec succès",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    next(error);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email: identifier, password } = loginSchema.parse(req.body);
    const clean = identifier.trim().toLowerCase();

    let user = null;
    let activeProfile: string | null = null;

    // Compte couple partagé (Romain & Sophie)
    if (clean === "sophie" || clean.startsWith("sophie")) {
      activeProfile = "Sophie";
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: "demo@fridgepro.com" },
            { firstName: { equals: "Romain", mode: "insensitive" } },
            { email: { contains: "romain", mode: "insensitive" } },
          ],
        },
      });
      // Si pas trouvé par ces critères, fallback sur le premier compte utilisateur
      if (!user) {
        user = await prisma.user.findFirst();
      }
    } else if (clean === "romain" || clean.startsWith("romain")) {
      activeProfile = "Romain";
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: "demo@fridgepro.com" },
            { firstName: { equals: "Romain", mode: "insensitive" } },
            { email: { contains: "romain", mode: "insensitive" } },
          ],
        },
      });
      if (!user) {
        user = await prisma.user.findFirst();
      }
    } else {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: clean, mode: "insensitive" } },
            { firstName: { equals: clean, mode: "insensitive" } },
          ],
        },
      });
      if (user) {
        if (
          user.email === "demo@fridgepro.com" ||
          user.firstName.toLowerCase() === "romain"
        ) {
          activeProfile = "Romain";
        } else {
          activeProfile = user.firstName;
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    const finalFirstName = activeProfile || user.firstName;

    // Générer le JWT avec le profil actif
    const token = jwt.sign(
      { userId: user.id, activeProfile: finalFirstName },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    // Retourner les données utilisateur (sans le mot de passe)
    const userData = {
      id: user.id,
      email: user.email,
      firstName: finalFirstName,
      lastName: user.lastName,
      geminiApiKey: user.geminiApiKey,
      activeProfile: finalFirstName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json({
      success: true,
      data: {
        user: userData,
        token,
      },
      message: "Connexion réussie",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    next(error);
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res, next) => {
  try {
    // Pour une vraie déconnexion, on pourrait ajouter le token à une blacklist
    // Ici on retourne simplement un succès
    res.json({
      success: true,
      message: "Déconnexion réussie",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
