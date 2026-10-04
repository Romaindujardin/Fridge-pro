import { Outlet, Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Home,
  Refrigerator,
  ChefHat,
  ShoppingCart,
  User,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function Layout() {
  const location = useLocation();
  const { user, logout, switchProfile } = useAuth();

  const isCoupleAccount =
    user?.firstName?.toLowerCase() === "romain" ||
    user?.firstName?.toLowerCase() === "sophie" ||
    user?.email === "demo@fridgepro.com";

  const navigation = [
    { name: "Accueil", href: "/", icon: Home, shortName: "Accueil" },
    { name: "Mon Frigo", href: "/fridge", icon: Refrigerator, shortName: "Frigo" },
    { name: "Recettes", href: "/recipes", icon: ChefHat, shortName: "Recettes" },
    { name: "Liste de courses", href: "/shopping-list", icon: ShoppingCart, shortName: "Courses" },
  ];

  const mobileNavigation = [
    { name: "Accueil", href: "/", icon: Home },
    { name: "Frigo", href: "/fridge", icon: Refrigerator },
    { name: "Recettes", href: "/recipes", icon: ChefHat },
    { name: "Courses", href: "/shopping-list", icon: ShoppingCart },
    { name: "Profil", href: "/profile", icon: User },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center group">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
                  Fridge<span className="text-emerald-600">Pro</span>
                </span>
              </Link>
            </div>

            {/* Desktop Navigation links */}
            <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? "text-emerald-700 bg-emerald-50 shadow-xs font-semibold"
                        : "text-gray-600 hover:text-emerald-600 hover:bg-gray-100/80"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? "text-emerald-600" : "text-gray-400"}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* User menu & Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Sélecteur de profil couple partagé */}
              {isCoupleAccount && (
                <div className="flex items-center bg-gray-100 p-0.5 rounded-full border border-gray-200/80 text-xs">
                  <button
                    type="button"
                    onClick={async () => {
                      if (user?.firstName !== "Romain") {
                        try {
                          await switchProfile("Romain");
                          toast.success("Profil actif : Romain 👨");
                        } catch {
                          toast.error("Erreur lors du changement de profil");
                        }
                      }
                    }}
                    className={`px-2 sm:px-2.5 py-1 rounded-full font-medium transition-all text-xs flex items-center gap-1 ${
                      user?.firstName === "Romain"
                        ? "bg-white text-emerald-700 shadow-xs font-semibold"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                    title="Basculez sur le profil de Romain"
                  >
                    <span>👨</span>
                    <span className="hidden xs:inline sm:inline">Romain</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (user?.firstName !== "Sophie") {
                        try {
                          await switchProfile("Sophie");
                          toast.success("Profil actif : Sophie 👩");
                        } catch {
                          toast.error("Erreur lors du changement de profil");
                        }
                      }
                    }}
                    className={`px-2 sm:px-2.5 py-1 rounded-full font-medium transition-all text-xs flex items-center gap-1 ${
                      user?.firstName === "Sophie"
                        ? "bg-white text-purple-700 shadow-xs font-semibold"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                    title="Basculez sur le profil de Sophie"
                  >
                    <span>👩</span>
                    <span className="hidden xs:inline sm:inline">Sophie</span>
                  </button>
                </div>
              )}

              <Link
                to="/profile"
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/profile")
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-gray-700 hover:text-emerald-600 hover:bg-gray-100"
                }`}
                title="Mon Profil"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  {user?.firstName ? user.firstName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <span className="hidden sm:inline-block font-medium text-gray-800">
                  {user ? user.firstName : "Profil"}
                </span>
              </Link>

              <button
                onClick={logout}
                className="flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content with generous bottom clearance on mobile so bottom bar never obscures content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-32 pb-safe sm:pb-28 md:pb-8">
        <Outlet />
        <div className="h-14 md:hidden pointer-events-none" aria-hidden="true" />
      </main>

      {/* Fixed Mobile Bottom Navigation Bar (thumb-friendly, native app feel) */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-gray-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe transition-all"
      >
        <div className="grid grid-cols-5 h-14">
          {mobileNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`relative flex flex-col items-center justify-center py-1 transition-all select-none ${
                  active ? "text-emerald-600" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {/* Active indicator bar */}
                {active && (
                  <span className="absolute top-0 w-8 h-1 bg-emerald-600 rounded-full" />
                )}
                <div
                  className={`flex items-center justify-center w-8 h-7 rounded-xl transition-transform ${
                    active ? "scale-110" : ""
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      active ? "text-emerald-600 stroke-[2.4]" : "text-gray-400 stroke-[1.8]"
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] tracking-tight transition-all ${
                    active ? "font-bold text-emerald-700" : "font-normal text-gray-500"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

