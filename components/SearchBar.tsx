"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface Suggestion {
  ein: string;
  name: string;
  city: string;
  state: string;
}

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  size?: "default" | "lg";
  className?: string;
}

export function SearchBar({
  defaultValue = "",
  placeholder = "Search by name, EIN, city, or state…",
  autoFocus = false,
  size = "default",
  className,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&pageSize=6`);
      const data = await res.json();
      setSuggestions(data.organizations ?? []);
      setOpen(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSelect = (ein: string) => {
    setOpen(false);
    router.push(`/nonprofit/${ein}`);
  };

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit} className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
            size === "lg" ? "h-5 w-5" : "h-4 w-4"
          )} />
          <Input
            value={query}
            onChange={handleChange}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={cn(
              "pl-9",
              size === "lg" && "h-12 text-base pl-10"
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setSuggestions([]); setOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            </button>
          )}
        </div>
        <Button type="submit" size={size === "lg" ? "lg" : "default"}>
          Search
        </Button>
      </form>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.ein}
              type="button"
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between gap-3"
              onMouseDown={() => handleSelect(s.ein)}
            >
              <span className="font-medium truncate">{s.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{s.city}, {s.state}</span>
            </button>
          ))}
          <button
            type="button"
            className="w-full px-4 py-2.5 text-left text-sm text-primary hover:bg-accent border-t transition-colors"
            onMouseDown={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
          >
            See all results for &ldquo;{query}&rdquo;
          </button>
        </div>
      )}
    </div>
  );
}
