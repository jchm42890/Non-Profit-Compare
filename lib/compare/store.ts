"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CompareEntry } from "@/types";

const MAX_COMPARE = 6;

interface CompareState {
  entries: CompareEntry[];
  add: (entry: CompareEntry) => void;
  remove: (ein: string) => void;
  clear: () => void;
  has: (ein: string) => boolean;
  isFull: () => boolean;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      entries: [],

      add(entry) {
        const { entries } = get();
        if (entries.length >= MAX_COMPARE) return;
        if (entries.some((e) => e.ein === entry.ein)) return;
        set({ entries: [...entries, entry] });
      },

      remove(ein) {
        set({ entries: get().entries.filter((e) => e.ein !== ein) });
      },

      clear() {
        set({ entries: [] });
      },

      has(ein) {
        return get().entries.some((e) => e.ein === ein);
      },

      isFull() {
        return get().entries.length >= MAX_COMPARE;
      },
    }),
    {
      name: "nonprofit-compare",
      storage: createJSONStorage(() => {
        // Guard against SSR where localStorage is unavailable
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
    }
  )
);

export const MAX_COMPARE_ITEMS = MAX_COMPARE;
