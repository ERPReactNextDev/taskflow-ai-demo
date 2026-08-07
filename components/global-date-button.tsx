"use client";

import React, { useState, useRef, useEffect } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { type DateRange } from "react-day-picker";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}
function startOfDay(d: Date) {
  const out = new Date(d); out.setHours(0, 0, 0, 0); return out;
}
function endOfDay(d: Date) {
  const out = new Date(d); out.setHours(23, 59, 59, 999); return out;
}
function fmtShort(d: Date) {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}
function isInRange(day: Date, range: DateRange | undefined) {
  if (!range?.from || !range?.to) return false;
  return day > range.from && day < range.to;
}
function isRangeStart(day: Date, range: DateRange | undefined) {
  return !!range?.from && isSameDay(day, range.from);
}
function isRangeEnd(day: Date, range: DateRange | undefined) {
  return !!range?.to && isSameDay(day, range.to);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GlobalDateButton() {
  const { dateRange, setDateRange } = useGlobalDate();
  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  // Track intermediate "from" picked, waiting for "to"
  const [pendingFrom, setPendingFrom] = useState<Date | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPendingFrom(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setPendingFrom(null); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleOpen = () => {
    // Sync view to current range start (or today)
    const anchor = dateRange?.from ?? today;
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth());
    setOpen(true);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleDayClick = (day: number) => {
    const clicked = new Date(viewYear, viewMonth, day);

    if (!pendingFrom) {
      // First click: set "from", wait for "to"
      setPendingFrom(startOfDay(clicked));
    } else {
      // Second click: finalize range
      const from = pendingFrom;
      const to = endOfDay(clicked);

      if (isSameDay(from, clicked)) {
        // Same day twice = single-day range
        setDateRange({ from: startOfDay(from), to: endOfDay(from) });
      } else if (clicked < from) {
        // Clicked before "from" → swap
        setDateRange({ from: startOfDay(clicked), to: endOfDay(from) });
      } else {
        setDateRange({ from, to });
      }
      setPendingFrom(null);
      setOpen(false);
    }
  };

  // Preview range while hovering (after first click)
  const getPreviewRange = (): DateRange | undefined => {
    if (!pendingFrom || !hoverDate) return dateRange;
    if (hoverDate < pendingFrom) return { from: startOfDay(hoverDate), to: endOfDay(pendingFrom) };
    return { from: pendingFrom, to: endOfDay(hoverDate) };
  };

  const displayRange = getPreviewRange();

  const clearRange = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDateRange(undefined);
    setPendingFrom(null);
  };

  // ── Trigger label ──────────────────────────────────────────────────────────
  let label: string;
  if (dateRange?.from && dateRange?.to) {
    if (isSameDay(dateRange.from, dateRange.to)) {
      label = fmtShort(dateRange.from);
    } else {
      label = `${fmtShort(dateRange.from)} – ${fmtShort(dateRange.to)}`;
    }
  } else if (dateRange?.from) {
    label = `${fmtShort(dateRange.from)} – ?`;
  } else {
    label = `${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  }

  const hasRange = !!(dateRange?.from);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstWeekday = getFirstWeekday(viewYear, viewMonth);

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger button ── */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className={[
          "h-8 gap-1.5 text-xs font-medium px-3 shadow-none",
          hasRange
            ? "border-gray-900 bg-gray-900 text-white hover:bg-gray-800 hover:text-white hover:border-gray-800"
            : "border-gray-200 bg-white hover:bg-gray-50",
        ].join(" ")}
        aria-label="Select date range"
        aria-expanded={open}
      >
        <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${hasRange ? "text-white" : "text-gray-500"}`} />
        <span className="hidden sm:inline max-w-[180px] truncate">{label}</span>
        {hasRange && (
          <span
            role="button"
            tabIndex={0}
            onClick={clearRange}
            onKeyDown={e => e.key === "Enter" && clearRange(e as any)}
            className="ml-1 rounded-full hover:bg-white/20 p-0.5 cursor-pointer"
            aria-label="Clear date range"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </Button>

      {/* ── Popover calendar ── */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 w-[300px] rounded-lg border border-gray-200 bg-white shadow-lg select-none"
          role="dialog"
          aria-label="Date range picker"
        >
          {/* Instruction hint */}
          <div className="px-3 pt-2.5 pb-1 text-center">
            <p className="text-[10px] text-gray-400 font-medium">
              {pendingFrom
                ? `From ${fmtShort(pendingFrom)} — pick end date`
                : "Click start date, then end date"}
            </p>
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between px-3 pb-2">
            <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500" aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-gray-800 tracking-wide">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-0.5">
              <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500" aria-label="Next month">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setOpen(false); setPendingFrom(null); }}
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                aria-label="Close calendar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-2 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 px-2 pb-2">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e-${i}`} />)}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const cellDate = new Date(viewYear, viewMonth, day);
              const isStart = isRangeStart(cellDate, displayRange);
              const isEnd = isRangeEnd(cellDate, displayRange);
              const inRange = isInRange(cellDate, displayRange);
              const isTodayCell = isSameDay(cellDate, today);
              const isPendingStart = !!pendingFrom && isSameDay(cellDate, pendingFrom);

              let cls = "relative flex items-center justify-center h-8 w-full text-xs font-medium transition-all duration-75 cursor-pointer ";

              if (isStart || isEnd || isPendingStart) {
                cls += "bg-gray-900 text-white font-bold rounded-md z-10 ";
              } else if (inRange) {
                cls += "bg-gray-100 text-gray-800 rounded-none ";
              } else if (isTodayCell) {
                cls += "border border-gray-400 text-gray-800 font-bold rounded-md hover:bg-gray-100 ";
              } else {
                cls += "text-gray-700 hover:bg-gray-100 rounded-md ";
              }

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  onMouseEnter={() => setHoverDate(cellDate)}
                  onMouseLeave={() => setHoverDate(null)}
                  className={cls}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                const now = new Date();
                setViewYear(now.getFullYear());
                setViewMonth(now.getMonth());
                setDateRange({ from: startOfDay(now), to: endOfDay(now) });
                setPendingFrom(null);
                setOpen(false);
              }}
              className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-md px-2 py-1.5 transition-colors"
            >
              Today
            </button>

            {pendingFrom && (
              <button
                onClick={() => setPendingFrom(null)}
                className="text-[11px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md px-2 py-1.5 transition-colors"
              >
                Reset
              </button>
            )}

            {hasRange && !pendingFrom && (
              <button
                onClick={() => { setDateRange(undefined); setPendingFrom(null); }}
                className="text-[11px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md px-2 py-1.5 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
