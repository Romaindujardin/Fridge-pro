# Project Configuration
variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "fridgepro"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "eastus"
}

# Database Configuration
variable "db_admin_username" {
  description = "PostgreSQL administrator username"
  type        = string
  default     = "fridgeadmin"
  sensitive   = true
}

variable "db_admin_password" {
  description = "PostgreSQL administrator password"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "fridge_pro"
}

variable "db_sku_name" {
  description = "PostgreSQL SKU name"
  type        = string
  default     = "B_Standard_B1ms"
  # Options: B_Standard_B1ms (Basic), GP_Standard_D2s_v3 (General Purpose)
}

# App Service Configuration
variable "app_service_sku" {
  description = "App Service SKU"
  type        = string
  default     = "B1"
  # Options: B1 (Basic), S1 (Standard), P1v2 (Premium)
}

# Application Configuration
variable "jwt_secret" {
  description = "JWT secret for authentication"
  type        = string
  sensitive   = true
}

variable "frontend_custom_domain" {
  description = "Custom domain for frontend (optional)"
  type        = string
  default     = ""
}

# Tags
variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "Fridge Pro"
    ManagedBy   = "Terraform"
    Environment = "dev"
  }
}
