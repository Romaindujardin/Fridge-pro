# Guide de Déploiement Manuel - Fridge Pro sur Azure

## 📋 Prérequis
- Compte Azure for Students actif
- Azure CLI installé et connecté (`az login`)
- Images Docker construites localement
- Accès au portail Azure (https://portal.azure.com)

## 🎯 Objectif
Déployer l'application Fridge Pro sur Azure de manière économique et contrôlée pour le projet Cloud Computing.

---

## Étape 1 : Créer le Resource Group

### Via Azure CLI :
```powershell
az group create `
  --name fridgepro-ken-rg-dev `
  --location francecentral `
  --tags Project="Fridge Pro Cloud" Team="Kenneth SANGLI" Course="Cloud Computing"
```

### Via le Portail Azure :
1. Aller sur https://portal.azure.com
2. Rechercher "Resource groups" → Créer
3. Nom : `fridgepro-ken-rg-dev`
4. Région : `France Central`
5. Tags : Project=Fridge Pro Cloud, Team=Kenneth SANGLI
6. Créer

---

## Étape 2 : Créer Azure Container Registry (ACR)

### Via Azure CLI :
```powershell
$ACR_NAME = "fridgeprokenacr$(Get-Random -Maximum 9999)"

az acr create `
  --resource-group fridgepro-ken-rg-dev `
  --name $ACR_NAME `
  --sku Basic `
  --admin-enabled true `
  --location francecentral

# Récupérer les credentials
az acr credential show --name $ACR_NAME --resource-group fridgepro-ken-rg-dev
```

### Via le Portail :
1. Rechercher "Container registries" → Créer
2. Resource group : `fridgepro-ken-rg-dev`
3. Registry name : `fridgeprokenacr` + nombre aléatoire (doit être unique)
4. Location : France Central
5. SKU : **Basic** (le moins cher, ~5€/mois)
6. Admin user : **Enabled**
7. Créer

**Sauvegarder** : Username et Password (dans Access keys)

---

## Étape 3 : Pousser les Images Docker vers ACR

### Connexion à ACR :
```powershell
# Récupérer le login server
$ACR_LOGIN_SERVER = az acr show --name $ACR_NAME --resource-group fridgepro-ken-rg-dev --query loginServer -o tsv

# Se connecter à ACR
az acr login --name $ACR_NAME

# OU avec Docker directement
docker login $ACR_LOGIN_SERVER -u <username> -p <password>
```

### Tag et Push des images :
```powershell
# Retour au dossier principal
cd "C:\Users\SANGLI Kenneth\Documents\Fridge\Fridge-pro\Fridge Pro"

# Backend
docker tag fridgepro-backend:latest ${ACR_LOGIN_SERVER}/backend:latest
docker push ${ACR_LOGIN_SERVER}/backend:latest

# Frontend
docker tag fridgepro-frontend:latest ${ACR_LOGIN_SERVER}/frontend:latest
docker push ${ACR_LOGIN_SERVER}/frontend:latest
```

---

## Étape 4 : Créer la Base de Données PostgreSQL

### Option A - Azure Database for PostgreSQL Flexible Server (Recommandé) :

Via Azure CLI :
```powershell
# Créer le serveur PostgreSQL
az postgres flexible-server create `
  --resource-group fridgepro-ken-rg-dev `
  --name fridgepro-ken-db `
  --location francecentral `
  --admin-user fridgeadmin `
  --admin-password "FridgePro2025!SecureDB" `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --version 16 `
  --storage-size 32 `
  --public-access 0.0.0.0-255.255.255.255

# Créer la base de données
az postgres flexible-server db create `
  --resource-group fridgepro-ken-rg-dev `
  --server-name fridgepro-ken-db `
  --database-name fridge_pro
```

Via le Portail :
1. Rechercher "Azure Database for PostgreSQL flexible servers" → Créer
2. Resource group : `fridgepro-ken-rg-dev`
3. Server name : `fridgepro-ken-db`
4. Region : France Central
5. PostgreSQL version : **16**
6. Workload type : **Development**
7. Compute + storage : **Burstable, Standard_B1ms** (1 vCore, 2 GB RAM) - ~20€/mois
8. Admin username : `fridgeadmin`
9. Password : `FridgePro2025!SecureDB`
10. Networking : Allow public access from Azure services
11. Créer

**Sauvegarder** : 
- Server name : `fridgepro-ken-db.postgres.database.azure.com`
- Connection string : `postgresql://fridgeadmin:FridgePro2025!SecureDB@fridgepro-ken-db.postgres.database.azure.com:5432/fridge_pro`

### Option B - Azure SQL Database (Alternative moins chère) :
Si budget limité, considérer Azure SQL Database avec tier gratuit F1, mais nécessite adaptation du code Prisma.

---

## Étape 5 : Créer l'App Service Plan

### Via Azure CLI :
```powershell
az appservice plan create `
  --name fridgepro-ken-plan `
  --resource-group fridgepro-ken-rg-dev `
  --location francecentral `
  --is-linux `
  --sku B1
```

### Via le Portail :
1. Rechercher "App Service plans" → Créer
2. Resource group : `fridgepro-ken-rg-dev`
3. Name : `fridgepro-ken-plan`
4. Operating System : **Linux**
5. Region : France Central
6. Pricing tier : **B1 Basic** (1.75 GB RAM, 1 Core) - ~13€/mois
7. Créer

---

## Étape 6 : Créer le Backend Web App

### Via Azure CLI :
```powershell
# Créer l'app
az webapp create `
  --resource-group fridgepro-ken-rg-dev `
  --plan fridgepro-ken-plan `
  --name fridgepro-ken-backend `
  --deployment-container-image-name ${ACR_LOGIN_SERVER}/backend:latest

# Configurer les settings
az webapp config appsettings set `
  --resource-group fridgepro-ken-rg-dev `
  --name fridgepro-ken-backend `
  --settings `
    DATABASE_URL="postgresql://fridgeadmin:FridgePro2025!SecureDB@fridgepro-ken-db.postgres.database.azure.com:5432/fridge_pro?sslmode=require" `
    JWT_SECRET="fridgepro-jwt-secret-ken-2025" `
    PORT="8080" `
    NODE_ENV="production" `
    WEBSITES_PORT="8080"

# Configurer le registry
az webapp config container set `
  --name fridgepro-ken-backend `
  --resource-group fridgepro-ken-rg-dev `
  --docker-custom-image-name ${ACR_LOGIN_SERVER}/backend:latest `
  --docker-registry-server-url https://${ACR_LOGIN_SERVER} `
  --docker-registry-server-user <ACR_USERNAME> `
  --docker-registry-server-password <ACR_PASSWORD>
```

### Via le Portail :
1. Rechercher "App Services" → Créer → Web App
2. Resource group : `fridgepro-ken-rg-dev`
3. Name : `fridgepro-ken-backend` (sera accessible sur fridgepro-ken-backend.azurewebsites.net)
4. Publish : **Docker Container**
5. Operating System : **Linux**
6. Region : France Central
7. App Service Plan : Sélectionner `fridgepro-ken-plan`
8. Onglet Docker :
   - Image Source : **Azure Container Registry**
   - Registry : Sélectionner votre ACR
   - Image : `backend`
   - Tag : `latest`
9. Créer

**Configuration après création** :
1. Aller dans Configuration → Application settings
2. Ajouter :
   - `DATABASE_URL` = `postgresql://fridgeadmin:FridgePro2025!SecureDB@fridgepro-ken-db.postgres.database.azure.com:5432/fridge_pro?sslmode=require`
   - `JWT_SECRET` = `fridgepro-jwt-secret-ken-2025`
   - `PORT` = `8080`
   - `NODE_ENV` = `production`
   - `WEBSITES_PORT` = `8080`
3. Sauvegarder

---

## Étape 7 : Créer le Frontend Web App

### Via Azure CLI :
```powershell
# Créer l'app
az webapp create `
  --resource-group fridgepro-ken-rg-dev `
  --plan fridgepro-ken-plan `
  --name fridgepro-ken-frontend `
  --deployment-container-image-name ${ACR_LOGIN_SERVER}/frontend:latest

# Configurer les settings
az webapp config appsettings set `
  --resource-group fridgepro-ken-rg-dev `
  --name fridgepro-ken-frontend `
  --settings `
    VITE_API_URL="https://fridgepro-ken-backend.azurewebsites.net" `
    WEBSITES_PORT="80"

# Configurer le registry
az webapp config container set `
  --name fridgepro-ken-frontend `
  --resource-group fridgepro-ken-rg-dev `
  --docker-custom-image-name ${ACR_LOGIN_SERVER}/frontend:latest `
  --docker-registry-server-url https://${ACR_LOGIN_SERVER} `
  --docker-registry-server-user <ACR_USERNAME> `
  --docker-registry-server-password <ACR_PASSWORD>
```

### Via le Portail :
1. App Services → Créer → Web App
2. Resource group : `fridgepro-ken-rg-dev`
3. Name : `fridgepro-ken-frontend`
4. Publish : **Docker Container**
5. Operating System : **Linux**
6. Region : France Central
7. App Service Plan : Sélectionner `fridgepro-ken-plan`
8. Onglet Docker :
   - Image Source : **Azure Container Registry**
   - Registry : Votre ACR
   - Image : `frontend`
   - Tag : `latest`
9. Créer

**Configuration après création** :
1. Configuration → Application settings
2. Ajouter :
   - `VITE_API_URL` = `https://fridgepro-ken-backend.azurewebsites.net`
   - `WEBSITES_PORT` = `80`
3. Sauvegarder

---

## Étape 8 : Initialiser la Base de Données

### Connexion SSH au Backend :
```powershell
# Via Azure CLI
az webapp ssh --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev
```

### Ou via le Portail :
1. Aller sur le Backend Web App
2. Development Tools → SSH → Go

### Exécuter les migrations :
```bash
cd /app
npx prisma migrate deploy
npm run db:seed
```

---

## Étape 9 : Tester l'Application

### URLs à tester :
- **Frontend** : https://fridgepro-ken-frontend.azurewebsites.net
- **Backend API** : https://fridgepro-ken-backend.azurewebsites.net/api/health

### Comptes de test :
- demo@fridgepro.com / demo123
- test@fridgepro.com / test123
- admin@fridgepro.com / admin123

---

## 💰 Estimation des Coûts (Azure for Students)

| Ressource | SKU | Coût mensuel estimé |
|-----------|-----|---------------------|
| App Service Plan | B1 (Basic) | ~13€ |
| PostgreSQL Flexible Server | Standard_B1ms | ~20€ |
| Container Registry | Basic | ~5€ |
| Bandwidth | Sortie 5 GB | ~0.50€ |
| **TOTAL** | | **~38-40€/mois** |

**Crédit Azure for Students** : 100$ pendant 12 mois
**Durée possible** : ~2.5 mois avec ce setup

---

## 🔧 Optimisation des Coûts

### Pour réduire les coûts :
1. **Arrêter l'App Service** quand non utilisé :
   ```powershell
   az webapp stop --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev
   az webapp stop --name fridgepro-ken-frontend --resource-group fridgepro-ken-rg-dev
   ```

2. **Arrêter PostgreSQL** :
   ```powershell
   az postgres flexible-server stop --name fridgepro-ken-db --resource-group fridgepro-ken-rg-dev
   ```

3. **Supprimer après présentation** :
   ```powershell
   az group delete --name fridgepro-ken-rg-dev --yes --no-wait
   ```

---

## 📊 Monitoring

### Via le Portail Azure :
1. Aller sur chaque Web App
2. Monitoring → Metrics
3. Surveiller : CPU, Memory, HTTP requests

### Logs :
```powershell
# Backend logs
az webapp log tail --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev

# Frontend logs
az webapp log tail --name fridgepro-ken-frontend --resource-group fridgepro-ken-rg-dev
```

---

## 🚀 Mise à Jour des Images

### Après modification du code :
```powershell
# Reconstruire localement
docker-compose build

# Push vers ACR
docker tag fridgepro-backend:latest ${ACR_LOGIN_SERVER}/backend:latest
docker push ${ACR_LOGIN_SERVER}/backend:latest

# Redémarrer l'app
az webapp restart --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev
```

---

## 📸 Pour la Présentation

### Captures d'écran à prendre :
1. ✅ Portail Azure - Vue d'ensemble du Resource Group
2. ✅ App Services - Backend et Frontend running
3. ✅ PostgreSQL Database - Overview
4. ✅ Container Registry - Images listées
5. ✅ Application fonctionnelle - Page d'accueil
6. ✅ Logs de l'application
7. ✅ Métriques de monitoring

---

## ❌ Nettoyage Complet

### Supprimer toutes les ressources :
```powershell
az group delete --name fridgepro-ken-rg-dev --yes
```

**⚠️ Attention** : Cette commande supprime TOUT et est irréversible !

---

## 🎓 Points à Mentionner dans la Présentation

1. **Infrastructure as Code** : Terraform configuré (même si déploiement manuel)
2. **Containerization** : Docker multi-stage builds
3. **Cloud Services** : App Services, PostgreSQL, Container Registry
4. **Networking** : HTTPS, CORS configuré
5. **Security** : Managed identities, secrets in environment variables
6. **Monitoring** : Application Insights, Logs
7. **Scalability** : Prêt pour scale up/out
8. **CI/CD** : GitHub Actions workflows prêts (même si pas utilisés)
9. **Cost Optimization** : Choix des SKUs économiques
10. **Best Practices** : Health checks, proper error handling

---

## 📞 Support

En cas de problème :
1. Vérifier les logs : `az webapp log tail`
2. Vérifier la configuration : Application settings correctes ?
3. Tester le backend seul : `/api/health` doit retourner 200
4. Vérifier la connexion DB : Firewall rules ok ?

---

**Créé par** : Kenneth SANGLI  
**Cours** : Cloud Computing - JUNIA  
**Date** : Novembre 2025
