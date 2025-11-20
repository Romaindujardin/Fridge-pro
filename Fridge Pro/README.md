# Fridge Pro

Une application moderne de gestion de frigo et de recettes avec intelligence artificielle, déployable sur Azure Cloud.

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/)
[![Infrastructure](https://img.shields.io/badge/Infrastructure-Terraform-7B42BC?logo=terraform)](infrastructure/terraform)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](docker-compose.yml)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=github-actions)](.github/workflows)

## 📋 Table des matières

- [Fonctionnalités](#fonctionnalités)
- [Technologies](#technologies)
- [Installation Locale](#-installation-locale)
- [Installation avec Docker](#-installation-avec-docker)
- [Déploiement Cloud Azure](#-déploiement-cloud-azure)
- [Architecture](#architecture)
- [Documentation](#documentation)

## Fonctionnalités

- **Gestion du frigo** : Ajout manuel ou automatique d'ingrédients via scan de tickets de caisse
- **Suggestions de recettes** : Algorithme intelligent qui propose des recettes selon vos ingrédients disponibles
- **IA intégrée** : Extraction automatique d'ingrédients avec Google Gemini et génération de recettes
- **Favoris** : Sauvegardez vos recettes préférées
- **Liste de courses** : Gérez vos achats futurs
- **Interface moderne** : Design responsive et intuitive
- **☁️ Cloud-Ready** : Déployable sur Azure avec Infrastructure as Code

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

## 🚀 Installation Locale

### Prérequis

- Node.js 18+
- PostgreSQL 13+
- Clé API Google Gemini (optionnel)

### 1. Cloner le projet

```bash
git clone https://github.com/Romaindujardin/Fridge-pro.git
cd "Fridge Pro"
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
# - JWT_SECRET
# - GEMINI_API_KEY (optionnel)
```

### 4. Initialiser la base de données

```bash
cd backend
npm run db:generate
npm run db:migrate
npm run db:seed
cd ..
```

### 5. Lancer l'application

```bash
npm run dev
```

L'application sera disponible sur :

- **Frontend** : http://localhost:3000
- **Backend** : http://localhost:5000
- **Prisma Studio** : http://localhost:5555 (avec `npm run db:studio`)

### Comptes de test

Après le seed, vous pouvez vous connecter avec :

- 📧 `demo@fridgepro.com` | 🔒 `demo123`
- 📧 `test@fridgepro.com` | 🔒 `test123`
- 📧 `admin@fridgepro.com` | 🔒 `admin123`

---

## 🐳 Installation avec Docker

### Prérequis

- Docker et Docker Compose installés

### 1. Configuration

```bash
# Copier le fichier d'environnement
cp .env.docker .env

# Éditer .env avec vos valeurs (optionnel)
```

### 2. Lancer avec Docker Compose

```bash
# Build et démarrage
docker-compose up -d

# Vérifier les logs
docker-compose logs -f

# Initialiser la base de données
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run db:seed
```

### 3. Accéder à l'application

- **Frontend** : http://localhost
- **Backend** : http://localhost:5000

### 4. Arrêter l'application

```bash
# Arrêter les containers
docker-compose down

# Arrêter et supprimer les volumes
docker-compose down -v
```

---

## ☁️ Déploiement Cloud Azure

### Option 1 : Déploiement rapide

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/)

### Option 2 : Déploiement avec Terraform

```bash
# 1. Installer Azure CLI et Terraform
az login

# 2. Configurer l'infrastructure
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Éditer terraform.tfvars avec vos valeurs

# 3. Déployer
terraform init
terraform plan
terraform apply

# 4. Configurer GitHub Actions (voir docs/CLOUD_DEPLOYMENT.md)
```

### Documentation complète

Pour un guide complet de déploiement Cloud :
- 📖 **[Guide de déploiement Cloud](docs/CLOUD_DEPLOYMENT.md)**
- 🏗️ **[Architecture Cloud](docs/ARCHITECTURE.md)**

**Coût estimé** : ~46€/mois pour environnement de développement

## 📁 Structure du projet

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
│   ├── Dockerfile              # Image Docker pour production
│   ├── nginx.conf              # Configuration Nginx
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
│   │   └── seed.ts             # Seed officiel
│   ├── Dockerfile              # Image Docker pour production
│   └── env.example             # Variables d'environnement
│
├── infrastructure/             # Infrastructure as Code
│   └── terraform/              # Configuration Terraform pour Azure
│       ├── main.tf             # Configuration principale
│       ├── database.tf         # PostgreSQL
│       ├── compute.tf          # App Services
│       ├── storage.tf          # Blob Storage
│       ├── variables.tf        # Variables
│       └── outputs.tf          # Outputs
│
├── .github/                    # CI/CD
│   └── workflows/
│       ├── deploy.yml          # Pipeline de déploiement
│       └── infrastructure.yml  # Gestion infrastructure
│
├── docs/                       # Documentation
│   ├── CLOUD_DEPLOYMENT.md     # Guide de déploiement Cloud
│   └── ARCHITECTURE.md         # Architecture détaillée
│
├── docker-compose.yml          # Orchestration Docker locale
└── .env.docker                 # Variables pour Docker
```

## 🏗️ Architecture

### Architecture locale (Docker)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend   │────▶│ PostgreSQL  │
│   (Nginx)   │     │  (Node.js)  │     │  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
   Port 80            Port 5000            Port 5432
```

### Architecture Cloud (Azure)

```
Internet ──▶ Frontend App Service ──▶ Backend App Service
                                            │
                                            ├─▶ PostgreSQL Flexible Server
                                            └─▶ Blob Storage (uploads)
```

Pour plus de détails, voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 📚 Documentation

- **[Guide de déploiement Cloud](docs/CLOUD_DEPLOYMENT.md)** - Déploiement complet sur Azure
- **[Architecture](docs/ARCHITECTURE.md)** - Architecture détaillée et diagrammes
- **[Contributing](CONTRIBUTING.md)** - Guide de contribution (à créer)

## 🔧 Technologies & Services Cloud

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

### Infrastructure Cloud (Azure)
- **Azure App Service** - Hébergement frontend et backend
- **Azure Database for PostgreSQL** - Base de données managée
- **Azure Blob Storage** - Stockage des fichiers
- **Azure Container Registry** - Registry Docker privé
- **Azure Virtual Network** - Isolation réseau
- **Terraform** - Infrastructure as Code
- **GitHub Actions** - CI/CD

## 💰 Coûts Cloud

| Environnement | Configuration | Coût mensuel estimé |
|--------------|---------------|---------------------|
| Local (Docker) | Sur votre machine | **Gratuit** |
| Azure Dev | Basic tier | **~46€/mois** |
| Azure Production | Standard tier + scaling | **~150€/mois** |

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Créez votre branche (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 👥 Auteurs

- **Fridge Pro Team** - [GitHub](https://github.com/Romaindujardin)

## 🙏 Remerciements

- Google Gemini AI pour l'intelligence artificielle
- Open Food Facts pour les données nutritionnelles
- La communauté open source

---

**Made with ❤️ and ☁️ Cloud Computing**

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
