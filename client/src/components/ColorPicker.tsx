import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette } from "lucide-react";

// Define the available colors (without labels)
const colorOptions = [
  { value: null },
  { value: "#f87171" },
  { value: "#facc15" },
  { value: "#4ade80" },
  { value: "#60a5fa" },
  { value: "#c084fc" },
];

interface ColorPickerProps {
  color: string | null;
  onChange: (color: string | null) => void;
  className?: string;
}

export default function ColorPicker({ color, onChange, className }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

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
        <div className="grid grid-cols-3 gap-1">
          {colorOptions.map((option, index) => (
            <button
              key={index}
              className={cn(
                "p-1 rounded-md w-8 h-8 flex items-center justify-center hover:bg-gray-700/50 relative",
                color === option.value && "ring-1 ring-primary ring-inset"
              )}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.value === null ? (
                <div className="w-6 h-6 border border-dashed border-gray-500 rounded-sm"></div>
              ) : (
                <div 
                  className="w-6 h-6 rounded-sm" 
                  style={{ backgroundColor: option.value }}
                />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}