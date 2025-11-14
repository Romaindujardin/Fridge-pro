import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  User,
  Mail,
  Calendar,
  Edit3,
  Save,
  X,
  Shield,
  Activity,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { userService } from "@/services/userService";

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
});

type ProfileForm = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const maskGeminiKey = (value?: string | null) => {
    if (!value) return null;
    if (value.length <= 8) {
      return "••••";
    }
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
  };

  // Formulaire
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      geminiApiKey: user?.geminiApiKey || "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        geminiApiKey: user.geminiApiKey || "",
      });
    }
  }, [user, form]);

  // Gestionnaire de sauvegarde
  const handleSave = async (data: ProfileForm) => {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        geminiApiKey: data.geminiApiKey?.trim()
          ? data.geminiApiKey.trim()
          : null,
      };

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
      geminiApiKey: user?.geminiApiKey || "",
    });
    setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profil 👤</h1>
          <p className="text-gray-600">
            Gérez vos informations personnelles et préférences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Informations personnelles */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Informations personnelles</span>
                </CardTitle>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Modifier
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <X className="w-4 h-4 mr-2" />
                      Annuler
                    </Button>
                    <Button size="sm" type="submit" form="profile-form" loading={isLoading}>
                      <Save className="w-4 h-4 mr-2" />
                      Sauvegarder
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {isEditing ? (
                <form
                  id="profile-form"
                  className="space-y-6"
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
                    helper="Indiquez votre clé personnelle pour utiliser les fonctionnalités IA. Laissez vide pour la supprimer."
                    error={form.formState.errors.geminiApiKey?.message || undefined}
                    {...form.register("geminiApiKey")}
                  />
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Prénom
                      </label>
                      <p className="mt-1 text-lg text-gray-900">
                        {user.firstName}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Nom
                      </label>
                      <p className="mt-1 text-lg text-gray-900">
                        {user.lastName}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Adresse email
                    </label>
                    <p className="mt-1 text-lg text-gray-900">{user.email}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Clé Gemini API
                    </label>
                    <p className="mt-1 text-lg text-gray-900">
                      {user.geminiApiKey
                        ? maskGeminiKey(user.geminiApiKey)
                        : "Aucune clé configurée"}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Cette clé est utilisée pour scanner les tickets et générer des recettes IA.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Membre depuis
                    </label>
                    <p className="mt-1 text-lg text-gray-900">
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
          {/* Avatar */}
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-primary-600">
                  {user.firstName.charAt(0)}
                  {user.lastName.charAt(0)}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {user.firstName} {user.lastName}
              </h3>
              <p className="text-sm text-gray-500">{user.email}</p>
            </CardContent>
          </Card>

          {/* Statistiques rapides */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Activité</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Recettes favorites
                  </span>
                  <span className="font-medium">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Ingrédients dans le frigo
                  </span>
                  <span className="font-medium">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Listes de courses
                  </span>
                  <span className="font-medium">-</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sécurité */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Sécurité</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button variant="outline" size="sm" className="w-full">
                  Changer le mot de passe
                </Button>
                <Button variant="outline" size="sm" className="w-full">
                  Télécharger mes données
                </Button>
                <Button variant="danger" size="sm" className="w-full">
                  Supprimer mon compte
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
