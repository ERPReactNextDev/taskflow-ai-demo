import React, { useEffect, useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Info, Download } from "lucide-react";
import ExcelJS from "exceljs";

/* ================= TYPES ================= */

interface HistoryItem {
  referenceid: string;
  source: string;
  call_status: string;
  status: string;
  type_activity: string;
  actual_sales?: number | string;
  quotation_amount?: number | string;
  so_amount?: number | string;
  start_date: string;
  end_date: string;
  date_created: string;
  activity_reference_number: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
}

interface OutboundCardProps {
  history: HistoryItem[];
  agents: Agent[];
  dateCreatedFilterRange?: { from: Date; to: Date };
  setDateCreatedFilterRangeAction?: React.Dispatch<React.SetStateAction<any>>;
  /** Per-agent monthly targets from ob-breakdown page: { [referenceid]: number } */
  perAgentTargets?: Record<string, number>;
}

/* ================= HELPERS ================= */

const pct = (num: number, den: number) =>
  den > 0 ? ((num / den) * 100).toFixed(2) + "%" : "0.00%";

const convBadge = (count: number) => (
  <span className="ml-1 text-green-600 text-[12px] font-medium">{count}</span>
);

/* ================= VALIDATION ================= */

const isFinitePositive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/* ================= COMPONENT ================= */

export function OutboundCallsTableCard({
  history,
  agents,
  dateCreatedFilterRange,
  perAgentTargets,
}: OutboundCardProps) {
  const [showComputation, setShowComputation] = useState(false);
  const [outboundQuota, setOutboundQuota] = useState<number>(20);
  const [quotaLoading, setQuotaLoading] = useState<boolean>(true);

  useEffect(() => {
    // Only fetch global quota if no per-agent targets are provided
    if (perAgentTargets) { setQuotaLoading(false); return; }
    fetch("/api/outbound-quota")
      .then((res) => res.json())
      .then((data) => {
        if (isFinitePositive(data?.outbound_quota)) {
          setOutboundQuota(data.outbound_quota);
        } else {
          console.warn("outbound-quota: received invalid value, falling back to 20", data);
        }
      })
      .catch((err) => {
        console.warn("outbound-quota: fetch failed, falling back to 20", err);
      })
      .finally(() => {
        setQuotaLoading(false);
      });
  }, [perAgentTargets]);

  /* ---- Agent map ---- */
  const agentMap = useMemo(() => {
    const map = new Map<string, { name: string; picture: string }>();
    agents.forEach((a) =>
      map.set(a.ReferenceID.toLowerCase(), {
        name: `${a.Firstname} ${a.Lastname}`,
        picture: a.profilePicture,
      })
    );
    return map;
  }, [agents]);

  /* ---- Step 1: Get only Outbound - Touchbase + Successful calls (with date filter) ----
     These are the "source" calls. Their activity_reference_number is the key
     we'll use to trace downstream activities (Quote, SO, SI).
  ---- */
  const successfulOBCalls = useMemo(() => {
    let base = history.filter(
      (h) =>
        h.source === "Outbound - Touchbase" &&
        h.call_status === "Successful"
    );

    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const toLocalMidnight = (val: any): Date => {
        const d = val instanceof Date ? val : new Date(val);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      };
      const start = toLocalMidnight(dateCreatedFilterRange.from);
      const end = toLocalMidnight(dateCreatedFilterRange.to);
      end.setHours(23, 59, 59, 999);
      base = base.filter((h) => {
        const d = new Date(h.date_created);
        return d >= start && d <= end;
      });
    }

    return base;
  }, [history, dateCreatedFilterRange]);

  /* ---- Step 2: Build a lookup of ALL history by activity_reference_number ----
     This lets us efficiently find what happened on each ref number
     (Quote-Done, SO-Done, Delivered/Closed) across ALL records — not just
     the agent's own records, since downstream activities share the same ref number.
  ---- */
  const historyByRefNum = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    history.forEach((h) => {
      if (!h.activity_reference_number) return;
      if (!map.has(h.activity_reference_number)) {
        map.set(h.activity_reference_number, []);
      }
      map.get(h.activity_reference_number)!.push(h);
    });
    return map;
  }, [history]);

  /* ---- OB target days (excluding Sundays) ---- */
  const daysCount = useMemo(() => {
    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const start = new Date(dateCreatedFilterRange.from);
      const end = new Date(dateCreatedFilterRange.to);
      let count = 0;
      const current = new Date(start);
      while (current <= end) {
        // 0 = Sunday, exclude it
        if (current.getDay() !== 0) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      return count || 1; // At least 1 day to avoid division by zero
    }
    return 22; // Default working days per month (excluding Sundays)
  }, [dateCreatedFilterRange]);

  const obTarget = outboundQuota * daysCount;

  /* ---- Step 3: Compute per-agent stats ---- */
  const statsByAgent = useMemo(() => {
    // Group successful OB calls by agent
    const byAgent: Record<string, HistoryItem[]> = {};
    successfulOBCalls.forEach((h) => {
      const id = h.referenceid?.toLowerCase();
      if (!id) return;
      if (!byAgent[id]) byAgent[id] = [];
      byAgent[id].push(h);
    });

    return Object.entries(byAgent)
      .filter(([agentId]) => {
        // Filter out rows where agentId is "referenceid" or "agentid"
        const invalidIds = ["referenceid", "agentid"];
        return !invalidIds.includes(agentId.toLowerCase());
      })
      .map(([agentId, obCalls]) => {
      // ── 1. Total successful OB Touchbase calls for this agent
      const totalCalls = obCalls.length;

      // ── 2. Collect unique activity_reference_numbers from those OB calls
      //       These are the reference numbers we'll trace downstream.
      const obRefNums = new Set(
        obCalls.map((c) => c.activity_reference_number).filter(Boolean)
      );

      // ── 3. For each ref number, look at ALL activities in history
      //       (across all sources/statuses) to find Quote, SO, and SI.
      //       A ref number counts once per conversion stage (unique refs).

      const quoteRefNums = new Set<string>();  // refs with status = "Quote - Done"
      const soRefNums = new Set<string>();     // refs with status = "SO-Done"
      const siRefNums = new Set<string>();     // refs with type_activity = "Delivered / Closed Transaction"

      obRefNums.forEach((refNum) => {
        const activitiesOnRef = historyByRefNum.get(refNum) ?? [];

        activitiesOnRef.forEach((act) => {
          if (act.status === "Quote-Done") {
            quoteRefNums.add(refNum);
          }
          if (act.status === "SO-Done") {
            soRefNums.add(refNum);
          }
          if (act.type_activity === "Delivered / Closed Transaction") {
            siRefNums.add(refNum);
          }
        });
      });

      const numQuotes = quoteRefNums.size;
      const numSO = soRefNums.size;
      const numSI = siRefNums.size;

      // ── 4. Calculate Quote Amount (sum of quotation_amount from Quote-Done activities)
      let quoteAmount = 0;
      obRefNums.forEach((refNum) => {
        const activitiesOnRef = historyByRefNum.get(refNum) ?? [];
        activitiesOnRef.forEach((act) => {
          if (act.status === "Quote-Done" && act.quotation_amount) {
            const amount = typeof act.quotation_amount === "string"
              ? parseFloat(act.quotation_amount)
              : act.quotation_amount;
            if (!isNaN(amount)) {
              quoteAmount += amount;
            }
          }
        });
      });

      // ── 5. Calculate SO Amount & Actual Sales (from SO-Done and Delivered activities)
      let soAmount = 0;
      let actualSales = 0;
      obRefNums.forEach((refNum) => {
        const activitiesOnRef = historyByRefNum.get(refNum) ?? [];
        activitiesOnRef.forEach((act) => {
          if (act.status === "SO-Done" && act.so_amount) {
            const amount = typeof act.so_amount === "string"
              ? parseFloat(act.so_amount)
              : act.so_amount;
            if (!isNaN(amount)) {
              soAmount += amount;
            }
          }
          if (act.type_activity === "Delivered / Closed Transaction" && act.actual_sales) {
            const amount = typeof act.actual_sales === "string"
              ? parseFloat(act.actual_sales)
              : act.actual_sales;
            if (!isNaN(amount)) {
              actualSales += amount;
            }
          }
        });
      });

      // ── 6. Conversions
      // Use per-agent target if provided, otherwise fall back to shared obTarget
      const agentTarget = perAgentTargets
        ? (perAgentTargets[agentId] ?? perAgentTargets[agentId.toUpperCase()] ?? 0)
        : obTarget;
      const achievement = agentTarget > 0 ? (totalCalls / agentTarget) * 100 : 0;
      // Calls → Quote: how many of the OB call refs eventually got a Quote
      const callsToQuote = pct(numQuotes, totalCalls);
      // Quote → SO: how many of the quoted refs eventually got an SO
      const quoteToSO = pct(numSO, numQuotes);
      // SO → SI: how many of the SO refs eventually got delivered/closed
      const soToSI = pct(numSI, numSO);

      return {
        agentId,
        totalCalls,
        numQuotes,
        numSO,
        numSI,
        quoteAmount,
        soAmount,
        actualSales,
        agentTarget,
        achievement,
        callsToQuote,
        quoteToSO,
        soToSI,
      };
    });
  }, [successfulOBCalls, historyByRefNum, obTarget]);

  const totals = useMemo(() => {
    const totalCalls = statsByAgent.reduce((s, a) => s + a.totalCalls, 0);
    const numQuotes = statsByAgent.reduce((s, a) => s + a.numQuotes, 0);
    const numSO = statsByAgent.reduce((s, a) => s + a.numSO, 0);
    const numSI = statsByAgent.reduce((s, a) => s + a.numSI, 0);
    const totalQuoteAmount = statsByAgent.reduce((s, a) => s + a.quoteAmount, 0);
    const totalSoAmount = statsByAgent.reduce((s, a) => s + a.soAmount, 0);
    const totalActualSales = statsByAgent.reduce((s, a) => s + a.actualSales, 0);
    const totalTarget = statsByAgent.reduce((s, a) => s + a.agentTarget, 0);
    return {
      totalCalls,
      numQuotes,
      numSO,
      numSI,
      totalQuoteAmount,
      totalSoAmount,
      totalActualSales,
      totalTarget,
      achievement: pct(totalCalls, totalTarget || 1),
      callsToQuote: pct(numQuotes, totalCalls),
      quoteToSO: pct(numSO, numQuotes),
      soToSI: pct(numSI, numSO),
    };
  }, [statsByAgent]);

  /* ── Excel Export ── */
  const exportToExcel = async () => {
    if (statsByAgent.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Outbound Performance");

      // Headers
      worksheet.columns = [
        { header: "Agent", key: "agent", width: 25 },
        { header: "OB Target", key: "target", width: 12 },
        { header: "Successful Calls", key: "calls", width: 15 },
        { header: "Achievement (%)", key: "achievement", width: 15 },
        { header: "Quote Based on OB Successful", key: "quotes", width: 25 },
        { header: "Calls → Quote (%)", key: "callsToQuote", width: 15 },
        { header: "Quote Amount", key: "quoteAmount", width: 18 },
        { header: "SO Based on OB Successful", key: "so", width: 25 },
        { header: "SO Amount", key: "soAmount", width: 18 },
        { header: "Quote → SO (%)", key: "quoteToSO", width: 15 },
        { header: "SI Based on OB Successful", key: "si", width: 25 },
        { header: "SI Amount", key: "actualSales", width: 18 },
        { header: "SO → SI (%)", key: "soToSI", width: 15 },
      ];

      // Style Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add Data
      statsByAgent.forEach((stat) => {
        const agentName = agentMap.get(stat.agentId)?.name ?? stat.agentId;
        worksheet.addRow({
          agent: agentName,
          target: stat.agentTarget,
          calls: stat.totalCalls,
          achievement: (stat.achievement / 100), // decimal for percentage format
          quotes: stat.numQuotes,
          callsToQuote: parseFloat(stat.callsToQuote) / 100,
          quoteAmount: stat.quoteAmount,
          so: stat.numSO,
          soAmount: stat.soAmount,
          quoteToSO: parseFloat(stat.quoteToSO) / 100,
          si: stat.numSI,
          actualSales: stat.actualSales,
          soToSI: parseFloat(stat.soToSI) / 100,
        });
      });

      // Add Totals Row
      const totalRow = worksheet.addRow({
        agent: "TOTAL",
        target: obTarget * statsByAgent.length,
        calls: totals.totalCalls,
        achievement: parseFloat(totals.achievement) / 100,
        quotes: totals.numQuotes,
        callsToQuote: parseFloat(totals.callsToQuote) / 100,
        quoteAmount: totals.totalQuoteAmount,
        so: totals.numSO,
        soAmount: totals.totalSoAmount,
        quoteToSO: parseFloat(totals.quoteToSO) / 100,
        si: totals.numSI,
        actualSales: totals.totalActualSales,
        soToSI: parseFloat(totals.soToSI) / 100,
      });
      totalRow.font = { bold: true };

      // Formatting
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (rowNumber > 1) {
            // Percentages: Achievement (4), Calls→Quote (6), Quote→SO (10), SO→SI (13)
            if ([4, 6, 10, 13].includes(colNumber)) {
              cell.numFmt = '0.00%';
            }
            // Currency: Quote Amount (7), SO Amount (9), Actual Sales (12)
            if ([7, 9, 12].includes(colNumber)) {
              cell.numFmt = '₱#,##0.00';
            }
          }
        });
      });

      // Filename
      let filename = "TSM_Outbound_Performance";
      if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
        const fromStr = new Date(dateCreatedFilterRange.from).toISOString().split('T')[0];
        const toStr = new Date(dateCreatedFilterRange.to).toISOString().split('T')[0];
        filename += `_${fromStr}_to_${toStr}`;
      }
      filename += ".xlsx";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      // Export failed silently
    }
  };

  return (
    <Card className="rounded-xl border shadow-sm">
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Outbound Calls (Touchbase)</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on <span className="font-medium text-gray-500">Outbound – Touchbase · Successful</span> calls only
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              disabled={statsByAgent.length === 0}
              className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border-green-200 bg-green-50/50 hover:bg-green-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComputation(!showComputation)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
            >
              <Info className="w-3.5 h-3.5" />
              {showComputation ? "Hide" : "Details"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {statsByAgent.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-gray-400">
            No outbound records found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 text-[11px]">
                  <TableHead className="text-gray-500">Agent</TableHead>
                  <TableHead className="text-gray-500 text-center">OB Target</TableHead>
                  <TableHead className="text-gray-500 text-center">Successful Calls</TableHead>
                  <TableHead className="text-gray-500 text-center">Achievement</TableHead>
                  <TableHead className="text-gray-500 text-center whitespace-normal break-words max-w-[120px]">Quote Based on OB Successful</TableHead>
                  <TableHead className="text-gray-500 text-center">Calls → Quote<span className="block text-[9px] font-normal text-gray-400">(Quotes ÷ Calls)</span></TableHead>
                  <TableHead className="text-gray-500 text-center">Quote Amount</TableHead>
                  <TableHead className="text-gray-500 text-center whitespace-normal break-words max-w-[120px]">SO Based on OB Successful</TableHead>
                  <TableHead className="text-gray-500 text-center">SO Amount</TableHead>
                  <TableHead className="text-gray-500 text-center">Quote → SO<span className="block text-[9px] font-normal text-gray-400">(SO ÷ Quotes)</span></TableHead>
                  <TableHead className="text-gray-500 text-center whitespace-normal break-words max-w-[120px]">SI Based on OB Successful</TableHead>
                  <TableHead className="text-gray-500 text-center">SI Amount</TableHead>
                  <TableHead className="text-gray-500 text-center">SO → SI<span className="block text-[9px] font-normal text-gray-400">(SI ÷ SO)</span></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {statsByAgent
                  .filter((stat) => agentMap.has(stat.agentId)) // Only show agents with name info
                  .map((stat) => {
                  const info = agentMap.get(stat.agentId)!;
                  return (
                    <TableRow key={stat.agentId} className="text-xs hover:bg-gray-50/50 font-mono">
                      {/* Agent */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {info?.picture ? (
                            <img
                              src={info.picture}
                              alt={info.name}
                              className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                              {info?.name?.[0] ?? "?"}
                            </div>
                          )}
                          <span className="capitalize text-gray-700">{info?.name}</span>
                        </div>
                      </TableCell>

                      {/* OB Target */}
                      <TableCell className="text-center text-gray-600">
                        {quotaLoading ? "…" : stat.agentTarget}
                      </TableCell>

                      {/* Successful Calls */}
                      <TableCell className="text-center font-semibold text-gray-800">
                        {stat.totalCalls}
                      </TableCell>

                      {/* Achievement */}
                      <TableCell className="text-center">
                        <span className={`font-semibold ${stat.achievement >= 100 ? "text-green-600" : stat.achievement >= 70 ? "text-amber-500" : "text-red-500"}`}>
                          {stat.achievement.toFixed(2)}%
                        </span>
                      </TableCell>

                      <TableCell className="text-center font-bold">
                        {convBadge(stat.numQuotes)}
                      </TableCell>

                      {/* Calls → Quote */}
                      <TableCell className="text-center">
                        <span className="text-gray-700">{stat.callsToQuote}</span>
                      </TableCell>

                      {/* Quote Amount */}
                      <TableCell className="text-center font-semibold text-green-600">
                        ₱{stat.quoteAmount.toLocaleString()}
                      </TableCell>

                      <TableCell className="text-center font-bold">
                        {convBadge(stat.numSO)}
                      </TableCell>

                      {/* SO Amount */}
                      <TableCell className="text-center font-semibold text-blue-600">
                        ₱{stat.soAmount.toLocaleString()}
                      </TableCell>

                      {/* Quote → SO */}
                      <TableCell className="text-center">
                        <span className="text-gray-700">{stat.quoteToSO}</span>
                      </TableCell>

                      <TableCell className="text-center font-bold">
                        {convBadge(stat.numSI)}
                      </TableCell>

                      {/* Actual Sales */}
                      <TableCell className="text-center font-semibold text-emerald-600">
                        ₱{stat.actualSales.toLocaleString()}
                      </TableCell>

                      {/* SO → SI */}
                      <TableCell className="text-center">
                        <span className="text-gray-700">{stat.soToSI}</span>
                      </TableCell>

                    </TableRow>
                  );
                })}
              </TableBody>

              {/* Footer totals */}
              <TableFooter>
                <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                  <TableCell className="text-gray-700">Total</TableCell>
                  <TableCell className="text-center text-gray-600">
                    {quotaLoading ? "…" : totals.totalTarget}
                  </TableCell>
                  <TableCell className="text-center text-gray-800">{totals.totalCalls}</TableCell>
                  <TableCell className="text-center text-gray-700">{totals.achievement}</TableCell>
                  <TableCell className="text-center">{convBadge(totals.numQuotes)}</TableCell>
                  <TableCell className="text-center">{totals.callsToQuote}</TableCell>
                  <TableCell className="text-center font-semibold text-green-600">₱{totals.totalQuoteAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{convBadge(totals.numSO)}</TableCell>
                  <TableCell className="text-center font-semibold text-blue-600">₱{totals.totalSoAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{totals.quoteToSO}</TableCell>
                  <TableCell className="text-center">{convBadge(totals.numSI)}</TableCell>
                  <TableCell className="text-center font-semibold text-emerald-600">₱{totals.totalActualSales.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{totals.soToSI}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {/* Computation details */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
            <p><strong>Base data:</strong> All records where <code>source = "Outbound - Touchbase"</code> AND <code>call_status = "Successful"</code> (date filter applied here).</p>
            <p><strong>OB Target:</strong> {outboundQuota} × number of days in selected range <em>(Sundays excluded)</em> (default: 22 working days = {outboundQuota * 22}).</p>
            <p><strong>Achievement:</strong> (Successful Calls ÷ OB Target) × 100%</p>
            <p><strong>Calls → Quote %:</strong> Count of unique <code>activity_reference_number</code>s (from OB calls) that have ANY activity with <code>status = "Quote - Done"</code> in the full history ÷ Successful Calls</p>
            <p><strong>Quote → SO %:</strong> Count of unique refs with <code>status = "SO-Done"</code> ÷ Count of Quoted refs</p>
            <p><strong>SO → SI %:</strong> Count of unique refs with <code>type_activity = "Delivered / Closed Transaction"</code> ÷ Count of SO refs</p>
            <p className="text-blue-700 text-[10px] mt-1">
              * Each conversion stage traces back to the same <code>activity_reference_number</code> from a Successful OB Touchbase call.
              All activities on that ref number (any source, any status) are scanned to determine if a conversion occurred.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
