"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default: "bg-teal-600 text-white hover:bg-teal-500 shadow-sm shadow-teal-900/30",
      secondary: "bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600",
      outline: "border border-slate-600 bg-transparent hover:bg-slate-800 text-slate-300",
      ghost: "hover:bg-slate-800 text-slate-300",
      destructive: "bg-red-600 text-white hover:bg-red-500",
    };
    const sizes = {
      default: "h-10 px-5 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-8 text-lg",
      icon: "h-10 w-10",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f1a] disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-800 bg-[#111827] shadow-lg shadow-black/20",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-semibold text-lg leading-none tracking-tight text-white", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-400", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, ...props }: InputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <input
        className={cn(
          "w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all",
          className
        )}
        {...props}
      />
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <textarea
        className={cn(
          "w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none",
          className
        )}
        rows={3}
        {...props}
      />
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({
  label,
  options,
  placeholder,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <select
        className={cn(
          "w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Slider ───────────────────────────────────────────────────────────────────

interface SliderProps {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  marks?: number[];
}

export function Slider({ label, value, onChange, min, max, step, marks }: SliderProps) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between">
          <label className="text-sm font-medium text-slate-300">{label}</label>
          <span className="text-sm font-bold text-teal-400">{value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-teal-500"
      />
      {marks && (
        <div className="flex justify-between text-xs text-slate-500">
          {marks.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BubbleSelect ─────────────────────────────────────────────────────────────

interface BubbleOption {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface BubbleSelectProps {
  label?: string;
  options: BubbleOption[];
  selected: string | string[];
  onSelect: (id: string) => void;
  multi?: boolean;
  layout?: "wrap" | "grid";
  columns?: 2 | 3 | 4;
  fullWidth?: boolean;
}

export function BubbleSelect({
  label,
  options,
  selected,
  onSelect,
  multi = false,
  layout = "wrap",
  columns = 2,
  fullWidth = false,
}: BubbleSelectProps) {
  const isSelected = (id: string) =>
    Array.isArray(selected) ? selected.includes(id) : selected === id;

  const gridCols =
    columns === 4 ? "grid-cols-4" : columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className="space-y-3">
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <div
        className={cn(
          layout === "grid" ? `grid ${gridCols} gap-2` : "flex flex-wrap gap-2"
        )}
      >
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className={cn(
              "bubble-option px-4 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer text-left",
              layout === "grid" && fullWidth && "w-full",
              isSelected(opt.id)
                ? "active border-teal-500 bg-teal-500/10 text-teal-300"
                : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300"
            )}
          >
            <div className="flex items-center justify-start gap-2">
              {opt.icon && <span className="inline-flex items-center">{opt.icon}</span>}
              <span>{opt.label}</span>
            </div>
            {opt.description && (
              <p className="text-xs mt-1 opacity-70 text-left">{opt.description}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={cn(
            "w-11 h-6 rounded-full transition-colors",
            checked ? "bg-teal-600" : "bg-slate-700"
          )}
        />
        <div
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
            checked && "translate-x-5"
          )}
        />
      </div>
      {label && <span className="text-sm font-medium text-slate-300">{label}</span>}
    </label>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-slate-800", className)} />
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning";
  className?: string;
}) {
  const variants = {
    default: "bg-slate-800 text-slate-300 border border-slate-700",
    success: "bg-emerald-900/40 text-emerald-400 border border-emerald-800",
    warning: "bg-amber-900/40 text-amber-400 border border-amber-800",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
