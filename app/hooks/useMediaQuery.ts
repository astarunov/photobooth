"use client";

import { useState, useEffect } from "react";

/**
 * A simple custom hook that checks if a given CSS media query matches.
 * Usage: const isDesktop = useMediaQuery("(min-width: 768px)");
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(query);
    // Set initial value
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    // Listener callback
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}
