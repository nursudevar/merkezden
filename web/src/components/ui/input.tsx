import * as React from "react"

function Input({ className = "", type, ...props }: React.ComponentProps<"input">) {
  const classes = `input ${className}`.trim()

  return (
    <input
      type={type}
      className={classes}
      {...props}
    />
  )
}

export { Input }
