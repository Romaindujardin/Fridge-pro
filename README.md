# Tuto for deployement on Azure

### Accès au dossier terraform où on défini le IaC, initialisation et application

```
cd ./terraform/
```

```
export ARM_SUBSCRIPTION_ID="<votre numéro id azure>" && terraform init
```

```
export ARM_SUBSCRIPTION_ID="<votre numéro id azure>" && terraform apply
```

### copier les outputs

```
terraform output -raw database_url_connection_string
```

### Exemple de sortie

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

```
az account show --query id -o tsv
```

### (copier tout ce qu'il y a apres le postgresql://fridgeadmin... !sans le %!)

```
export DATABASE_URL='<l'url de la databse que vous venez de copier>'
```

### prenez votre ip ici "https://www.whatismyip.com"

```
az postgres flexible-server firewall-rule create \
 --resource-group <nom du ressource group> \
 --name <nom de la db> \
 --rule-name allow-my-ip \
 --start-ip-address <votre IP> \
 --end-ip-address <votre IP>
```

## Deploiement de la DB

```
cd ..
```

```
cd ./Fridge\ Pro/
```

```
cd backend
```

```
npx prisma migrate deploy
/ Optionnel : npx prisma db seed pour le peuplement
```

## Deploiement du backend

### On build le backend et on zip le dossier

```
npm install
npm run build
mkdir deploy_temp
cp -r dist prisma package.json package-lock.json deploy_temp/
cd deploy_temp
npm install --omit=dev
zip -r ../backend.zip .
cd ..
rm -rf deploy_temp
```

### On deploie sur azure le dossier du backend zippé

```
az webapp deploy \
 --resource-group <nom du ressource group> \
 --name <nom du backend> \
 --src-path backend.zip \
 --type zip
```

## Frontend

```
cd ..
```

```
cd ./frontend/
```

### On compile le code

```
export VITE_API_URL="<url du backend>"
npm run build
```

### On crée un fichier zip du dossier frontend compilé

```
mkdir deploy_front
cp -r dist server.js package.json package-lock.json deploy_front/
cd deploy_front
npm install --omit=dev
zip -r ../frontend.zip .
cd ..
rm -rf deploy_front
```

### Et on deploie le fichier zip pour le frontend

```
az webapp deploy \
 --resource-group <nom du ressource group> \
 --name <nom du frontend> \
 --src-path frontend.zip \
 --type zip
```

### On remets la configuration CORS qui bloquait precedement

```
az webapp cors add \
 --resource-group <nom du ressource group> \
 --name <nom du backend> \
 --allowed-origins "<url du frontend>"
```
