import * as React from "react"

function Card({ className = "", ...props }: React.ComponentProps<"div">) {
  const classes = `card ${className}`.trim()
  return <div className={classes} {...props} />
}

function CardHeader({ className = "", ...props }: React.ComponentProps<"div">) {
  const classes = `card-header ${className}`.trim()
  return <div className={classes} {...props} />
}

function CardTitle({ className = "", ...props }: React.ComponentProps<"div">) {
  const classes = `card-title ${className}`.trim()
  return <div className={classes} {...props} />
}

function CardDescription({ className = "", ...props }: React.ComponentProps<"div">) {
  const classes = `card-description ${className}`.trim()
  return <div className={classes} {...props} />
}

function CardAction({ className = "", ...props }: React.ComponentProps<"div">) {
  const classes = `card-action ${className}`.trim()
  return <div className={classes} {...props} />
}

function CardContent({ className = "", ...props }: React.ComponentProps<"div">) {
  const classes = `card-content ${className}`.trim()
  return <div className={classes} {...props} />
}

function CardFooter({ className = "", ...props }: React.ComponentProps<"div">) {
  const classes = `card-footer ${className}`.trim()
  return <div className={classes} {...props} />
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
