import {
  ButtonHTMLAttributes,
  forwardRef,
  ReactElement,
  cloneElement,
} from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
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
      "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      primary: "bg-primary-600 text-white hover:bg-primary-700",
      secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
      outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
      ghost: "text-gray-700 hover:bg-gray-100",
      danger: "bg-red-600 text-white hover:bg-red-700",
    };

    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 py-2",
      lg: "h-12 px-6 text-lg",
    };

    const combinedClassName = clsx(
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
        className: clsx(combinedClassName, child.props.className),
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
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
