"use client";

import * as React from "react";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { type DateRange } from "react-day-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * SidebarRight still accepts date range props so existing pages don't break —
 * they're ignored now that the date picker has moved to the global top bar.
 */
type SidebarRightProps = React.ComponentProps<typeof Sidebar> & {
  dateCreatedFilterRange?: DateRange | undefined;
  setDateCreatedFilterRangeAction?: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SidebarRight({
  dateCreatedFilterRange: _dateRange,
  setDateCreatedFilterRangeAction: _setDateRange,
  ...props
}: SidebarRightProps) {
  // Strip any non-DOM props to avoid React warnings
  const sidebarProps = React.useMemo(() => {
    const { userId: _, ...rest } = props as any;
    return rest;
  }, [props]);

  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh border-l lg:flex w-[56px]"
      {...sidebarProps}
    >
      <SidebarContent />
    </Sidebar>
  );
}
