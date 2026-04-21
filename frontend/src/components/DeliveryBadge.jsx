import { Truck } from "lucide-react";

/**
 * Delivery estimate badge. For now static 2-3 days (same-country). Will accept
 * real ETA from logistics service once routing engine is wired.
 */
export default function DeliveryBadge({ eta = "2–3 days", testId, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-800 border border-blue-100 text-[11px] px-2 py-1 font-semibold ${className}`}
      data-testid={testId}
    >
      <Truck className="w-3 h-3" /> {eta}
    </span>
  );
}
