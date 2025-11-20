variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "fridge-pro"
}

variable "environment" {
  description = "Environment name (e.g. dev, prod)"
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "italynorth" # Default choice, central and usually good availability

  validation {
    condition     = contains(["norwayeast", "uksouth", "spaincentral", "italynorth", "swedencentral"], var.location)
    error_message = "The location must be one of: norwayeast, uksouth, spaincentral, italynorth, swedencentral."
  }
}

variable "db_admin_username" {
  description = "Administrator username for the database"
  type        = string
  default     = "fridgeadmin"
  sensitive   = true
}

# Password will be generated if not provided, but can be overridden
variable "db_admin_password" {
  description = "Administrator password for the database"
  type        = string
  default     = null
  sensitive   = true
}

