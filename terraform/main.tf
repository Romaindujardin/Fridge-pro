resource "random_password" "jwt_secret" {
  length  = 32
  special = true
}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  resource_group_name = "${var.project_name}-${var.environment}-rg"
  app_service_name    = "${var.project_name}-api-${random_string.suffix.result}"
  frontend_app_name   = "${var.project_name}-web-${random_string.suffix.result}"
  db_server_name      = "${var.project_name}-db-${random_string.suffix.result}"
}

resource "azurerm_resource_group" "rg" {
  name     = local.resource_group_name
  location = var.location
}

# --- Database ---

resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "azurerm_postgresql_flexible_server" "db" {
  name                   = local.db_server_name
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "16"
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password != null ? var.db_admin_password : random_password.db_password.result
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"
  zone                   = "1"

  lifecycle {
    ignore_changes = [
      zone,
      high_availability.0.standby_availability_zone
    ]
  }
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "fridge_pro"
  server_id = azurerm_postgresql_flexible_server.db.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.db.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# --- Service Plan ---

resource "azurerm_service_plan" "asp" {
  name                = "${var.project_name}-plan"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "B1"
}

# --- Frontend (Web App) ---
# Using Web App instead of Static Web App due to region constraints

resource "azurerm_linux_web_app" "frontend" {
  name                = local.frontend_app_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.asp.id

  site_config {
    application_stack {
      node_version = "20-lts"
    }
    always_on = true
    
    # Startup command to serve the build
    app_command_line = "pm2 start server.js --no-daemon"
  }

  app_settings = {
    "NODE_ENV" = "production"
    "PORT"     = "8080"
  }
}

# --- Backend (Web App) ---

resource "azurerm_linux_web_app" "api" {
  name                = local.app_service_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.asp.id

  site_config {
    application_stack {
      node_version = "20-lts"
    }
    always_on = true
    
    #cors {
    #  allowed_origins = [
    #    "https://${azurerm_linux_web_app.frontend.default_hostname}",
    #    "http://localhost:3000",
    #    "http://localhost:5173"
    #  ]
    #}
  }

  app_settings = {
    "NODE_ENV"       = "production"
    "PORT"           = "8080"
    "DATABASE_URL"   = "postgresql://${var.db_admin_username}:${urlencode(var.db_admin_password != null ? var.db_admin_password : random_password.db_password.result)}@${azurerm_postgresql_flexible_server.db.fqdn}:5432/fridge_pro?schema=public&sslmode=require"
    "JWT_SECRET"     = random_password.jwt_secret.result
    "JWT_EXPIRES_IN" = "7d"
    "FRONTEND_URL"   = "https://${azurerm_linux_web_app.frontend.default_hostname}"
  }
}
