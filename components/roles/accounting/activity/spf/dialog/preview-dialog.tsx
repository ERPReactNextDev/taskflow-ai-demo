"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  FileText, Building2, FileCheck,
  Eye, Loader2,
} from "lucide-react";
import { supabase } from "@/utils/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  currentSPF: any;
}

interface SPFCreationRow {
  id: number;
  spf_number: string;
  company_name?: string;
  supplier_brand?: string;
  contact_name?: string;
  contact_number?: string;
  item_code?: string;
  product_offer_image?: string;
  product_offer_qty?: string;
  product_offer_technical_specification?: string;
  product_offer_unit_cost?: string;
  product_offer_packaging_details?: string;
  product_offer_factory_address?: string;
  product_offer_port_of_discharge?: string;
  product_offer_subtotal?: string;
  product_offer_pcs_per_carton?: string;
  final_selling_cost?: string;
  final_unit_cost?: string;
  final_subtotal?: string;
  proj_lead_time?: string;
  status?: string;
}

interface SpecItem {
  key: string;
  value: string;
  multiValues: string[];
}

interface SpecCategory {
  name: string;
  items: SpecItem[];
}

interface OfferProduct {
  image: string;
  qty: string;
  spec: SpecCategory[];
  unit_cost: string;
  packaging: string;
  factory_address: string;
  port_of_discharge: string;
  subtotal: string;
  pcs_per_carton: string;
  company_name: string;
  supplier_brand: string;
  contact_number: string;
  item_code: string;
  lead_time: string;
  final_selling: string;
}

const F = { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" };

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        ...F,
        fontSize: "9px",
        fontWeight: 600,
        color: copied ? "#059669" : "#64748b",
        background: copied ? "#d1fae5" : "#f1f5f9",
        border: `1px solid ${copied ? "#6ee7b7" : "#e2e8f0"}`,
        borderRadius: "3px",
        padding: "2px 6px",
        cursor: "pointer",
      }}
    >
      {copied ? "✓" : "📋"}
    </button>
  );
};

const StatusBadge = ({ status }: { status?: string }) => {
  const s = (status || "").toLowerCase();

  const getDisplayText = (status: string) => {
    const statusMap: Record<string, string> = {
      "pending for procurement": "For Procurement Costing",
      "approved by procurement": "Ready for Quotation",
      "for revision": "Revised by Sales",
      "processed by pd": "Pending for Procurement",
      "approved": "Approved",
      "pending": "Pending",
      "declined": "Declined",
    };

    return statusMap[s] || status || "—";
  };

  const cls =
    s === "approved" || s === "approved by procurement" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : s === "pending" || s === "pending for procurement" ? "bg-amber-50 text-amber-700 border-amber-100"
        : s === "processed by pd" || s === "declined" ? "bg-red-50 text-red-700 border-red-100"
          : s === "for revision" ? "bg-blue-50 text-blue-700 border-blue-100"
            : "bg-zinc-100 text-zinc-600 border-zinc-200";

  return (
    <span style={{ ...F, fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 8px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "4px" }}>
      {getDisplayText(status || "")}
    </span>
  );
};

// Parsers
const parseField2D = (val?: string): string[][] => {
  if (!val?.trim()) return [[""]];
  return val.split("|ROW|").map((row) =>
    row.split("||").map((s) => s.trim()).filter((s) => s.length > 0)
  );
};

const parseImageField2D = (val?: string): string[][] => {
  if (!val?.trim()) return [[""]];
  return val.split("|ROW|").map((row) =>
    row.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
  );
};

const parseSpec = (raw: string): SpecCategory[] => {
  if (!raw?.trim()) return [];
  return raw
    .split("@@")
    .map((catChunk) => {
      const [catName, rest] = catChunk.split("~~");
      if (!catName?.trim()) return null;
      const items: SpecItem[] = (rest || "")
        .split(";;")
        .map((entry) => {
          const colonIdx = entry.indexOf(":");
          if (colonIdx === -1) return null;
          const key = entry.slice(0, colonIdx).trim();
          const rawVal = entry.slice(colonIdx + 1).trim();
          const multiValues = rawVal.split("|").map((v) => v.trim()).filter(Boolean);
          return { key, value: rawVal, multiValues } as SpecItem;
        })
        .filter(Boolean) as SpecItem[];
      return { name: catName.trim(), items } as SpecCategory;
    })
    .filter(Boolean) as SpecCategory[];
};

const getBaseItemCode = (itemCode: string) => {
  const c = (itemCode || "").trim().toUpperCase();
  if (!c || c === "-") return "";
  const m = c.match(/^(.*)-(OPT-[A-Z]?[0-9]*|[A-Z])$/);
  return m ? m[1] : c;
};

const getOptionSuffix = (itemCode: string) => {
  const c = (itemCode || "").trim().toUpperCase();
  const m = c.match(/-(OPT-([A-Z]?[0-9]*)|([A-Z]))$/);
  return m ? (m[2] || m[3]) : "";
};

const parseOfferRows = (row: SPFCreationRow): OfferProduct[][] => {
  const f = parseField2D;
  const images = parseImageField2D(row.product_offer_image);
  const qtys = parseImageField2D(row.product_offer_qty);
  const specs = f(row.product_offer_technical_specification);
  const costs = f(row.product_offer_unit_cost);
  const packs = f(row.product_offer_packaging_details);
  const factories = f(row.product_offer_factory_address);
  const ports = f(row.product_offer_port_of_discharge);
  const subtotals = f(row.product_offer_subtotal);
  const pcs = f(row.product_offer_pcs_per_carton);
  const companies = f(row.company_name);
  const brands = f(row.supplier_brand);
  const contacts = f(row.contact_number);
  const codes = parseImageField2D(row.item_code);
  const leads = parseImageField2D(row.proj_lead_time);
  const sellings = parseImageField2D(row.final_selling_cost);

  const numRows = Math.max(images.length, qtys.length, specs.length);

  return Array.from({ length: numRows }, (_, ri) => {
    const rImg = images[ri] ?? [""];
    const rQty = qtys[ri] ?? [""];
    const rSpc = specs[ri] ?? [""];
    const rCst = costs[ri] ?? [""];
    const rPck = packs[ri] ?? [""];
    const rFct = factories[ri] ?? [""];
    const rPrt = ports[ri] ?? [""];
    const rSub = subtotals[ri] ?? [""];
    const rPcs = pcs[ri] ?? [""];
    const rComp = companies[ri] ?? [""];
    const rBrnd = brands[ri] ?? [""];
    const rCont = contacts[ri] ?? [""];
    const rCode = codes[ri] ?? [""];
    const rLead = leads[ri] ?? [""];
    const rSell = sellings[ri] ?? [""];
    const numProds = Math.max(rImg.length, rQty.length, rSpc.length);

    return Array.from({ length: numProds }, (_, pi) => ({
      image: rImg[pi] ?? "",
      qty: rQty[pi] ?? "",
      spec: parseSpec(rSpc[pi] ?? ""),
      unit_cost: rCst[pi] ?? "",
      packaging: rPck[pi] ?? "",
      factory_address: rFct[pi] ?? "",
      port_of_discharge: rPrt[pi] ?? "",
      subtotal: rSub[pi] ?? "",
      pcs_per_carton: rPcs[pi] ?? "",
      company_name: rComp[pi] ?? "",
      supplier_brand: rBrnd[pi] ?? "",
      contact_number: rCont[pi] ?? "",
      item_code: rCode[pi] ?? "",
      lead_time: rLead[pi] ?? "",
      final_selling: rSell[pi] ?? "",
    }));
  });
};

const getOfferProductsForItem = (offer: SPFCreationRow, itemIndex: number, itemRowCode: string) => {
  const offerRows = parseOfferRows(offer);
  const flat = offerRows.flat();

  if (itemRowCode && itemRowCode !== "-") {
    const matches = flat
      .filter((p) => getBaseItemCode(p.item_code) === itemRowCode.toUpperCase())
      .slice()
      .sort((a, b) => {
        const ar = getOptionSuffix(a.item_code);
        const br = getOptionSuffix(b.item_code);
        const ai = ar ? ar.charCodeAt(0) : 999;
        const bi = br ? br.charCodeAt(0) : 999;
        return ai - bi;
      });
    if (matches.length > 0) return matches;
  }

  return offerRows[itemIndex] || [];
};

export function SPFPreviewDialog({ open, onClose, currentSPF }: Props) {
  const [offers, setOffers] = useState<SPFCreationRow[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  const openFullImage = (url: string) => { setFullImageUrl(url); setIsImageDialogOpen(true); };

  const requestedItems = (() => {
    const descs = (currentSPF?.item_description || "").split(",").map((s: string) => s.trim());
    const photos = (currentSPF?.item_photo || "").split(",").map((s: string) => s.trim());
    const qtys = (currentSPF?.item_qty || "").split(",").map((s: string) => s.trim());
    const maxLen = Math.max(descs.filter(Boolean).length, photos.filter(Boolean).length, qtys.filter(Boolean).length);
    return maxLen > 0 ? Array.from({ length: maxLen }, (_, i) => ({ item_description: descs[i] || "", item_photo: photos[i] || "", item_qty: qtys[i] || "" })) : [];
  })();

  useEffect(() => {
    if (!open || !currentSPF?.spf_number) { setOffers([]); return; }
    setLoadingOffers(true);
    supabase
      .from("spf_creation")
      .select("*")
      .eq("spf_number", currentSPF.spf_number)
      .order("id", { ascending: true })
      .then(({ data, error }) => { if (!error && data) setOffers(data as SPFCreationRow[]); setLoadingOffers(false); });
  }, [open, currentSPF?.spf_number, supabase]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="p-0 overflow-hidden" style={{ maxWidth: "1400px", width: "100%", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ background: "#f8fafc", maxHeight: "calc(100vh - 60px)", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #334155", flexShrink: 0 }}>
            <div className="flex items-center gap-3">
              <div style={{ background: "rgba(255,255,255,0.1)", padding: "6px", borderRadius: "4px" }}><FileText style={{ width: "14px", height: "14px", color: "#f9fafb" }} /></div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 style={{ ...F, fontSize: "13px", fontWeight: 800, color: "#f9fafb", margin: 0, letterSpacing: "0.05em" }}>{currentSPF?.spf_number || "SPF-PENDING"}</h2>
                  <CopyButton text={currentSPF?.spf_number || ""} />
                </div>
                <p style={{ ...F, fontSize: "11px", color: "#94a3b8", margin: "2px 0 0 0" }}>{currentSPF?.customer_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {currentSPF?.status && <StatusBadge status={currentSPF?.status} />}
            </div>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            {/* Two Column Layout: SPF Request (Left) + Offers (Right) */}
            <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "16px" }}>
              {/* LEFT: Full SPF Request Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Customer Info Section */}
                <div style={{ background: "#fff", borderRadius: "6px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Building2 style={{ width: "12px", height: "12px", color: "#64748b" }} />
                    <span style={{ ...F, fontSize: "10px", fontWeight: 800, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase" }}>Customer Information</span>
                  </div>
                  <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[
                      { label: "Customer Name", value: currentSPF?.customer_name },
                      { label: "Contact Person", value: currentSPF?.contact_person },
                      { label: "Contact Number", value: currentSPF?.contact_number },
                      { label: "TIN Number", value: currentSPF?.tin_no },
                      { label: "Registered Address", value: currentSPF?.registered_address },
                      { label: "Delivery Address", value: currentSPF?.delivery_address },
                      { label: "Billing Address", value: currentSPF?.billing_address },
                      { label: "Collection Address", value: currentSPF?.collection_address },
                    ].map((f, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ ...F, fontSize: "8px", color: "#64748b", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{f.label}</span>
                          {f.value && <CopyButton text={f.value} />}
                        </div>
                        <span style={{ ...F, fontSize: "11px", color: "#0f172a", fontWeight: 600, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{f.value || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Terms Section */}
                <div style={{ background: "#fff", borderRadius: "6px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  <div style={{ background: "#f0fdf4", padding: "8px 12px", borderBottom: "1px solid #86efac", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileCheck style={{ width: "12px", height: "12px", color: "#059669" }} />
                    <span style={{ ...F, fontSize: "10px", fontWeight: 800, color: "#065f46", letterSpacing: "0.12em", textTransform: "uppercase" }}>Order Terms</span>
                  </div>
                  <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[
                      { label: "Payment Terms", value: currentSPF?.payment_terms },
                      { label: "Warranty", value: currentSPF?.warranty },
                      { label: "Delivery Date", value: currentSPF?.delivery_date ? new Date(currentSPF.delivery_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "" },
                      { label: "Special Instructions", value: currentSPF?.special_instructions },
                    ].map((f, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ ...F, fontSize: "8px", color: "#065f46", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{f.label}</span>
                          {f.value && <CopyButton text={f.value} />}
                        </div>
                        <span style={{ ...F, fontSize: "11px", color: "#065f46", fontWeight: 600, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{f.value || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signatories Section */}
                <div style={{ background: "#fff", borderRadius: "6px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileText style={{ width: "12px", height: "12px", color: "#64748b" }} />
                    <span style={{ ...F, fontSize: "10px", fontWeight: 800, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase" }}>Signatories</span>
                  </div>
                  <div style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {[
                      { label: "Sales Person", value: currentSPF?.sales_person },
                      { label: "Prepared By", value: currentSPF?.prepared_by },
                      { label: "Approved By", value: currentSPF?.approved_by },
                      { label: "Noted By", value: currentSPF?.noted_by },
                    ].map((f, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ ...F, fontSize: "8px", color: "#64748b", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{f.label}</span>
                          {f.value && <CopyButton text={f.value} />}
                        </div>
                        <span style={{ ...F, fontSize: "11px", color: "#0f172a", fontWeight: 600, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{f.value || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT: Item Comparisons (Requested vs Offers) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {requestedItems.map((reqItem, itemIndex) => {
                  const itemRowCode = currentSPF?.spf_number
                    ? `${currentSPF.spf_number}-${String(itemIndex + 1).padStart(3, "0")}`
                    : "-";

                  const itemOffers = offers
                    .map((offer) => getOfferProductsForItem(offer, itemIndex, itemRowCode))
                    .flat();

                  return (
                    <div key={itemIndex} style={{ background: "#fff", borderRadius: "6px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
                      {/* Item Header */}
                      <div style={{ background: "#f8fafc", padding: "10px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ background: "#0f172a", color: "#f9fafb", padding: "4px 12px", borderRadius: "4px", fontWeight: 800, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                          Item {itemIndex + 1}
                        </div>
                        {reqItem.item_qty && (
                          <span style={{ ...F, fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 8px", background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: "4px" }}>
                            Qty: {reqItem.item_qty}
                          </span>
                        )}
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ ...F, fontSize: "10px", fontWeight: 800, color: "#475569", border: "1px solid #cbd5e1", background: "#ffffff", padding: "3px 8px", borderRadius: "4px" }}>
                            {itemRowCode}
                          </span>
                          {itemRowCode !== "-" && <CopyButton text={itemRowCode} />}
                        </div>
                      </div>

                      {/* Item Body */}
                      <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "280px 1fr", gap: "16px" }}>
                        {/* Requested Item */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
                          <div style={{ background: "#f0fdf4", borderRadius: "6px", padding: "12px", border: "1px solid #86efac", height: "100%" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <FileCheck style={{ width: "12px", height: "12px", color: "#059669" }} />
                                <span style={{ ...F, fontSize: "10px", fontWeight: 800, color: "#065f46", letterSpacing: "0.12em", textTransform: "uppercase" }}>Requested</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ ...F, fontSize: "10px", fontWeight: 800, color: "#065f46", border: "1px solid #86efac", background: "#ffffff", padding: "2px 8px", borderRadius: "4px" }}>
                                  {itemRowCode}
                                </span>
                                {itemRowCode !== "-" && <CopyButton text={itemRowCode} />}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                              {reqItem.item_photo && (
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                  <div
                                    style={{ width: "90px", height: "90px", border: "1px solid #86efac", borderRadius: "4px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fff" }}
                                    onClick={() => openFullImage(reqItem.item_photo)}
                                  >
                                    <img src={reqItem.item_photo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                  </div>
                                </div>
                              )}

                              {/* Description */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div style={{ ...F, fontSize: "9px", color: "#065f46", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Description</div>
                                  <CopyButton text={(reqItem.item_description || "No description provided").replace(/([A-Za-z ]+:\s*)/g, "\n$1").trim()} />
                                </div>
                                <div style={{
                                  background: "#fff",
                                  border: "1px solid #86efac",
                                  borderRadius: "4px",
                                  padding: "10px",
                                  ...F,
                                  fontSize: "11px",
                                  color: "#065f46",
                                  lineHeight: "1.6",
                                  whiteSpace: "pre-line",
                                }}>
                                  {(reqItem.item_description || "No description provided")
                                    .replace(/([A-Za-z ]+:\s*)/g, "\n$1")
                                    .trim()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Product Offers for this Item */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {loadingOffers ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100px", gap: "8px", background: "#fff", borderRadius: "6px", border: "1px dashed #e5e7eb" }}>
                              <Loader2 style={{ width: "16px", height: "16px", color: "#6b7280", animation: "spin 1s linear infinite" }} />
                              <span style={{ ...F, fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>Loading offers…</span>
                            </div>
                          ) : itemOffers.length === 0 ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100px", background: "#fff", borderRadius: "6px", border: "1px dashed #e5e7eb" }}>
                              <span style={{ ...F, fontSize: "11px", color: "#9ca3af", fontWeight: 600 }}>No offers for this item</span>
                            </div>
                          ) : (
                            offers.map((offer, offerIndex) => {
                              const offerRow = getOfferProductsForItem(offer, itemIndex, itemRowCode);
                              if (!offerRow || offerRow.length === 0) return null;
                              return (
                                <div key={offer.id} style={{ border: "1px solid #e5e7eb", borderRadius: "6px", overflow: "hidden" }}>
                                  <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div className="flex items-center gap-3">
                                      <Building2 style={{ width: "14px", height: "14px", color: "#bfdbfe" }} />
                                      <div className="flex items-center gap-2">
                                        <div style={{ ...F, fontSize: "12px", fontWeight: 800, color: "#f9fafb" }}>{(offer.company_name || "").split("|ROW|").filter(Boolean)[0]}</div>
                                        <CopyButton text={(offer.company_name || "").split("|ROW|").filter(Boolean)[0] || ""} />
                                      </div>
                                    </div>
                                    <span style={{ ...F, fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 8px", background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: "4px" }}>
                                      Offer #{offerIndex + 1}
                                    </span>
                                  </div>
                                  <div style={{ padding: "14px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: offerRow.length > 1 ? `repeat(${Math.min(offerRow.length, 2)}, 1fr)` : "1fr", gap: "12px" }}>
                                      {offerRow.map((prod, prodIndex) => (
                                        <div key={prodIndex} style={{ border: "1px solid #e5e7eb", borderRadius: "6px", overflow: "hidden", background: "#fafafa" }}>
                                          <div style={{ background: "#eff6ff", padding: "8px 12px", borderBottom: "1px solid #dbeafe", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <span style={{ ...F, fontSize: "10px", color: "#1e40af", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Variant {prodIndex + 1}</span>
                                          </div>
                                          <div style={{ padding: "12px" }}>
                                            {/* Product Image + Quick Stats */}
                                            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                                              {prod.image && (
                                                <div style={{ flexShrink: 0 }}>
                                                  <div
                                                    style={{ width: "80px", height: "80px", border: "1px solid #dbeafe", borderRadius: "4px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fff" }}
                                                    onClick={() => openFullImage(prod.image)}>
                                                    <img src={prod.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                                  </div>
                                                  <button
                                                    onClick={() => openFullImage(prod.image)}
                                                    style={{
                                                      ...F,
                                                      width: "100%",
                                                      marginTop: "5px",
                                                      fontSize: "9px",
                                                      color: "#2563eb",
                                                      background: "#dbeafe",
                                                      border: "1px solid #93c5fd",
                                                      borderRadius: "3px",
                                                      padding: "2px 6px",
                                                      cursor: "pointer",
                                                      fontWeight: 600
                                                    }}
                                                  >
                                                    View
                                                  </button>
                                                </div>
                                              )}
                                              <div style={{ flex: 1 }}>
                                                {/* Quick Stats Grid */}
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
                                                  {[
                                                    { label: "Item Code", value: prod.item_code, copy: true },
                                                    { label: "Lead Time", value: prod.lead_time },
                                                    { label: "Unit Cost", value: prod.unit_cost, highlight: true, copy: true },
                                                    { label: "Selling Cost", value: prod.final_selling, highlight: true, copy: true },
                                                    { label: "Qty", value: prod.qty },
                                                    { label: "Subtotal", value: prod.subtotal, highlight: true, copy: true },
                                                  ].map((stat, i) => (
                                                    <div key={i} style={{ background: stat.highlight ? "#f0fdf4" : "#fff", padding: "7px 9px", borderRadius: "5px", border: `1px solid ${stat.highlight ? "#86efac" : "#e5e7eb"}` }}>
                                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                                                        <span style={{ ...F, fontSize: "8px", fontWeight: 700, color: stat.highlight ? "#065f46" : "#64748b", letterSpacing: "0.12em", textTransform: "uppercase" }}>{stat.label}</span>
                                                        {stat.copy && stat.value && <CopyButton text={stat.value} />}
                                                      </div>
                                                      <span style={{ ...F, fontSize: "12px", fontWeight: 700, color: stat.highlight ? "#065f46" : "#0f172a" }}>{stat.value || "—"}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                            {/* Technical Specs */}
                                            {/* Technical Specs */}
                                            {prod.spec.length > 0 && (
                                              <div>
                                                <div style={{ ...F, fontSize: "9px", color: "#64748b", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "7px" }}>Specifications</div>
                                                <div
                                                  style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "5px",
                                                    maxHeight: "220px",
                                                    overflowY: "auto",
                                                    paddingRight: "4px",
                                                  }}
                                                >
                                                  {prod.spec.map((cat, ci) => (
                                                    <div key={ci} style={{ border: "1px solid #dbeafe", borderRadius: "5px", overflow: "hidden", flexShrink: 0 }}>
                                                      <div style={{ background: "#eff6ff", padding: "4px 10px", borderBottom: "1px solid #dbeafe", position: "sticky", top: 0, zIndex: 1 }}>
                                                        <span style={{ ...F, fontSize: "8px", fontWeight: 800, color: "#1e40af", letterSpacing: "0.12em", textTransform: "uppercase" }}>{cat.name}</span>
                                                      </div>
                                                      <div style={{ padding: "5px 10px", background: "#fff" }}>
                                                        {cat.items.map((item, ii) => (
                                                          <div key={ii} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: ii < cat.items.length - 1 ? "1px solid #f0f9ff" : "none" }}>
                                                            <span style={{ ...F, fontSize: "10px", color: "#64748b", fontWeight: 600 }}>{item.key}</span>
                                                            <span style={{ ...F, fontSize: "11px", color: "#0f172a", fontWeight: 600, textAlign: "right", marginLeft: "8px" }}>
                                                              {item.multiValues.length > 1 ? item.multiValues.join(" • ") : item.value}
                                                            </span>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Full Image Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="p-0 overflow-hidden" style={{ maxWidth: "90vw", maxHeight: "90vh", width: "auto", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.25)" }}>
          <div style={{ background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            {fullImageUrl && <img src={fullImageUrl} alt="Full size" style={{ maxWidth: "100%", maxHeight: "calc(90vh - 60px)", objectFit: "contain", borderRadius: "6px" }} />}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
