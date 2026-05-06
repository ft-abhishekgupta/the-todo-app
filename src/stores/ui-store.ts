"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  fullscreen: boolean;
  toggleFullscreen: () => void;
  setFullscreen: (value: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      fullscreen: false,
      toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
      setFullscreen: (value) => set({ fullscreen: value }),
    }),
    { name: "thetodoapp-ui" }
  )
);
