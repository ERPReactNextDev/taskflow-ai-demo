"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { type DateRange } from "react-day-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlobalDateContextType {
  /** Single selected date (for the top bar calendar trigger display) */
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  /** Date range used to filter all date-dependent data across the app */
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const GlobalDateContext = createContext<GlobalDateContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GlobalDateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDateState] = useState<Date>(new Date());
  const [dateRange, setDateRangeState] = useState<DateRange | undefined>(undefined);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    try {
      const savedDate = localStorage.getItem("globalSelectedDate");
      if (savedDate) {
        const d = new Date(savedDate);
        if (!isNaN(d.getTime())) setSelectedDateState(d);
      }
      const savedRange = localStorage.getItem("globalDateRange");
      if (savedRange) {
        const parsed = JSON.parse(savedRange);
        if (parsed) {
          setDateRangeState({
            from: parsed.from ? new Date(parsed.from) : undefined,
            to:   parsed.to   ? new Date(parsed.to)   : undefined,
          });
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const setSelectedDate = (date: Date) => {
    setSelectedDateState(date);
    try {
      localStorage.setItem("globalSelectedDate", date.toISOString());
    } catch {}
  };

  const setDateRange = (range: DateRange | undefined) => {
    setDateRangeState(range);
    try {
      if (range) {
        localStorage.setItem("globalDateRange", JSON.stringify({
          from: range.from?.toISOString(),
          to:   range.to?.toISOString(),
        }));
      } else {
        localStorage.removeItem("globalDateRange");
      }
    } catch {}
  };

  return (
    <GlobalDateContext.Provider value={{ selectedDate, setSelectedDate, dateRange, setDateRange }}>
      {children}
    </GlobalDateContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGlobalDate() {
  const ctx = useContext(GlobalDateContext);
  if (!ctx) throw new Error("useGlobalDate must be used within GlobalDateProvider");
  return ctx;
}
