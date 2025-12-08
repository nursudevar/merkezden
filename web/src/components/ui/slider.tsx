"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

function Slider({
  className = "",
  defaultValue,
  value,
  min = 0,
  max = 100,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      orientation={orientation}
      className={`price-slider ${className}`.trim()}
      {...props}
    >
      <SliderPrimitive.Track className="price-slider-track">
        <SliderPrimitive.Range className="price-slider-range" />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="price-slider-thumb"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
