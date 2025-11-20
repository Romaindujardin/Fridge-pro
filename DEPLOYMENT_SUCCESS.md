# 🎉 Déploiement Réussi - Fridge Pro sur Azure

## ✅ Statut du Déploiement

| Composant | État | URL |
|-----------|------|-----|
| **Frontend** | ✅ Opérationnel | [https://fridge-pro-web-vqptop.azurewebsites.net](https://fridge-pro-web-vqptop.azurewebsites.net) |
| **Backend API** | ✅ Opérationnel | [https://fridge-pro-api-vqptop.azurewebsites.net](https://fridge-pro-api-vqptop.azurewebsites.net) |
| **Database** | ✅ Migrée | `fridge-pro-db-vqptop.postgres.database.azure.com` |
| **Health Check** | ✅ OK | [https://fridge-pro-api-vqptop.azurewebsites.net/api/health](https://fridge-pro-api-vqptop.azurewebsites.net/api/health) |

## 📋 Ressources Azure

```json
{
  "resource_group": "fridge-pro-prod-rg",
  "location": "italynorth",
  "backend_app": "fridge-pro-api-vqptop",
  "frontend_app": "fridge-pro-web-vqptop",
  "db_server": "fridge-pro-db-vqptop"
}
```

## 🔐 Accès aux Secrets

Pour récupérer les informations sensibles (mots de passe, JWT secret, connection string) :

```bash
cd terraform
terraform output -json | jq '.db_password.value'
terraform output -json | jq '.database_url_connection_string.value'
```

## 📊 Stack Technique Déployée

### Backend
- **Runtime** : Node.js 20 LTS
- **Framework** : Express.js
- **ORM** : Prisma Client (avec binaires Linux `debian-openssl-3.0.x`)
- **Database** : PostgreSQL 16 Flexible Server
- **Auth** : JWT (secret généré automatiquement par Terraform)
- **AI** : Support Google Gemini (clé API par utilisateur)

### Frontend
- **Framework** : React 18 + Vite
- **Routing** : React Router v6
- **State** : Zustand
- **Styling** : Tailwind CSS
- **Déploiement** : Buildé statiquement, servi par Express.js

### Infrastructure
- **IaC** : Terraform
- **Provider** : Azure (authentification via Azure CLI)
- **App Service Plan** : Linux B1 (partagé entre frontend et backend)
- **Database** : PostgreSQL Flexible Server B1ms

## 🚀 Utilisation

1. **Accédez au frontend** : https://fridge-pro-web-vqptop.azurewebsites.net
2. **Créez un compte utilisateur**
3. **Commencez à gérer votre frigo !**

## 🔄 Mises à Jour et Redéploiement

### Backend

```bash
cd "Fridge Pro/backend"
# 1. Effectuer vos modifications
# 2. Installer, compiler et déployer
npm install && npm run build

mkdir -p deploy_temp
cp -r dist prisma package.json deploy_temp/
cd deploy_temp
npm install --omit=dev
zip -r ../backend-deploy.zip .
cd ..
az webapp deploy --resource-group fridge-pro-prod-rg \
  --name fridge-pro-api-vqptop \
  --src-path backend-deploy.zip --type zip
rm -rf deploy_temp backend-deploy.zip
```

### Frontend

```bash
cd "Fridge Pro/frontend"
# 1. Effectuer vos modifications
# 2. Builder avec l'URL de l'API Azure
export VITE_API_URL="https://fridge-pro-api-vqptop.azurewebsites.net"
npm install && npm run build

# 3. Déployer
zip -r frontend-deploy.zip dist server.js package.json
az webapp deploy --resource-group fridge-pro-prod-rg \
  --name fridge-pro-web-vqptop \
  --src-path frontend-deploy.zip --type zip
rm frontend-deploy.zip
```

### Migrations de Base de Données

```bash
cd "Fridge Pro/backend"
export DATABASE_URL='<connection_string_from_terraform_output>'
npx prisma migrate deploy
```

## 💰 Gestion des Coûts

**Estimation mensuelle** : ~30€
- App Service Plan B1 : ~13€/mois
- PostgreSQL Flexible Server B1ms : ~15€/mois

**Pour arrêter temporairement** :
```bash
az webapp stop --name fridge-pro-api-vqptop --resource-group fridge-pro-prod-rg
az webapp stop --name fridge-pro-web-vqptop --resource-group fridge-pro-prod-rg
az postgres flexible-server stop --name fridge-pro-db-vqptop --resource-group fridge-pro-prod-rg
```

**Pour redémarrer** :
```bash
az postgres flexible-server start --name fridge-pro-db-vqptop --resource-group fridge-pro-prod-rg
az webapp start --name fridge-pro-api-vqptop --resource-group fridge-pro-prod-rg
az webapp start --name fridge-pro-web-vqptop --resource-group fridge-pro-prod-rg
```

**Pour détruire complètement l'infrastructure** :
```bash
cd terraform
terraform destroy
```

## 🛠️ Dépannage

### Backend ne répond pas
```bash
# Vérifier les logs
az webapp log tail --name fridge-pro-api-vqptop --resource-group fridge-pro-prod-rg

# Redémarrer l'application
az webapp restart --name fridge-pro-api-vqptop --resource-group fridge-pro-prod-rg
```

### Frontend affiche "Application Error"
```bash
# Vérifier les logs
az webapp log tail --name fridge-pro-web-vqptop --resource-group fridge-pro-prod-rg

# Redémarrer
az webapp restart --name fridge-pro-web-vqptop --resource-group fridge-pro-prod-rg
```

### Problème de connexion à la base de données
Assurez-vous que votre IP est autorisée dans le firewall :
```bash
az postgres flexible-server firewall-rule create \
  --resource-group fridge-pro-prod-rg \
  --name fridge-pro-db-vqptop \
  --rule-name allow-my-ip \
  --start-ip-address $(curl -4 -s ifconfig.me) \
  --end-ip-address $(curl -4 -s ifconfig.me)
```

## 📝 Fichiers de Configuration

- `terraform/` : Infrastructure as Code
- `DEPLOYMENT_INFO.json` : Informations de déploiement (URLs, noms de ressources)
- `DEPLOY_MANUAL.md` : Guide de déploiement manuel (référence)
- `DEPLOYMENT_SUCCESS.md` : Ce fichier

## ⚠️ Sécurité

- ✅ JWT Secret généré aléatoirement par Terraform
- ✅ Mot de passe DB généré aléatoirement
- ✅ HTTPS activé automatiquement par Azure
- ✅ CORS configuré pour l'origine du frontend
- ⚠️ Pensez à configurer des règles de firewall plus strictes pour la base de données en production

## 🎯 Fonctionnalités Déployées

- Authentification utilisateur (inscription/connexion)
- Gestion du frigo (ajout/suppression d'ingrédients)
- Recherche d'ingrédients via OpenFoodFacts
- Génération de recettes avec IA (Gemini)
- Favoris de recettes
- Listes de courses
- Profil utilisateur avec clé API Gemini personnalisée

---

**Date de déploiement** : 20 novembre 2025  
**Région Azure** : Italy North  
**Méthode** : Déploiement manuel via Azure CLI + Terraform  
