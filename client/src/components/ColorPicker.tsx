import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette } from "lucide-react";

// Define the available colors
const colorOptions = [
  { value: null, label: "None" },
  { value: "#f87171", label: "Red" },
  { value: "#facc15", label: "Yellow" },
  { value: "#4ade80", label: "Green" },
  { value: "#60a5fa", label: "Blue" },
  { value: "#c084fc", label: "Purple" },
];

interface ColorPickerProps {
  color: string | null;
  onChange: (color: string | null) => void;
  className?: string;
}

export default function ColorPicker({ color, onChange, className }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Helper to get the current color's label
  const getCurrentColorLabel = () => {
    const currentOption = colorOptions.find((option) => option.value === color);
    return currentOption ? currentOption.label : "None";
  };

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
          title="Change Note Color"
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <Palette size={16} className="text-gray-400" />
            {color && (
              <div 
                className="absolute bottom-0 right-0 rounded-full h-2 w-2" 
                style={{ backgroundColor: color }}
              />
            )}
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-2" side="top">
        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-400 mb-1 px-1">Select Color</div>
          <div className="grid grid-cols-3 gap-1">
            {colorOptions.map((option) => (
              <button
                key={option.label}
                className={cn(
                  "p-1 rounded-md w-9 h-9 text-center flex items-center justify-center hover:bg-gray-700/50 relative",
                  color === option.value && "ring-1 ring-primary ring-inset"
                )}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                title={option.label}
              >
                {option.value === null ? (
                  <div className="w-6 h-6 border border-dashed border-gray-500 rounded-sm flex items-center justify-center">
                    <span className="text-gray-400 text-[10px]">None</span>
                  </div>
                ) : (
                  <div 
                    className="w-6 h-6 rounded-sm" 
                    style={{ backgroundColor: option.value }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}