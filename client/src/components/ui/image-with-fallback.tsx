import { useState } from "react";
import { Image } from "lucide-react";

interface ImageWithFallbackProps {
  url: string;
  alt: string;
  className?: string;
}

/**
 * A component that displays an image with a fallback when the image fails to load
 */
export default function ImageWithFallback({ url, alt, className }: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-400">
        <Image size={24} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}