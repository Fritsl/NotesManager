// Color utilities for handling numeric colors in notes

// Define color mapping from numeric values to hex colors
export const colorMap = {
  0: null,         // Default/transparent
  1: "#f87171",    // Red
  2: "#facc15",    // Yellow
  3: "#4ade80",    // Green
  4: "#60a5fa",    // Blue
  5: "#c084fc",    // Purple
};

// Reverse mapping from hex color to numeric value
export const hexToColorValue: Record<string, number> = Object.entries(colorMap).reduce(
  (acc, [key, value]) => {
    if (value !== null) {
      acc[value] = parseInt(key, 10);
    }
    return acc;
  },
  {} as Record<string, number>
);

// Convert numeric color value to hex color
export const getColorFromValue = (colorValue: number | null): string | null => {
  if (colorValue === null || colorValue === 0 || !(colorValue in colorMap)) {
    return null;
  }
  return colorMap[colorValue as keyof typeof colorMap];
};

// Convert hex color to numeric value, with fallback to 0 (transparent)
export const getValueFromColor = (hexColor: string | null): number => {
  if (!hexColor) return 0;
  return hexColor in hexToColorValue ? hexToColorValue[hexColor] : 0;
};

// Convert legacy string color values to numeric values
export const convertLegacyColorToValue = (color: string | number | null): number => {
  // If it's already a number, return it (but ensure it's in valid range)
  if (typeof color === 'number') {
    return color >= 0 && color <= 5 ? color : 0;
  }
  // If it's a string, convert to numeric value
  if (typeof color === 'string') {
    return getValueFromColor(color);
  }
  // Default to 0 for null
  return 0;
};

// Get background color style with transparency for notes
export const getNoteBackgroundStyle = (colorValue: number | null) => {
  const color = getColorFromValue(colorValue);
  return color ? { backgroundColor: `${color}25` } : {}; // 25 is hex for 15% opacity
};