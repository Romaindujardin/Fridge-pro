# Tuto for deployement on Azure

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

### (copier tout ce qu'il y a apres le postgresql://fridgeadmin... !sans le %!)

```
export DATABASE_URL='<l'url de la databse que vous venez de copier>'
```

### prenez votre ip ici "https://www.whatismyip.com"

```
az postgres flexible-server firewall-rule create \
 --resource-group fridge-pro-prod-rg \
 --name fridge-pro-db-xpeyok \
 --rule-name allow-my-ip \
 --start-ip-address <votre IP> \
 --end-ip-address <votre IP>
```

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

```
az webapp deploy \
 --resource-group fridge-pro-prod-rg \
 --name fridge-pro-api-xpeyok \
 --src-path backend.zip \
 --type zip
```

```
cd ..
```

```
cd ./frontend/
```

```
export VITE_API_URL="<url du backend>"
npm run build
```

```
mkdir deploy_front
cp -r dist server.js package.json package-lock.json deploy_front/
cd deploy_front
npm install --omit=dev
zip -r ../frontend.zip .
cd ..
rm -rf deploy_front
```

```
az webapp deploy \
 --resource-group fridge-pro-prod-rg \
 --name fridge-pro-web-xpeyok \
 --src-path frontend.zip \
 --type zip
```

```
az webapp cors add \
 --resource-group fridge-pro-prod-rg \
 --name fridge-pro-api-xpeyok \
 --allowed-origins "<url du frontend>"
```
