"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDownIcon } from "lucide-react"

function Accordion({
  className = "",
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root className={`category-accordion ${className}`.trim()} {...props} />
}

function AccordionItem({
  className = "",
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={`category-accordion-item ${className}`.trim()}
      {...props}
    />
  )
}

function AccordionTrigger({
  className = "",
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="category-accordion-header">
      <AccordionPrimitive.Trigger
        className={`category-accordion-trigger ${className}`.trim()}
        {...props}
      >
        {children}
        <ChevronDownIcon className="category-accordion-icon" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className = "",
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className={`category-accordion-content ${className}`.trim()}
      {...props}
    >
      <div className="category-accordion-content-inner">{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
