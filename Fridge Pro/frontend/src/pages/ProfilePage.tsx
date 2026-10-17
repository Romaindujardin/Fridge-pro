import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { User, Edit3, Save, X, Shield, KeyRound, Receipt, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { userService } from "@/services/userService";
import { authService } from "@/services/authService";
import { fridgeService } from "@/services/fridgeService";
import type { ScannedReceipt } from "@/types";

// Schéma de validation
const profileSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  geminiApiKey: z
    .string()
    .trim()
    .max(255, "La clé ne doit pas dépasser 255 caractères")
    .optional()
    .nullable(),
  removeGeminiKey: z.boolean().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const formatReceiptDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const formatReceiptTime = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

/** Vignette d'un ticket scanné : la photo est chargée en blob (requête authentifiée). */
function ReceiptThumbnail({ receiptId }: { receiptId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    fridgeService
      .getScannedReceiptImageUrl(receiptId)
      .then((imageUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(imageUrl);
          return;
        }
        objectUrl = imageUrl;
        setUrl(imageUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [receiptId]);

  return (
    <div className="w-full aspect-[3/4] bg-gray-100 flex items-center justify-center overflow-hidden">
      {url ? (
        <img
          src={url}
          alt="Ticket scanné"
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
        />
      ) : (
        <Receipt className="w-6 h-6 text-gray-300" />
      )}
    </div>
  );
}

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Changement de mot de passe (compte partagé Romain & Sophie)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Historique des tickets scannés
  const queryClient = useQueryClient();
  const [selectedReceipt, setSelectedReceipt] = useState<ScannedReceipt | null>(
    null
  );
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);

  const { data: scannedReceipts = [], isLoading: isReceiptsLoading } = useQuery(
    {
      queryKey: ["scannedReceipts"],
      queryFn: () => fridgeService.getScannedReceipts(),
    }
  );

  const deleteReceiptMutation = useMutation({
    mutationFn: (id: string) => fridgeService.deleteScannedReceipt(id),
    onSuccess: () => {
      toast.success("Ticket supprimé de l'historique");
      queryClient.invalidateQueries({ queryKey: ["scannedReceipts"] });
      setSelectedReceipt(null);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de la suppression du ticket");
    },
  });

  // Charge la photo du ticket sélectionné (blob authentifié)
  useEffect(() => {
    if (!selectedReceipt) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    fridgeService
      .getScannedReceiptImageUrl(selectedReceipt.id)
      .then((imageUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(imageUrl);
          return;
        }
        objectUrl = imageUrl;
        setReceiptImageUrl(imageUrl);
      })
      .catch(() => setReceiptImageUrl(null));

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setReceiptImageUrl(null);
    };
  }, [selectedReceipt]);

  // Formulaire
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      geminiApiKey: "",
      removeGeminiKey: false,
    },
  });

  useEffect(() => {
    userService
      .getProfile()
      .then((freshUser) => {
        setUser(freshUser);
      })
      .catch(() => {});
  }, [setUser]);

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        geminiApiKey: "",
        removeGeminiKey: false,
      });
    }
  }, [user, form]);

  // Gestionnaire de sauvegarde
  const handleSave = async (data: ProfileForm) => {
    setIsLoading(true);
    try {
      // La clé Gemini n'est envoyée que si l'utilisateur en saisit une nouvelle
      // (ou coche la suppression) : elle n'est jamais relue depuis le serveur.
      const payload: {
        firstName: string;
        lastName: string;
        email: string;
        geminiApiKey?: string | null;
      } = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      };

      if (data.geminiApiKey?.trim()) {
        payload.geminiApiKey = data.geminiApiKey.trim();
      } else if (data.removeGeminiKey) {
        payload.geminiApiKey = null;
      }

      const updatedUser = await userService.updateProfile(payload);
      setUser(updatedUser);
      toast.success("Profil mis à jour !");
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la mise à jour");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    form.reset({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      geminiApiKey: "",
      removeGeminiKey: false,
    });
    setIsEditing(false);
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Veuillez saisir votre mot de passe actuel");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les deux nouveaux mots de passe ne correspondent pas");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Le nouveau mot de passe doit être différent de l'actuel");
      return;
    }

    setIsPasswordLoading(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      toast.success("Mot de passe mis à jour !");
      closePasswordModal();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du changement de mot de passe");
    } finally {
      setIsPasswordLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Mon Profil</h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            Gérez vos informations personnelles, clés IA et préférences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Informations personnelles */}
        <div className="lg:col-span-2">
          <Card className="rounded-3xl border border-gray-150/80 bg-white shadow-card overflow-hidden">
            <CardHeader className="p-5 sm:p-6 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
                  <User className="w-5 h-5 text-primary-600" />
                  <span>Informations personnelles</span>
                </CardTitle>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="rounded-full px-4 text-xs font-semibold"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                    Modifier
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={handleCancel} className="rounded-full px-4 text-xs font-semibold">
                      <X className="w-3.5 h-3.5 mr-1.5" />
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      type="submit"
                      form="profile-form"
                      loading={isLoading}
                      className="rounded-full px-4 text-xs font-semibold"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Sauvegarder
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 pt-2">
              {isEditing ? (
                <form
                  id="profile-form"
                  className="space-y-5"
                  onSubmit={form.handleSubmit(handleSave)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Prénom"
                      placeholder="John"
                      error={form.formState.errors.firstName?.message}
                      {...form.register("firstName")}
                    />
                    <Input
                      label="Nom"
                      placeholder="Doe"
                      error={form.formState.errors.lastName?.message}
                      {...form.register("lastName")}
                    />
                  </div>

                  <Input
                    label="Adresse email"
                    type="email"
                    placeholder="votre@email.com"
                    error={form.formState.errors.email?.message}
                    {...form.register("email")}
                  />

                  <Input
                    label="Clé Gemini API"
                    type="password"
                    placeholder="AIza..."
                    helper="Indiquez votre clé personnelle pour utiliser les fonctionnalités IA. Elle est stockée côté serveur et n'est plus jamais affichée ensuite. Laissez vide pour conserver la clé actuelle."
                    error={
                      form.formState.errors.geminiApiKey?.message || undefined
                    }
                    {...form.register("geminiApiKey")}
                  />

                  {user.hasGeminiKey && (
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        {...form.register("removeGeminiKey")}
                      />
                      Supprimer la clé Gemini enregistrée
                    </label>
                  )}
                </form>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4 sm:gap-6 bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Prénom
                      </label>
                      <p className="mt-1 text-base sm:text-lg font-bold text-gray-900">
                        {user.firstName}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Nom
                      </label>
                      <p className="mt-1 text-base sm:text-lg font-bold text-gray-900">
                        {user.lastName}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Adresse email
                    </label>
                    <p className="mt-1 text-base sm:text-lg font-bold text-gray-900">{user.email}</p>
                  </div>

                  <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Clé Gemini API
                    </label>
                    <p className="mt-1 text-base font-bold text-gray-900 font-mono">
                      {user.hasGeminiKey
                        ? "Clé enregistrée (masquée)"
                        : "Aucune clé configurée"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Cette clé est utilisée pour scanner les tickets et générer
                      des recettes IA.
                    </p>
                  </div>

                  <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Membre depuis
                    </label>
                    <p className="mt-1 text-base font-bold text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar avec statistiques */}
        <div className="space-y-6">
          {/* Avatar Card */}
          <Card className="rounded-3xl border border-gray-150/80 bg-white shadow-card overflow-hidden">
            <CardContent className="p-6 text-center">
              <div className="w-20 h-20 bg-linear-to-tr from-primary-100 to-primary-200 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner ring-4 ring-primary-50">
                <span className="text-2xl font-extrabold text-primary-700 tracking-tight">
                  {user.firstName.charAt(0)}
                  {user.lastName.charAt(0)}
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">
                {user.firstName} {user.lastName}
              </h3>
              <p className="text-xs text-gray-400 font-medium">{user.email}</p>
            </CardContent>
          </Card>

          {/* Sécurité */}
          <Card className="rounded-3xl border border-gray-150/80 bg-white shadow-card overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="flex items-center space-x-2 text-base font-bold text-gray-900">
                <Shield className="w-4 h-4 text-gray-500" />
                <span>Sécurité & Compte</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="space-y-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full text-xs font-semibold"
                  onClick={() => setIsPasswordModalOpen(true)}
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                  Changer le mot de passe
                </Button>
                <p className="text-[11px] text-gray-500 leading-relaxed px-1">
                  Le compte est partagé entre Romain et Sophie : le nouveau mot
                  de passe s'appliquera aux deux profils de connexion.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Historique des tickets scannés */}
      <Card className="rounded-3xl border border-gray-150/80 bg-white shadow-card overflow-hidden">
        <CardHeader className="p-5 sm:p-6 pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
            <Receipt className="w-5 h-5 text-primary-600" />
            <span>Tickets scannés</span>
          </CardTitle>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
            Les tickets analysés avec l'IA, conservés avec leur photo et leur
            date de scan.
          </p>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-2">
          {isReceiptsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            </div>
          ) : scannedReceipts.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              Aucun ticket scanné pour le moment. Scannez un ticket depuis la
              page « Mon Frigo » : il apparaîtra ici avec sa photo.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {scannedReceipts.map((receipt) => (
                <button
                  key={receipt.id}
                  type="button"
                  onClick={() => setSelectedReceipt(receipt)}
                  className="group text-left rounded-2xl border border-gray-150/80 bg-gray-50/60 overflow-hidden hover:border-primary-300 hover:shadow-soft transition-all"
                >
                  <ReceiptThumbnail receiptId={receipt.id} />
                  <div className="p-2.5">
                    <p className="text-xs font-bold text-gray-900">
                      {formatReceiptDate(receipt.scannedAt)} à{" "}
                      {formatReceiptTime(receipt.scannedAt)}
                    </p>
                    <p className="text-[11px] text-gray-500 font-medium">
                      {receipt.itemCount} aliment(s) ajouté(s)
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal : changer le mot de passe */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={closePasswordModal}
        title="Changer le mot de passe"
        size="sm"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input
            label="Mot de passe actuel"
            type="password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="Nouveau mot de passe"
            type="password"
            placeholder="8 caractères minimum"
            helper="Au moins 8 caractères."
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Confirmer le nouveau mot de passe"
            type="password"
            placeholder="Ressaisissez le même mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <p className="text-[11px] text-gray-500">
            Compte partagé Romain &amp; Sophie : le mot de passe est commun aux
            deux profils de connexion.
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={closePasswordModal}>
              Annuler
            </Button>
            <Button type="submit" loading={isPasswordLoading}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal : détail d'un ticket scanné */}
      <Modal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        title={
          selectedReceipt
            ? `Ticket du ${formatReceiptDate(selectedReceipt.scannedAt)} à ${formatReceiptTime(selectedReceipt.scannedAt)}`
            : "Ticket scanné"
        }
        size="lg"
      >
        {selectedReceipt && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-150/80 bg-gray-50 overflow-hidden">
              {receiptImageUrl ? (
                <img
                  src={receiptImageUrl}
                  alt="Photo du ticket scanné"
                  className="w-full max-h-[45vh] object-contain mx-auto"
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              )}
            </div>

            {selectedReceipt.items && selectedReceipt.items.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Aliments ajoutés au frigo
                </h4>
                <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {selectedReceipt.items.map((item, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between gap-3 text-sm bg-gray-50/60 border border-gray-100 rounded-xl px-3 py-2"
                    >
                      <span className="font-medium text-gray-800 truncate">
                        {item.categoryIcon ? `${item.categoryIcon} ` : ""}
                        {item.name}
                      </span>
                      <span className="text-xs font-bold text-gray-500 shrink-0">
                        {item.quantity} {item.unit}
                        {item.price != null
                          ? ` • ${item.price.toFixed(2)} €`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                loading={deleteReceiptMutation.isPending}
                onClick={() => {
                  if (confirm("Supprimer ce ticket de l'historique ?")) {
                    deleteReceiptMutation.mutate(selectedReceipt.id);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Supprimer de l'historique
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedReceipt(null)}
              >
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
