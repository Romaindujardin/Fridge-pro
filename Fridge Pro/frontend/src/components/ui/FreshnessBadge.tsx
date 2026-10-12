import React from "react";
import { Clock, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

export interface FreshnessBadgeProps {
  expiryDate?: string | Date | null;
  isEstimated?: boolean | null;
  className?: string;
  showDays?: boolean;
}

export function FreshnessBadge({
  expiryDate,
  isEstimated = false,
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-coral-50 text-coral-800 border border-coral-200/80 shadow-soft-xs ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-coral-500"></span>
        </span>
        <AlertCircle className="w-3.5 h-3.5 text-coral-600 shrink-0" />
        <span>
          {showDays
            ? `Expiré (${isEstimated ? "~" : ""}${daysAgo} j${isEstimated ? " • estimé" : ""})`
            : isEstimated
            ? "Expiré (estimé)"
            : "Expiré"}
        </span>
      </div>
    );
  }

  // Expire aujourd'hui
  if (diffDays === 0) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200/80 shadow-soft-xs animate-pulse ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
        </span>
        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>{isEstimated ? "Expire aujourd'hui (~estimé)" : "Expire aujourd'hui"}</span>
      </div>
    );
  }

  // Expire très bientôt (dans 1 à 3 jours)
  if (diffDays <= 3) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50/70 text-amber-900 border border-amber-200/70 shadow-soft-xs ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
        </span>
        <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>
          {diffDays === 1
            ? isEstimated
              ? "Expire demain (~estimé)"
              : "Expire demain"
            : showDays
            ? `Dans ${isEstimated ? "~" : ""}${diffDays} j${isEstimated ? " (estimé)" : ""}`
            : "Expire bientôt"}
        </span>
      </div>
    );
  }

  // Frais (plus de 3 jours)
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-900 border border-primary-200/70 shadow-soft-xs ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-500"></span>
      </span>
      <span>
        {showDays
          ? `Frais • ${isEstimated ? "~" : ""}${diffDays} j${isEstimated ? " (~)" : ""}`
          : "Frais"}
      </span>
    </div>
  );
}
