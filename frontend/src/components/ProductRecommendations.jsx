import { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import ProductCard from "./ProductCard";

/**
 * Related-products block for the product-detail page.
 * Pulls /api/recommendations/product/{listingId}.
 */
export default function ProductRecommendations({ listingId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    api
      .get(`/recommendations/product/${listingId}`)
      .then((r) => setData(r.data))
      .catch(() => setData({ same_crop: [], same_region: [] }))
      .finally(() => setLoading(false));
  }, [listingId]);

  if (loading) return null;
  if (!data) return null;

  const hasSameCrop = data.same_crop && data.same_crop.length > 0;
  const hasSameRegion = data.same_region && data.same_region.length > 0;
  if (!hasSameCrop && !hasSameRegion) return null;

  return (
    <div className="space-y-8" data-testid="product-recommendations">
      {hasSameCrop && (
        <section className="space-y-3" data-testid="recs-same-crop">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand grid place-items-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-ink">Other farmers selling the same crop</h3>
                <div className="text-xs text-ink-muted">Compare prices, grades and delivery.</div>
              </div>
            </div>
            <Link to="/app/marketplace" className="text-sm font-semibold text-brand inline-flex items-center gap-1">
              Browse <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data.same_crop.slice(0, 4).map((l) => (
              <ProductCard key={l.id} listing={l} testIdPrefix="rec-same-crop" />
            ))}
          </div>
        </section>
      )}

      {hasSameRegion && (
        <section className="space-y-3" data-testid="recs-same-region">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gold/10 text-gold-dark grid place-items-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-ink">Popular in this region</h3>
              <div className="text-xs text-ink-muted">Trending produce from nearby farmers.</div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data.same_region.slice(0, 4).map((l) => (
              <ProductCard key={l.id} listing={l} testIdPrefix="rec-same-region" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
