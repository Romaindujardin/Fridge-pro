# 🎨 Diagrammes et Visuels - Fridge Pro Cloud

Ce fichier contient des diagrammes ASCII art et des visuels pour votre présentation.

---

## 📊 Architecture Cloud Azure

### Vue d'ensemble complète

```
┌─────────────────────────────────────────────────────────────────────┐
│                            🌐 Internet                               │
│                     (Utilisateurs du monde entier)                   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                         ☁️  Microsoft Azure                          │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               🌐 Azure Front Door (Optionnel)               │   │
│  │        CDN Global | WAF | Load Balancing                    │   │
│  └──────────────────────┬──────────────────────────────────────┘   │
│                         │                                           │
│         ┌───────────────┴───────────────┐                           │
│         │                               │                           │
│  ┌──────▼────────┐              ┌──────▼────────┐                  │
│  │  📱 Frontend  │              │  ⚙️  Backend  │                  │
│  │  App Service  │              │  App Service  │                  │
│  ├───────────────┤              ├───────────────┤                  │
│  │ 🐳 Container  │              │ 🐳 Container  │                  │
│  │ Nginx + React │◄─────────────┤ Node.js + API │                  │
│  │               │   API calls  │               │                  │
│  ├───────────────┤              ├───────────────┤                  │
│  │ B1: 1 vCPU    │              │ B1: 1 vCPU    │                  │
│  │     1.75 GB   │              │     1.75 GB   │                  │
│  │ Auto-scaling  │              │ Auto-scaling  │                  │
│  └───────────────┘              └───────┬───────┘                  │
│         │                               │                           │
│         │                               ├──────────────┐            │
│         │                               │              │            │
│         │                      ┌────────▼───────┐  ┌──▼─────────┐  │
│         │                      │  🗄️  PostgreSQL│  │ 📦 Blob    │  │
│         │                      │  Flexible      │  │  Storage   │  │
│         │                      │  Server        │  │            │  │
│         │                      ├────────────────┤  ├────────────┤  │
│         │                      │ Version: 16    │  │ Container: │  │
│         │                      │ Storage: 32 GB │  │  - uploads │  │
│         │                      │ Backup: 7 days │  │  - static  │  │
│         │                      │ SSL required   │  │ LRS, Hot   │  │
│         │                      └────────────────┘  └────────────┘  │
│         │                                                           │
│  ┌──────▼──────────────────────────────────────────────────────┐   │
│  │            📦 Azure Container Registry (ACR)                │   │
│  │  ┌────────────────────┐    ┌────────────────────┐          │   │
│  │  │ backend:latest     │    │ frontend:latest    │          │   │
│  │  │ backend:sha-xxxxx  │    │ frontend:sha-xxxxx │          │   │
│  │  └────────────────────┘    └────────────────────┘          │   │
│  │           Private Registry | Webhook to App Services       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              🌐 Virtual Network (10.0.0.0/16)               │   │
│  │  ┌─────────────────────┐  ┌─────────────────────┐          │   │
│  │  │ App Subnet          │  │ DB Subnet           │          │   │
│  │  │ 10.0.1.0/24         │  │ 10.0.2.0/24         │          │   │
│  │  │ - App Services      │  │ - PostgreSQL        │          │   │
│  │  └─────────────────────┘  └─────────────────────┘          │   │
│  │                                                              │   │
│  │  🔒 Private DNS Zone: fridgepro-postgres.postgres.database  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Pipeline CI/CD

### Workflow de déploiement automatique

```
┌─────────────────────────────────────────────────────────────────┐
│                     👨‍💻 Développeur                               │
└────────┬────────────────────────────────────────────────────────┘
         │
         │ git push origin main
         │
┌────────▼───────────────────────────────────────────────────────┐
│                     📦 GitHub Repository                        │
│                    (Code source versionné)                      │
└────────┬───────────────────────────────────────────────────────┘
         │
         │ Webhook trigger
         │
┌────────▼───────────────────────────────────────────────────────┐
│                   🔧 GitHub Actions Workflow                    │
│                                                                 │
│  ÉTAPE 1: Tests ✅                                              │
│  ├─ Backend tests                                              │
│  │  ├─ Checkout code                                           │
│  │  ├─ Setup Node.js 18                                        │
│  │  ├─ npm ci (install dependencies)                           │
│  │  ├─ Generate Prisma Client                                  │
│  │  ├─ npm run lint                                            │
│  │  └─ npm run build                                           │
│  │                                                              │
│  └─ Frontend tests                                             │
│     ├─ Checkout code                                           │
│     ├─ Setup Node.js 18                                        │
│     ├─ npm ci (install dependencies)                           │
│     ├─ npm run lint                                            │
│     └─ npm run build                                           │
│                                                                 │
│  ÉTAPE 2: Build Docker 🐳                                       │
│  ├─ Login to Azure                                             │
│  ├─ Login to ACR                                               │
│  ├─ Build backend image                                        │
│  │  └─ Tag: latest + SHA                                       │
│  ├─ Build frontend image                                       │
│  │  └─ Tag: latest + SHA                                       │
│  ├─ Push backend to ACR                                        │
│  └─ Push frontend to ACR                                       │
│                                                                 │
│  ÉTAPE 3: Deploy ☁️                                             │
│  ├─ Deploy backend to App Service                              │
│  │  └─ Pull image from ACR                                     │
│  ├─ Deploy frontend to App Service                             │
│  │  └─ Pull image from ACR                                     │
│  └─ Health checks                                              │
│     ├─ Check backend /api/health                               │
│     └─ Check frontend /health                                  │
│                                                                 │
└────────┬───────────────────────────────────────────────────────┘
         │
         │ ✅ Deployment successful!
         │
┌────────▼───────────────────────────────────────────────────────┐
│                    🌐 Application en production                 │
│                 (Accessible aux utilisateurs)                   │
└─────────────────────────────────────────────────────────────────┘
```

**Temps total** : ~10 minutes  
**Fréquence** : À chaque push sur `main`

---

## 🏗️ Infrastructure as Code (Terraform)

### Structure des fichiers

```
infrastructure/terraform/
│
├── 📄 main.tf
│   ├─ Provider azurerm
│   ├─ Resource Group
│   ├─ Virtual Network (10.0.0.0/16)
│   │  ├─ App Subnet (10.0.1.0/24)
│   │  └─ DB Subnet (10.0.2.0/24)
│   └─ Private DNS Zone
│
├── 📄 database.tf
│   ├─ PostgreSQL Flexible Server
│   │  ├─ Version: 16
│   │  ├─ SKU: B_Standard_B1ms
│   │  ├─ Storage: 32 GB
│   │  └─ Backup: 7 days
│   ├─ Database: fridge_pro
│   ├─ Firewall rules
│   └─ Configuration
│
├── 📄 storage.tf
│   ├─ Storage Account
│   │  ├─ Type: StorageV2
│   │  ├─ Replication: LRS
│   │  └─ Tier: Hot
│   ├─ Container: uploads
│   └─ Container: static
│
├── 📄 compute.tf
│   ├─ Container Registry (ACR)
│   │  ├─ SKU: Basic
│   │  └─ Admin enabled
│   ├─ App Service Plan
│   │  ├─ OS: Linux
│   │  └─ SKU: B1
│   ├─ Backend App Service
│   │  ├─ Container: backend:latest
│   │  ├─ Environment vars
│   │  └─ Health check
│   ├─ Frontend App Service
│   │  ├─ Container: frontend:latest
│   │  ├─ Environment vars
│   │  └─ Health check
│   └─ VNet Integration
│
├── 📄 variables.tf
│   ├─ project_name
│   ├─ environment
│   ├─ location
│   ├─ db_admin_username
│   ├─ db_admin_password
│   ├─ jwt_secret
│   └─ ...
│
└── 📄 outputs.tf
    ├─ frontend_url
    ├─ backend_url
    ├─ database_fqdn
    ├─ acr_login_server
    └─ ...
```

### Workflow Terraform

```
┌─────────────────┐
│ terraform init  │  Initialise les providers
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ terraform plan  │  Prévisualise les changements
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ terraform apply │  Applique les changements
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Infrastructure  │  ✅ Déployée sur Azure
│    déployée     │
└─────────────────┘
```

---

## 🐳 Docker & Conteneurisation

### Architecture des containers

```
┌────────────────────────────────────────────────────────────┐
│                    🐳 Docker Compose                       │
│                    (Environnement local)                   │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Frontend    │  │  Backend     │  │  Database    │   │
│  │  Container   │  │  Container   │  │  Container   │   │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤   │
│  │ Nginx        │  │ Node.js 18   │  │ PostgreSQL   │   │
│  │ + React SPA  │  │ + Express    │  │ 16-alpine    │   │
│  │              │  │ + Prisma     │  │              │   │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤   │
│  │ Port: 80     │  │ Port: 5000   │  │ Port: 5432   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │            │
│         └─────────────────┴─────────────────┘            │
│                     fridge-network                        │
│                      (Bridge driver)                      │
│                                                            │
│  Volumes:                                                 │
│  ├─ postgres_data (Database persistence)                 │
│  └─ backend_uploads (File uploads)                       │
└────────────────────────────────────────────────────────────┘
```

### Build process

```
Backend Dockerfile                 Frontend Dockerfile
┌─────────────────┐               ┌─────────────────┐
│ FROM node:18    │               │ FROM node:18    │
│                 │               │                 │
│ WORKDIR /app    │               │ WORKDIR /app    │
│                 │               │                 │
│ COPY package*.  │               │ COPY package*.  │
│                 │               │                 │
│ RUN npm ci      │               │ RUN npm ci      │
│                 │               │                 │
│ COPY . .        │               │ COPY . .        │
│                 │               │                 │
│ RUN prisma gen  │               │ RUN npm build   │
│                 │               │                 │
│ RUN npm build   │               │ FROM nginx      │
│                 │               │                 │
│ EXPOSE 5000     │               │ COPY nginx.conf │
│                 │               │                 │
│ CMD npm start   │               │ COPY dist/      │
└─────────────────┘               │                 │
                                  │ EXPOSE 80       │
                                  │                 │
                                  │ CMD nginx       │
                                  └─────────────────┘
```

---

## 📊 Flux de données

### De l'utilisateur à la base de données

```
┌───────────────┐
│  🧑 User      │
│  (Browser)    │
└───────┬───────┘
        │
        │ 1. HTTP Request
        │    GET /api/ingredients
        │
┌───────▼─────────────────────────────────────────────┐
│  🌐 Frontend App Service (Nginx)                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ 2. Nginx routes /api/* to backend          │   │
│  │    Proxy to http://backend:5000            │   │
│  └─────────────────────────────────────────────┘   │
└───────┬─────────────────────────────────────────────┘
        │
        │ 3. Proxied request
        │
┌───────▼─────────────────────────────────────────────┐
│  ⚙️  Backend App Service (Node.js)                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ 4. Express route handler                   │   │
│  │    /api/ingredients -> controller          │   │
│  │                                             │   │
│  │ 5. JWT authentication middleware            │   │
│  │    Verify token                            │   │
│  │                                             │   │
│  │ 6. Prisma ORM query                        │   │
│  │    prisma.ingredient.findMany()            │   │
│  └─────────────────────────────────────────────┘   │
└───────┬─────────────────────────────────────────────┘
        │
        │ 7. SQL Query
        │    SELECT * FROM "Ingredient"
        │
┌───────▼─────────────────────────────────────────────┐
│  🗄️  PostgreSQL Flexible Server                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 8. Execute query                           │   │
│  │    Query planner                           │   │
│  │    Execute                                  │   │
│  │    Return results                          │   │
│  └─────────────────────────────────────────────┘   │
└───────┬─────────────────────────────────────────────┘
        │
        │ 9. Results (JSON)
        │    [{id: 1, name: "Tomate", ...}, ...]
        │
┌───────▼─────────────────────────────────────────────┐
│  ⚙️  Backend (Response)                              │
│  ┌─────────────────────────────────────────────┐   │
│  │ 10. Format response                        │   │
│  │     JSON serialization                     │   │
│  │     Add headers                            │   │
│  └─────────────────────────────────────────────┘   │
└───────┬─────────────────────────────────────────────┘
        │
        │ 11. HTTP Response
        │     200 OK + JSON data
        │
┌───────▼─────────────────────────────────────────────┐
│  🌐 Frontend (Nginx proxy back)                     │
└───────┬─────────────────────────────────────────────┘
        │
        │ 12. HTTP Response
        │
┌───────▼───────┐
│  🧑 User      │
│  (Browser)    │
│  React renders│
│  the data     │
└───────────────┘
```

---

## 🔒 Sécurité

### Architecture de sécurité

```
┌─────────────────────────────────────────────────────┐
│                  🌐 Internet                        │
│              (Potentiellement hostile)              │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ HTTPS only (TLS 1.2+)
                       │
┌──────────────────────▼──────────────────────────────┐
│           🛡️  Azure Front Door (Optional)           │
│  ┌─────────────────────────────────────────────┐   │
│  │  • Web Application Firewall (WAF)          │   │
│  │  • DDoS Protection                         │   │
│  │  • SSL/TLS Termination                     │   │
│  │  • Rate limiting                           │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ HTTPS
                       │
┌──────────────────────▼──────────────────────────────┐
│             📱 Frontend App Service                 │
│  ┌─────────────────────────────────────────────┐   │
│  │  Security Headers:                         │   │
│  │  • X-Frame-Options: SAMEORIGIN             │   │
│  │  • X-Content-Type-Options: nosniff         │   │
│  │  • X-XSS-Protection: 1; mode=block         │   │
│  │  • Content-Security-Policy                 │   │
│  │  • Strict-Transport-Security               │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ Internal network
                       │
┌──────────────────────▼──────────────────────────────┐
│              ⚙️  Backend App Service                 │
│  ┌─────────────────────────────────────────────┐   │
│  │  Authentication:                           │   │
│  │  • JWT tokens                              │   │
│  │  • Password hashing (bcrypt)               │   │
│  │  • Token expiration: 7 days                │   │
│  │                                             │   │
│  │  Authorization:                            │   │
│  │  • Role-based access control               │   │
│  │  • Resource ownership validation           │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼───────────────┐   ┌─────────▼────────────────┐
│  🗄️  PostgreSQL      │   │  📦 Blob Storage         │
│  ┌────────────────┐  │   │  ┌──────────────────┐   │
│  │ • Private VNet │  │   │  │ • Private access │   │
│  │ • SSL required │  │   │  │ • SAS tokens     │   │
│  │ • Firewall     │  │   │  │ • Encryption     │   │
│  │ • Encryption   │  │   │  │   at rest        │   │
│  │   at rest      │  │   │  └──────────────────┘   │
│  └────────────────┘  │   └──────────────────────────┘
└──────────────────────┘

Légende:
🛡️  = Protection externe
🔒 = Chiffrement
🔑 = Authentification
🚫 = Contrôle d'accès
```

---

## 💰 Coûts et optimisation

### Répartition des coûts

```
┌──────────────────────────────────────────────────────┐
│         💰 Coûts mensuels - Environnement Dev        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  App Service Plan (B1)                               │
│  ├─ Frontend instance       12.50€  ████████████░░  │
│  └─ Backend instance        12.50€  ████████████░░  │
│  Subtotal:                  25.00€                   │
│                                                      │
│  PostgreSQL (B_Standard_B1ms)                        │
│  ├─ Compute                  8.00€  ██████░░░░░░░░  │
│  ├─ Storage (32 GB)          5.00€  ████░░░░░░░░░░  │
│  └─ Backup                   2.00€  ██░░░░░░░░░░░░  │
│  Subtotal:                  15.00€                   │
│                                                      │
│  Blob Storage (LRS)                                  │
│  ├─ Storage (10 GB)          0.50€  ░░░░░░░░░░░░░░  │
│  └─ Transactions             0.50€  ░░░░░░░░░░░░░░  │
│  Subtotal:                   1.00€                   │
│                                                      │
│  Container Registry (Basic)                          │
│  └─ Registry                 5.00€  ████░░░░░░░░░░  │
│  Subtotal:                   5.00€                   │
│                                                      │
│  Virtual Network                                     │
│  └─ VNet + Subnets           0.00€  GRATUIT         │
│  Subtotal:                   0.00€                   │
│                                                      │
├──────────────────────────────────────────────────────┤
│  TOTAL PAR MOIS:           ~46.00€                   │
│  TOTAL PAR AN:            ~550.00€                   │
└──────────────────────────────────────────────────────┘

💡 Optimisations possibles:
  • Arrêt automatique des envs de dev la nuit: -30%
  • Reserved Instances (1 an): -30%
  • Reserved Instances (3 ans): -50%
  • Scaling down hors pics: -20%
```

### Comparaison tiers

```
┌─────────────┬──────────────┬──────────────┬──────────────┐
│   Tier      │   Dev/Test   │   Staging    │  Production  │
├─────────────┼──────────────┼──────────────┼──────────────┤
│ App Service │ B1           │ S1           │ P1v2         │
│             │ 1 instance   │ 2 instances  │ 3 instances  │
│             │ ~25€/mois    │ ~140€/mois   │ ~360€/mois   │
├─────────────┼──────────────┼──────────────┼──────────────┤
│ PostgreSQL  │ B1ms         │ D2s_v3       │ D4s_v3       │
│             │ Burstable    │ Gen Purpose  │ Gen Purpose  │
│             │ ~15€/mois    │ ~120€/mois   │ ~240€/mois   │
├─────────────┼──────────────┼──────────────┼──────────────┤
│ Storage     │ LRS          │ LRS          │ GRS          │
│             │ Hot          │ Hot          │ Hot          │
│             │ ~1€/mois     │ ~5€/mois     │ ~10€/mois    │
├─────────────┼──────────────┼──────────────┼──────────────┤
│ TOTAL       │ ~46€/mois    │ ~265€/mois   │ ~610€/mois   │
└─────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 📈 Métriques et KPIs

### Dashboard de performance

```
┌───────────────────────────────────────────────────────────┐
│            📊 Métriques de Performance                     │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Response Time (P95)                                      │
│  ├─ Frontend:     300ms  ████████████░░░░░░  (Target: <500ms)
│  ├─ Backend API:  150ms  ██████░░░░░░░░░░░░  (Target: <300ms)
│  └─ Database:      50ms  ███░░░░░░░░░░░░░░░  (Target: <200ms)
│                                                           │
│  Availability (SLA)                                       │
│  ├─ Frontend:   99.95%  ███████████████████  (Target: >99.9%)
│  ├─ Backend:    99.98%  ███████████████████  (Target: >99.9%)
│  └─ Database:   99.99%  ███████████████████  (Target: >99.9%)
│                                                           │
│  Requests per Second                                      │
│  ├─ Peak:         1,200  ███████████████░░░  (Limit: 2,000)
│  ├─ Average:        400  █████░░░░░░░░░░░░  (Normal)
│  └─ Minimum:         50  ██░░░░░░░░░░░░░░░  (Night)
│                                                           │
│  Error Rate                                               │
│  ├─ 4xx errors:   0.5%  ░░░░░░░░░░░░░░░░░░  (Target: <1%)
│  ├─ 5xx errors:   0.1%  ░░░░░░░░░░░░░░░░░░  (Target: <0.5%)
│  └─ Timeouts:     0.0%  ░░░░░░░░░░░░░░░░░░  (Target: <0.1%)
│                                                           │
│  Resource Utilization                                     │
│  ├─ CPU:           45%  ████████░░░░░░░░░░  (Alert: >80%)
│  ├─ Memory:        60%  ████████████░░░░░░  (Alert: >85%)
│  └─ Storage:       30%  ██████░░░░░░░░░░░░  (Alert: >80%)
│                                                           │
└───────────────────────────────────────────────────────────┘

✅ Tous les KPIs sont dans les objectifs!
```

---

## 🎯 Checklist de déploiement

```
📋 Checklist avant déploiement sur Azure

Phase 1: Préparation (1 heure)
  ☐ Compte Azure créé et activé
  ☐ Azure CLI installé et configuré (az --version)
  ☐ Terraform installé (terraform --version)
  ☐ Git configuré avec GitHub
  ☐ Service Principal créé (az ad sp create-for-rbac)
  ☐ Credentials sauvegardés en sécurité

Phase 2: Configuration Terraform (30 min)
  ☐ cd infrastructure/terraform
  ☐ Copie de terraform.tfvars.example
  ☐ Édition de terraform.tfvars (passwords, secrets)
  ☐ terraform init (succès)
  ☐ terraform validate (aucune erreur)
  ☐ terraform plan (review des ressources)

Phase 3: Déploiement Infrastructure (20 min)
  ☐ terraform apply (confirmation et attente)
  ☐ Noter les outputs (URLs, noms de ressources)
  ☐ Vérifier dans Azure Portal
  ☐ Tester la connectivité réseau

Phase 4: Configuration CI/CD (15 min)
  ☐ GitHub → Settings → Secrets
  ☐ Ajout AZURE_CREDENTIALS
  ☐ Ajout AZURE_RESOURCE_GROUP
  ☐ Ajout ACR_NAME
  ☐ Ajout BACKEND_APP_NAME
  ☐ Ajout FRONTEND_APP_NAME
  ☐ Ajout DB_ADMIN_PASSWORD
  ☐ Ajout JWT_SECRET

Phase 5: Premier Déploiement (10 min)
  ☐ git add .
  ☐ git commit -m "Initial cloud deployment"
  ☐ git push origin main
  ☐ Vérifier GitHub Actions (succès)
  ☐ Attendre fin du déploiement

Phase 6: Initialisation Base de Données (5 min)
  ☐ az webapp ssh --name {BACKEND_APP_NAME}
  ☐ npx prisma migrate deploy
  ☐ npm run db:seed
  ☐ exit

Phase 7: Tests et Validation (15 min)
  ☐ Ouvrir l'URL frontend (terraform output)
  ☐ Tester la connexion avec compte demo
  ☐ Vérifier l'affichage des ingrédients
  ☐ Tester l'ajout d'un ingrédient
  ☐ Tester la génération de recettes
  ☐ Vérifier les logs (aucune erreur)

Phase 8: Monitoring (10 min)
  ☐ Configurer les alertes Azure
  ☐ Activer Application Insights (optionnel)
  ☐ Configurer les budgets
  ☐ Documenter les URLs de prod

✅ Déploiement terminé!
   Total time: ~2-3 heures (première fois)
   
🎉 Application en production:
   Frontend: https://fridgepro-frontend-xxx.azurewebsites.net
   Backend:  https://fridgepro-backend-xxx.azurewebsites.net
```

---

**Utilisez ces diagrammes pour votre présentation ! 🎨**
