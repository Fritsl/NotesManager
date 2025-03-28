import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Define color mapping from numeric values to hex colors
export const colorMap = {
  0: null, // Default/transparent
  1: "#f87171", // Red
  2: "#facc15", // Yellow
  3: "#4ade80", // Green
  4: "#60a5fa", // Blue
  5: "#c084fc", // Purple
};

// Define the available colors with numeric values
const colorOptions = [
  { value: 0 },
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
];

// Convert numeric color value to hex color
export const getColorFromValue = (colorValue: number | null): string | null => {
  if (colorValue === null || colorValue === 0 || !(colorValue in colorMap)) {
    return null;
  }
  return colorMap[colorValue as keyof typeof colorMap];
};

interface ColorPickerProps {
  colorValue: number | null;
  onChange: (colorValue: number) => void;
  className?: string;
}

export default function ColorPicker({ colorValue, onChange, className }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Get the actual color from the value
  const color = getColorFromValue(colorValue);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 p-1 touch-target relative",
            className
          )}
        >
          <div 
            className={cn(
              "w-5 h-5 rounded-sm",
              (!color || colorValue === 0) && "border border-dashed border-gray-500"
            )} 
            style={color ? { backgroundColor: color } : {}}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-2" side="top">
        <div className="grid grid-cols-3 gap-1">
          {colorOptions.map((option) => {
            const hexColor = getColorFromValue(option.value);
            return (
              <button
                key={option.value}
                className={cn(
                  "p-1 rounded-md w-8 h-8 flex items-center justify-center hover:bg-gray-700/50 relative",
                  colorValue === option.value && "ring-1 ring-primary ring-inset"
                )}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.value === 0 ? (
                  <div className="w-6 h-6 border border-dashed border-gray-500 rounded-sm"></div>
                ) : (
                  <div 
                    className="w-6 h-6 rounded-sm" 
                    style={{ backgroundColor: hexColor || undefined }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}