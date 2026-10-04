import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authService } from "@/services/authService";
import type { User, LoginRequest, RegisterRequest, AuthResponse } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  register: (data: RegisterRequest) => Promise<AuthResponse>;
  switchProfile: (profileName: "Romain" | "Sophie") => Promise<AuthResponse>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: authService.getCurrentUser(),
      isAuthenticated: authService.isAuthenticated(),
      isLoading: false,

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true });
        try {
          const data = await authService.login(credentials);
          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });
          return data;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data: RegisterRequest) => {
        set({ isLoading: true });
        try {
          const result = await authService.register(data);
          set({
            user: result.user,
            isAuthenticated: true,
            isLoading: false,
          });
          return result;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      switchProfile: async (profileName: "Romain" | "Sophie") => {
        set({ isLoading: true });
        try {
          const data = await authService.switchProfile(profileName);
          set({
            user: data.user,
            isLoading: false,
          });
          return data;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authService.logout();
        } catch (error) {
          console.error("Erreur lors de la déconnexion:", error);
        } finally {
          authService.clearSession();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      checkAuth: () => {
        try {
          const isAuthenticated = authService.isAuthenticated();
          const user = isAuthenticated ? authService.getCurrentUser() : null;

          if (!isAuthenticated) {
            authService.clearSession();
          }

          set({
            user,
            isAuthenticated,
            isLoading: false,
          });
        } catch (error) {
          console.error(
            "Erreur lors de la vérification d'authentification:",
            error
          );
          authService.clearSession();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
