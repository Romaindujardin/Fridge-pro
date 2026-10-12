import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { clsx } from "clsx";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  className,
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Overlay with subtle blur */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet */}
      <div
        className={clsx(
          "relative bg-white w-full rounded-t-[2.5rem] sm:rounded-3xl shadow-float border border-[#E8E5DF] flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom-6 duration-200 sm:zoom-in-95",
          sizes[size],
          className
        )}
      >
        {/* Mobile drag handle indicator */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 bg-[#E8E5DF] rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-[#E8E5DF] shrink-0">
            <h2 className="text-base sm:text-lg font-bold text-[#1A1C19] tracking-tight line-clamp-1">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-[#8E918B] hover:text-[#1A1C19] transition-colors rounded-full bg-[#F2EFE9] hover:bg-[#E8E5DF]"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-5 sm:p-7 overflow-y-auto overscroll-contain flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
