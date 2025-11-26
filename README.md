# Fridge Pro

## Sommaire

1. [Vue d'ensemble de l'application](#vue-densemble-de-lapplication)
2. [Tuto déploiement Azure](#tuto-for-deployement-on-azure)
3. [Features à ajouter/corriger](#features-à-ajoutercorriger)
4. [Annexe photo](#annexe-photo)

---

## Vue d'ensemble de l'application

**Fridge Pro** est une application de gestion de frigo intelligente qui vous aide à optimiser votre frigo, découvrir de nouvelles recettes adaptés à vos ingrédients.

### Fonctionnalités

- **Ajout d'ingrédients** :

  - **Manuellement** : Recherchez et ajoutez vos ingrédients avec l'aide de l'API OpenFoodFacts pour un vaste catalogue de produits.
  - **Scan de ticket de caisse** : Utilisez l'OCR IA (Google Gemini) pour scanner votre ticket de caisse et ajouter automatiquement tous les ingrédients à votre frigo.

- **Suivi des dates d'expiration** : Visualisez les ingrédients qui expirent bientôt (dans les 3 jours) ou qui sont déjà expirés, avec des alertes visuelles pour éviter le gaspillage.

- **Statistiques live** : Consultez le nombre total d'ingrédients, ceux qui expirent bientôt et ceux déjà expirés.

#### **Gestion et création de recettes**

- **Création manuelle** : Créez vos propres recettes avec ingrédients, quantités, instructions détaillées, temps de préparation/cuisson et niveau de difficulté.

- **Génération par IA** : Générez des recettes personnalisées via Google Gemini AI :

  - Décrivez vos envies culinaires (type de plat, inspiration, nombre de personnes)
  - Option pour utiliser uniquement les ingrédients disponibles dans votre frigo
  - Les recettes générées sont automatiquement sauvegardées

- **Système de favoris** : Marquez vos recettes préférées pour un accès rapide.

- **Recherche et filtres avancés** :

  - Recherche par nom ou description
  - Filtres par difficulté (facile, moyen, difficile)
  - Filtre "Réalisables" : affiche uniquement les recettes pour lesquelles vous avez tous les ingrédients
  - Filtre "Favoris" : vos recettes favorites
  - Filtre "Recettes IA" : recettes générées par l'intelligence artificielle
  - Filtre "Mes recettes" : vos créations personnelles

- **Compatibilité avec le frigo** : Pour chaque recette, visualisez :

  - Le nombre d'ingrédients disponibles dans votre frigo
  - Les ingrédients manquants

- **Recettes recommandées** : Le dashboard vous suggère des recettes adaptées à vos ingrédients disponibles.

#### Listes de courses intelligentes

- **Gestion de plusieurs listes** : Créez et gérez plusieurs listes de courses (ex: courses hebdomadaires, courses spéciales, etc.).

- **Ajout automatique** : Ajoutez automatiquement les ingrédients manquants d'une recette à votre liste de courses en un clic.

- **Suivi des achats** : Cochez/décochez les articles achetés pour suivre votre progression.

- **Ajout manuel** : Ajoutez manuellement des ingrédients à vos listes avec quantités et unités.

#### Dashboard

- **Statistiques globales** : Vue d'ensemble de vos ingrédients disponibles, recettes réalisables, favoris et articles en liste de courses.

- **Actions rapides** : Accès direct pour ajouter des ingrédients, scanner un ticket ou générer une recette.

- **Recettes recommandées** : Suggestions de recettes basées sur vos ingrédients disponibles.

#### Profil utilisateur

- **Gestion des informations** : Modifiez vos informations personnelles (prénom, nom, email).

- **Configuration de l'IA** : Configurez votre clé API Google Gemini personnelle pour utiliser les fonctionnalités IA (scan de tickets et génération de recettes).

## Structure de la Codebase

```
Fridge-pro/
│
├── 📂 Fridge Pro/                    # Dossier principal de l'application
│   │
│   ├── 📂 backend/                   # API REST Node.js/Express avec TypeScript
│   │   ├── 📂 src/                   # Code source TypeScript
│   │   │   ├── index.ts              # Point d'entrée : configuration Express, routes, middleware
│   │   │   │
│   │   │   ├── 📂 middleware/        # Middlewares Express
│   │   │   │   ├── auth.ts           # Authentification JWT (vérification des tokens)
│   │   │   │   ├── errorHandler.ts   # Gestion centralisée des erreurs
│   │   │   │   └── notFound.ts       # Handler 404 pour routes inexistantes
│   │   │   │
│   │   │   ├── 📂 routes/            # Routes API (endpoints REST)
│   │   │   │   ├── auth.ts           # POST /api/auth/login, /api/auth/register
│   │   │   │   ├── users.ts          # CRUD utilisateurs (GET, PUT /api/users/*)
│   │   │   │   ├── ingredients.ts    # Gestion des ingrédients (CRUD)
│   │   │   │   ├── fridge.ts         # Gestion du frigo (ajout, suppression, expiration)
│   │   │   │   ├── recipes.ts        # CRUD recettes, recherche, favoris
│   │   │   │   ├── shopping-lists.ts # Gestion des listes de courses
│   │   │   │   └── ai.ts             # Endpoints pour génération IA (Gemini)
│   │   │   │
│   │   │   └── 📂 services/          # Services externes et logique métier
│   │   │       ├── geminiService.ts   # Intégration Google Gemini AI (génération recettes)
│   │   │       └── openFoodFactsService.ts # API OpenFoodFacts (infos produits)
│   │   │
│   │   ├── 📂 prisma/                # ORM Prisma (base de données)
│   │   │   ├── schema.prisma         # Schéma de la base (modèles : User, Recipe, FridgeItem, etc.)
│   │   │   ├── seed.ts               # Script de peuplement initial de la DB
│   │   │   └── 📂 migrations/        # Migrations SQL (historique des changements DB)
│   │   │
│   │   ├── 📂 scripts/               # Scripts utilitaires
│   │   │   └── seedFrenchRecipes.ts  # Script pour ajouter des recettes françaises
│   │   │
│   │   ├── 📂 dist/                  # Code JavaScript compilé (généré par `npm run build`)
│   │   ├── package.json              # Dépendances backend (Express, Prisma, JWT, etc.)
│   │   ├── tsconfig.json             # Configuration TypeScript
│   │   └── env.example               # Template des variables d'environnement
│   │
│   ├── 📂 frontend/                  # Application React avec TypeScript
│   │   ├── 📂 src/                   # Code source React
│   │   │   ├── main.tsx              # Point d'entrée React (rendu de l'app)
│   │   │   ├── App.tsx               # Configuration des routes (React Router)
│   │   │   ├── index.css             # Styles globaux
│   │   │   │
│   │   │   ├── 📂 pages/             # Pages principales de l'application
│   │   │   │   ├── HomePage.tsx      # Page d'accueil (dashboard, suggestions)
│   │   │   │   ├── AuthPage.tsx      # Connexion/Inscription
│   │   │   │   ├── FridgePage.tsx    # Gestion du contenu du frigo
│   │   │   │   ├── RecipesPage.tsx   # Liste et recherche de recettes
│   │   │   │   ├── ShoppingListPage.tsx # Gestion des listes de courses
│   │   │   │   └── ProfilePage.tsx   # Profil utilisateur (clé API Gemini)
│   │   │   │
│   │   │   ├── 📂 components/        # Composants React réutilisables
│   │   │   │   ├── Layout.tsx        # Layout principal (header, navigation)
│   │   │   │   ├── ProtectedRoute.tsx # HOC pour protéger les routes (auth)
│   │   │   │   ├── OpenFoodFactsTest.tsx # Composant de test API
│   │   │   │   └── 📂 ui/            # Composants UI réutilisables
│   │   │   │       ├── Button.tsx    # Bouton stylisé
│   │   │   │       ├── Card.tsx      # Carte conteneur
│   │   │   │       ├── Input.tsx     # Champ de saisie
│   │   │   │       ├── Modal.tsx     # Modal/dialog
│   │   │   │       └── index.ts      # Exports centralisés
│   │   │   │
│   │   │   ├── 📂 services/          # Services API (appels HTTP)
│   │   │   │   ├── api.ts            # Configuration Axios (baseURL, interceptors)
│   │   │   │   ├── authService.ts    # Login, register, logout
│   │   │   │   ├── userService.ts    # CRUD utilisateur
│   │   │   │   ├── fridgeService.ts  # Gestion du frigo
│   │   │   │   ├── recipeService.ts  # Recherche, création, favoris recettes
│   │   │   │   └── shoppingListService.ts # CRUD listes de courses
│   │   │   │
│   │   │   ├── 📂 stores/            # State management (Zustand)
│   │   │   │   └── authStore.ts      # Store global pour l'authentification
│   │   │   │
│   │   │   ├── 📂 hooks/             # Hooks React personnalisés
│   │   │   │   └── useAuth.ts        # Hook pour l'authentification
│   │   │   │
│   │   │   └── 📂 types/             # Définitions TypeScript
│   │   │       └── index.ts          # Types partagés (User, Recipe, Ingredient, etc.)
│   │   │
│   │   ├── 📂 dist/                  # Build de production (généré par `npm run build`)
│   │   ├── server.js                 # Serveur Express pour servir le build en production
│   │   ├── package.json              # Dépendances frontend (React, Vite, Tailwind, etc.)
│   │   ├── vite.config.ts            # Configuration Vite (bundler)
│   │   ├── tailwind.config.js        # Configuration Tailwind CSS
│   │   └── tsconfig.json             # Configuration TypeScript
│   │
│   └── db_dump.txt                   # Export SQL de la base de données (backup)
│
├── 📂 terraform/                     # Infrastructure as Code (Azure)
│   ├── main.tf                       # Définition des ressources Azure (App Services, DB, etc.)
│   ├── variables.tf                  # Variables Terraform (project_name, location, etc.)
│   ├── outputs.tf                    # Outputs Terraform (URLs, credentials)
│   ├── versions.tf                   # Versions des providers Terraform
│   └── terraform.tfstate             # État Terraform (généré automatiquement)
│
├── 📄 README.md                      # Ce fichier (documentation)
├── 📄 DEPLOYMENT_INFO.json           # Informations de déploiement
└── 📄 tf_outputs.json                # Outputs Terraform exportés
```

### Flux de Données

1. **Frontend** (React) → Appels HTTP via Axios → **Backend** (Express)
2. **Backend** → Prisma ORM → **PostgreSQL** (base de données)
3. **Backend** → Services externes (Gemini AI, OpenFoodFacts API)
4. **Authentification** : JWT tokens stockés côté client, vérifiés par middleware `auth.ts`

### Technologies Utilisées

**Backend** :

- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT (jsonwebtoken)
- Google Gemini AI
- OpenFoodFacts API

**Frontend** :

- React 18
- TypeScript
- Vite (bundler)
- React Router (routing)
- Zustand (state management)
- Tailwind CSS (styling)
- Axios (HTTP client)
- React Query (gestion des requêtes)

**Infrastructure** :

- Terraform (IaC)
- Azure (App Services, PostgreSQL Flexible Server)

---

# Tuto for deployement on Azure

## Étape 1 : Déploiement de l'infrastructure avec Terraform

### 1.1 Initialisation de Terraform

Accédez au dossier Terraform et initialisez le projet :

```bash
cd ./terraform/
```

Récupérez votre ID d'abonnement Azure :

```bash
az account show --query id -o tsv
```

Initialisez Terraform avec votre ID d'abonnement :

```bash
export ARM_SUBSCRIPTION_ID="<votre-id-abonnement-azure>" && terraform init
```

### 1.2 Création des ressources Azure

Appliquez la configuration Terraform pour créer toutes les ressources (App Services, base de données PostgreSQL, etc.) :

```bash
export ARM_SUBSCRIPTION_ID="<votre-id-abonnement-azure>" && terraform apply
```

Terraform va créer :

- Un groupe de ressources
- Un serveur PostgreSQL Flexible Server
- Une App Service pour le backend
- Une App Service pour le frontend

### 1.3 Récupération des informations de connexion

Récupérez la chaîne de connexion à la base de données :

```bash
terraform output -raw database_url_connection_string
```

### Exemple de sortie

```
postgresql://fridgeadmin:SNHWm1%25C_nsKtuqu@fridge-pro-db-xpeyok.postgres.database.azure.com:5432/fridge_pro?schema=public&sslmode=require
```

> **Note importante** : Copiez uniquement la partie après `postgresql://fridgeadmin:...` et **sans le `%` final** si présent.

```
Outputs:

backend_app_name = "fridge-pro-api-xpeyok"
backend_url = "https://fridge-pro-api-xpeyok.azurewebsites.net"
database_url_connection_string = <sensitive>
db_password = <sensitive>
db_server_fqdn = "fridge-pro-db-xpeyok.postgres.database.azure.com"
frontend_app_name = "fridge-pro-web-xpeyok"
frontend_url = "https://fridge-pro-web-xpeyok.azurewebsites.net"
resource_group_name = "fridge-pro-prod-rg"
romain@MacBook-Pro-de-Romain terraform % terraform output -raw database_url_connection_string
postgresql://fridgeadmin:SNHWm1%25C_nsKtuqu@fridge-pro-db-xpeyok.postgres.database.azure.com:5432/fridge_pro?schema=public&sslmode=require%
```

### Si nécessaire, elles sont accessible de nouveau avec :

```bash
# Nom du groupe de ressources
terraform output -raw resource_group_name

# URL du backend
terraform output -raw backend_url

# URL du frontend
terraform output -raw frontend_url

# Nom du serveur de base de données
terraform output -raw db_server_fqdn
```

Exportez la variable d'environnement `DATABASE_URL` :

```
export DATABASE_URL='<l'url de la databse que vous venez de copier>'
```

### 1.4 Configuration du pare-feu PostgreSQL

Pour pouvoir accéder à la base de données depuis votre machine locale, vous devez autoriser votre adresse IP.

Récupérez votre adresse IP publique sur [whatismyip.com](https://www.whatismyip.com).

Créez une règle de pare-feu :

```bash
az postgres flexible-server firewall-rule create \
  --resource-group <nom-du-groupe-de-ressources> \
  --name <nom-du-serveur-db> \
  --rule-name allow-my-ip \
  --start-ip-address <votre-IP> \
  --end-ip-address <votre-IP>
```

## Étape 2 : Déploiement de la base de données

### 2.1 Application des migrations Prisma

Accédez au dossier backend :

```bash
cd ../Fridge\ Pro/backend
```

Appliquez les migrations Prisma pour créer le schéma de base de données :

```bash
npx prisma migrate deploy
```

> **Optionnel** : Si vous souhaitez peupler la base de données avec des données initiales :
>
> ```bash
> npx prisma db seed
> ```

---

## Étape 3 : Déploiement du backend

### 3.1 Build et préparation du package

Installez les dépendances et compilez le code TypeScript :

```bash
npm install
npm run build
```

Créez un package de déploiement contenant uniquement les fichiers nécessaires :

```bash
mkdir deploy_temp
cp -r dist prisma package.json package-lock.json deploy_temp/
cd deploy_temp
npm install --omit=dev
zip -r ../backend.zip .
cd ..
rm -rf deploy_temp
```

### 3.2 Déploiement sur Azure App Service

Déployez le package sur l'App Service backend :

```bash
az webapp deploy \
  --resource-group <nom-du-groupe-de-ressources> \
  --name <nom-de-l-app-service-backend> \
  --src-path backend.zip \
  --type zip
```

---

## Étape 4 : Déploiement du frontend

### 4.1 Build du frontend

Accédez au dossier frontend :

```bash
cd ../frontend/
```

Définissez l'URL de l'API backend et compilez l'application :

```bash
export VITE_API_URL="<url-du-backend>"
npm run build
```

### 4.2 Préparation du package de déploiement

Créez un package contenant les fichiers compilés et le serveur Node.js :

```bash
mkdir deploy_front
cp -r dist server.js package.json package-lock.json deploy_front/
cd deploy_front
npm install --omit=dev
zip -r ../frontend.zip .
cd ..
rm -rf deploy_front
```

### 4.3 Déploiement sur Azure App Service

Déployez le frontend sur son App Service :

```bash
az webapp deploy \
  --resource-group <nom-du-groupe-de-ressources> \
  --name <nom-de-l-app-service-frontend> \
  --src-path frontend.zip \
  --type zip
```

### 4.4 Configuration CORS

Configurez CORS sur le backend pour autoriser les requêtes depuis le frontend :

```bash
az webapp cors add \
  --resource-group <nom-du-groupe-de-ressources> \
  --name <nom-de-l-app-service-backend> \
  --allowed-origins "<url-du-frontend>"
```

---

## Vérification du déploiement

Une fois toutes les étapes terminées, vous pouvez vérifier que tout fonctionne :

1. **Backend** : Accédez à `https://<backend-url>/api/health` - vous devriez voir un statut "OK"
2. **Frontend** : Accédez à `https://<frontend-url>` - l'application devrait se charger
3. **Base de données** : Les migrations Prisma ont créé toutes les tables nécessaires

---

## Features à ajouter/corriger

### Fonctionnalités à implémenter

- [ ] Amélioration du système de notifications pour les dates d'expiration
- [ ] Ajouter l'option d'Export/Import des données utilisateur & option supression compte
- [ ] Partage de recettes entre utilisateurs
- [ ] Mode hors-ligne pour la consultation des recettes
- [ ] Génération de liste de courses automatique basée sur les recettes favorites
- [ ] Historique des recettes préparées
- [ ] Système de notation et commentaires sur les recettes
- [ ] Mode sombre

### Corrections et améliorations

- [ ] Optimisation des performances de recherche d'ingrédients (via openfoodfact)
- [ ] Gestion des erreurs plus robuste côté frontend
- [ ] Tests unitaires et d'intégration
- [ ] Régler le petit soucis de connexion où on doit s'y prendre à 2 reprises

---

## Annexe photo

### Captures d'écran de l'application

> **Note** : Les captures d'écran seront ajoutées ici pour illustrer les différentes fonctionnalités de l'application.

#### Dashboard

- Vue d'ensemble avec statistiques et recettes recommandées

#### Gestion du frigo

- Liste des ingrédients avec dates d'expiration

<img width="2880" height="1369" alt="CleanShot 2025-11-24 at 23 47 10@2x" src="https://github.com/user-attachments/assets/6afa3a67-ffb9-46e1-9a47-98a7a4f16a85" />


- Modal d'ajout d'ingrédient avec recherche OpenFoodFacts

![CleanShot 2025-11-24 at 23 44 23](https://github.com/user-attachments/assets/ed8d22fc-c74b-4fe8-a801-0e7d554c306b)


- Scanner de ticket de caisse

![CleanShot 2025-11-24 at 23 50 29](https://github.com/user-attachments/assets/b3d06cb6-7587-4d33-a161-699419610f10)


#### Recettes

- Liste des recettes avec filtres
- Détail d'une recette avec ingrédients et instructions

![CleanShot 2025-11-25 at 12 05 02](https://github.com/user-attachments/assets/a7db47b2-d4e1-49ea-82c6-487feffb5047)


- Modal de génération de recette par IA

![CleanShot 2025-11-25 at 11 58 52](https://github.com/user-attachments/assets/416b8046-b69d-4963-8ecd-9b1634417805)


- Modal de création manuelle de recette

![CleanShot 2025-11-26 at 07 47 30](https://github.com/user-attachments/assets/3467058b-4197-4ff8-925d-249509f33da7)



#### Listes de courses

- Gestion des listes de courses

![CleanShot 2025-11-25 at 12 03 15](https://github.com/user-attachments/assets/b091664f-151d-4d69-8fea-cdd7f86d515b)


- Ajout d'ingrédients manquants depuis une recette

![CleanShot 2025-11-25 at 12 00 46](https://github.com/user-attachments/assets/ea855fe7-8bea-4b6d-b638-9ab55bc1b982)


#### Profil utilisateur

- Modification des informations personnelles

![CleanShot 2025-11-26 at 07 53 04](https://github.com/user-attachments/assets/dc12069e-e770-4f23-a2b2-e0fb4e2f1191)


- Configuration de la clé API Gemini
