import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/HomePage";
import { FridgePage } from "@/pages/FridgePage";
import { RecipesPage } from "@/pages/RecipesPage";
import { ShoppingListPage } from "@/pages/ShoppingListPage";
import { AuthPage } from "@/pages/AuthPage";
import { ProfilePage } from "@/pages/ProfilePage";
import OpenFoodFactsTest from "@/components/OpenFoodFactsTest";

function App() {
  return (
    <Routes>
      {/* Routes publiques */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Routes protégées avec layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="fridge" element={<FridgePage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="shopping-list" element={<ShoppingListPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="test-openff" element={<OpenFoodFactsTest />} />
      </Route>

      {/* Redirection par défaut */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
