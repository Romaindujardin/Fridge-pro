import {
  ButtonHTMLAttributes,
  forwardRef,
  ReactElement,
  cloneElement,
} from "react";
import { cn } from "@/utils/cn";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "coral" | "secondary" | "outline" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  asChild?: boolean;
  children: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/25 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none";

    const variants = {
      primary:
        "bg-[#183328] hover:bg-[#214334] text-white shadow-soft-xs rounded-xl",
      coral:
        "bg-coral-500 hover:bg-coral-600 text-white shadow-soft-xs rounded-xl",
      secondary:
        "bg-[#F2EFE9] hover:bg-[#E8E4DC] text-[#1A1C19] border border-[#E8E5DF] rounded-xl",
      outline:
        "border border-[#E8E5DF] bg-white hover:bg-[#F8F6F2] text-[#1A1C19] rounded-xl shadow-soft-xs",
      ghost:
        "text-[#6F726D] hover:text-[#1A1C19] hover:bg-[#F2EFE9]/60 rounded-xl",
      danger:
        "bg-coral-600 hover:bg-coral-700 text-white shadow-soft-xs rounded-xl",
    };

    const sizes = {
      xs: "h-7 px-2.5 text-xs rounded-lg",
      sm: "h-8 px-3 text-xs sm:text-sm rounded-xl",
      md: "h-10 px-4 py-2 text-sm rounded-xl",
      lg: "h-12 px-6 text-base rounded-2xl",
    };

    const combinedClassName = cn(
      baseStyles,
      variants[variant],
      sizes[size],
      className
    );

    if (
      asChild &&
      children &&
      typeof children === "object" &&
      "type" in children
    ) {
      const child = children as ReactElement;
      return cloneElement(child, {
        ...child.props,
        className: cn(combinedClassName, child.props.className),
        ref,
      });
    }

    return (
      <button
        className={combinedClassName}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
