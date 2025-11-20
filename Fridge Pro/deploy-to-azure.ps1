# Script de Déploiement Manuel - Fridge Pro sur Azure
# Auteur: Kenneth SANGLI
# Cours: Cloud Computing - JUNIA

# Configuration
$RESOURCE_GROUP = "fridgepro-ken-rg-dev"
$LOCATION = "francecentral"
$ACR_NAME = "fridgeprokenacr$(Get-Random -Maximum 9999)"
$DB_SERVER_NAME = "fridgepro-ken-db"
$DB_ADMIN_USER = "fridgeadmin"
$DB_ADMIN_PASSWORD = "FridgePro2025!SecureDB"
$DB_NAME = "fridge_pro"
$APP_PLAN_NAME = "fridgepro-ken-plan"
$BACKEND_APP_NAME = "fridgepro-ken-backend"
$FRONTEND_APP_NAME = "fridgepro-ken-frontend"
$JWT_SECRET = "fridgepro-jwt-secret-ken-2025-cloud-computing-project"

Write-Host "🚀 Démarrage du déploiement de Fridge Pro sur Azure..." -ForegroundColor Green
Write-Host ""

# Vérifier la connexion Azure
Write-Host "📋 Étape 1/9 : Vérification de la connexion Azure..." -ForegroundColor Cyan
$account = az account show 2>$null
if (-not $account) {
    Write-Host "❌ Non connecté à Azure. Exécution de 'az login'..." -ForegroundColor Yellow
    az login
}
Write-Host "✅ Connecté à Azure" -ForegroundColor Green
Write-Host ""

# Créer le Resource Group
Write-Host "📋 Étape 2/9 : Création du Resource Group..." -ForegroundColor Cyan
az group create `
    --name $RESOURCE_GROUP `
    --location $LOCATION `
    --tags Project="Fridge Pro Cloud" Team="Kenneth SANGLI" Course="Cloud Computing" | Out-Null
Write-Host "✅ Resource Group créé: $RESOURCE_GROUP" -ForegroundColor Green
Write-Host ""

# Créer Azure Container Registry
Write-Host "📋 Étape 3/9 : Création de l'Azure Container Registry..." -ForegroundColor Cyan
az acr create `
    --resource-group $RESOURCE_GROUP `
    --name $ACR_NAME `
    --sku Basic `
    --admin-enabled true `
    --location $LOCATION | Out-Null

$ACR_LOGIN_SERVER = az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv
$ACR_USERNAME = az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv
$ACR_PASSWORD = az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query "passwords[0].value" -o tsv

Write-Host "✅ Azure Container Registry créé" -ForegroundColor Green
Write-Host "   Login Server: $ACR_LOGIN_SERVER" -ForegroundColor Gray
Write-Host ""

# Se connecter à ACR et pousser les images
Write-Host "📋 Étape 4/9 : Push des images Docker vers ACR..." -ForegroundColor Cyan
Write-Host "   Cette étape peut prendre 5-10 minutes..." -ForegroundColor Yellow

az acr login --name $ACR_NAME

# Tag et push backend
docker tag fridgepro-backend:latest ${ACR_LOGIN_SERVER}/backend:latest
docker push ${ACR_LOGIN_SERVER}/backend:latest

# Tag et push frontend
docker tag fridgepro-frontend:latest ${ACR_LOGIN_SERVER}/frontend:latest
docker push ${ACR_LOGIN_SERVER}/frontend:latest

Write-Host "✅ Images Docker poussées vers ACR" -ForegroundColor Green
Write-Host ""

# Créer PostgreSQL Flexible Server
Write-Host "📋 Étape 5/9 : Création du serveur PostgreSQL..." -ForegroundColor Cyan
Write-Host "   Cette étape peut prendre 5-10 minutes..." -ForegroundColor Yellow

az postgres flexible-server create `
    --resource-group $RESOURCE_GROUP `
    --name $DB_SERVER_NAME `
    --location $LOCATION `
    --admin-user $DB_ADMIN_USER `
    --admin-password $DB_ADMIN_PASSWORD `
    --sku-name Standard_B1ms `
    --tier Burstable `
    --version 16 `
    --storage-size 32 `
    --public-access 0.0.0.0-255.255.255.255 | Out-Null

# Créer la base de données
az postgres flexible-server db create `
    --resource-group $RESOURCE_GROUP `
    --server-name $DB_SERVER_NAME `
    --database-name $DB_NAME | Out-Null

$DB_HOST = "${DB_SERVER_NAME}.postgres.database.azure.com"
$DATABASE_URL = "postgresql://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?sslmode=require"

Write-Host "✅ Serveur PostgreSQL créé" -ForegroundColor Green
Write-Host "   Host: $DB_HOST" -ForegroundColor Gray
Write-Host ""

# Créer App Service Plan
Write-Host "📋 Étape 6/9 : Création de l'App Service Plan..." -ForegroundColor Cyan
az appservice plan create `
    --name $APP_PLAN_NAME `
    --resource-group $RESOURCE_GROUP `
    --location $LOCATION `
    --is-linux `
    --sku B1 | Out-Null

Write-Host "✅ App Service Plan créé" -ForegroundColor Green
Write-Host ""

# Créer Backend Web App
Write-Host "📋 Étape 7/9 : Création du Backend Web App..." -ForegroundColor Cyan

az webapp create `
    --resource-group $RESOURCE_GROUP `
    --plan $APP_PLAN_NAME `
    --name $BACKEND_APP_NAME `
    --deployment-container-image-name ${ACR_LOGIN_SERVER}/backend:latest | Out-Null

# Configurer le container registry
az webapp config container set `
    --name $BACKEND_APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --docker-custom-image-name ${ACR_LOGIN_SERVER}/backend:latest `
    --docker-registry-server-url https://${ACR_LOGIN_SERVER} `
    --docker-registry-server-user $ACR_USERNAME `
    --docker-registry-server-password $ACR_PASSWORD | Out-Null

# Configurer les app settings
az webapp config appsettings set `
    --resource-group $RESOURCE_GROUP `
    --name $BACKEND_APP_NAME `
    --settings `
        DATABASE_URL=$DATABASE_URL `
        JWT_SECRET=$JWT_SECRET `
        PORT="8080" `
        NODE_ENV="production" `
        WEBSITES_PORT="8080" | Out-Null

$BACKEND_URL = "https://${BACKEND_APP_NAME}.azurewebsites.net"

Write-Host "✅ Backend Web App créé" -ForegroundColor Green
Write-Host "   URL: $BACKEND_URL" -ForegroundColor Gray
Write-Host ""

# Créer Frontend Web App
Write-Host "📋 Étape 8/9 : Création du Frontend Web App..." -ForegroundColor Cyan

az webapp create `
    --resource-group $RESOURCE_GROUP `
    --plan $APP_PLAN_NAME `
    --name $FRONTEND_APP_NAME `
    --deployment-container-image-name ${ACR_LOGIN_SERVER}/frontend:latest | Out-Null

# Configurer le container registry
az webapp config container set `
    --name $FRONTEND_APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --docker-custom-image-name ${ACR_LOGIN_SERVER}/frontend:latest `
    --docker-registry-server-url https://${ACR_LOGIN_SERVER} `
    --docker-registry-server-user $ACR_USERNAME `
    --docker-registry-server-password $ACR_PASSWORD | Out-Null

# Configurer les app settings
az webapp config appsettings set `
    --resource-group $RESOURCE_GROUP `
    --name $FRONTEND_APP_NAME `
    --settings `
        VITE_API_URL=$BACKEND_URL `
        WEBSITES_PORT="80" | Out-Null

$FRONTEND_URL = "https://${FRONTEND_APP_NAME}.azurewebsites.net"

Write-Host "✅ Frontend Web App créé" -ForegroundColor Green
Write-Host "   URL: $FRONTEND_URL" -ForegroundColor Gray
Write-Host ""

# Initialiser la base de données
Write-Host "📋 Étape 9/9 : Initialisation de la base de données..." -ForegroundColor Cyan
Write-Host "   ⚠️  Vous devrez exécuter manuellement les commandes suivantes via SSH:" -ForegroundColor Yellow
Write-Host "   1. az webapp ssh --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP" -ForegroundColor Yellow
Write-Host "   2. cd /app && npx prisma migrate deploy && npm run db:seed" -ForegroundColor Yellow
Write-Host ""

# Résumé
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "🎉 DÉPLOIEMENT TERMINÉ !" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Informations de déploiement :" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 URLs de l'application :" -ForegroundColor White
Write-Host "   Frontend:  $FRONTEND_URL" -ForegroundColor Green
Write-Host "   Backend:   $BACKEND_URL" -ForegroundColor Green
Write-Host "   Health:    $BACKEND_URL/api/health" -ForegroundColor Green
Write-Host ""
Write-Host "🗄️  Base de données :" -ForegroundColor White
Write-Host "   Host:      $DB_HOST" -ForegroundColor Green
Write-Host "   Database:  $DB_NAME" -ForegroundColor Green
Write-Host "   Username:  $DB_ADMIN_USER" -ForegroundColor Green
Write-Host "   Password:  $DB_ADMIN_PASSWORD" -ForegroundColor Green
Write-Host ""
Write-Host "🐳 Container Registry :" -ForegroundColor White
Write-Host "   Server:    $ACR_LOGIN_SERVER" -ForegroundColor Green
Write-Host "   Username:  $ACR_USERNAME" -ForegroundColor Green
Write-Host "   Password:  $ACR_PASSWORD" -ForegroundColor Green
Write-Host ""
Write-Host "👥 Comptes de test :" -ForegroundColor White
Write-Host "   demo@fridgepro.com / demo123" -ForegroundColor Green
Write-Host "   test@fridgepro.com / test123" -ForegroundColor Green
Write-Host "   admin@fridgepro.com / admin123" -ForegroundColor Green
Write-Host ""
Write-Host "💰 Coûts estimés : ~38-40€/mois" -ForegroundColor Yellow
Write-Host ""
Write-Host "🚨 N'OUBLIEZ PAS :" -ForegroundColor Red
Write-Host "   1. Initialiser la base de données via SSH (voir instructions ci-dessus)" -ForegroundColor Yellow
Write-Host "   2. Tester l'application" -ForegroundColor Yellow
Write-Host "   3. Prendre des captures d'écran pour la présentation" -ForegroundColor Yellow
Write-Host "   4. Arrêter les ressources quand non utilisées pour économiser" -ForegroundColor Yellow
Write-Host "   5. Supprimer le Resource Group après la présentation" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Commandes utiles :" -ForegroundColor Cyan
Write-Host "   Arrêter: az webapp stop --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP" -ForegroundColor Gray
Write-Host "   Démarrer: az webapp start --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP" -ForegroundColor Gray
Write-Host "   Logs: az webapp log tail --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP" -ForegroundColor Gray
Write-Host "   Supprimer: az group delete --name $RESOURCE_GROUP --yes" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green

# Sauvegarder les informations dans un fichier
$deploymentInfo = @"
DÉPLOIEMENT FRIDGE PRO - $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
═══════════════════════════════════════════════════════════

URLs:
  Frontend: $FRONTEND_URL
  Backend:  $BACKEND_URL
  Health:   $BACKEND_URL/api/health

Database:
  Host:     $DB_HOST
  Database: $DB_NAME
  Username: $DB_ADMIN_USER
  Password: $DB_ADMIN_PASSWORD

Container Registry:
  Server:   $ACR_LOGIN_SERVER
  Username: $ACR_USERNAME
  Password: $ACR_PASSWORD

Resource Group: $RESOURCE_GROUP
Location: $LOCATION

Test Accounts:
  demo@fridgepro.com / demo123
  test@fridgepro.com / test123
  admin@fridgepro.com / admin123
"@

$deploymentInfo | Out-File -FilePath "azure-deployment-info.txt" -Encoding UTF8
Write-Host "💾 Informations sauvegardées dans: azure-deployment-info.txt" -ForegroundColor Green
Write-Host ""
