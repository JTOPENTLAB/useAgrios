import { Link } from "react-router-dom";
import { MapPin, ShieldCheck, Sprout, Bookmark, Eye } from "lucide-react";
import { fmtMoney } from "@/lib/api";
import RatingPill from "./RatingPill";
import DeliveryBadge from "./DeliveryBadge";

const COUNTRY = {
  NG: { flag: "🇳🇬", name: "Nigeria" },
  GH: { flag: "🇬🇭", name: "Ghana" },
  KE: { flag: "🇰🇪", name: "Kenya" },
  CI: { flag: "🇨🇮", name: "Côte d'Ivoire" },
};

/**
 * Premium product card — shared by Marketplace, Explore, BuyerHome, SavedListings.
 *
 * Props:
 *   listing        — listing object from API
 *   to             — override link target (defaults to /app/marketplace/:id)
 *   onToggleSave   — optional; if provided, renders the bookmark button
 *   isSaved        — bookmark state
 *   testIdPrefix   — defaults to "product-card"
 */
export default function ProductCard({
  listing,
  to,
  onToggleSave,
  isSaved = false,
  testIdPrefix = "product-card",
}) {
  const l = listing;
  const currency = l.currency || "NGN";
  const country = COUNTRY[l.country_code] || COUNTRY.NG;
  const href = to || `/app/marketplace/${l.id}`;

  return (
    <Link
      to={href}
      className="af-card af-card-hover overflow-hidden relative group flex flex-col"
      data-testid={`${testIdPrefix}-${l.id}`}
    >
      {/* Save button */}
      {onToggleSave && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSave(l.id, e);
          }}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/95 hover:bg-white shadow-soft grid place-items-center transition"
          data-testid={`${testIdPrefix}-bookmark-${l.id}`}
          aria-label={isSaved ? "Unsave" : "Save"}
        >
          <Bookmark
            className={`w-4 h-4 ${isSaved ? "text-brand fill-brand" : "text-ink-muted"}`}
          />
        </button>
      )}

      {/* Image */}
      <div className="aspect-[4/3] bg-zinc-100 relative">
        {l.image_url ? (
          <img
            src={l.image_url}
            alt={l.crop}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-ink-muted">
            <Sprout className="w-10 h-10" />
          </div>
        )}
        <span
          className="absolute top-3 left-3 af-chip bg-white/95 text-[11px] shadow-soft"
          data-testid={`${testIdPrefix}-country-${l.id}`}
        >
          {country.flag} {country.name}
        </span>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-heading font-bold text-lg text-ink truncate">{l.crop}</h3>
            <div className="text-xs text-ink-muted mt-0.5 truncate">
              {l.variety || "—"} · Grade {l.grade}
            </div>
          </div>
          {l.farmer_verified && (
            <span
              className="af-badge-verified flex-shrink-0"
              data-testid={`${testIdPrefix}-verified-${l.id}`}
            >
              <ShieldCheck className="w-3 h-3" /> Verified
            </span>
          )}
        </div>

        {/* Location */}
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-ink-muted min-w-0">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {l.location}
            {country.name && l.location && !l.location.toLowerCase().includes(country.name.toLowerCase())
              ? `, ${country.name}`
              : ""}
          </span>
        </div>

        {/* Rating + Delivery */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <RatingPill
            seed={l.farmer_id || l.id}
            verified={l.farmer_verified}
            testId={`${testIdPrefix}-rating-${l.id}`}
          />
          <DeliveryBadge testId={`${testIdPrefix}-delivery-${l.id}`} />
          {(l.views || 0) > 5 && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"
              data-testid={`${testIdPrefix}-liquidity-${l.id}`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <Eye className="w-3 h-3" />
              {Math.min(Math.max(Math.floor((l.views || 0) / 8), 1), 12)} viewing
            </span>
          )}
        </div>

        {/* Price + Qty */}
        <div className="mt-4 pt-4 border-t border-zinc-100 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div
              className="font-heading font-extrabold text-2xl text-ink leading-none tracking-tight"
              data-testid={`${testIdPrefix}-price-${l.id}`}
            >
              {fmtMoney(l.price_per_kg, currency)}
              <span className="text-sm text-ink-muted font-normal">/kg</span>
            </div>
            <div
              className="text-xs text-ink-muted mt-1 font-semibold"
              data-testid={`${testIdPrefix}-qty-${l.id}`}
            >
              {Number(l.quantity_kg || 0).toLocaleString()}kg available
            </div>
          </div>
          {l.farmer_name && (
            <span className="af-chip text-[10px] whitespace-nowrap">
              by {l.farmer_name.split(" ")[0]}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
