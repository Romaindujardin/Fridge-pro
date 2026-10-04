import api, { handleApiResponse, handleApiError } from "./api";
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
} from "@/types";

export const authService = {
  // Connexion
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await api.post("/auth/login", credentials);
      const data = handleApiResponse<AuthResponse>(response);

      // Stocker le token et les infos utilisateur
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      return data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Inscription
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await api.post("/auth/register", userData);
      const data = handleApiResponse<AuthResponse>(response);

      // Stocker le token et les infos utilisateur
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      return data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Nettoyer tous les stockages de session
  clearSession(): void {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("auth-storage");
    } catch {
      // Ignorer si localStorage n'est pas accessible
    }
  },

  // Vérifier si le token JWT est structurellement valide et non expiré
  isTokenValid(token: string | null): boolean {
    if (!token || typeof token !== "string") return false;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return false;
      const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(payloadJson);
      if (typeof payload.exp === "number") {
        // Marge de sécurité de 10 secondes
        return Date.now() < (payload.exp - 10) * 1000;
      }
      return true;
    } catch {
      return false;
    }
  },

  // Déconnexion
  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      // Continuer même si l'API échoue
      console.error("Erreur lors de la déconnexion:", error);
    } finally {
      this.clearSession();
    }
  },

  // Récupérer l'utilisateur stocké
  getCurrentUser(): User | null {
    try {
      const userStr = localStorage.getItem("user");
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  // Vérifier si l'utilisateur est connecté et le token non expiré
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    if (!token || !user) {
      return false;
    }
    if (!this.isTokenValid(token)) {
      this.clearSession();
      return false;
    }
    return true;
  },

  // Récupérer le token
  getToken(): string | null {
    return localStorage.getItem("token");
  },

  // Basculer de profil au sein du compte partagé (Romain / Sophie)
  async switchProfile(profileName: "Romain" | "Sophie"): Promise<AuthResponse> {
    try {
      const response = await api.post("/users/switch-profile", { profileName });
      const data = handleApiResponse<AuthResponse>(response);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      return data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
