import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/authService";
import type { LoginRequest, RegisterRequest } from "@/types";

// Schémas de validation
const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(2, "Le prénom doit contenir au moins 2 caractères"),
    lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    email: z.string().email("Adresse email invalide"),
    password: z
      .string()
      .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Récupérer la page d'origine depuis le state de navigation
  const from = (location.state as any)?.from?.pathname || "/";

  // Formulaire de connexion
  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Formulaire d'inscription
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Gestion de la connexion
  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const loginData: LoginRequest = {
        email: data.email,
        password: data.password,
      };

      await authService.login(loginData);
      toast.success("Connexion réussie !");
      navigate(from, { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la connexion");
    } finally {
      setIsLoading(false);
    }
  };

  // Gestion de l'inscription
  const handleRegister = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const registerData: RegisterRequest = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      };

      await authService.register(registerData);
      toast.success("Compte créé avec succès !");
      navigate(from, { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création du compte");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Fridge Pro</h1>
          <p className="text-gray-600">
            Gérez votre frigo et découvrez de nouvelles recettes
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Toggle */}
          <div className="flex mb-8">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                isLogin
                  ? "text-primary-600 border-b-2 border-primary-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                !isLogin
                  ? "text-primary-600 border-b-2 border-primary-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Formulaire de connexion */}
          {isLogin ? (
            <form
              onSubmit={loginForm.handleSubmit(handleLogin)}
              className="space-y-6"
            >
              <Input
                label="Adresse email"
                type="email"
                placeholder="votre@email.com"
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register("email")}
              />

              <div className="relative">
                <Input
                  label="Mot de passe"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  error={loginForm.formState.errors.password?.message}
                  {...loginForm.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              <Button
                type="submit"
                loading={isLoading}
                className="w-full"
                size="lg"
              >
                Se connecter
              </Button>
            </form>
          ) : (
            // Formulaire d'inscription
            <form
              onSubmit={registerForm.handleSubmit(handleRegister)}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Prénom"
                  placeholder="John"
                  error={registerForm.formState.errors.firstName?.message}
                  {...registerForm.register("firstName")}
                />
                <Input
                  label="Nom"
                  placeholder="Doe"
                  error={registerForm.formState.errors.lastName?.message}
                  {...registerForm.register("lastName")}
                />
              </div>

              <Input
                label="Adresse email"
                type="email"
                placeholder="votre@email.com"
                error={registerForm.formState.errors.email?.message}
                {...registerForm.register("email")}
              />

              <Input
                label="Mot de passe"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                error={registerForm.formState.errors.password?.message}
                {...registerForm.register("password")}
              />

              <Input
                label="Confirmer le mot de passe"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                error={registerForm.formState.errors.confirmPassword?.message}
                {...registerForm.register("confirmPassword")}
              />

              <Button
                type="submit"
                loading={isLoading}
                className="w-full"
                size="lg"
              >
                Créer mon compte
              </Button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-gray-500">
            {isLogin ? (
              <>
                Pas encore de compte ?{" "}
                <button
                  onClick={() => setIsLogin(false)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{" "}
                <button
                  onClick={() => setIsLogin(true)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Se connecter
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
