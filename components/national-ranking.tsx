"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/utils/supabase";

interface HistoryItem {
  referenceid: string;
  tsm: string;
  call_status?: string;
  source?: string;
  date_created: string;
}

interface UserInfo {
  ReferenceID: string | null | undefined;
  Firstname: string;
  Lastname: string;
  profilePicture: string | null;
}

interface RankedItem {
  referenceid: string;
  count: number;
  firstname: string;
  lastname: string;
  profilePicture: string | null;
  rank: number;
}

import { type DateRange } from "react-day-picker";

interface NationalRankingProps {
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: (range: DateRange | undefined) => void;
}

const MEDAL_COLORS: Record<number, string> = {
  1: "bg-yellow-50 border-l-4 border-yellow-400",
  2: "bg-gray-50 border-l-4 border-gray-400",
  3: "bg-orange-50 border-l-4 border-orange-400",
};

const RANK_BADGE: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export function NationalRanking({
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}: NationalRankingProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false); // soft refetch state
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const startDate = dateCreatedFilterRange?.from ?? null;
  const endDate   = dateCreatedFilterRange?.to   ?? null;

  const formatDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}`;
  };

  // Normalize users map for fast lookup
  const usersByRef = useMemo(() => {
    const map = new Map<string, UserInfo>();
    users.forEach((u) => {
      if (typeof u.ReferenceID === "string" && u.ReferenceID.trim()) {
        map.set(u.ReferenceID.trim().toLowerCase(), u);
      }
    });
    return map;
  }, [users]);

  const assignRank = (items: Omit<RankedItem, "rank">[]): RankedItem[] => {
    let lastCount = -1;
    let rank = 0;

    return items
      .sort((a, b) => b.count - a.count)
      .map((item, index) => {
        if (item.count !== lastCount) {
          rank = index + 1;
          lastCount = item.count;
        }
        return { ...item, rank };
      });
  };

  // Suggestion 1: Filter directly in Supabase query — less data transferred
  const fetchAllHistory = async () => {
    let all: HistoryItem[] = [];
    let from = 0;
    const size = 1000;

    while (true) {
      let query = supabase
        .from("history")
        .select("referenceid, tsm, call_status, source, date_created")
        .eq("call_status", "Successful")
        .eq("source", "Outbound - Touchbase")
        .range(from, from + size - 1);

      if (startDate && endDate) {
        const start = formatDate(startDate);
        const end = formatDate(endDate);

        query =
          start === end
            ? query.eq("date_created", start)
            : query.gte("date_created", start).lte("date_created", end);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      all = all.concat(data);
      if (data.length < size) break;
      from += size;
    }

    return all;
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/fetch-users");
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  };

  const isFirstLoad = useRef(true);

  useEffect(() => {
    // Suggestion 5: Date validation — block fetch if invalid range
    if (startDate && endDate && startDate > endDate) {
      setDateError("Start date cannot be later than end date.");
      return;
    }
    setDateError(null);

    const load = async () => {
      // Suggestion 6: Soft loading — keep previous data visible on refetch
      if (isFirstLoad.current) {
        setLoading(true);
      } else {
        setIsFetching(true);
      }
      setError(null);

      try {
        const [historyData, usersData] = await Promise.all([
          fetchAllHistory(),
          users.length === 0 ? fetchUsers() : Promise.resolve(users),
        ]);
        setHistory(historyData);
        if (users.length === 0) setUsers(usersData);
      } catch (e: any) {
        setError(e.message || "Failed to load data");
      } finally {
        setLoading(false);
        setIsFetching(false);
        isFirstLoad.current = false;
      }
    };

    load();
  }, [startDate, endDate]);

  const tsaRank = useMemo(() => {
    const map = new Map<string, number>();

    history.forEach((h) => {
      if (!h.referenceid) return;
      const key = h.referenceid.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    const items = Array.from(map.entries()).map(([ref, count]) => {
      const user = usersByRef.get(ref);
      return {
        referenceid: ref,
        count,
        firstname: user?.Firstname || "Unknown",
        lastname: user?.Lastname || "",
        profilePicture: user?.profilePicture || null,
      };
    });

    return assignRank(items);
  }, [history, usersByRef]);

  const tsmRank = useMemo(() => {
    const map = new Map<string, number>();

    history.forEach((h) => {
      if (!h.tsm) return;
      const key = h.tsm.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    const items = Array.from(map.entries()).map(([ref, count]) => {
      const user = usersByRef.get(ref);
      return {
        referenceid: ref,
        count,
        firstname: user?.Firstname || "Unknown",
        lastname: user?.Lastname || "",
        profilePicture: user?.profilePicture || null,
      };
    });

    return assignRank(items);
  }, [history, usersByRef]);

  const tsaOverallTotal = useMemo(
    () => tsaRank.reduce((a, b) => a + b.count, 0),
    [tsaRank]
  );

  // Suggestion 2: TSM overall total
  const tsmOverallTotal = useMemo(
    () => tsmRank.reduce((a, b) => a + b.count, 0),
    [tsmRank]
  );

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = e.target.value ? new Date(e.target.value) : undefined;
    setDateCreatedFilterRangeAction(
      newFrom || endDate
        ? { from: newFrom ?? undefined, to: endDate ?? undefined }
        : undefined
    );
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTo = e.target.value ? new Date(e.target.value) : undefined;
    setDateCreatedFilterRangeAction(
      startDate || newTo
        ? { from: startDate ?? undefined, to: newTo ?? undefined }
        : undefined
    );
  };

  const renderTable = (data: RankedItem[], overallTotal: number) => (
    <>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-4 py-2 text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Rank
            </th>
            <th className="px-4 py-2 text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Agent
            </th>
            <th className="px-4 py-2 text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Successful
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {/* Suggestion 3: Empty state */}
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="px-4 py-8 text-center text-gray-400 text-xs"
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.referenceid}
                // Suggestion 4: Top 3 highlight with medal colors
                className={`transition-colors ${
                  MEDAL_COLORS[item.rank] || "hover:bg-gray-50"
                }`}
              >
                <td className="px-4 py-2 text-xs font-semibold text-gray-700 w-12">
                  {RANK_BADGE[item.rank] ?? `#${item.rank}`}
                </td>
                <td className="px-4 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    {item.profilePicture ? (
                      <img
                        src={item.profilePicture}
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-200"
                        alt={`${item.firstname} ${item.lastname}`}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 font-semibold ring-2 ring-gray-300">
                        {item.firstname?.[0] || "?"}
                      </div>
                    )}
                    <div className="font-semibold uppercase text-gray-800">
                      {item.firstname} {item.lastname}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-xs font-bold text-gray-900">
                  {item.count}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Overall Total */}
      <div className="flex justify-end mt-2 gap-2 p-4 text-xs font-semibold border-t border-gray-100">
        <span className="text-gray-600">Overall Total</span>
        <Badge variant="secondary">{overallTotal}</Badge>
      </div>
    </>
  );

  return (
    <main className="flex flex-col gap-4 p-4">
      {/* Date Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <label className="text-sm font-semibold text-gray-700">
          Start Date:{" "}
          <input
            type="date"
            value={startDate ? formatDate(startDate) : ""}
            onChange={handleStartDateChange}
            className="border rounded px-2 py-1 text-sm ml-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          End Date:{" "}
          <input
            type="date"
            value={endDate ? formatDate(endDate) : ""}
            onChange={handleEndDateChange}
            className="border rounded px-2 py-1 text-sm ml-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>

        {/* Suggestion 5: Date validation error message */}
        {dateError && (
          <span className="text-xs text-red-500 font-medium">{dateError}</span>
        )}

        {/* Suggestion 6: Soft loading indicator while refetching */}
        {isFetching && (
          <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
            <Spinner className="size-3" /> Refreshing...
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-10" />
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-10">{error}</div>
      ) : (
        <Card
          className={`bg-white text-black p-4 rounded-none transition-opacity duration-200 ${
            isFetching ? "opacity-60 pointer-events-none" : "opacity-100"
          }`}
        >
          <CardContent className="p-0 overflow-auto">
            <div className="flex gap-6">
              {/* TSA Ranking Column */}
              <div className="flex-1 min-w-0 border-r pr-4">
                <h3 className="font-semibold mb-2 text-gray-800">
                  TSA Ranking
                </h3>
                {renderTable(tsaRank, tsaOverallTotal)}
              </div>

              {/* TSM Ranking Column */}
              <div className="flex-1 min-w-0 pl-2">
                <h3 className="font-semibold mb-2 text-gray-800">
                  TSM Ranking
                </h3>
                {renderTable(tsmRank, tsmOverallTotal)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}