import axios, { AxiosResponse } from "axios";
import toast from "react-hot-toast";
import type { ApiResponse, ApiError } from "@/types";

// Configuration axios
const api = axios.create({
  baseURL: "/api",
  timeout: 1000000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses et erreurs
api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<any>>) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré ou invalide
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/auth";
      return Promise.reject(error);
    }

    const errorMessage =
      error.response?.data?.message || "Une erreur est survenue";
    toast.error(errorMessage);

    return Promise.reject(error);
  }
);

// Helpers pour extraire les données
export const handleApiResponse = <T>(
  response: AxiosResponse<ApiResponse<T>>
): T => {
  if (!response.data.success) {
    throw new Error(response.data.message || "Erreur API");
  }
  return response.data.data;
};

export const handleApiError = (error: any): never => {
  const apiError: ApiError = {
    success: false,
    message:
      error.response?.data?.message || error.message || "Erreur inconnue",
    statusCode: error.response?.status || 500,
  };
  throw apiError;
};

export default api;
