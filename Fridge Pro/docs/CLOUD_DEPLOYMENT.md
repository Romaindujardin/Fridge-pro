# 🚀 Cloud Deployment Guide - Fridge Pro

## 📋 Table des matières

- [Prérequis](#prérequis)
- [Architecture Cloud](#architecture-cloud)
- [Installation locale avec Docker](#installation-locale-avec-docker)
- [Déploiement sur Azure](#déploiement-sur-azure)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring et Maintenance](#monitoring-et-maintenance)

---

## 🎯 Prérequis

### Outils nécessaires

```bash
# Node.js 18+
node --version

# Docker et Docker Compose
docker --version
docker-compose --version

# Terraform (pour l'infrastructure)
terraform --version

# Azure CLI
az --version

# Git
git --version
```

### Comptes requis

- [x] Compte Azure (essai gratuit disponible)
- [x] Compte GitHub (pour le repository)
- [x] Clé API Google Gemini (optionnel, pour le scan de tickets)

---

## 🏗️ Architecture Cloud

### Architecture Azure

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Cloud Platform                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────┐       ┌───────────────┐                  │
│  │   Frontend    │       │   Backend     │                  │
│  │  App Service  │◄──────┤  App Service  │                  │
│  │   (Nginx)     │       │   (Node.js)   │                  │
│  └───────┬───────┘       └───────┬───────┘                  │
│          │                       │                           │
│          │                       ├──────────┐                │
│          │                       │          │                │
│          │                       ▼          ▼                │
│          │              ┌─────────────┐ ┌─────────────┐     │
│          │              │ PostgreSQL  │ │   Blob      │     │
│          │              │  Flexible   │ │  Storage    │     │
│          │              │   Server    │ │ (Uploads)   │     │
│          │              └─────────────┘ └─────────────┘     │
│          │                                                   │
│          ▼                                                   │
│  ┌───────────────┐                                          │
│  │  Container    │                                          │
│  │   Registry    │                                          │
│  │     (ACR)     │                                          │
│  └───────────────┘                                          │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Virtual Network (VNet)                   │  │
│  │  - App Subnet                                         │  │
│  │  - Database Subnet                                    │  │
│  │  - Private DNS Zone                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Ressources Cloud utilisées

| Service | Type | Usage | Coût mensuel estimé |
|---------|------|-------|---------------------|
| App Service | B1 (2 instances) | Frontend + Backend | ~25€ |
| PostgreSQL | B_Standard_B1ms | Base de données | ~15€ |
| Blob Storage | LRS | Stockage fichiers | ~1€ |
| Container Registry | Basic | Images Docker | ~5€ |
| Virtual Network | Standard | Réseau privé | Gratuit |
| **TOTAL** | | | **~46€/mois** |

---

## 🐳 Installation locale avec Docker

### 1. Configuration

```bash
# Cloner le repository
git clone https://github.com/Romaindujardin/Fridge-pro.git
cd "Fridge Pro"

# Copier et configurer les variables d'environnement
cp .env.docker .env

# Éditer .env avec vos valeurs
notepad .env  # Ou vim .env sur Linux/Mac
```

### 2. Lancer l'application

```bash
# Build et démarrage
docker-compose up -d

# Vérifier les logs
docker-compose logs -f

# L'application sera accessible sur:
# Frontend: http://localhost
# Backend: http://localhost:5000
```

### 3. Initialiser la base de données

```bash
# Entrer dans le container backend
docker-compose exec backend sh

# Exécuter les migrations
npx prisma migrate deploy

# Peupler la base avec des données de test
npm run db:seed

# Sortir du container
exit
```

### 4. Arrêter l'application

```bash
# Arrêter les containers
docker-compose down

# Arrêter et supprimer les volumes (⚠️ efface les données)
docker-compose down -v
```

---

## ☁️ Déploiement sur Azure

### Étape 1: Configuration Azure CLI

```bash
# Se connecter à Azure
az login

# Créer un service principal pour Terraform et GitHub Actions
az ad sp create-for-rbac \
  --name "fridge-pro-sp" \
  --role contributor \
  --scopes /subscriptions/{SUBSCRIPTION_ID} \
  --sdk-auth

# ⚠️ SAUVEGARDER LE JSON RETOURNÉ - il sera nécessaire pour GitHub Actions
```

### Étape 2: Déployer l'infrastructure avec Terraform

```bash
cd infrastructure/terraform

# Copier le fichier de variables
cp terraform.tfvars.example terraform.tfvars

# Éditer terraform.tfvars avec vos valeurs
notepad terraform.tfvars

# Initialiser Terraform
terraform init

# Planifier les changements
terraform plan

# Appliquer l'infrastructure
terraform apply

# Noter les outputs (URLs, credentials, etc.)
terraform output
```

### Étape 3: Configurer GitHub Secrets

Aller dans votre repository GitHub → Settings → Secrets and variables → Actions

Ajouter les secrets suivants:

```
AZURE_CREDENTIALS        # JSON du service principal (étape 1)
AZURE_RESOURCE_GROUP     # Nom du resource group Terraform
ACR_NAME                 # Nom du Container Registry (output Terraform)
BACKEND_APP_NAME         # Nom de l'App Service backend (output Terraform)
FRONTEND_APP_NAME        # Nom de l'App Service frontend (output Terraform)
DB_ADMIN_PASSWORD        # Mot de passe PostgreSQL
JWT_SECRET               # Secret JWT pour l'authentification
```

### Étape 4: Déployer via GitHub Actions

```bash
# Pousser le code sur GitHub
git add .
git commit -m "Add cloud infrastructure"
git push origin main

# Le pipeline CI/CD se déclenchera automatiquement et:
# 1. Testera le backend et frontend
# 2. Construira les images Docker
# 3. Les poussera vers Azure Container Registry
# 4. Déploiera sur Azure App Services
```

### Étape 5: Exécuter les migrations

```bash
# Se connecter au backend déployé
az webapp ssh --name {BACKEND_APP_NAME} --resource-group {RESOURCE_GROUP}

# Exécuter les migrations
cd /app
npx prisma migrate deploy
npm run db:seed

# Sortir
exit
```

---

## 🔄 CI/CD Pipeline

### Pipeline de déploiement automatique

Le pipeline GitHub Actions (`deploy.yml`) se déclenche automatiquement sur chaque push vers `main`:

1. **Test** - Vérifie que le code compile et passe les tests
2. **Build** - Construit les images Docker
3. **Push** - Pousse les images vers Azure Container Registry
4. **Deploy** - Déploie sur Azure App Services
5. **Health Check** - Vérifie que l'application fonctionne

### Pipeline d'infrastructure

Le pipeline `infrastructure.yml` permet de gérer l'infrastructure via GitHub Actions:

```bash
# Aller dans Actions → Infrastructure Deployment → Run workflow
# Choisir l'action: plan / apply / destroy
```

### Tests automatiques

Les tests sont exécutés automatiquement sur chaque pull request:

- Linting du code
- Build TypeScript
- Tests unitaires (à ajouter)

---

## 📊 Monitoring et Maintenance

### Consulter les logs

```bash
# Logs de l'App Service backend
az webapp log tail --name {BACKEND_APP_NAME} --resource-group {RESOURCE_GROUP}

# Logs de l'App Service frontend
az webapp log tail --name {FRONTEND_APP_NAME} --resource-group {RESOURCE_GROUP}

# Logs dans le portail Azure
# https://portal.azure.com → App Services → Votre app → Logs
```

### Surveillance de la base de données

```bash
# Se connecter à PostgreSQL
az postgres flexible-server connect \
  --name {POSTGRES_SERVER_NAME} \
  --database-name fridge_pro \
  --admin-user fridgeadmin \
  --admin-password {PASSWORD}

# Exécuter des requêtes SQL
SELECT * FROM "User" LIMIT 10;
```

### Sauvegardes

Les sauvegardes automatiques sont configurées:

- **PostgreSQL**: Sauvegarde quotidienne, rétention de 7 jours
- **Blob Storage**: Versioning activé pour les uploads

Pour restaurer une sauvegarde:

```bash
# Lister les sauvegardes disponibles
az postgres flexible-server backup list \
  --resource-group {RESOURCE_GROUP} \
  --name {POSTGRES_SERVER_NAME}

# Restaurer depuis une sauvegarde
az postgres flexible-server restore \
  --resource-group {RESOURCE_GROUP} \
  --name {NEW_SERVER_NAME} \
  --source-server {POSTGRES_SERVER_NAME} \
  --restore-time {TIMESTAMP}
```

### Mise à l'échelle

```bash
# Augmenter les ressources de l'App Service
az appservice plan update \
  --name {PLAN_NAME} \
  --resource-group {RESOURCE_GROUP} \
  --sku S1

# Augmenter les ressources de la base de données
az postgres flexible-server update \
  --name {POSTGRES_SERVER_NAME} \
  --resource-group {RESOURCE_GROUP} \
  --sku-name GP_Standard_D2s_v3
```

---

## 🔒 Sécurité

### Bonnes pratiques implémentées

- ✅ HTTPS obligatoire sur tous les services
- ✅ Authentification JWT
- ✅ Variables d'environnement pour les secrets
- ✅ Virtual Network pour isoler les ressources
- ✅ Private DNS pour la base de données
- ✅ Stockage chiffré
- ✅ Sauvegardes automatiques
- ✅ Headers de sécurité (CSP, X-Frame-Options, etc.)

### Recommandations supplémentaires

- [ ] Activer Azure AD Authentication
- [ ] Configurer Azure Key Vault pour les secrets
- [ ] Activer Azure DDoS Protection
- [ ] Configurer Azure Application Gateway avec WAF
- [ ] Mettre en place Azure Monitor et alertes

---

## 💰 Gestion des coûts

### Surveiller les coûts

```bash
# Voir les coûts actuels
az consumption usage list --output table

# Configurer des alertes de budget dans le portail Azure
# https://portal.azure.com → Cost Management → Budgets
```

### Optimiser les coûts

- Utiliser des instances **Basic** ou **Standard** pour dev/test
- Passer en **Premium** uniquement pour la production
- Éteindre les environnements de dev/test la nuit et le week-end
- Utiliser des **Reserved Instances** pour réduire les coûts de 30-50%

---

## 🆘 Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs
az webapp log tail --name {APP_NAME} --resource-group {RESOURCE_GROUP}

# Vérifier la configuration
az webapp config appsettings list --name {APP_NAME} --resource-group {RESOURCE_GROUP}

# Redémarrer l'application
az webapp restart --name {APP_NAME} --resource-group {RESOURCE_GROUP}
```

### Erreur de connexion à la base de données

```bash
# Vérifier que l'App Service peut accéder à la base
az postgres flexible-server firewall-rule list \
  --name {POSTGRES_SERVER_NAME} \
  --resource-group {RESOURCE_GROUP}

# Vérifier la connexion réseau
az network vnet subnet show \
  --resource-group {RESOURCE_GROUP} \
  --vnet-name {VNET_NAME} \
  --name {SUBNET_NAME}
```

### Erreur de déploiement Docker

```bash
# Vérifier que l'image existe dans ACR
az acr repository list --name {ACR_NAME}

# Vérifier les tags
az acr repository show-tags --name {ACR_NAME} --repository backend

# Reconstruire et pousser l'image
docker build -t {ACR_NAME}.azurecr.io/backend:latest ./backend
az acr login --name {ACR_NAME}
docker push {ACR_NAME}.azurecr.io/backend:latest
```

---

## 📚 Ressources supplémentaires

- [Documentation Azure App Service](https://docs.microsoft.com/azure/app-service/)
- [Documentation PostgreSQL sur Azure](https://docs.microsoft.com/azure/postgresql/)
- [Documentation Terraform Azure](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [GitHub Actions pour Azure](https://docs.microsoft.com/azure/developer/github/github-actions)

---

## 🤝 Support

Pour toute question ou problème:

1. Consulter les [Issues GitHub](https://github.com/Romaindujardin/Fridge-pro/issues)
2. Créer une nouvelle issue avec le tag `cloud-deployment`
3. Contacter l'équipe de développement

---

**Bon déploiement! 🚀**
