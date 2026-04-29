"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface CityResult {
  name: string;
  country: string;
  state?: string;
  lat: number;
  lon: number;
  display: string;
}

interface CitySearchProps {
  apiKey: string;
  value: string;
  onChange: (city: CityResult | null) => void;
  label?: string;
  placeholder?: string;
}

export function CitySearch({
  apiKey,
  value,
  onChange,
  label,
  placeholder = "Search for a city...",
}: CitySearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
    setSelectedLabel(value);
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchCities = useCallback(async (q: string) => {
    if (!apiKey || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${apiKey}`
      );
      if (!res.ok) throw new Error("Geocoding API error");
      const data: { name: string; country: string; state?: string; lat: number; lon: number }[] = await res.json();
      setResults(
        data.map((item) => {
          const parts = [item.name, item.state, item.country].filter(Boolean);
          return {
            name: item.name,
            country: item.country,
            state: item.state,
            lat: item.lat,
            lon: item.lon,
            display: parts.join(", "),
          };
        })
      );
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchCities(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchCities]);

  const handleSelect = (city: CityResult) => {
    setSelectedLabel(city.display);
    setQuery(city.display);
    onChange(city);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    // If the user is typing, clear the selection
    if (val !== selectedLabel) {
      onChange(null);
    }
    setOpen(true);
  };

  const handleFocus = () => {
    if (query.length >= 2) setOpen(true);
  };

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant">
          {label}
        </label>
      )}
      <div className="relative">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-outline/30 bg-surface-container/60 pl-10 pr-10 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 backdrop-blur-sm transition-all duration-200 focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20"
          />
          {loading && (
            <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-on-surface-variant/50" />
          )}
        </div>

        <AnimatePresence>
          {open && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-outline-variant/40 bg-surface/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-2xl"
            >
              {results.map((city, i) => (
                <button
                  key={`${city.lat}-${city.lon}-${i}`}
                  onClick={() => handleSelect(city)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--theme-primary)]/10">
                    <MapPin size={14} className="text-[var(--theme-primary)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-on-surface truncate">
                      {city.name}
                    </p>
                    <p className="text-[11px] text-on-surface-variant/60 truncate">
                      {[city.state, city.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <span className="text-[10px] text-on-surface-variant/40 shrink-0 tabular-nums">
                    {city.lat.toFixed(2)}, {city.lon.toFixed(2)}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* No results hint */}
        <AnimatePresence>
          {open && query.length >= 2 && !loading && results.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 right-0 top-full z-50 mt-1 rounded-2xl border border-outline-variant/40 bg-surface/95 p-4 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl"
            >
              <p className="text-xs text-on-surface-variant/50">No cities found. Try a different search term.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
