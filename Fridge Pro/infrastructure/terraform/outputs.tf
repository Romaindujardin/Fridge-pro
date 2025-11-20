# Resource Group
output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

# Database
output "postgres_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_database_name" {
  description = "PostgreSQL database name"
  value       = azurerm_postgresql_flexible_server_database.main.name
}

# Storage
output "storage_account_name" {
  description = "Storage account name"
  value       = azurerm_storage_account.main.name
}

output "storage_connection_string" {
  description = "Storage account connection string"
  value       = azurerm_storage_account.main.primary_connection_string
  sensitive   = true
}

# Container Registry
output "acr_login_server" {
  description = "ACR login server URL"
  value       = azurerm_container_registry.main.login_server
}

output "acr_admin_username" {
  description = "ACR admin username"
  value       = azurerm_container_registry.main.admin_username
  sensitive   = true
}

output "acr_admin_password" {
  description = "ACR admin password"
  value       = azurerm_container_registry.main.admin_password
  sensitive   = true
}

# App Services
output "backend_url" {
  description = "Backend App Service URL"
  value       = "https://${azurerm_linux_web_app.backend.default_hostname}"
}

output "frontend_url" {
  description = "Frontend App Service URL"
  value       = "https://${azurerm_linux_web_app.frontend.default_hostname}"
}

output "backend_app_name" {
  description = "Backend App Service name"
  value       = azurerm_linux_web_app.backend.name
}

output "frontend_app_name" {
  description = "Frontend App Service name"
  value       = azurerm_linux_web_app.frontend.name
}

# Summary
output "deployment_summary" {
  description = "Deployment summary"
  value = {
    frontend_url = "https://${azurerm_linux_web_app.frontend.default_hostname}"
    backend_url  = "https://${azurerm_linux_web_app.backend.default_hostname}"
    acr_url      = azurerm_container_registry.main.login_server
    database     = azurerm_postgresql_flexible_server.main.fqdn
  }
}
