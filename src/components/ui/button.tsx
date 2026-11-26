import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong active:scale-[0.985]",
  {
    variants: {
      variant: {
        primary: "bg-jade-600 text-white shadow-[0_10px_24px_-12px_rgba(11,122,90,0.8)] hover:bg-jade-700",
        secondary: "border border-line bg-panel text-heading shadow-[0_1px_0_rgba(8,20,15,0.02)] hover:border-accent-line hover:bg-accent-soft",
        ghost: "text-heading hover:bg-brand-soft",
        dark: "bg-forest text-white hover:bg-forest-700",
        danger: "bg-clay text-white hover:bg-clay/90",
        mango: "bg-mango-500 text-heading hover:bg-mango-400",
        link: "px-0 text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[0.95rem]",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
