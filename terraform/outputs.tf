output "resource_group_name" {
  value = azurerm_resource_group.rg.name
}

output "backend_app_name" {
  value = azurerm_linux_web_app.api.name
}

output "backend_url" {
  value = "https://${azurerm_linux_web_app.api.default_hostname}"
}

output "frontend_app_name" {
  value = azurerm_linux_web_app.frontend.name
}

output "frontend_url" {
  value = "https://${azurerm_linux_web_app.frontend.default_hostname}"
}

output "db_server_fqdn" {
  value = azurerm_postgresql_flexible_server.db.fqdn
}

output "db_password" {
  value     = var.db_admin_password != null ? var.db_admin_password : random_password.db_password.result
  sensitive = true
}

output "database_url_connection_string" {
  value     = "postgresql://${var.db_admin_username}:${urlencode(var.db_admin_password != null ? var.db_admin_password : random_password.db_password.result)}@${azurerm_postgresql_flexible_server.db.fqdn}:5432/fridge_pro?schema=public&sslmode=require"
  sensitive = true
}
