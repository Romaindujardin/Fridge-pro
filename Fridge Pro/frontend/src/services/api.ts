import axios, { AxiosResponse } from "axios";
import toast from "react-hot-toast";
import type { ApiResponse, ApiError } from "@/types";

// Configuration axios
const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim();
const apiBaseUrl = rawApiUrl
  ? rawApiUrl.endsWith("/api")
    ? rawApiUrl
    : `${rawApiUrl.replace(/\/+$/, "")}/api`
  : "/api";

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Nettoie tout objet récursivement pour éliminer les structures cycliques ou objets DOM/React
function sanitizeJsonPayload(data: any, seen = new WeakSet()): any {
  if (data === null || typeof data !== "object") {
    return data;
  }
  if (data instanceof FormData || data instanceof Blob || data instanceof ArrayBuffer) {
    return data;
  }
  if (seen.has(data)) {
    return undefined;
  }
  seen.add(data);
  if (Array.isArray(data)) {
    return data
      .map((item) => sanitizeJsonPayload(item, seen))
      .filter((item) => item !== undefined);
  }
  const cleanObj: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    // Écarter les propriétés internes React, événements ou window
    if (
      key.startsWith("_") ||
      key === "nativeEvent" ||
      key === "view" ||
      key === "target" ||
      key === "currentTarget"
    ) {
      continue;
    }
    const val = data[key];
    if (typeof val === "function") continue;
    const sanitized = sanitizeJsonPayload(val, seen);
    if (sanitized !== undefined) {
      cleanObj[key] = sanitized;
    }
  }
  return cleanObj;
}

// Intercepteur pour ajouter le token d'authentification et assainir les données JSON
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data && !(config.data instanceof FormData)) {
      config.data = sanitizeJsonPayload(config.data);
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

    const rawMessage = error.response?.data?.message || error.message;
    const errorMessage =
      typeof rawMessage === "string" && !rawMessage.toLowerCase().includes("cyclic")
        ? rawMessage
        : "Une erreur est survenue lors de l'opération";
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
