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

  // Déconnexion
  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      // Continuer même si l'API échoue
      console.error("Erreur lors de la déconnexion:", error);
    } finally {
      // Nettoyer le localStorage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
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

  // Vérifier si l'utilisateur est connecté
  isAuthenticated(): boolean {
    const token = localStorage.getItem("token");
    const user = this.getCurrentUser();
    return !!(token && user);
  },

  // Récupérer le token
  getToken(): string | null {
    return localStorage.getItem("token");
  },
};
