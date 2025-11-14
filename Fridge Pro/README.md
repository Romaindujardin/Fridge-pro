# Fridge Pro

Une application moderne de gestion de frigo et de recettes avec intelligence artificielle.

## Fonctionnalités

- **Gestion du frigo** : Ajout manuel ou automatique d'ingrédients via scan de tickets de caisse
- **Suggestions de recettes** : Algorithme intelligent qui propose des recettes selon vos ingrédients disponibles
- **IA intégrée** : Extraction automatique d'ingrédients avec Google Gemini et génération de recettes
- **Favoris** : Sauvegardez vos recettes préférées
- **Liste de courses** : Gérez vos achats futurs
- **Interface moderne** : Design responsive et intuitive

## Technologies

### Backend

- **Node.js** + **Express** + **TypeScript**
- **PostgreSQL** avec **Prisma ORM**
- **Google Gemini AI** pour l'extraction et génération de contenu
- **JWT** pour l'authentification

### Frontend

- **React** + **TypeScript** + **Vite**
- **Tailwind CSS** pour le styling
- **React Query** pour la gestion des données
- **Zustand** pour le state management

## 🚀 Installation

### Prérequis

- Node.js 18+
- PostgreSQL 13+
- Clé API Google Gemini

### 1. Cloner le projet

```bash
git clone <votre-repo>
cd fridge-pro
```

### 2. Installer les dépendances

```bash
npm run install:all
```

### 3. Configuration de la base de données

```bash
# Créer la base de données PostgreSQL
createdb fridge_pro

# Copier le fichier d'environnement
cp backend/env.example backend/.env

# Modifier backend/.env avec vos informations :
# - DATABASE_URL
# - GEMINI_API_KEY
# - JWT_SECRET
```

### 4. Initialiser la base de données

```bash
cd backend
npm run db:migrate
npm run db:generate
npm run db:seed
```

### 5. Lancer l'application

```bash
# Retourner à la racine
cd ..

# Lancer frontend et backend simultanément
npm run dev
```

L'application sera disponible sur :

- **Frontend** : http://localhost:3000
- **Backend** : http://localhost:5000
- **Prisma Studio** : http://localhost:5555 (avec `npm run db:studio`)

## Structure du projet

```
fridge-pro/
├── frontend/                   # Application React + Vite
│   ├── src/
│   │   ├── components/         # Composants UI (Layout, Modal, etc.)
│   │   │   └── ui/             # Boutons, cartes, inputs réutilisables
│   │   ├── pages/              # Pages principales (Frigo, Recettes, Profil…)
│   │   ├── services/           # Appels API (auth, frigo, recettes…)
│   │   ├── hooks/              # Hooks personnalisés (ex: useAuth)
│   │   ├── stores/             # Zustand (authStore)
│   │   └── types/              # Types TypeScript partagés
│   ├── public/ (si nécessaire)
│   └── config Vite/Tailwind/TS
│
├── backend/                    # API Express + Prisma
│   ├── src/
│   │   ├── index.ts            # Entrée de l'app
│   │   ├── routes/             # Routes (auth, frigo, recettes, IA…)
│   │   ├── middleware/         # Auth, gestion des erreurs…
│   │   ├── services/           # Intégrations externes (Gemini, OpenFoodFacts)
│   │   └── scripts/            # Scripts ponctuels (ex: import recettes FR)
│   ├── prisma/
│   │   ├── schema.prisma       # Modèle de données
│   │   ├── migrations/         # Historique Prisma
│   │   └── seed.ts             # Seed officiel utilisé par `prisma db seed`
│   ├── scripts/                # Outils CLI (ex: dump-db.ts)
│   └── env.example             # Variables d'environnement à copier
```

## Variables d'environnement

Voir `backend/env.example` pour la liste complète des variables requises.

## Utilisation

1. **Créer un compte** et se connecter
2. **Ajouter des ingrédients** dans votre frigo :
   - Manuellement via le formulaire
   - Automatiquement en uploadant une photo de ticket de caisse
3. **Découvrir des recettes** adaptées à vos ingrédients disponibles
4. **Générer de nouvelles recettes** avec l'IA
5. **Gérer votre liste de courses** pour les ingrédients manquants

## Roadmap / À faire

- [ ] Mettre le projet sur Azure
- [x] Ajouter un champ “clé Gemini API” côté frontend (profil) et vérifier la clé côté backend avant chaque appel IA (**en cours**)
- [ ] Mettre en place le systeme d'ingrédient synchro avec les recettes et ajoutable dans la liste de course
- [ ] Ajouter des tests end-to-end (Playwright/Cypress) pour les parcours clés (connexion, ajout ingrédient, génération recette IA)
