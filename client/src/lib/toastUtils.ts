import { toast } from "@/hooks/use-toast";

/**
 * Error-only toast utility - shows toasts only for errors, silently ignores success messages
 * @param options Toast options
 */
export function showToast(options: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) {
  // Only show toasts for errors (destructive variant)
  if (options.variant === "destructive") {
    toast(options);
  }
  // All success toasts are silently ignored
}