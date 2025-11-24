# Fridge Pro

## Vue d'ensemble de l'application

**Fridge Pro** est une application de gestion de frigo intelligente.

### Fonctionnalités

- **Gestion des ingrédients de votre frigo** : Ajoutez les ingrédients que vous possédez

  - **Manuellement** : Renseignez les champs, l'API OpenFoodFacts vous aide à trouver vos ingrédients parmi un vaste choix.
  - **Via OCR IA** : Prenez en photo votre ticket de caisse, et les ingrédients s'ajouteront automatiquement dans votre frigo.

- **Gestion et création de recettes** : Créez vos recettes favorites ou générez-en via IA. Visualisez le nombre d'ingrédients disponibles dans votre frigo nécessaires à la réalisation de chaque recette.

- **Génération de recettes par IA** : Générez des recettes personnalisées via IA, avec la possibilité de créer des recettes uniquement basées sur les ingrédients disponibles dans votre frigo.

- **Liste de courses** : Si des ingrédients manquent pour votre recette favorite, ajoutez-les automatiquement à votre liste de courses !

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
