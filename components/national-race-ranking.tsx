"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
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

const RANK_BADGE: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

const LANE_COLORS = [
  "bg-emerald-900/60",
  "bg-emerald-800/50",
  "bg-emerald-900/60",
  "bg-emerald-800/50",
];

const TOP3_GLOW: Record<number, string> = {
  1: "shadow-[inset_0_0_0_2px_rgba(250,204,21,0.6)]",
  2: "shadow-[inset_0_0_0_2px_rgba(156,163,175,0.5)]",
  3: "shadow-[inset_0_0_0_2px_rgba(251,146,60,0.5)]",
};

// ─── Gallop Keyframes ─────────────────────────────────────────────────────────
const GallopStyles = () => (
  <style>{`
    @keyframes gallop {
      0%   { transform: scaleX(-1) translateY(0px)    rotate(0deg);   }
      20%  { transform: scaleX(-1) translateY(-4px)   rotate(-3deg);  }
      40%  { transform: scaleX(-1) translateY(-7px)   rotate(-5deg);  }
      60%  { transform: scaleX(-1) translateY(-4px)   rotate(-2deg);  }
      80%  { transform: scaleX(-1) translateY(-1px)   rotate(1deg);   }
      100% { transform: scaleX(-1) translateY(0px)    rotate(0deg);   }
    }
    @keyframes dustPuff {
      0%   { opacity: 0.7; transform: scale(0.5) translateX(0px);  }
      100% { opacity: 0;   transform: scale(1.4) translateX(10px); }
    }
    @keyframes jockeyBob {
      0%, 100% { transform: translateY(0px);  }
      50%       { transform: translateY(-3px); }
    }
  `}</style>
);

// ─── Horse Lane ───────────────────────────────────────────────────────────────
const HorseLane = ({
  item,
  maxCount,
  idx,
}: {
  item: RankedItem;
  maxCount: number;
  idx: number;
}) => {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100 + idx * 80);
    return () => clearTimeout(t);
  }, [idx]);

  const progress = maxCount > 0 ? item.count / maxCount : 0;
  // 0% → gate position (3%), 100% → near finish (82%)
  const leftPercent = animated ? 3 + progress * 79 : 3;

  const laneClass = LANE_COLORS[idx % LANE_COLORS.length];
  const glowClass = TOP3_GLOW[item.rank] ?? "";

  return (
    <div
      className={`relative rounded-lg h-[68px] flex items-center ${laneClass} ${glowClass} border-b border-emerald-950/40 overflow-hidden`}
    >
      {/* Grass texture stripes */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-emerald-600/20"
            style={{ left: `${10 + i * 11}%` }}
          />
        ))}
        {/* Ground line */}
        <div className="absolute bottom-3 inset-x-0 border-b border-dashed border-white/10" />
      </div>

      {/* Rank badge */}
      <div className="z-10 w-9 text-center text-base shrink-0 ml-2">
        {RANK_BADGE[item.rank] ?? (
          <span className="text-white/60 text-xs font-bold">#{item.rank}</span>
        )}
      </div>

      {/* Agent name fixed label */}
      <div className="z-10 w-28 shrink-0 ml-1 pr-1">
        <p className="text-white text-[11px] font-bold uppercase leading-tight truncate">
          {item.firstname}
        </p>
        <p className="text-white/60 text-[10px] uppercase leading-tight truncate">
          {item.lastname}
        </p>
        <p className="text-yellow-300 text-[10px] font-semibold mt-0.5">
          {item.count.toLocaleString()} pts
        </p>
      </div>

      {/* Track area */}
      <div className="flex-1 relative h-full">
        {/* Horse + jockey */}
        <div
          className="absolute bottom-1 transition-all ease-out"
          style={{
            left: `${leftPercent}%`,
            transitionDuration: `${800 + idx * 60}ms`,
          }}
        >
          <div className="relative flex flex-col items-center">
            {/* Profile picture (jockey helmet) */}
            <div
              className="relative z-10 -mb-1"
              style={{ animation: "jockeyBob 0.45s ease-in-out infinite" }}
            >
              {item.profilePicture ? (
                <img
                  src={item.profilePicture}
                  className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-md"
                  alt={item.firstname}
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xs font-black text-white border-2 border-white shadow-md">
                  {item.firstname?.[0] ?? "?"}
                </div>
              )}
            </div>
            {/* Dust puff behind horse */}
            <span
              className="absolute bottom-0 text-[14px] select-none pointer-events-none"
              style={{
                right: "90%",
                animation: "dustPuff 0.45s ease-out infinite",
              }}
            >
              💨
            </span>
            {/* Horse */}
            <span
              className="text-[28px] leading-none select-none"
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                display: "inline-block",
                transform: "scaleX(-1)",
                animation: "gallop 0.45s ease-in-out infinite",
                transformOrigin: "center bottom",
              }}
            >
              🏇
            </span>
          </div>
        </div>
      </div>

      {/* Finish flag */}
      <div className="z-10 w-10 text-center text-xl shrink-0">🏁</div>
    </div>
  );
};

// ─── Race Track ───────────────────────────────────────────────────────────────
const RaceTrack = ({
  data,
  overallTotal,
  title,
  subtitle,
}: {
  data: RankedItem[];
  overallTotal: number;
  title: string;
  subtitle: string;
}) => {
  const sorted = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data]);
  const maxCount = sorted[0]?.count ?? 1;

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-emerald-900/60">
      {/* Track header board */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{
          background: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #052e16 100%)",
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <h3 className="text-white font-black text-base tracking-widest uppercase">
              {title}
            </h3>
          </div>
          <p className="text-emerald-400 text-[10px] tracking-widest uppercase mt-0.5">
            {subtitle}
          </p>
        </div>
        <div className="text-right">
          <p className="text-emerald-400 text-[10px] uppercase tracking-wider">Total</p>
          <p className="text-yellow-300 font-black text-lg leading-none">
            {overallTotal.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Start gate header */}
      <div
        className="flex items-center px-4 py-1 text-[10px] font-bold tracking-widest uppercase"
        style={{ background: "#0a3d1f" }}
      >
        <div className="w-9 shrink-0" />
        <div className="w-28 shrink-0 ml-1 text-emerald-500">Agent</div>
        <div className="flex-1 flex items-center">
          <span className="text-emerald-600 ml-1">— Track —</span>
        </div>
        <div className="w-10 text-center text-emerald-600">End</div>
      </div>

      {/* Lanes */}
      <div
        className="p-2 space-y-1.5"
        style={{
          background: "linear-gradient(180deg, #064e29 0%, #065f38 50%, #064e29 100%)",
        }}
      >
        {sorted.length === 0 ? (
          <div className="text-emerald-400/60 text-center py-12 text-sm tracking-wider uppercase">
            🐎 No runners yet
          </div>
        ) : (
          sorted.map((item, idx) => (
            <HorseLane key={item.referenceid} item={item} maxCount={maxCount} idx={idx} />
          ))
        )}
      </div>

      {/* Bottom scoreboard */}
      <div
        className="px-5 py-2.5 flex items-center gap-3 overflow-x-auto"
        style={{ background: "#021a0d" }}
      >
        <span className="text-emerald-600 text-[10px] uppercase tracking-widest font-bold shrink-0">
          Top 3
        </span>
        {sorted.slice(0, 3).map((item) => (
          <div key={item.referenceid} className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm">{RANK_BADGE[item.rank]}</span>
            <span className="text-white text-[11px] font-semibold uppercase">
              {item.firstname} {item.lastname}
            </span>
            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-[10px] px-1.5 py-0">
              {item.count}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function NationalRanking({
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}: NationalRankingProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const startDate = dateCreatedFilterRange?.from ?? null;
  const endDate   = dateCreatedFilterRange?.to   ?? null;

  const formatDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

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
    if (startDate && endDate && startDate > endDate) {
      setDateError("Start date cannot be later than end date.");
      return;
    }
    setDateError(null);

    const load = async () => {
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
    return assignRank(
      Array.from(map.entries()).map(([ref, count]) => {
        const user = usersByRef.get(ref);
        return {
          referenceid: ref,
          count,
          firstname: user?.Firstname || "Unknown",
          lastname: user?.Lastname || "",
          profilePicture: user?.profilePicture || null,
        };
      })
    );
  }, [history, usersByRef]);

  const tsmRank = useMemo(() => {
    const map = new Map<string, number>();
    history.forEach((h) => {
      if (!h.tsm) return;
      const key = h.tsm.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return assignRank(
      Array.from(map.entries()).map(([ref, count]) => {
        const user = usersByRef.get(ref);
        return {
          referenceid: ref,
          count,
          firstname: user?.Firstname || "Unknown",
          lastname: user?.Lastname || "",
          profilePicture: user?.profilePicture || null,
        };
      })
    );
  }, [history, usersByRef]);

  const tsaOverallTotal = useMemo(() => tsaRank.reduce((a, b) => a + b.count, 0), [tsaRank]);
  const tsmOverallTotal = useMemo(() => tsmRank.reduce((a, b) => a + b.count, 0), [tsmRank]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setDateCreatedFilterRangeAction([
      e.target.value ? new Date(e.target.value) : null,
      endDate,
    ]);

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setDateCreatedFilterRangeAction([
      startDate,
      e.target.value ? new Date(e.target.value) : null,
    ]);

  return (
    <>
    <GallopStyles />
    <main
      className="flex flex-col gap-6 p-4 min-h-screen"
      style={{
        background: "linear-gradient(160deg, #0a0a0a 0%, #0d1f15 50%, #0a0a0a 100%)",
      }}
    >
      {/* ── Page Title ── */}
      <div className="text-center pt-2">
        <h1 className="text-white font-black text-2xl tracking-widest uppercase">
          🏟️ National Race Rankings
        </h1>
        <p className="text-emerald-500 text-xs tracking-widest uppercase mt-1">
          Outbound · Touchbase · Successful Calls
        </p>
      </div>

      {/* ── Date Filters ── */}
      <div
        className="flex flex-wrap gap-4 items-center rounded-xl px-5 py-3 border border-emerald-900/40"
        style={{ background: "#071410" }}
      >
        <span className="text-emerald-500 text-[10px] uppercase tracking-widest font-bold">
          📅 Race Period
        </span>
        <label className="text-emerald-300 text-xs font-semibold flex items-center gap-2">
          From
          <input
            type="date"
            value={startDate ? formatDate(startDate) : ""}
            onChange={handleStartDateChange}
            className="bg-emerald-950 border border-emerald-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
        <label className="text-emerald-300 text-xs font-semibold flex items-center gap-2">
          To
          <input
            type="date"
            value={endDate ? formatDate(endDate) : ""}
            onChange={handleEndDateChange}
            className="bg-emerald-950 border border-emerald-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
        {dateError && (
          <span className="text-red-400 text-xs font-medium">{dateError}</span>
        )}
        {isFetching && (
          <span className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
            <Spinner className="size-3" /> Refreshing race...
          </span>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="text-5xl animate-bounce">🏇</span>
          <Spinner className="size-8 text-emerald-500" />
          <p className="text-emerald-400 text-xs tracking-widest uppercase">
            Loading the race...
          </p>
        </div>
      ) : error ? (
        <div className="text-center text-red-400 py-10 text-sm">{error}</div>
      ) : (
        <div
          className={`grid grid-cols-1 xl:grid-cols-2 gap-6 transition-opacity duration-300 ${
            isFetching ? "opacity-50 pointer-events-none" : "opacity-100"
          }`}
        >
          <RaceTrack
            data={tsaRank}
            overallTotal={tsaOverallTotal}
            title="TSA Race"
            subtitle="Territory Sales Associates"
          />
          <RaceTrack
            data={tsmRank}
            overallTotal={tsmOverallTotal}
            title="TSM Race"
            subtitle="Territory Sales Managers"
          />
        </div>
      )}
    </main>
    </>
  );
}