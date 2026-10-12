import { useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries();
      }
    };
    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);
    return () => {
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("focus", handleResume);
    };
  }, [queryClient]);

  const navigation = [
    { name: "Accueil", href: "/", icon: Home },
    { name: "Mon Frigo", href: "/fridge", icon: Refrigerator },
    { name: "Recettes", href: "/recipes", icon: ChefHat },
    { name: "Courses", href: "/shopping-list", icon: ShoppingCart },
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
    <div className="min-h-screen bg-[#F8F6F2] text-[#1A1C19] flex flex-col font-sans selection:bg-primary-100 selection:text-primary-800">
            {/* Top Navbar */}
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E8E5DF] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-[#183328] text-white flex items-center justify-center shadow-soft-xs group-hover:scale-105 transition-transform">
                  <Refrigerator className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-lg sm:text-xl font-bold tracking-tight text-[#1A1C19]">
                  Fridge<span className="text-primary-600 font-medium ml-0.5">Pro</span>
                </span>
              </Link>
            </div>

            {/* Desktop Navigation links */}
            <div className="hidden md:flex items-center p-1 bg-[#F2EFE9] rounded-xl border border-[#E8E5DF]">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm transition-all ${
                      active
                        ? "text-[#183328] bg-white shadow-soft-xs font-semibold"
                        : "text-[#6F726D] hover:text-[#1A1C19] hover:bg-white/50 font-medium"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        active ? "text-primary-600 stroke-[2.2]" : "text-[#8E918B] stroke-[1.8]"
                      }`}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* User menu & Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/profile"
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm transition-all ${
                  isActive("/profile")
                    ? "text-primary-800 bg-primary-50 border border-primary-200/80 font-semibold"
                    : "text-[#1A1C19] hover:bg-black/5 font-medium"
                }`}
                title="Mon Profil"
              >
                <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-xs ring-1 ring-primary-300">
                  {user?.firstName ? user.firstName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                </div>
                <span className="hidden sm:inline-block font-semibold text-[#1A1C19] text-xs sm:text-sm">
                  {user ? user.firstName : "Profil"}
                </span>
              </Link>

              <button
                onClick={logout}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[#8E918B] hover:text-coral-600 hover:bg-coral-50 transition-colors"
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-44 sm:pb-36 md:pb-12">
        <Outlet />
      </main>

      {/* Modern Floating Mobile Dock */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] inset-x-3 max-w-md mx-auto z-40 bg-white/95 backdrop-blur-2xl border border-[#E8E5DF] rounded-2xl shadow-float transition-all"
      >
        <div className="grid grid-cols-5 py-1.5 px-1 items-center">
          {mobileNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`relative flex flex-col items-center justify-center py-1 transition-all select-none rounded-xl ${
                  active ? "text-primary-800 font-bold" : "text-[#8E918B] hover:text-[#1A1C19]"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-6 rounded-lg transition-all ${
                    active ? "bg-primary-50 scale-105" : ""
                  }`}
                >
                  <Icon
                    className={`w-4.5 h-4.5 transition-colors ${
                      active ? "text-primary-600 stroke-[2.2]" : "text-[#8E918B] stroke-[1.8]"
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 transition-all ${
                    active ? "font-bold text-primary-800" : "font-medium text-[#6F726D]"
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
