"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

function Label({
  className = "",
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const classes = `label ${className}`.trim()
  return <LabelPrimitive.Root className={classes} {...props} />
}

export { Label }
