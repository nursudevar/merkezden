"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addInstitutionCompareItem,
  clearInstitutionCompareItems,
  readInstitutionCompareFromStorage,
  removeInstitutionCompareItem,
  toggleInstitutionCompareItem,
  writeInstitutionCompareToStorage,
  type InstitutionCompareItem,
} from "@/lib/institutionCompare";

type InstitutionCompareContextValue = {
  items: InstitutionCompareItem[];
  add: (item: InstitutionCompareItem) => void;
  remove: (institutionId: number) => void;
  toggle: (item: InstitutionCompareItem) => void;
  clear: () => void;
};

const InstitutionCompareContext = createContext<InstitutionCompareContextValue | null>(null);

export function InstitutionCompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InstitutionCompareItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readInstitutionCompareFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeInstitutionCompareToStorage(items);
  }, [hydrated, items]);

  const add = useCallback((item: InstitutionCompareItem) => {
    setItems((prev) => addInstitutionCompareItem(prev, item));
  }, []);

  const remove = useCallback((institutionId: number) => {
    setItems((prev) => removeInstitutionCompareItem(prev, institutionId));
  }, []);

  const toggle = useCallback((item: InstitutionCompareItem) => {
    setItems((prev) => toggleInstitutionCompareItem(prev, item));
  }, []);

  const clear = useCallback(() => {
    setItems(clearInstitutionCompareItems());
  }, []);

  const value = useMemo(
    () => ({ items, add, remove, toggle, clear }),
    [items, add, remove, toggle, clear],
  );

  return (
    <InstitutionCompareContext.Provider value={value}>{children}</InstitutionCompareContext.Provider>
  );
}

export function useInstitutionCompare(): InstitutionCompareContextValue {
  const context = useContext(InstitutionCompareContext);
  if (!context) {
    throw new Error("useInstitutionCompare must be used within InstitutionCompareProvider");
  }
  return context;
}
