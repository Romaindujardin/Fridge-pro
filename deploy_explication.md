# Explication détaillée du déploiement sur Azure

Ce document retrace l'intégralité des étapes mises en œuvre pour déployer l'application Fridge Pro sur Azure, les choix techniques, les commandes utilisées et les modifications apportées au code source original.

## 1. Architecture Technique

Pour héberger cette application "Fullstack" (React + Node.js + PostgreSQL), nous avons opté pour l'architecture suivante sur Azure :

*   **Région** : `Italy North` (choisie pour sa compatibilité et ses coûts réduits, suite à la demande de restriction géographique).
*   **Resource Group** : `fridge-pro-prod-rg`.
*   **Backend API** : Hébergé sur **Azure App Service (Web App)** sous Linux (Plan B1).
    *   Runtime : Node.js 20 LTS.
    *   Permet d'exécuter un serveur Express.js persistant.
*   **Frontend** : Hébergé également sur **Azure App Service (Web App)** sous Linux (Plan B1).
    *   Bien que ce soit une application React statique, nous l'hébergeons via un serveur Node.js léger (`express`) pour plus de flexibilité et pour s'aligner sur le même plan de service que le backend (économie de ressources).
*   **Base de Données** : **Azure Database for PostgreSQL - Flexible Server**.
    *   Version 16.
    *   Tier B1ms (Burstable, économique pour le développement/prod légère).
    *   SSL forcé par défaut.

## 2. Infrastructure as Code (Terraform)

L'infrastructure a été entièrement provisionnée via Terraform pour garantir la reproductibilité.

### Fichiers créés (`terraform/`)
*   `main.tf` : Définition des ressources (Web Apps, Plan, Postgres, Firewall).
*   `variables.tf` : Paramètres configurables (région, nom du projet, credentials admin DB).
*   `versions.tf` : Configuration du provider `azurerm`.
*   `outputs.tf` : Export des URLs et secrets générés.

### Points clés de la configuration
*   **Authentification** : Utilisation de l'Azure CLI local (`az login`) pour éviter la complexité d'un Service Principal.
*   **Secrets** : Les mots de passe de la base de données et le secret JWT (`JWT_SECRET`) sont générés aléatoirement par Terraform (`random_password`) et injectés directement dans les variables d'environnement des App Services (`app_settings`).

### Commandes Terraform utilisées
```bash
cd terraform
terraform init      # Initialisation des plugins
terraform apply     # Création des ressources
terraform output    # Récupération des URLs et infos de connexion
```

## 3. Modifications du Code Source

Pour rendre l'application "Cloud Ready", plusieurs ajustements ont été nécessaires.

### Backend (`Fridge Pro/backend`)

1.  **Support Binaire Linux pour Prisma** (`prisma/schema.prisma`) :
    *   Ajout de `binaryTargets = ["native", "debian-openssl-3.0.x"]`.
    *   **Pourquoi ?** Le développement se fait sur macOS ("native"), mais Azure Web Apps tourne sous Linux Debian. Sans cela, Prisma plante au démarrage car il ne trouve pas le bon moteur de base de données.

2.  **Scripts de build** (`package.json`) :
    *   Ajout de `"postinstall": "prisma generate"`.
    *   **Pourquoi ?** Pour s'assurer que le client Prisma est régénéré automatiquement à chaque installation de dépendances.

3.  **Déplacement des dépendances** (`package.json`) :
    *   `prisma`, `typescript`, `tsx` déplacés de `devDependencies` vers `dependencies`.
    *   **Pourquoi ?** Azure (en mode déploiement zip avec build désactivé) a besoin de ces outils pour exécuter l'application en production, et pas seulement pour le développement.

### Frontend (`Fridge Pro/frontend`)

1.  **Serveur de Production** (`server.js`) :
    *   Création d'un serveur Express minimaliste pour servir les fichiers statiques du dossier `dist`.
    *   **Pourquoi ?** Une Web App Node.js a besoin d'un processus actif (`node server.js`). React seul ne produit que des fichiers HTML/JS statiques.

2.  **Configuration API dynamique** (`src/services/api.ts`) :
    *   Modification : `baseURL: import.meta.env.VITE_API_URL ? ${import.meta.env.VITE_API_URL}/api : "/api"`.
    *   **Pourquoi ?** En local, on utilise un proxy (`/api`). En production, le frontend est sur un domaine différent du backend, il faut donc pointer vers l'URL complète de l'API Azure.

3.  **Script de démarrage** (`package.json`) :
    *   Ajout de `"start": "node server.js"`.
    *   **Pourquoi ?** C'est la commande par défaut que Azure cherche pour lancer l'application.

## 4. Processus de Déploiement (Manuel & Automatisé par scripts)

Nous avons rencontré plusieurs défis liés au build automatique sur Azure (Oryx) qui échouait à cause de la structure monorepo complexe. Nous avons opté pour une stratégie de **"Build Local, Deploy Artifact"**.

### Stratégie Backend

1.  **Build Local** : Compilation TypeScript en JavaScript (`npm run build` -> dossier `dist`).
2.  **Packaging Complet** :
    *   Création d'une archive ZIP contenant : `dist`, `package.json`, `prisma` **ET** `node_modules`.
    *   **Pourquoi inclure node_modules ?** Pour contourner les problèmes d'installation de dépendances sur Azure (conflits de workspace npm, timeouts). Nous installons les dépendances de production localement (`npm install --production`) et les envoyons telles quelles.
3.  **Configuration Azure** :
    *   `SCM_DO_BUILD_DURING_DEPLOYMENT=false` : On dit à Azure "Ne touche à rien, exécute juste ce que je t'envoie".
4.  **Déploiement** :
    ```bash
    az webapp deploy --resource-group <RG> --name <APP_NAME> --src-path backend.zip --type zip
    ```
5.  **Base de Données** :
    *   Whitelist de l'IP locale temporaire dans le Firewall Azure.
    *   Exécution de `npx prisma migrate deploy` depuis la machine locale vers la DB distante.

### Stratégie Frontend

1.  **Build Local** :
    *   `export VITE_API_URL="https://<BACKEND_URL>"`
    *   `npm run build` -> Génère le dossier `dist` optimisé avec les bonnes URLs.
2.  **Packaging** :
    *   ZIP contenant : `dist`, `server.js` (le serveur express), `package.json`.
3.  **Déploiement** :
    *   Même méthode que le backend (`az webapp deploy`).
    *   Azure installe automatiquement `express` car il est listé dans `package.json` (build léger côté serveur possible ici, ou inclusion de node_modules comme on l'a fait pour sécuriser le coup).

## 5. Résumé des Commandes Clés

Voici les commandes "magiques" qui ont permis de stabiliser le déploiement :

**Backend :**
```bash
# Préparer l'archive avec tout le nécessaire
zip -r backend-final.zip dist node_modules package.json prisma

# Désactiver le build Azure (source de conflits)
az webapp config appsettings set ... --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false

# Déployer
az webapp deploy ... --src-path backend-final.zip
```

**Frontend :**
```bash
# Build avec la bonne variable d'environnement
export VITE_API_URL="..."
npm run build

# Déployer
az webapp deploy ... --src-path frontend-final.zip
```

## 6. Problèmes Résolus

*   **Erreur "Cannot find module express"** : Résolu en incluant `node_modules` dans le zip de déploiement.
*   **Erreur "Route not found /auth/login"** : Résolu en corrigeant `api.ts` pour qu'il ajoute dynamiquement `/api` à l'URL de base en production.
*   **Erreur Prisma "Query engine not found"** : Résolu en ajoutant `binaryTargets` Linux dans le schéma Prisma.

