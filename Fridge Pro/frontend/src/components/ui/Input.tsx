import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, helper, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs sm:text-sm font-semibold text-stone-700 tracking-tight"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={clsx(
            "flex h-11 w-full rounded-xl border border-[#E8E5DF] bg-[#FAF8F5] hover:bg-[#F2EFE9] focus:bg-white px-3.5 py-2 text-sm text-[#1A1C19] transition-all placeholder:text-[#8E918B] focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-500/10 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-coral-400 bg-coral-50/20 focus:border-coral-500 focus:ring-coral-500/10",
            className
          )}
          ref={ref}
          {...props}
        />
        {helper && !error && <p className="text-xs text-[#6F726D]">{helper}</p>}
        {error && <p className="text-xs font-medium text-coral-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
