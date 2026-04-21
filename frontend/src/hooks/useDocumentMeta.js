import { useEffect } from "react";

/**
 * Lightweight document head manager — for route-specific <title> and meta description.
 * Primary OG/Twitter cards live in public/index.html for scraper reliability.
 */
export function useDocumentMeta({ title, description }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      let el = document.querySelector('meta[name="description"]');
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", "description");
        document.head.appendChild(el);
      }
      el.setAttribute("content", description);
    }
  }, [title, description]);
}
