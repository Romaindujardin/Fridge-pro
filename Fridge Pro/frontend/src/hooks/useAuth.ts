import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export const useAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    switchProfile,
    setUser,
    logout,
    checkAuth,
  } = useAuthStore();

  useEffect(() => {
    // Vérifier l'authentification au montage et au réveil de l'application (iOS PWA)
    checkAuth();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAuth();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
  }, [checkAuth]);

  useEffect(() => {
    // Ne rien faire si on est encore en train de charger
    if (isLoading) return;

    // Rediriger vers /auth si non authentifié et pas déjà sur la page d'auth
    if (!isAuthenticated && location.pathname !== "/auth") {
      navigate("/auth", { replace: true });
    }
    // Rediriger vers / si authentifié et sur la page d'auth
    else if (isAuthenticated && location.pathname === "/auth") {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, location.pathname, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    switchProfile,
    setUser,
    logout: handleLogout,
    checkAuth,
  };
};
