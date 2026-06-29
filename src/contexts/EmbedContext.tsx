import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface EmbedParams {
  dealer?: string;
  make?: string;
  model?: string;
  mm?: string;
  branchCode?: string;
}

const DEFAULT_DEALER = import.meta.env.VITE_DEFAULT_DEALER as string | undefined;

const EmbedContext = createContext<EmbedParams>({});

export function EmbedProvider({ children }: { children: ReactNode }) {
  const value = useMemo<EmbedParams>(() => {
    if (typeof window === "undefined") return { dealer: DEFAULT_DEALER };
    const sp = new URLSearchParams(window.location.search);
    const pick = (k: string) => sp.get(k)?.trim() || undefined;
    return {
      dealer: pick("dealer") ?? DEFAULT_DEALER,
      make: pick("make"),
      model: pick("model"),
      mm: pick("mm"),
      branchCode: pick("branchCode"),
    };
  }, []);
  return <EmbedContext.Provider value={value}>{children}</EmbedContext.Provider>;
}

export function useEmbed() {
  return useContext(EmbedContext);
}
