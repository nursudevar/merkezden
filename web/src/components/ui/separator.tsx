"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

function Separator({
  className = "",
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  const orientationClass = orientation === "vertical" ? "filter-divider-vertical" : "filter-divider";
  
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={`${orientationClass} ${className}`.trim()}
      {...props}
    />
  )
}

export { Separator }
