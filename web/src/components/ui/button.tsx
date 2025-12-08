import * as React from "react"

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"

function Button({
  className = "",
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant
  size?: ButtonSize
    asChild?: boolean
  }) {
  const variantClass = variant !== "default" ? `button-${variant}` : "button"
  const sizeClass = size !== "default" ? `button-${size}` : ""
  const classes = [variantClass, sizeClass, className].filter(Boolean).join(" ")

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      className: `${classes} ${(children.props as any).className || ""}`.trim(),
      ...(props as any),
    } as any)
  }

  return (
    <button
      className={classes}
      {...props}
    >
      {children}
    </button>
  )
}

export { Button }
