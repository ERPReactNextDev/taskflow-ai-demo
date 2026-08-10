"use client";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { X, CheckCircle2, XCircle, Search } from "lucide-react";

interface DatabaseCoverageCardProps {
  referenceid: string;
  name?: string;
  fromDate?: string;
  toDate?: string;
}

const toLocalDateString = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
};

function barColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 70) return "#10b981";
  if (score >= 50) return "#3b82f6";
  if (score >= 30) return "#f59e0b";
  return "#ef4444";
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function CoverageModal({
  open,
  onClose,
  referenceid,
  monthStart,
  monthEnd,
  coveredCount,
  totalCount,
}: {
  open: boolean;
  onClose: () => void;
  referenceid: string;
  monthStart: string;
  monthEnd: string;
  coveredCount: number;
  totalCount: number;
}) {
  const [withActivity, setWithActivity] = useState<string[]>([]);
  const [noActivity,   setNoActivity]   = useState<string[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [tab,          setTab]          = useState<"with" | "no">("no");
  const [search,       setSearch]       = useState("");

  useEffect(() => {
    if (!open || !referenceid) return;
    setLoading(true);
    fetch(
      `/api/db-coverage?referenceid=${encodeURIComponent(referenceid)}&from=${monthStart}&to=${monthEnd}&detail=true`
    )
      .then((r) => r.ok ? r.json() : { success: false })
      .then((data) => {
        if (data.success) {
          setWithActivity(data.withActivity ?? []);
          setNoActivity(data.noActivity ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, referenceid, monthStart, monthEnd]);

  // Reset search when switching tabs
  useEffect(() => { setSearch(""); }, [tab]);

  const filtered = useMemo(() => {
    const list = tab === "with" ? withActivity : noActivity;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((n) => n.toLowerCase().includes(q));
  }, [tab, withActivity, noActivity, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <p className="text-sm font-bold text-gray-800">DB Coverage Breakdown</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {coveredCount} with activity · {totalCount - coveredCount} no activity · {totalCount} total
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          <button
            onClick={() => setTab("no")}
            className={[
              "flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px",
              tab === "no"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-400 hover:text-gray-600",
            ].join(" ")}
          >
            <XCircle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            No Activity ({noActivity.length})
          </button>
          <button
            onClick={() => setTab("with")}
            className={[
              "flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px",
              tab === "with"
                ? "border-green-500 text-green-600"
                : "border-transparent text-gray-400 hover:text-gray-600",
            ].join(" ")}
          >
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            With Activity ({withActivity.length})
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-xs text-gray-400">
              <Spinner className="w-4 h-4" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-10">
              {search ? "No matching companies." : "No companies in this category."}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((name, i) => (
                <li
                  key={i}
                  className={[
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs",
                    tab === "with"
                      ? "bg-green-50 text-green-800"
                      : "bg-red-50 text-red-800",
                  ].join(" ")}
                >
                  {tab === "with"
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  }
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer count */}
        <div className="px-4 py-2.5 border-t border-gray-100 shrink-0 bg-gray-50">
          <p className="text-[10px] text-gray-400 text-center">
            Showing {filtered.length} of {tab === "with" ? withActivity.length : noActivity.length} companies
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────────

export function DatabaseCoverageCard({
  referenceid,
  name = "—",
  fromDate,
}: DatabaseCoverageCardProps) {
  const [coveredCount, setCoveredCount] = useState(0);
  const [totalCount,   setTotalCount]   = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [modalOpen,    setModalOpen]    = useState(false);

  const today = toLocalDateString(new Date());
  const effectiveFromDate = fromDate || today;

  const monthRange = useMemo(() => {
    const d = new Date(effectiveFromDate + "T00:00:00Z");
    const year  = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const monthStart = new Date(Date.UTC(year, month, 1)).toISOString().split("T")[0];
    const monthEnd   = new Date(Date.UTC(year, month + 1, 0)).toISOString().split("T")[0];
    return { monthStart, monthEnd };
  }, [effectiveFromDate]);

  useEffect(() => {
    if (!referenceid) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/db-coverage?referenceid=${encodeURIComponent(referenceid)}&from=${monthRange.monthStart}&to=${monthRange.monthEnd}`
        );
        if (!res.ok) throw new Error("Failed to fetch DB coverage");
        const data = await res.json();
        if (data.success) {
          setCoveredCount(data.coveredCount);
          setTotalCount(data.totalCount);
        } else {
          throw new Error(data.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [referenceid, monthRange.monthStart, monthRange.monthEnd]);

  const percentage = totalCount > 0 ? Math.min(Math.round((coveredCount / totalCount) * 100), 100) : 0;

  return (
    <>
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              DB Coverage
            </p>
            {!loading && !error && totalCount > 0 && (
              <button
                onClick={() => setModalOpen(true)}
                className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded-md border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                View
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4 gap-2 text-xs text-gray-400">
              <Spinner className="w-4 h-4" />
              <span>Loading…</span>
            </div>
          ) : error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{name}</span>
                  <span className="text-sm font-bold" style={{ color: barColor(percentage) }}>
                    {coveredCount.toLocaleString()}/{totalCount.toLocaleString()}
                  </span>
                </div>
                {totalCount > 0 && (
                  <div className="w-full bg-gray-200 h-1.5 rounded-full">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%`, backgroundColor: barColor(percentage) }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CoverageModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        referenceid={referenceid}
        monthStart={monthRange.monthStart}
        monthEnd={monthRange.monthEnd}
        coveredCount={coveredCount}
        totalCount={totalCount}
      />
    </>
  );
}
