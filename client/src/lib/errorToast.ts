import { toast } from "@/hooks/use-toast";

/**
 * Handle toast notifications - only show error toasts, not success ones
 * @param params Object containing toast parameters
 */
export function handleToast(params: {
  title: string;
  description?: string;
  variant?: "default" | "destructive" | null;
  error?: boolean;
}) {
  // Only show the toast if it's an error or explicitly marked as one
  if (params.variant === "destructive" || params.error) {
    toast({
      title: params.title,
      description: params.description,
      variant: "destructive",
    });
  }
  // Success toasts are not shown (return silently)
}