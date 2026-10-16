"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { cn } from "@/src/lib/utils";

interface AuthFieldProps extends React.ComponentProps<"input"> {
  label: string;
  icon: LucideIcon;
  error?: string;
  labelAction?: React.ReactNode;
  trailing?: React.ReactNode;
}

/** Input bergaya halaman auth MANGO: ikon kiri, latar muted, pesan error di bawah. */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ label, icon: Icon, error, labelAction, trailing, id, type, className, ...props }, ref) => {
    const [show, setShow] = useState(false);
    const isPassword = type === "password";
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={id} className="text-sm font-medium text-muted-foreground">
            {label}
          </Label>
          {labelAction}
        </div>
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
            <Icon size={18} strokeWidth={1.5} />
          </div>
          <Input
            ref={ref}
            id={id}
            type={isPassword && show ? "text" : type}
            aria-invalid={!!error}
            className={cn("pl-10 h-12 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background", (isPassword || trailing) && "pr-12", className)}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShow((s) => !s)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          ) : (
            trailing && <div className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</div>
          )}
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>
    );
  }
);
AuthField.displayName = "AuthField";
