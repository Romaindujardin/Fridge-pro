import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HomePage } from "@/pages/HomePage";
import { FridgePage } from "@/pages/FridgePage";
import { RecipesPage } from "@/pages/RecipesPage";
import { ShoppingListPage } from "@/pages/ShoppingListPage";
import { AuthPage } from "@/pages/AuthPage";
import { ProfilePage } from "@/pages/ProfilePage";
import OpenFoodFactsTest from "@/components/OpenFoodFactsTest";

function App() {
  return (
    <ErrorBoundary>
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
          <Route
            index
            element={
              <ErrorBoundary>
                <HomePage />
              </ErrorBoundary>
            }
          />
          <Route
            path="fridge"
            element={
              <ErrorBoundary>
                <FridgePage />
              </ErrorBoundary>
            }
          />
          <Route
            path="recipes"
            element={
              <ErrorBoundary>
                <RecipesPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="shopping-list"
            element={
              <ErrorBoundary>
                <ShoppingListPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="profile"
            element={
              <ErrorBoundary>
                <ProfilePage />
              </ErrorBoundary>
            }
          />
          <Route
            path="test-openff"
            element={
              <ErrorBoundary>
                <OpenFoodFactsTest />
              </ErrorBoundary>
            }
          />
        </Route>

        {/* Redirection par défaut */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
