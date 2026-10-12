import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import type { LoginRequest, RegisterRequest } from "@/types";

// Schémas de validation
const loginSchema = z.object({
  email: z.string().min(1, "Identifiant ou adresse email requis"),
  password: z
    .string()
    .min(1, "Le mot de passe est requis"),
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
  const queryClient = useQueryClient();
  const { login, register, isAuthenticated } = useAuth();

  // Récupérer la page d'origine depuis le state de navigation (éviter la boucle sur /auth)
  const rawFrom = (location.state as any)?.from?.pathname;
  const from = rawFrom && rawFrom !== "/auth" ? rawFrom : "/";

  // Rediriger immédiatement si déjà authentifié
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, from, navigate]);

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
        email: data.email.trim(),
        password: data.password,
      };

      await login(loginData);
      queryClient.clear();
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
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        password: data.password,
      };

      await register(registerData);
      queryClient.clear();
      toast.success("Compte créé avec succès !");
      navigate(from, { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création du compte");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Halos d'ambiance en arrière-plan */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-coral-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-linear-to-tr from-primary-600 to-primary-400 text-white shadow-md shadow-primary-500/25 mb-3 text-xl">
            🥦
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Fridge Pro</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Gérez votre frigo et cuisinez malin au quotidien
          </p>
        </div>

        {/* Bento Auth Card */}
        <div className="bento-card rounded-3xl border border-gray-150/80 bg-white/95 backdrop-blur-md shadow-card p-6 sm:p-8">
          {/* Segmented Pill Toggle */}
          <div className="flex p-1 bg-gray-100/80 rounded-full mb-6 border border-gray-200/60">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-full transition-all ${
                isLogin
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-full transition-all ${
                !isLogin
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Formulaire de connexion */}
          {isLogin ? (
            <form
              onSubmit={loginForm.handleSubmit(handleLogin)}
              className="space-y-5"
            >
              <Input
                label="Identifiant ou email"
                type="text"
                placeholder="romain, sophie ou email"
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
                  className="absolute right-3.5 top-9 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <Button
                type="submit"
                loading={isLoading}
                className="w-full rounded-full py-2.5 font-semibold shadow-md shadow-primary-500/20"
                size="lg"
              >
                Se connecter
              </Button>
            </form>
          ) : (
            // Formulaire d'inscription
            <form
              onSubmit={registerForm.handleSubmit(handleRegister)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
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
                className="w-full rounded-full py-2.5 font-semibold shadow-md shadow-primary-500/20 mt-2"
                size="lg"
              >
                Créer mon compte
              </Button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-500">
            {isLogin ? (
              <>
                Pas encore de compte ?{" "}
                <button
                  onClick={() => setIsLogin(false)}
                  className="text-primary-600 hover:text-primary-700 font-bold"
                >
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{" "}
                <button
                  onClick={() => setIsLogin(true)}
                  className="text-primary-600 hover:text-primary-700 font-bold"
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
