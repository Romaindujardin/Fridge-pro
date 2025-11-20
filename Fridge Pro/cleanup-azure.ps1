# Script de Nettoyage - Fridge Pro Azure Resources
# Auteur: Kenneth SANGLI
# Cours: Cloud Computing - JUNIA

$RESOURCE_GROUP = "fridgepro-ken-rg-dev"

Write-Host "⚠️  ATTENTION: NETTOYAGE DES RESSOURCES AZURE" -ForegroundColor Red
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Red
Write-Host ""
Write-Host "Ce script va SUPPRIMER toutes les ressources suivantes:" -ForegroundColor Yellow
Write-Host "  - Resource Group: $RESOURCE_GROUP" -ForegroundColor Yellow
Write-Host "  - Toutes les Web Apps" -ForegroundColor Yellow
Write-Host "  - Le serveur PostgreSQL et les bases de données" -ForegroundColor Yellow
Write-Host "  - L'Azure Container Registry et les images" -ForegroundColor Yellow
Write-Host "  - L'App Service Plan" -ForegroundColor Yellow
Write-Host "  - Tous les logs et données" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  CETTE ACTION EST IRRÉVERSIBLE !" -ForegroundColor Red
Write-Host ""

$confirmation = Read-Host "Êtes-vous sûr de vouloir continuer? (Tapez 'OUI' en majuscules pour confirmer)"

if ($confirmation -ne "OUI") {
    Write-Host ""
    Write-Host "❌ Nettoyage annulé." -ForegroundColor Green
    Write-Host ""
    exit
}

Write-Host ""
Write-Host "🗑️  Suppression du Resource Group en cours..." -ForegroundColor Cyan
Write-Host "   Cette opération peut prendre quelques minutes..." -ForegroundColor Yellow
Write-Host ""

az group delete --name $RESOURCE_GROUP --yes --no-wait

Write-Host "✅ Commande de suppression lancée" -ForegroundColor Green
Write-Host ""
Write-Host "📝 La suppression se fait en arrière-plan." -ForegroundColor Cyan
Write-Host "   Vous pouvez vérifier l'état sur le portail Azure." -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Pour vérifier si la suppression est terminée:" -ForegroundColor Yellow
Write-Host "   az group show --name $RESOURCE_GROUP" -ForegroundColor Gray
Write-Host "   (Retournera une erreur si le groupe n'existe plus)" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "🎉 Nettoyage lancé avec succès!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
