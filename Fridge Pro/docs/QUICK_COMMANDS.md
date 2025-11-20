# Commandes Rapides - Fridge Pro Azure

## 🚀 Déploiement Rapide
```powershell
# Exécuter le script de déploiement automatique
.\deploy-to-azure.ps1
```

## 🔍 Vérification et Monitoring

### Vérifier l'état des ressources
```powershell
# Lister toutes les ressources du groupe
az resource list --resource-group fridgepro-ken-rg-dev --output table

# Vérifier l'état des Web Apps
az webapp list --resource-group fridgepro-ken-rg-dev --output table

# Vérifier l'état du serveur PostgreSQL
az postgres flexible-server list --resource-group fridgepro-ken-rg-dev --output table
```

### Voir les logs en temps réel
```powershell
# Backend logs
az webapp log tail --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev

# Frontend logs
az webapp log tail --name fridgepro-ken-frontend --resource-group fridgepro-ken-rg-dev
```

### Tester les endpoints
```powershell
# Test backend health
Invoke-WebRequest -Uri "https://fridgepro-ken-backend.azurewebsites.net/api/health" -UseBasicParsing

# Test frontend
Start-Process "https://fridgepro-ken-frontend.azurewebsites.net"
```

## 🔄 Gestion des Apps

### Redémarrer les applications
```powershell
# Redémarrer le backend
az webapp restart --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev

# Redémarrer le frontend
az webapp restart --name fridgepro-ken-frontend --resource-group fridgepro-ken-rg-dev

# Redémarrer les deux
az webapp restart --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev
az webapp restart --name fridgepro-ken-frontend --resource-group fridgepro-ken-rg-dev
```

### Arrêter les applications (pour économiser)
```powershell
# Arrêter le backend
az webapp stop --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev

# Arrêter le frontend
az webapp stop --name fridgepro-ken-frontend --resource-group fridgepro-ken-rg-dev

# Arrêter PostgreSQL
az postgres flexible-server stop --name fridgepro-ken-db --resource-group fridgepro-ken-rg-dev
```

### Démarrer les applications
```powershell
# Démarrer le backend
az webapp start --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev

# Démarrer le frontend
az webapp start --name fridgepro-ken-frontend --resource-group fridgepro-ken-rg-dev

# Démarrer PostgreSQL
az postgres flexible-server start --name fridgepro-ken-db --resource-group fridgepro-ken-rg-dev
```

## 🐳 Mise à jour des Images Docker

### Après modification du code
```powershell
# Retour au dossier principal
cd "C:\Users\SANGLI Kenneth\Documents\Fridge\Fridge-pro\Fridge Pro"

# Récupérer les infos ACR
$ACR_LOGIN_SERVER = az acr show --name <ACR_NAME> --resource-group fridgepro-ken-rg-dev --query loginServer -o tsv

# Se connecter à ACR
az acr login --name <ACR_NAME>

# Reconstruire les images
docker-compose build

# Tag et push backend
docker tag fridgepro-backend:latest ${ACR_LOGIN_SERVER}/backend:latest
docker push ${ACR_LOGIN_SERVER}/backend:latest

# Tag et push frontend
docker tag fridgepro-frontend:latest ${ACR_LOGIN_SERVER}/frontend:latest
docker push ${ACR_LOGIN_SERVER}/frontend:latest

# Redémarrer les apps pour charger les nouvelles images
az webapp restart --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev
az webapp restart --name fridgepro-ken-frontend --resource-group fridgepro-ken-rg-dev
```

## 🗄️ Gestion de la Base de Données

### Se connecter à PostgreSQL
```powershell
# Via psql (si installé)
psql "host=fridgepro-ken-db.postgres.database.azure.com port=5432 dbname=fridge_pro user=fridgeadmin password=FridgePro2025!SecureDB sslmode=require"
```

### Exécuter les migrations via SSH
```powershell
# Se connecter en SSH au backend
az webapp ssh --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev

# Dans le terminal SSH:
cd /app
npx prisma migrate deploy
npm run db:seed
exit
```

### Backup de la base de données
```powershell
# Créer un backup manuel
az postgres flexible-server backup create `
  --resource-group fridgepro-ken-rg-dev `
  --name fridgepro-ken-db `
  --backup-name manual-backup-$(Get-Date -Format "yyyyMMdd-HHmmss")
```

## 📊 Monitoring et Métriques

### Voir les métriques CPU/Memory
```powershell
# Backend metrics
az monitor metrics list `
  --resource "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/fridgepro-ken-rg-dev/providers/Microsoft.Web/sites/fridgepro-ken-backend" `
  --metric "CpuPercentage" "MemoryPercentage" `
  --output table

# Frontend metrics
az monitor metrics list `
  --resource "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/fridgepro-ken-rg-dev/providers/Microsoft.Web/sites/fridgepro-ken-frontend" `
  --metric "CpuPercentage" "MemoryPercentage" `
  --output table
```

### Voir les requêtes HTTP
```powershell
az monitor metrics list `
  --resource "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/fridgepro-ken-rg-dev/providers/Microsoft.Web/sites/fridgepro-ken-backend" `
  --metric "Http2xx" "Http4xx" "Http5xx" `
  --output table
```

## 💰 Gestion des Coûts

### Voir les coûts actuels
```powershell
# Coûts du Resource Group
az consumption usage list `
  --start-date (Get-Date).AddDays(-7).ToString("yyyy-MM-dd") `
  --end-date (Get-Date).ToString("yyyy-MM-dd") `
  --query "[?contains(instanceId, 'fridgepro-ken-rg-dev')]" `
  --output table
```

### Budget Alert (optionnel)
```powershell
# Créer une alerte de budget (50€)
az consumption budget create `
  --resource-group fridgepro-ken-rg-dev `
  --budget-name fridge-pro-budget `
  --amount 50 `
  --time-grain Monthly `
  --start-date (Get-Date).ToString("yyyy-MM-01") `
  --end-date (Get-Date).AddMonths(3).ToString("yyyy-MM-01")
```

## 🔐 Sécurité

### Récupérer les secrets ACR
```powershell
$ACR_NAME = "fridgeprokenacr<NUMBER>"

az acr credential show `
  --name $ACR_NAME `
  --resource-group fridgepro-ken-rg-dev
```

### Récupérer la connection string PostgreSQL
```powershell
az postgres flexible-server show-connection-string `
  --server-name fridgepro-ken-db `
  --database-name fridge_pro `
  --admin-user fridgeadmin `
  --admin-password FridgePro2025!SecureDB
```

## 🧹 Nettoyage

### Supprimer toutes les ressources
```powershell
# Via le script
.\cleanup-azure.ps1

# OU manuellement
az group delete --name fridgepro-ken-rg-dev --yes

# Vérifier la suppression
az group show --name fridgepro-ken-rg-dev
# (Doit retourner une erreur si supprimé)
```

## 📸 Pour la Présentation

### Ouvrir le portail Azure directement sur vos ressources
```powershell
# Ouvrir le Resource Group
Start-Process "https://portal.azure.com/#@/resource/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/fridgepro-ken-rg-dev/overview"

# Ouvrir le backend
Start-Process "https://portal.azure.com/#@/resource/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/fridgepro-ken-rg-dev/providers/Microsoft.Web/sites/fridgepro-ken-backend/appServices"
```

### Télécharger les logs pour analyse
```powershell
# Backend logs
az webapp log download `
  --name fridgepro-ken-backend `
  --resource-group fridgepro-ken-rg-dev `
  --log-file backend-logs.zip

# Frontend logs
az webapp log download `
  --name fridgepro-ken-frontend `
  --resource-group fridgepro-ken-rg-dev `
  --log-file frontend-logs.zip
```

## 🆘 Troubleshooting

### L'application ne démarre pas
```powershell
# 1. Vérifier les logs
az webapp log tail --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev

# 2. Vérifier la configuration
az webapp config appsettings list --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev

# 3. Vérifier le container
az webapp config container show --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev

# 4. Redémarrer
az webapp restart --name fridgepro-ken-backend --resource-group fridgepro-ken-rg-dev
```

### Erreur de connexion à la base de données
```powershell
# Vérifier que le firewall autorise Azure Services
az postgres flexible-server firewall-rule list `
  --resource-group fridgepro-ken-rg-dev `
  --name fridgepro-ken-db

# Tester la connexion
Test-NetConnection -ComputerName fridgepro-ken-db.postgres.database.azure.com -Port 5432
```

### Images Docker non à jour
```powershell
# Forcer le redéploiement
az webapp deployment container config `
  --name fridgepro-ken-backend `
  --resource-group fridgepro-ken-rg-dev `
  --enable-cd true

# Trigger un webhook pour forcer le pull
az webapp deployment container show-cd-url `
  --name fridgepro-ken-backend `
  --resource-group fridgepro-ken-rg-dev
```

---

**Note**: Remplacez `<ACR_NAME>`, `<SUBSCRIPTION_ID>` par vos valeurs réelles.

**Astuce**: Sauvegardez les informations de déploiement dans le fichier `azure-deployment-info.txt` créé par le script de déploiement.
