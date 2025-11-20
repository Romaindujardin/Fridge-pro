# Container Registry for Docker images
resource "azurerm_container_registry" "main" {
  name                = "${var.project_name}acr${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true

  tags = var.common_tags
}

# App Service Plan
resource "azurerm_service_plan" "main" {
  name                = "${var.project_name}-plan-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku

  tags = var.common_tags
}

# Backend App Service
resource "azurerm_linux_web_app" "backend" {
  name                = "${var.project_name}-backend-${var.environment}-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id

  site_config {
    always_on = true

    application_stack {
      docker_image_name   = "backend:latest"
      docker_registry_url = "https://${azurerm_container_registry.main.login_server}"
    }

    health_check_path = "/api/health"

    cors {
      allowed_origins = [
        "https://${azurerm_linux_web_app.frontend.default_hostname}",
        var.frontend_custom_domain != "" ? "https://${var.frontend_custom_domain}" : ""
      ]
      support_credentials = true
    }
  }

  app_settings = {
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE" = "false"
    "DOCKER_REGISTRY_SERVER_URL"          = "https://${azurerm_container_registry.main.login_server}"
    "DOCKER_REGISTRY_SERVER_USERNAME"     = azurerm_container_registry.main.admin_username
    "DOCKER_REGISTRY_SERVER_PASSWORD"     = azurerm_container_registry.main.admin_password
    "WEBSITES_PORT"                       = "5000"
    
    # Application Settings
    "NODE_ENV"                            = var.environment
    "DATABASE_URL"                        = "postgresql://${var.db_admin_username}:${var.db_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.db_name}?sslmode=require"
    "JWT_SECRET"                          = var.jwt_secret
    "JWT_EXPIRES_IN"                      = "7d"
    "PORT"                                = "5000"
    "FRONTEND_URL"                        = "https://${azurerm_linux_web_app.frontend.default_hostname}"
    "AZURE_STORAGE_CONNECTION_STRING"     = azurerm_storage_account.main.primary_connection_string
    "AZURE_STORAGE_CONTAINER_NAME"        = azurerm_storage_container.uploads.name
    "MAX_FILE_SIZE"                       = "10485760"
  }

  https_only = true

  identity {
    type = "SystemAssigned"
  }

  logs {
    application_logs {
      file_system_level = "Information"
    }
    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }
  }

  tags = var.common_tags
}

# Frontend App Service
resource "azurerm_linux_web_app" "frontend" {
  name                = "${var.project_name}-frontend-${var.environment}-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id

  site_config {
    always_on = true

    application_stack {
      docker_image_name   = "frontend:latest"
      docker_registry_url = "https://${azurerm_container_registry.main.login_server}"
    }

    health_check_path = "/health"
  }

  app_settings = {
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE" = "false"
    "DOCKER_REGISTRY_SERVER_URL"          = "https://${azurerm_container_registry.main.login_server}"
    "DOCKER_REGISTRY_SERVER_USERNAME"     = azurerm_container_registry.main.admin_username
    "DOCKER_REGISTRY_SERVER_PASSWORD"     = azurerm_container_registry.main.admin_password
    "WEBSITES_PORT"                       = "80"
  }

  https_only = true

  identity {
    type = "SystemAssigned"
  }

  logs {
    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }
  }

  tags = var.common_tags
}

# Virtual Network Integration for Backend
resource "azurerm_app_service_virtual_network_swift_connection" "backend" {
  app_service_id = azurerm_linux_web_app.backend.id
  subnet_id      = azurerm_subnet.app_subnet.id
}
