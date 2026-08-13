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
  addInstructorCompareItem,
  clearInstructorCompareItems,
  readInstructorCompareFromStorage,
  removeInstructorCompareItem,
  toggleInstructorCompareItem,
  writeInstructorCompareToStorage,
  type InstructorCompareItem,
} from "@/lib/instructorCompare";

type InstructorCompareContextValue = {
  items: InstructorCompareItem[];
  add: (item: InstructorCompareItem) => void;
  remove: (instructorId: number) => void;
  toggle: (item: InstructorCompareItem) => void;
  clear: () => void;
};

const InstructorCompareContext = createContext<InstructorCompareContextValue | null>(null);

export function InstructorCompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InstructorCompareItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readInstructorCompareFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeInstructorCompareToStorage(items);
  }, [hydrated, items]);

  const add = useCallback((item: InstructorCompareItem) => {
    setItems((prev) => addInstructorCompareItem(prev, item));
  }, []);

  const remove = useCallback((instructorId: number) => {
    setItems((prev) => removeInstructorCompareItem(prev, instructorId));
  }, []);

  const toggle = useCallback((item: InstructorCompareItem) => {
    setItems((prev) => toggleInstructorCompareItem(prev, item));
  }, []);

  const clear = useCallback(() => {
    setItems(clearInstructorCompareItems());
  }, []);

  const value = useMemo(
    () => ({ items, add, remove, toggle, clear }),
    [items, add, remove, toggle, clear],
  );

  return (
    <InstructorCompareContext.Provider value={value}>{children}</InstructorCompareContext.Provider>
  );
}

export function useInstructorCompare(): InstructorCompareContextValue {
  const context = useContext(InstructorCompareContext);
  if (!context) {
    throw new Error("useInstructorCompare must be used within InstructorCompareProvider");
  }
  return context;
}
