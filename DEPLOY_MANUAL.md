# Déploiement Manuel sur Azure (Mise à jour)

Ce guide explique comment déployer l'application Fridge Pro sur Azure. L'infrastructure utilise **2 Web Apps Linux** (une pour le backend, une pour le frontend) et une base de données PostgreSQL.

## Prérequis

1.  **Azure CLI** installé et authentifié (`az login`).
2.  **Terraform** installé.
3.  **Node.js** (version 20 recommandée).
4.  **Zip** installé.

## Étape 1 : Infrastructure (Terraform)

_Cette étape a normalement déjà été faite par l'assistant._

1.  Allez dans le dossier `terraform`.
2.  Récupérez les informations de déploiement :
    ```bash
    cd terraform
    terraform output
    ```
    _Notez les noms des Web Apps (`backend_app_name`, `frontend_app_name`) et l'URL du backend._

## Étape 2 : Base de Données

1.  Autorisez votre IP pour la migration :

    ```bash
    # Remplacez par les valeurs de votre déploiement
    az postgres flexible-server firewall-rule create \
      --resource-group fridge-pro-prod-rg \
      --name <DB_SERVER_NAME> \
      --rule-name allow-my-ip \
      --start-ip-address <VOTRE_IP> \
      --end-ip-address <VOTRE_IP>
    ```

2.  Migration (depuis `Fridge Pro/backend`) :

    ```bash
    # Définir l'URL de connexion (voir output terraform 'database_url_connection_string')
    # Attention aux caractères spéciaux, mettez la valeur entre quotes simples
    export DATABASE_URL='<VALEUR_OUTPUT>'

    cd "Fridge Pro/backend"
    npx prisma migrate deploy
    # Optionnel : npx prisma db seed
    ```

## Étape 3 : Déploiement Backend

1.  Allez dans `Fridge Pro/backend`.
2.  Installez et Buildez :
    ```bash
    npm install
    npm run build
    ```
3.  Générez le lockfile (important pour Azure) :
    ```bash
    npm install --package-lock-only --no-workspaces
    ```
4.  Zippez et Déployez :

    ```bash
    # Création de l'archive (exclut node_modules pour laisser Azure installer)
    zip -r backend.zip dist package.json package-lock.json prisma

    # Déploiement
    az webapp deploy \
      --resource-group fridge-pro-prod-rg \
      --name <BACKEND_APP_NAME> \
      --src-path backend.zip \
      --type zip
    ```

## Étape 4 : Déploiement Frontend

Le frontend est hébergé sur une Web App Node.js qui sert les fichiers statiques via un serveur Express.

1.  Allez dans `Fridge Pro/frontend`.
2.  Installez et Buildez :

    ```bash
    # Remplacez par l'URL de VOTRE backend (https://<backend_app_name>.azurewebsites.net)
    export VITE_API_URL="https://<BACKEND_APP_NAME>.azurewebsites.net"

    npm install
    npm run build
    ```

3.  Zippez et Déployez :

    ```bash
    # Nous incluons dist, le serveur et package.json. Azure installera express.
    zip -r frontend.zip dist server.js package.json package-lock.json

    # Déploiement
    az webapp deploy \
      --resource-group fridge-pro-prod-rg \
      --name <FRONTEND_APP_NAME> \
      --src-path frontend.zip \
      --type zip
    ```

## Vérification

Accédez à l'URL du Frontend (`https://<FRONTEND_APP_NAME>.azurewebsites.net`).

### Dépannage

Si une application ne démarre pas ("Application Error") :

1.  Allez sur le portail Azure > App Service > Log Stream.
2.  Ou utilisez la commande : `az webapp log tail --name <APP_NAME> --resource-group fridge-pro-prod-rg`.
3.  Assurez-vous que `package-lock.json` est bien présent dans le zip si Azure doit installer les dépendances.
