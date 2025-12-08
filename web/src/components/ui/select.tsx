"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value {...props} />
}

function SelectTrigger({
  className = "",
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  const sizeClass = size === "sm" ? "select-trigger-sm" : "select-trigger-default";
  const classes = className ? `${sizeClass} ${className}`.trim() : sizeClass;
  
  return (
    <SelectPrimitive.Trigger
      className={classes}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="select-trigger-icon" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className = "",
  children,
  position = "popper",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  const positionClass = position === "popper" ? "select-content-popper" : "select-content";
  const classes = className ? `${positionClass} ${className}`.trim() : positionClass;
  
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={classes}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="select-viewport">
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className = "",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  const classes = `select-label ${className}`.trim()
  return (
    <SelectPrimitive.Label
      className={classes}
      {...props}
    />
  )
}

function SelectItem({
  className = "",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  const classes = className ? `select-item ${className}`.trim() : "select-item";
  
  return (
    <SelectPrimitive.Item
      className={classes}
      {...props}
    >
      <span className="select-item-indicator">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="select-item-check-icon" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className = "",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  const classes = className ? `select-separator ${className}`.trim() : "select-separator";
  return (
    <SelectPrimitive.Separator
      className={classes}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className = "",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  const classes = className ? `select-scroll-button ${className}`.trim() : "select-scroll-button";
  return (
    <SelectPrimitive.ScrollUpButton
      className={classes}
      {...props}
    >
      <ChevronUpIcon className="select-scroll-icon" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className = "",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  const classes = className ? `select-scroll-button ${className}`.trim() : "select-scroll-button";
  return (
    <SelectPrimitive.ScrollDownButton
      className={classes}
      {...props}
    >
      <ChevronDownIcon className="select-scroll-icon" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
