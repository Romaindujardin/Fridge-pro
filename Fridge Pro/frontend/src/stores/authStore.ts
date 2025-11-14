import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authService } from "@/services/authService";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

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
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      checkAuth: () => {
        set({ isLoading: true });

        try {
          const user = authService.getCurrentUser();
          const isAuthenticated = authService.isAuthenticated();

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
