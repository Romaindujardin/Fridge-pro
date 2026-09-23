import React from "react";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";

export interface FreshnessBadgeProps {
  expiryDate?: string | Date | null;
  className?: string;
  showDays?: boolean;
}

export function FreshnessBadge({
  expiryDate,
  className = "",
  showDays = true,
}: FreshnessBadgeProps) {
  if (!expiryDate) {
    return null;
  }

  const expiry = new Date(expiryDate);
  const now = new Date();

  // Mettre les heures à zéro pour comparer les dates du calendrier de manière juste
  const expiryStartOfDay = new Date(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate()
  ).getTime();
  const nowStartOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const diffTime = expiryStartOfDay - nowStartOfDay;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // Expiré
  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50/90 text-rose-800 border border-rose-200/80 shadow-xs ${className}`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
        </span>
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span>
          {showDays ? `Expiré (il y a ${daysAgo} j)` : "Expiré"}
        </span>
      </div>
    );
  }

  // Expire aujourd'hui
  if (diffDays === 0) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50/90 text-orange-800 border border-orange-200/80 shadow-xs animate-pulse ${className}`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
        </span>
        <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
        <span>Expire aujourd'hui</span>
      </div>
    );
  }

  // Expire très bientôt (dans 1 à 3 jours)
  if (diffDays <= 3) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50/90 text-amber-800 border border-amber-200/80 shadow-xs ${className}`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>
          {diffDays === 1
            ? "Expire demain"
            : showDays
            ? `Expire dans ${diffDays} jours`
            : "Expire bientôt"}
        </span>
      </div>
    );
  }

  // Frais (plus de 3 jours) - Pas d'emote/icône superflue, style épuré
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50/90 text-emerald-800 border border-emerald-200/80 shadow-xs ${className}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span>{showDays ? `Frais • ${diffDays} j restants` : "Frais"}</span>
    </div>
  );
}
