import api, { handleApiResponse, handleApiError } from "./api";
import type { User } from "@/types";

interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  email: string;
  geminiApiKey?: string | null;
}

export const userService = {
  async getProfile(): Promise<User> {
    try {
      const response = await api.get("/users/profile");
      const data = handleApiResponse<{ user: User }>(response);
      return data.user;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateProfile(payload: UpdateProfileRequest): Promise<User> {
    try {
      const response = await api.put("/users/profile", payload);
      const data = handleApiResponse<{ user: User }>(response);

      // Mettre à jour le cache local
      localStorage.setItem("user", JSON.stringify(data.user));

      return data.user;
    } catch (error) {
      return handleApiError(error);
    }
  },
};

