# 📐 Architecture Cloud - Fridge Pro

## Vue d'ensemble

Fridge Pro est déployé sur **Microsoft Azure** en utilisant une architecture moderne, scalable et sécurisée basée sur des conteneurs Docker et des services managés.

---

## 🏗️ Architecture Technique

### Diagramme d'architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                            Internet                                   │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 │ HTTPS
                                 │
┌────────────────────────────────▼─────────────────────────────────────┐
│                       Azure Front Door (Optional)                     │
│                    - CDN & Global Load Balancer                       │
│                    - WAF (Web Application Firewall)                   │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
┌───────────────▼───────────────┐   ┌────────────▼──────────────┐
│   Frontend App Service        │   │  Backend App Service       │
│   ┌─────────────────────┐     │   │  ┌──────────────────────┐ │
│   │   Nginx Container   │     │   │  │  Node.js Container   │ │
│   │   - React SPA       │     │   │  │  - Express API       │ │
│   │   - Static Assets   │     │   │  │  - Prisma ORM        │ │
│   └─────────────────────┘     │   │  └──────────────────────┘ │
│   Region: East US             │   │  Region: East US          │
│   SKU: B1 (1 vCPU, 1.75 GB)  │   │  SKU: B1 (1 vCPU, 1.75 GB)│
└───────────────┬───────────────┘   └────────────┬──────────────┘
                │                                │
                │                                │
                │   ┌────────────────────────────┤
                │   │                            │
                │   │   ┌────────────────────────▼──────────┐
                │   │   │  Virtual Network (10.0.0.0/16)    │
                │   │   │  ┌─────────────────────────────┐  │
                │   │   │  │  App Subnet (10.0.1.0/24)   │  │
                │   │   │  └─────────────────────────────┘  │
                │   │   │  ┌─────────────────────────────┐  │
                │   │   │  │  DB Subnet (10.0.2.0/24)    │  │
                │   │   │  └──────────┬──────────────────┘  │
                │   │   └─────────────┼─────────────────────┘
                │   │                 │
                │   │   ┌─────────────▼──────────────────────────┐
                │   │   │  Azure PostgreSQL Flexible Server      │
                │   │   │  ┌──────────────────────────────────┐  │
                │   │   │  │  Database: fridge_pro            │  │
                │   │   │  │  Version: 16                     │  │
                │   │   │  │  Storage: 32 GB                  │  │
                │   │   │  │  SKU: B_Standard_B1ms            │  │
                │   │   │  │  Backup: 7 days retention        │  │
                │   │   │  └──────────────────────────────────┘  │
                │   │   │  Private DNS Zone                      │
                │   │   └────────────────────────────────────────┘
                │   │
                │   │   ┌────────────────────────────────────────┐
                │   └───►  Azure Blob Storage                    │
                │       │  ┌──────────────────────────────────┐  │
                │       │  │  Container: uploads              │  │
                │       │  │  - Receipt images                │  │
                │       │  │  - User avatars                  │  │
                │       │  └──────────────────────────────────┘  │
                │       │  Replication: LRS                      │
                │       │  Tier: Hot                             │
                │       └────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│  Azure Container Registry (ACR)         │
│  ┌───────────────────────────────────┐  │
│  │  Repository: backend              │  │
│  │  - Latest tag                     │  │
│  │  - SHA tags (git commit)          │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Repository: frontend             │  │
│  │  - Latest tag                     │  │
│  │  - SHA tags (git commit)          │  │
│  └───────────────────────────────────┘  │
│  SKU: Basic                             │
└─────────────────────────────────────────┘
```

---

## 🔧 Composants de l'architecture

### 1. Frontend (React + Nginx)

**Service**: Azure App Service (Linux Container)

**Configuration**:
- Container Nginx avec React SPA buildée
- Routing côté client pour SPA
- Proxy API vers le backend
- Compression Gzip
- Headers de sécurité (CSP, X-Frame-Options, etc.)

**Ressources**:
- 1 vCPU
- 1.75 GB RAM
- Auto-scaling possible (jusqu'à 10 instances)

**Endpoints**:
- `/` - Application React
- `/api/*` - Proxy vers backend
- `/health` - Health check

### 2. Backend (Node.js + Express)

**Service**: Azure App Service (Linux Container)

**Configuration**:
- Container Node.js avec Express API
- Prisma ORM pour la base de données
- JWT pour l'authentification
- Google Gemini AI pour le scan de tickets

**Ressources**:
- 1 vCPU
- 1.75 GB RAM
- Auto-scaling possible (jusqu'à 10 instances)

**Endpoints**:
- `/api/auth/*` - Authentification
- `/api/users/*` - Gestion utilisateurs
- `/api/ingredients/*` - Ingrédients
- `/api/fridge/*` - Gestion du frigo
- `/api/recipes/*` - Recettes
- `/api/shopping-list/*` - Liste de courses
- `/api/scan/*` - Scan de tickets
- `/api/health` - Health check

### 3. Base de données (PostgreSQL)

**Service**: Azure Database for PostgreSQL Flexible Server

**Configuration**:
- Version: PostgreSQL 16
- SKU: B_Standard_B1ms (Burstable)
- Storage: 32 GB SSD
- Backup: 7 jours de rétention
- Haute disponibilité: Single zone (upgradable)

**Sécurité**:
- Connexion via Virtual Network
- SSL/TLS obligatoire
- Private DNS Zone
- Firewall configuré

**Schéma**:
```sql
Tables:
- User (utilisateurs)
- Category (catégories d'ingrédients)
- Ingredient (ingrédients)
- FridgeItem (éléments dans le frigo)
- Recipe (recettes)
- RecipeIngredient (ingrédients des recettes)
- ShoppingList (listes de courses)
- ShoppingListItem (articles dans la liste)
- Favorite (recettes favorites)
```

### 4. Stockage (Blob Storage)

**Service**: Azure Storage Account

**Configuration**:
- Type: StorageV2 (General Purpose v2)
- Replication: LRS (Locally Redundant)
- Tier: Hot (accès fréquent)
- CORS activé pour uploads

**Containers**:
- `uploads/` - Images de tickets scannés
- `static/` - Assets statiques (optionnel)

**Sécurité**:
- Access tier: Private
- SAS tokens pour accès temporaire
- Versioning activé

### 5. Registry (Container Registry)

**Service**: Azure Container Registry

**Configuration**:
- SKU: Basic
- Admin enabled (pour CI/CD)
- Webhook vers App Services

**Repositories**:
- `backend` - Images Docker du backend
- `frontend` - Images Docker du frontend

### 6. Networking (Virtual Network)

**Configuration**:
- Address space: 10.0.0.0/16
- Subnets:
  - App Subnet (10.0.1.0/24) - Pour App Services
  - DB Subnet (10.0.2.0/24) - Pour PostgreSQL
- Service Endpoints: Storage, PostgreSQL
- Private DNS Zones

---

## 🔐 Sécurité

### Authentification & Autorisation

```
┌──────────────┐      JWT Token       ┌──────────────┐
│   Client     │◄────────────────────►│   Backend    │
└──────────────┘                       └──────────────┘
                                              │
                                              │ Verify
                                              │
                                       ┌──────▼──────┐
                                       │  Database   │
                                       └─────────────┘
```

- JWT (JSON Web Tokens) pour l'authentification
- Tokens stockés en localStorage (frontend)
- Refresh tokens (à implémenter)
- Expiration: 7 jours

### Isolation réseau

```
Internet ──► App Services ──► VNet ──► PostgreSQL
                  │                        (Private)
                  │
                  └──► Blob Storage
                       (Public with auth)
```

- PostgreSQL accessible uniquement via VNet
- Private DNS Zone pour la résolution
- Service Endpoints pour accès sécurisé

### Chiffrement

- **En transit**: HTTPS/TLS 1.2+ obligatoire
- **Au repos**: 
  - PostgreSQL: Encryption at rest (Azure-managed keys)
  - Blob Storage: Encryption at rest (AES-256)
  - App Services: Encrypted disks

### Headers de sécurité

```nginx
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000
```

---

## 📈 Scalabilité

### Scaling horizontal (Auto-scaling)

**App Services**:
```yaml
Triggers:
  - CPU > 70% pendant 5 minutes → Scale out
  - CPU < 30% pendant 10 minutes → Scale in
  
Limites:
  - Min instances: 1
  - Max instances: 10
  
Coût estimé:
  - 1 instance: 25€/mois
  - 10 instances: 250€/mois
```

**PostgreSQL**:
```yaml
Read replicas:
  - Créer des réplicas en lecture seule
  - Load balancing automatique
  - Haute disponibilité
```

### Scaling vertical (Tier upgrade)

**App Services**:
- Basic (B1): 1 vCPU, 1.75 GB - 25€/mois
- Standard (S1): 1 vCPU, 1.75 GB - 70€/mois (auto-scaling)
- Premium (P1v2): 1 vCPU, 3.5 GB - 120€/mois (slots de déploiement)

**PostgreSQL**:
- Burstable (B1ms): 1 vCPU, 2 GB - 15€/mois
- General Purpose (D2s_v3): 2 vCPU, 8 GB - 120€/mois
- Memory Optimized (E2s_v3): 2 vCPU, 16 GB - 200€/mois

---

## 🔄 CI/CD Pipeline

### Workflow de déploiement

```
┌─────────────┐
│ Git Push    │
│  (main)     │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ GitHub Actions      │
│                     │
│ 1. Checkout code    │
│ 2. Run tests        │
│ 3. Build Docker     │
│ 4. Push to ACR      │
│ 5. Deploy to Azure  │
│ 6. Health check     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Azure App Services  │
│                     │
│ - Pull from ACR     │
│ - Deploy containers │
│ - Zero downtime     │
└─────────────────────┘
```

### Stratégie de déploiement

**Blue-Green Deployment** (avec slots):
1. Déployer sur slot "staging"
2. Tester automatiquement
3. Swap vers "production"
4. Rollback possible en 1 clic

**Rolling Update** (sans slots):
1. Déployer instance par instance
2. Health check après chaque instance
3. Stop si health check échoue

---

## 📊 Monitoring

### Métriques à surveiller

**App Services**:
- CPU Usage (%)
- Memory Usage (%)
- Request Count
- Response Time (ms)
- HTTP 5xx Errors

**PostgreSQL**:
- CPU Usage (%)
- Memory Usage (%)
- Storage Usage (%)
- Connections Count
- Query Performance

**Storage**:
- Storage Used (GB)
- Transaction Count
- Egress Bandwidth (GB)

### Alertes recommandées

```yaml
Alerts:
  - CPU > 80% pendant 15 min
  - Memory > 85% pendant 10 min
  - HTTP 5xx > 10 en 5 min
  - Database Connections > 90% du max
  - Storage > 80% de capacité
  - Response Time > 2000ms (P95)
```

### Logs

**Application Insights** (à activer):
- Request tracing
- Exception tracking
- Custom events
- Performance profiling

**Log Analytics**:
- Logs agrégés de tous les services
- Requêtes KQL personnalisées
- Dashboards et workbooks

---

## 💰 Optimisation des coûts

### Recommandations

1. **Environnements multiples**:
   ```
   Production: B1 (always on)
   Staging: B1 (on-demand)
   Development: Docker local (gratuit)
   ```

2. **Reserved Instances**:
   - Engagement 1 an: -30% de réduction
   - Engagement 3 ans: -50% de réduction

3. **Auto-shutdown**:
   ```bash
   # Arrêter les environnements de dev/test la nuit
   az webapp stop --name {APP_NAME} --resource-group {RG}
   
   # Scheduler via Azure Automation
   ```

4. **Monitoring des coûts**:
   - Budgets Azure avec alertes
   - Cost Analysis mensuel
   - Rightsizing recommendations

### Coût total estimé

| Environnement | Mensuel | Annuel |
|--------------|---------|--------|
| Development (local) | 0€ | 0€ |
| Staging (B1) | ~46€ | ~550€ |
| Production (B1) | ~46€ | ~550€ |
| Production (S1 + scaling) | ~150€ | ~1800€ |

---

## 🚀 Performance

### Optimisations implémentées

**Frontend**:
- Build optimisé avec Vite
- Code splitting automatique
- Lazy loading des routes
- Compression Gzip
- Cache des assets statiques (1 an)
- CDN ready

**Backend**:
- Connection pooling Prisma
- Caching des queries fréquentes
- Compression des responses
- Rate limiting
- Pagination optimisée

**Database**:
- Indexes sur colonnes clés
- Query optimization
- Connection pooling
- Read replicas (optionnel)

### Temps de réponse cibles

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| Frontend | <200ms | <500ms | <1s |
| API (simple) | <100ms | <300ms | <500ms |
| API (complex) | <500ms | <1s | <2s |
| Database query | <50ms | <200ms | <500ms |

---

## 📱 Disponibilité

### SLA (Service Level Agreement)

**Azure App Service (B1)**:
- SLA: 99.95%
- Downtime mensuel max: ~22 minutes

**Azure PostgreSQL (Single Zone)**:
- SLA: 99.99%
- Downtime mensuel max: ~4 minutes

**Azure Storage**:
- SLA: 99.9% (LRS)
- Downtime mensuel max: ~43 minutes

### Haute disponibilité (Production)

Pour améliorer la disponibilité:

1. **Multi-region deployment**:
   ```
   Primary: East US
   Secondary: West Europe
   Traffic Manager: Geographic routing
   ```

2. **Database HA**:
   ```
   Zone-redundant PostgreSQL
   SLA: 99.99%
   Automatic failover
   ```

3. **CDN + Front Door**:
   ```
   Azure CDN pour assets statiques
   Azure Front Door pour load balancing global
   DDoS protection
   ```

---

## 📚 Bonnes pratiques

### Infrastructure as Code

- ✅ Tout est défini dans Terraform
- ✅ Versioning dans Git
- ✅ Peer review obligatoire
- ✅ Environments séparés (dev/staging/prod)

### CI/CD

- ✅ Tests automatiques avant déploiement
- ✅ Build reproductibles avec Docker
- ✅ Déploiement zero-downtime
- ✅ Rollback en 1 clic

### Sécurité

- ✅ Principe du moindre privilège
- ✅ Secrets dans Key Vault (recommandé)
- ✅ Network isolation
- ✅ Monitoring et alertes
- ✅ Regular updates et patches

### Documentation

- ✅ Architecture documentée
- ✅ Runbooks pour incidents
- ✅ Disaster recovery plan
- ✅ Onboarding guide

---

**Dernière mise à jour**: Novembre 2025
