import { forwardRef } from "react";

type Variant = "ghost" | "icon" | "accent";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "ghost", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`btn btn-${variant} ${className}`.trim()}
      {...props}
    />
  ),
);

Button.displayName = "Button";
