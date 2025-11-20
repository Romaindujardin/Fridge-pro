# 🚀 Quick Start Guide - Fridge Pro

Guide de démarrage rapide pour Fridge Pro selon votre cas d'usage.

---

## 🎯 Choisir votre méthode d'installation

### 1️⃣ Développement Local (Recommandé pour débuter)

**Avantages** : Complet, tous les outils disponibles  
**Prérequis** : Node.js, PostgreSQL  
**Temps** : ~15 minutes

```bash
# Installation
git clone https://github.com/Romaindujardin/Fridge-pro.git
cd "Fridge Pro"
npm run install:all

# Configuration
cp backend/env.example backend/.env
# Éditer backend/.env avec vos valeurs

# Base de données
createdb fridge_pro
cd backend
npm run db:generate
npm run db:migrate
npm run db:seed
cd ..

# Lancement
npm run dev
```

✅ **Accès** : http://localhost:3000

---

### 2️⃣ Docker (Recommandé pour tester rapidement)

**Avantages** : Simple, isolé, reproductible  
**Prérequis** : Docker Desktop  
**Temps** : ~5 minutes

```bash
# Installation
git clone https://github.com/Romaindujardin/Fridge-pro.git
cd "Fridge Pro"

# Configuration
cp .env.docker .env

# Lancement
docker-compose up -d

# Initialisation (première fois uniquement)
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run db:seed
```

✅ **Accès** : http://localhost

---

### 3️⃣ Cloud Azure (Pour production)

**Avantages** : Scalable, haute disponibilité, géré  
**Prérequis** : Compte Azure, Azure CLI, Terraform  
**Temps** : ~30 minutes  
**Coût** : ~46€/mois (dev), ~150€/mois (prod)

```bash
# Installation
git clone https://github.com/Romaindujardin/Fridge-pro.git
cd "Fridge Pro"

# Azure CLI
az login

# Terraform
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Éditer terraform.tfvars

terraform init
terraform plan
terraform apply

# Suivre le guide complet : docs/CLOUD_DEPLOYMENT.md
```

✅ **Accès** : URL Azure fournie par Terraform

---

## 🔑 Comptes de test

Après initialisation de la base de données :

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| demo@fridgepro.com | demo123 | Utilisateur demo |
| test@fridgepro.com | test123 | Utilisateur test |
| admin@fridgepro.com | admin123 | Admin |

---

## 🧪 Premiers pas dans l'application

### 1. Connexion
- Accédez à l'application
- Connectez-vous avec un compte de test

### 2. Ajouter des ingrédients
- Allez dans "Mon Frigo"
- Cliquez sur "Ajouter un ingrédient"
- Choisissez un ingrédient et une quantité

### 3. Scanner un ticket (optionnel)
- **Prérequis** : Clé API Google Gemini
- Allez dans Profil → Ajouter votre clé API
- Retournez dans "Mon Frigo" → "Scanner un ticket"
- Uploadez une photo de ticket

### 4. Générer des recettes
- Allez dans "Recettes"
- Cliquez sur "Générer des suggestions"
- L'IA propose des recettes basées sur vos ingrédients

### 5. Créer une liste de courses
- Allez dans "Liste de courses"
- Ajoutez les ingrédients manquants
- Marquez-les comme achetés au fur et à mesure

---

## 🔧 Configuration avancée

### Variables d'environnement importantes

**Backend** (`backend/.env`) :

```env
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/fridge_pro?schema=public"

# Authentification
JWT_SECRET="votre-secret-jwt-super-securise"
JWT_EXPIRES_IN="7d"

# Google Gemini AI (optionnel)
GEMINI_API_KEY="votre-cle-api-gemini"

# Serveur
PORT=5000
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
```

### Obtenir une clé API Google Gemini

1. Allez sur https://aistudio.google.com/app/apikey
2. Connectez-vous avec votre compte Google
3. Cliquez sur "Create API Key"
4. Copiez la clé et ajoutez-la dans `.env` ou dans votre profil

**C'est gratuit** avec des limites généreuses !

---

## 📊 Vérifier que tout fonctionne

### Test de santé

```bash
# Backend
curl http://localhost:5000/api/health
# Doit retourner: {"status":"ok","database":"connected"}

# Frontend (Docker)
curl http://localhost/health
# Doit retourner: healthy
```

### Logs

**Développement local** :
- Backend : Logs dans le terminal où vous avez lancé `npm run dev`
- Frontend : Logs dans le terminal + Console navigateur

**Docker** :
```bash
# Tous les logs
docker-compose logs -f

# Backend uniquement
docker-compose logs -f backend

# Frontend uniquement
docker-compose logs -f frontend
```

**Azure** :
```bash
# Backend
az webapp log tail --name {BACKEND_APP_NAME} --resource-group {RESOURCE_GROUP}

# Frontend
az webapp log tail --name {FRONTEND_APP_NAME} --resource-group {RESOURCE_GROUP}
```

---

## 🐛 Problèmes courants

### Erreur : "Cannot connect to database"

**Solution** :
```bash
# Vérifier que PostgreSQL tourne
# Windows
net start postgresql-x64-18

# Mac
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Docker
docker-compose ps  # Vérifier que le container database est up
```

### Erreur : "Port 3000 already in use"

**Solution** :
```bash
# Trouver le processus
# Windows
netstat -ano | findstr :3000

# Mac/Linux
lsof -i :3000

# Tuer le processus ou changer le port dans vite.config.ts
```

### Erreur : "Prisma Client not generated"

**Solution** :
```bash
cd backend
npm run db:generate
```

### Docker : "Container is unhealthy"

**Solution** :
```bash
# Voir les logs
docker-compose logs backend

# Reconstruire
docker-compose down
docker-compose up --build
```

---

## 🎓 Prochaines étapes

### Pour le développement

1. **Lire la documentation complète**
   - Architecture : `docs/ARCHITECTURE.md`
   - API : `backend/src/routes/`
   - Components : `frontend/src/components/`

2. **Explorer le code**
   ```bash
   # Backend
   cd backend/src
   code .

   # Frontend
   cd frontend/src
   code .
   ```

3. **Ajouter des features**
   - Créer une branche : `git checkout -b feature/ma-feature`
   - Développer
   - Tester localement
   - Créer une Pull Request

### Pour le déploiement Cloud

1. **Lire le guide de déploiement**
   - `docs/CLOUD_DEPLOYMENT.md`

2. **Configurer Azure**
   - Créer un compte Azure
   - Installer Azure CLI
   - Configurer les credentials

3. **Déployer avec Terraform**
   - Suivre le guide étape par étape
   - Configurer GitHub Actions
   - Déployer automatiquement

4. **Configurer le monitoring**
   - Azure Application Insights
   - Alertes sur les erreurs
   - Dashboards personnalisés

---

## 📚 Ressources

### Documentation officielle

- [Node.js](https://nodejs.org/docs)
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [Vite](https://vitejs.dev)
- [Docker](https://docs.docker.com)
- [Terraform](https://www.terraform.io/docs)
- [Azure](https://docs.microsoft.com/azure)

### Tutoriels

- [Prisma Quick Start](https://www.prisma.io/docs/getting-started/quickstart)
- [React Query Tutorial](https://tanstack.com/query/latest/docs/react/overview)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Terraform Azure](https://learn.hashicorp.com/tutorials/terraform/azure-build)

---

## 🆘 Besoin d'aide ?

1. **Documentation** : Consultez `docs/`
2. **Issues GitHub** : https://github.com/Romaindujardin/Fridge-pro/issues
3. **Discussions** : https://github.com/Romaindujardin/Fridge-pro/discussions

---

**Bon développement ! 🚀**
