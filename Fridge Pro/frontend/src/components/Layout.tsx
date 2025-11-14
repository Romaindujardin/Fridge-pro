import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Home,
  Refrigerator,
  ChefHat,
  ShoppingCart,
  User,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navigation = [
    { name: "Accueil", href: "/", icon: Home },
    { name: "Mon Frigo", href: "/fridge", icon: Refrigerator },
    { name: "Recettes", href: "/recipes", icon: ChefHat },
    { name: "Liste de courses", href: "/shopping-list", icon: ShoppingCart },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-primary-600">
                Fridge Pro
              </Link>
            </div>

            {/* Navigation links */}
            <div className="hidden md:flex items-center space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "text-primary-600 bg-primary-50"
                        : "text-gray-600 hover:text-primary-600 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              <Link
                to="/profile"
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/profile")
                    ? "text-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-primary-600 hover:bg-gray-100"
                }`}
              >
                <User className="w-5 h-5" />
                <span className="hidden sm:block">
                  {user ? `${user.firstName}` : "Profil"}
                </span>
              </Link>

              <button
                onClick={logout}
                className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:block">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden border-t">
          <div className="grid grid-cols-4 gap-1 p-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex flex-col items-center p-2 rounded-md text-xs font-medium transition-colors ${
                    isActive(item.href)
                      ? "text-primary-600 bg-primary-50"
                      : "text-gray-600 hover:text-primary-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
