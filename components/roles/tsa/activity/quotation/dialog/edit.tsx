"use client";

import React, { useState, useEffect, useRef, ChangeEvent, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sileo } from "sileo";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Download,
  Eye,
  Trash,
  FileSpreadsheet,
  FileText,
  EyeOff,
  ImagePlus,
  Plus,
  Package,
  Building2,
  PanelLeft,
  HelpCircle,
  Info,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FieldLabel } from "@/components/ui/field";

import { Preview } from "./preview";
import ConfirmationDialog from "./confirmation";

interface Completed {
  id: number;
  start_date?: string;
  end_date?: string;
  date_updated?: string;
  date_created?: string;
  product_quantity?: string;
  product_amount?: string;
  product_description?: string;
  product_photo?: string;
  product_title?: string;
  product_sku?: string;
  item_remarks?: string;
  quotation_number?: string;
  quotation_amount?: number | string;
  quotation_type: string;
  version?: string;
  activity_reference_number?: string;
  referenceid?: string;
  tsm?: string;
  manager?: string;
  company_name?: string;
  contact_person?: string;
  contact_number?: string;
  email_address?: string;
  address?: string;
  region?: string;
  delivery_fee?: string;
  restocking_fee?: string;
  quotation_vatable?: string;
  quotation_subject?: string;
  discounted_priced?: string;
  discounted_amount?: string;
  hide_discount_in_preview?: boolean;
  show_discount_columns?: boolean;
  show_summary_discounts?: boolean;
  show_profit_margins?: boolean;
  margin_alert_threshold?: number;
  show_margin_alerts?: boolean;
  product_view_mode?: string;
  visible_columns?: any;
  product_is_promo?: string;
  product_is_hidden?: string;
  product_display_mode?: string;

  // Signatory properties
  agent_signature?: string;
  agent_contact_number?: string;
  agent_email_address?: string;
  tsm_signature?: string;
  tsm_contact_number?: string;
  tsm_email_address?: string;
  manager_signature?: string;
  manager_contact_number?: string;
  manager_email_address?: string;
}

interface ProductItem {
  uid: string; // Unique identifier for rawInputValues keys
  description: string;
  skus: any;
  title: string;
  isPromo?: boolean;
  isHidden?: boolean;
  hideDiscountInPreview?: boolean;
  displayMode?: 'transparent' | 'net_only' | 'value_add' | 'bundle' | 'request';
  images: any;
  isDiscounted: boolean;
  price: number;
  quantity: number;
  product_quantity?: string;
  product_amount?: string;
  product_description?: string;
  product_photo?: string;
  product_title?: string;
  product_sku?: string;
  item_remarks?: string;
  discount?: number;
  discountAmount?: number; // Per-unit discount amount in pesos (synced with discount %)
  procurementMinQty?: number;
  procurementLeadTime?: string;
  procurementLockedPrice?: boolean;
  originalPrice?: number;
  cloudinaryPublicId?: string;
  id?: string;
  pageBreakBefore?: boolean;  // Force a page break before this item in PDF
  spacerAfter?: number;       // Extra vertical space (px) added after this item in PDF
  descSpacerAfter?: number;   // Extra space (px) added inside description column (4th col) after last section
  descSpacerBefore?: number;  // Extra space (px) added inside description column (4th col) before first section
  descSectionSpacing?: number;// Extra space (px) added BETWEEN description sections
  sectionSpacings?: number[]; // Per-section spacing (array of px values for each section)
  sectionPageBreaks?: boolean[]; // Per-section page breaks (array of booleans, true = force page break BEFORE this section)
}

function splitAndTrim(value?: string): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim());
}

function splitDescription(value?: string): string[] {
  if (!value) return [];
  return value.split("||").map((v) => v.trim());
}

function parseDescriptionIntoSections(html?: string): string[] {
  if (!html?.trim()) return [];
  
  // Clean up first
  let processed = html
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  // Split by section headers (divs with #121212 background)
  const sections: string[] = [];
  const headerPattern = /<div[^>]*background\s*:\s*#121212[^>]*>/gi;
  let lastIndex = 0;
  let match;
  
  while ((match = headerPattern.exec(processed)) !== null) {
    if (match.index > lastIndex) {
      const before = processed.substring(lastIndex, match.index).trim();
      if (before) sections.push(before);
    }
    
    // Find the end of this section block
    let depth = 1;
    let endIdx = match.index + match[0].length;
    
    while (depth > 0 && endIdx < processed.length) {
      if (processed.substring(endIdx, endIdx + 5) === '<div ') {
        depth++;
        endIdx += 5;
      } else if (processed.substring(endIdx, endIdx + 6) === '</div>') {
        depth--;
        endIdx += 6;
      } else {
        endIdx++;
      }
    }
    
    sections.push(processed.substring(match.index, endIdx).trim());
    lastIndex = endIdx;
  }
  
  if (lastIndex < processed.length) {
    const remaining = processed.substring(lastIndex).trim();
    if (remaining) sections.push(remaining);
  }
  
  return sections.filter(s => s.length > 0);
}

// ── SPF 1 types ──────────────────────────────────────────────────────────────
type SpfCreationRow = {
  id: number;
  spf_number?: string | null;
  status?: string | null;
  company_name?: string | null;
  supplier_brand?: string | null;
  contact_name?: string | null;
  contact_number?: string | null;
  final_selling_cost?: string | null;
  proj_lead_time?: string | null;
  project_lead_time?: string | null;
  manager?: string | null;
  item_code?: string | null;
  product_name?: string | null;
  referenceid?: string | null;
  [key: string]: any;
};

type SpfOfferProduct = {
  title: string;
  sku: string;
  quantity: number;
  finalSellingPrice: number;
  imageUrl: string;
  technicalSpecification: string;
  packagingDetails: string;
  factoryDetails: string;
  url: string;
  leadTime: string;
};

type SpfDetailRow = {
  id?: number;
  spf_number?: string;
  status?: string;
  company_name?: string;
  supplier_brand?: string;
  contact_name?: string;
  contact_number?: string;
  final_selling_cost?: string;
  project_lead_time?: string;
  manager?: string;
  item_code?: string;
  referenceid?: string;
  product_offer_title?: string;
  product_offer_sku?: string;
  product_offer_technical_specification?: string;
  product_offer_packaging_details?: string;
  product_offer_image_url?: string;
  product_offer_unit_cost?: string;
  product_offer_factory_address?: string;
  product_offer_port_of_discharge?: string;
  product_offer_subtotal?: string;
  product_offer_pcs_per_carton?: string;
  product_offer_quantity?: string;
  product_offer_final_selling?: string;
  product_offer_lead_time?: string;
  product_offer_company_name?: string;
  product_offer_supplier_brand?: string;
  product_offer_contact_number?: string;
  [key: string]: any;
};

function spfSplitByRow(value?: string | null): string[] {
  return (value || "").split("|ROW|").map((s) => s.trim()).filter((s) => s.length > 0);
}
function spfSplitComma(value?: string | null): string[] {
  return (value || "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}
function spfExplodeRowGroups(value?: string | null): string[] {
  const groups = spfSplitByRow(value);
  if (groups.length === 0) return spfSplitComma(value);
  return groups.flatMap((g) => spfSplitComma(g));
}
function spfExplodeTechSpecs(value?: string | null): string[] {
  const v = (value || "").trim();
  if (!v) return [];
  const rowGroups = spfSplitByRow(v);
  if (rowGroups.length > 0) return rowGroups;
  return [v];
}
function spfSummarizeField(value?: string | null, max = 2): string {
  const items = spfExplodeRowGroups(value)
    .map((v) => v.replace(/\|ROW\|/g, "").trim())
    .filter((v) => v && v !== "-" && v !== "--");
  const unique = Array.from(new Set(items));
  if (unique.length === 0) return "—";
  const head = unique.slice(0, max).join(", ");
  return unique.length > max ? `${head}...` : head;
}
function parseSpfCreationProducts(row: SpfCreationRow): SpfOfferProduct[] {
  const skus = spfExplodeRowGroups(row.item_code);
  const productNames = spfExplodeRowGroups(row.product_name);
  const qtys = spfExplodeRowGroups(row.product_offer_qty);
  const sellingPrices = spfExplodeRowGroups(row.final_selling_cost);
  const leadRaw = row.proj_lead_time ?? row.project_lead_time;
  const leadTimes = spfExplodeRowGroups(leadRaw);
  const imgs = spfExplodeRowGroups(row.product_offer_image);
  const techSpecs = spfExplodeTechSpecs(row.product_offer_technical_specification);
  const packaging = spfExplodeRowGroups(row.product_offer_packaging_details);
  const factory = spfExplodeRowGroups(row.product_offer_factory_address);
  const maxLen = skus.length || Math.max(qtys.length, sellingPrices.length, leadTimes.length, imgs.length, 1);
  return Array.from({ length: maxLen }, (_, i) => {
    // Use product_name if available, otherwise fallback to item code
    const productName = (productNames[i] || "").trim();
    const itemCode = (skus[i] || "").trim();
    const displayTitle = (productName && productName !== "-") ? productName : (itemCode || `SPF ITEM ${i + 1}`);
    
    return {
      title: displayTitle.toUpperCase(),
      sku: (itemCode || skus[0] || "").toUpperCase(),
      quantity: Math.max(0, parseInt(qtys[i] || "0", 10) || 0),
      finalSellingPrice: Math.max(0, parseFloat(sellingPrices[i] || "0") || 0),
      imageUrl: imgs[i] || "",
      technicalSpecification: techSpecs[i] || "",
      packagingDetails: packaging[i] || "",
      factoryDetails: factory[i] || "",
      url: "",
      leadTime: leadTimes[i] || leadTimes[0] || "",
    };
  }).filter((p) => p.sku.trim().length > 0);
}
function escapeHtmlSpf(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function formatSpfTechSpecToHtml(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return '<span style="color:#9ca3af;font-style:italic;">No specifications provided.</span>';
  const normalised = text.replace(/\s*\|\|\s*([^|@~]+~~)/g, "@@$1");
  const groups = normalised.split("@@").map((g) => g.trim()).filter(Boolean);
  const out: string[] = [];
  for (const g of groups) {
    const [groupTitleRaw, ...rest] = g.split("~~");
    const groupTitle = escapeHtmlSpf((groupTitleRaw || "").trim());
    const body = rest.join("~~").trim();
    const lines = body.split(";;").map((l) => l.trim()).filter(Boolean);
    out.push(`<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">${groupTitle || "SPECIFICATIONS"}</div>`);
    if (lines.length === 0) continue;
    out.push(`<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">`);
    for (const line of lines) {
      const idx = line.indexOf(":");
      const name = escapeHtmlSpf((idx >= 0 ? line.slice(0, idx) : line).trim());
      const value = escapeHtmlSpf((idx >= 0 ? line.slice(idx + 1) : "").trim());
      out.push(`<tr><td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%"><strong>${name}</strong></td><td style="border:1px solid #e5e7eb;padding:4px">${value}</td></tr>`);
    }
    out.push(`</table>`);
  }
  return out.join("\n");
}
function formatProcurementLeadHtml(lead: string): string {
  const t = (lead || "").trim();
  if (!t) return "";
  return `<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">Procurement</div><table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px"><tr><td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%"><strong>Project lead time</strong></td><td style="border:1px solid #e5e7eb;padding:4px">${escapeHtmlSpf(t)}</td></tr></table>`;
}

// SPF offer parsing types
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

const parseOfferRows = (row: SpfCreationRow): OfferProduct[][] => {
  const f = parseField2D;
  const images = parseImageField2D(row.product_offer_image ?? undefined);
  const qtys = parseImageField2D(row.product_offer_qty ?? undefined);
  const specs = f(row.product_offer_technical_specification ?? undefined);
  const costs = f(row.product_offer_unit_cost ?? undefined);
  const packs = f(row.product_offer_packaging_details ?? undefined);
  const factories = f(row.product_offer_factory_address ?? undefined);
  const ports = f(row.product_offer_port_of_discharge ?? undefined);
  const subtotals = f(row.product_offer_subtotal ?? undefined);
  const pcs = f(row.product_offer_pcs_per_carton ?? undefined);
  const companies = f(row.company_name ?? undefined);
  const brands = f(row.supplier_brand ?? undefined);
  const contacts = f(row.contact_number ?? undefined);
  const codes = parseImageField2D(row.item_code ?? undefined);
  const leads = parseImageField2D(row.proj_lead_time ?? undefined);
  const sellings = parseImageField2D(row.final_selling_cost ?? undefined);

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

interface Product {
  id: string;
  title: string;
  description?: string;
  images?: { src: string }[];
  skus?: string[];
  price?: string;
  remarks?: string;
}

interface RevisedQuotation {
  id: number;
  quotation_number?: string;
  product_title?: string;
  quotation_amount?: number;
  version?: string;
  start_date?: string | Date;
  end_date?: string | Date;
  products?: Product[];
  product_description?: string;
  product_quantity?: string;
  product_amount?: string;
  product_photo?: string;
  product_sku?: string;
  item_remarks?: string;
  discounted_priced?: string;
  discounted_amount?: string;
  product_is_promo?: string;
  product_is_hidden?: string;
  product_display_mode?: string;
  date_updated?: string;
  date_created?: string;
  status?: string;
  type_activity?: string;
  quotation_subject?: string;
  quotation_vatable?: string;
  restocking_fee?: string;
  delivery_fee?: string;
  vat_type?: string;
  quotation_type?: string;
}

interface TaskListEditDialogProps {
  item: Completed;
  onClose: () => void;
  onSave: () => void;
  company?: {
    company_name?: string;
    contact_number?: string;
    type_client?: string;
    email_address?: string;
    address?: string;
    contact_person?: string;
  };
  firstname?: string;
  lastname?: string;
  email?: string;
  contact?: string;
  tsmname?: string;
  tsmemail?: string;
  tsmcontact?: string;
  managername?: string;
  activity_reference_number?: string;
  referenceid?: string;
  tsm?: string;
  manager?: string;
  company_name?: string;
  contact_person?: string;
  contact_number?: string;
  email_address?: string;
  address?: string;
  quotation_number?: string;
  vatType?: string;
  deliveryFee?: string;
  restockingFee?: string;
  whtType?: string;
  quotationSubject?: string;
  agentSignature?: string;
  agentContactNumber?: string;
  agentEmailAddress?: string;
  TsmSignature?: string;
  TsmEmailAddress?: string;
  TsmContactNumber?: string;
  ManagerSignature?: string;
  ManagerContactNumber?: string;
  ManagerEmailAddress?: string;
  ApprovedStatus?: string;
  /**
   * When set by the notification bell:
   *   "preview"  → auto-open the Review Quotation modal (same as clicking the black button)
   *   "download" → auto-trigger the jsPDF download (same as clicking the yellow PDF button)
   * When null / undefined → normal manual open, no auto-action.
   */
  autoAction?: "preview" | "download" | null;
}

export default function TaskListEditDialog({
  item,
  onClose,
  onSave,
  company,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  tsmemail,
  tsmcontact,
  managername,
  vatType,
  deliveryFee,
  restockingFee,
  whtType,
  quotationSubject,
  agentSignature,
  agentContactNumber,
  agentEmailAddress,
  TsmSignature,
  TsmContactNumber,
  TsmEmailAddress,
  ManagerSignature,
  ManagerContactNumber,
  ManagerEmailAddress,
  ApprovedStatus,
  autoAction,
}: TaskListEditDialogProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [previewStates, setPreviewStates] = useState<boolean[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [quotationAmount, setQuotationAmount] = useState<number>(0);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isManualEntry, setIsManualEntry] = useState<boolean>(false);

  const [checkedRows, setCheckedRows] = useState<Record<number, boolean>>({});
  const [hasDeleted, setHasDeleted] = useState(false);
  const [discount, setDiscount] = React.useState(0);
  const initialVatType: "vat_inc" | "vat_exe" | "zero_rated" =
    vatType === "vat_inc" || vatType === "vat_exe" || vatType === "zero_rated"
      ? vatType
      : "zero_rated";

  const [vatTypeState, setVatTypeState] = React.useState<
    "vat_inc" | "vat_exe" | "zero_rated"
  >(initialVatType);
  const [deliveryFeeState, setDeliveryFeeState] = useState<string>(
    deliveryFee ?? "",
  );
  const [restockingFeeState, setRestockingFeeState] = useState<string>(
    restockingFee ?? "",
  );
  const [whtTypeState, setWhtTypeState] = useState<string>(
    whtType ?? "none",
  );
  const [quotationSubjectState, setQuotationSubjectState] = useState<string>(
    quotationSubject ?? "For Quotation",
  );

  // Contact details state (editable in revision)
  const [contactPersonState, setContactPersonState] = useState<string>(
    item.contact_person || "",
  );
  const [contactNumberState, setContactNumberState] = useState<string>(
    item.contact_number || "",
  );
  const [emailAddressState, setEmailAddressState] = useState<string>(
    item.email_address || "",
  );

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isContentHidden, setIsContentHidden] = useState(false);
  const [expandedProductRows, setExpandedProductRows] = useState<Set<string>>(new Set());
  const [lookupDialogOpen, setLookupDialogOpen] = useState(false);
  const [lookupQuotationNumber, setLookupQuotationNumber] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [isUsingOwnerName, setIsUsingOwnerName] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugPasswordDialogOpen, setDebugPasswordDialogOpen] = useState(false);
  const [debugPasswordInput, setDebugPasswordInput] = useState("");
  const [debugPasswordError, setDebugPasswordError] = useState("");
  // Signature states to override props when loading quotation
  const [loadedAgentSignature, setLoadedAgentSignature] = useState<string | null>(null);
  const [loadedAgentContactNumber, setLoadedAgentContactNumber] = useState<string | null>(null);
  const [loadedAgentEmailAddress, setLoadedAgentEmailAddress] = useState<string | null>(null);
  const [loadedTsmSignature, setLoadedTsmSignature] = useState<string | null>(null);
  const [loadedTsmContactNumber, setLoadedTsmContactNumber] = useState<string | null>(null);
  const [loadedTsmEmailAddress, setLoadedTsmEmailAddress] = useState<string | null>(null);
  const [loadedManagerSignature, setLoadedManagerSignature] = useState<string | null>(null);
  const [loadedManagerContactNumber, setLoadedManagerContactNumber] = useState<string | null>(null);
  const [loadedManagerEmailAddress, setLoadedManagerEmailAddress] = useState<string | null>(null);
  const [loadedManagerName, setLoadedManagerName] = useState<string | null>(null);
  const [loadedAgentName, setLoadedAgentName] = useState<string | null>(null);
  const [loadedTsmName, setLoadedTsmName] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    example?: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [pdfOption, setPdfOption] = useState<"with-discount" | "default-only">("default-only");
  const [pdfBreakBuffer, setPdfBreakBuffer] = useState(-70); // pixels to adjust page break threshold (+ = later break, - = earlier break)
  const [pdfContHeaderGap, setPdfContHeaderGap] = useState(-85); // extra gap between column header and content on continuation pages 2+
  const [pdfAutoRefresh, setPdfAutoRefresh] = useState(true); // auto-refresh preview on slider changes
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  // NEW: Hide discount columns in preview (for SRP-only quotes)
  // Helper to convert database value to boolean (handles strings like "true"/"false")
  const toBoolean = (value: any, defaultValue: boolean): boolean => {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return defaultValue;
  };

  const [hideDiscountInPreview, setHideDiscountInPreview] = useState(toBoolean(item.hide_discount_in_preview, false));
  // Default to TRUE like planner - show discount columns by default
  const [showDiscountColumns, setShowDiscountColumns] = useState(toBoolean(item.show_discount_columns, true));
  const [showSummaryDiscounts, setShowSummaryDiscounts] = useState(toBoolean(item.show_summary_discounts, true));

  // Sync Show Discount Row with Show Discounts (but allow manual override) - same as planner
  useEffect(() => {
    if (showDiscountColumns) {
      setShowSummaryDiscounts(true);
    } else {
      setShowSummaryDiscounts(false);
    }
  }, [showDiscountColumns]);

  const [showProfitMargins, setShowProfitMargins] = useState(item.show_profit_margins ?? false);
  const [marginAlertThreshold, setMarginAlertThreshold] = useState(item.margin_alert_threshold ?? 0);
  const [showMarginAlerts, setShowMarginAlerts] = useState(item.show_margin_alerts ?? false);
  // Toast notification state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };
  const [productViewMode, setProductViewMode] = useState<'list' | 'grid'>('list');
  const [visibleColumns, setVisibleColumns] = useState(item.visible_columns ?? null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [mobilePanelTab, setMobilePanelTab] = useState<"search" | "products">("search");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<ProductItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lastHistoryAction, setLastHistoryAction] = useState<string>("");
  const [savedTemplates, setSavedTemplates] = useState<Array<{ name: string; products: ProductItem[] }>>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  // Store original data for change detection (PDF security)
  const [originalProducts, setOriginalProducts] = useState<ProductItem[]>([]);
  const [originalConfig, setOriginalConfig] = useState<{
    vatType: string;
    deliveryFee: string;
    restockingFee: string;
    whtType: string;
    quotationSubject: string;
    hideDiscountInPreview: boolean;
    showDiscountColumns: boolean;
    showSummaryDiscounts: boolean;
  } | null>(null);
  const [dragRowUid, setDragRowUid] = useState<string | null>(null);
  // Track raw input values for smooth decimal typing (keyed by product uid + field)
  const [rawInputValues, setRawInputValues] = useState<Record<string, string>>({});
  const [dragOverRowUid, setDragOverRowUid] = useState<string | null>(null);
  const [selectedRevisedQuotation, setSelectedRevisedQuotation] =
    useState<RevisedQuotation | null>(null);

  // SPF modes
  const [hasChanges, setHasChanges] = useState(false);
  const [isSpfMode, setIsSpfMode] = useState(false);
  const [isSpf1Mode, setIsSpf1Mode] = useState(false);
  const [spf1Loading, setSpf1Loading] = useState(false);
  const [spf1Error, setSpf1Error] = useState<string | null>(null);
  const [spf1Records, setSpf1Records] = useState<SpfCreationRow[]>([]);
  const [spfDetailOffers, setSpfDetailOffers] = useState<SpfCreationRow[]>([]);
  // Date tracking
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString());
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString());

  // Update endDate every second for duration tracking
  useEffect(() => {
    const interval = setInterval(() => {
      setEndDate(new Date().toISOString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Revised quotations
  const [revisedQuotations, setRevisedQuotations] = useState<RevisedQuotation[]>([]);
  // Product source for SPF
  const [productSource, setProductSource] = useState<'shopify' | 'firebase_taskflow' | 'firebase_shopify' | 'manual' | 'catalog'>('shopify');
  // Manual product entry for SPF
  const [spfManualProduct, setSpfManualProduct] = useState({
    title: '',
    sku: '',
    quantity: '1',
    price: '',
    cost: '',
    leadTime: '',
    imageUrl: '',
    description: '',
    packaging: '',
    factory: '',
    port: '',
    pcsPerCarton: '',
    supplier: '',
    contact: '',
    cloudinaryPublicId: '',
  });
  // SPF detail view
  const [showSpfDetailView, setShowSpfDetailView] = useState(false);
  // SPF1 search and selection
  const [spf1Search, setSpf1Search] = useState("");
  const [spf1Selected, setSpf1Selected] = useState<SpfCreationRow | null>(null);
  // Description dialog (tracks which product descriptions are expanded)
  const [openDescription, setOpenDescription] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const quantities = splitAndTrim(item.product_quantity);
    const amounts = splitAndTrim(item.product_amount);
    const titles = splitAndTrim(item.product_title);
    const descriptions = splitDescription(item.product_description);
    const photos = splitAndTrim(item.product_photo);
    const sku = splitAndTrim(item.product_sku);
    const remarks = splitAndTrim(item.item_remarks);
    const discountedPrices = splitAndTrim(item.discounted_priced);

    // Parse product flags
    const promoFlags = splitAndTrim(item.product_is_promo);
    const hiddenFlags = splitAndTrim(item.product_is_hidden);
    const displayModes = splitAndTrim(item.product_display_mode);

    // Debug logging
    console.log("[Edit] Loading product flags from item:", {
      product_is_promo: item.product_is_promo,
      product_is_hidden: item.product_is_hidden,
      product_display_mode: item.product_display_mode,
      promoFlags,
      hiddenFlags,
      displayModes,
    });

    const maxLen = Math.max(
      quantities.length,
      amounts.length,
      titles.length,
      descriptions.length,
      photos.length,
      sku.length,
      remarks.length,
    );

    // Parse lead time out of saved description HTML
    const parseLeadTime = (desc: string): string => {
      const match = desc.match(/Project lead time<\/strong><\/td><td[^>]*>([^<]+)/);
      return match?.[1]?.trim() ?? "";
    };

    // Detect SPF1 product by presence of procurement block in description
    const isSpf1Desc = (desc: string): boolean =>
      desc.includes("Project lead time") || desc.includes(">Procurement<");

    const arr: ProductItem[] = [];
    const newCheckedRows: Record<number, boolean> = {};
    for (let i = 0; i < maxLen; i++) {
      const desc = descriptions[i] ?? "";
      const qty = quantities[i] ?? "";
      const amt = amounts[i] ?? "";
      const leadTime = parseLeadTime(desc);
      const isSpf1 = isSpf1Desc(desc);
      const discountPct = parseFloat(discountedPrices[i] ?? "0") || 0;
      const isDiscounted = discountPct > 0;
      if (isDiscounted) {
        newCheckedRows[i] = true;
      }
      const unitPrice = parseFloat(amt) || 0;
      // discounted_amount in DB is stored as the TOTAL discount (unit discount × qty).
      // Always divide by qty to get the per-unit discount amount.
      const discountedAmountArr = splitAndTrim(item.discounted_amount);
      const qtyNum = parseFloat(qty) || 1;
      let savedDiscountAmt = parseFloat(discountedAmountArr[i] ?? "0") || 0;
      if (savedDiscountAmt > 0 && qtyNum > 0) {
        savedDiscountAmt = savedDiscountAmt / qtyNum;
      }
      // Fall back to percent-derived if no saved amount
      const unitDiscountAmount = savedDiscountAmt > 0
        ? savedDiscountAmt
        : isDiscounted ? (unitPrice * discountPct) / 100 : 0;

      arr.push({
        uid: `product-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        product_quantity: qty,
        product_amount: amt,
        product_title: titles[i] ?? "",
        product_description: desc,
        product_photo: photos[i] ?? "",
        product_sku: sku[i] ?? "",
        item_remarks: remarks[i] ?? "",
        quantity: parseFloat(qty) || 0,
        price: unitPrice,
        description: desc,
        skus: sku[i] ? [sku[i]] : undefined,
        title: titles[i] ?? "",
        images: photos[i] ? [{ src: photos[i] }] : undefined,
        isDiscounted,
        discount: discountPct,
        discountAmount: unitDiscountAmount,
        hideDiscountInPreview: hiddenFlags[i] === "1",
        procurementLeadTime: leadTime || undefined,
        procurementMinQty: isSpf1 ? (parseFloat(qty) || undefined) : undefined,
        procurementLockedPrice: isSpf1 ? true : undefined,
        originalPrice: isSpf1 ? unitPrice : undefined,
        isPromo: promoFlags[i] === "1",
        isHidden: hiddenFlags[i] === "1",
        displayMode: (() => {
          const raw = displayModes[i] ?? "";
          if (raw === 'full' || raw === 'transparent') return 'transparent';
          if (raw === 'compact' || raw === 'net_only') return 'net_only';
          if (raw === 'value_add') return 'value_add';
          if (raw === 'bundle') return 'bundle';
          if (raw === 'request') return 'request';
          return 'transparent';
        })(),
        pageBreakBefore: false,
        spacerAfter: 0,
        descSpacerAfter: 0,
        descSpacerBefore: 0,
        descSectionSpacing: 0,
        sectionSpacings: [],
        sectionPageBreaks: [],
      });
    }
    setProducts(arr);
    setOriginalProducts(JSON.parse(JSON.stringify(arr))); // Deep copy for comparison
    // Store original config
    setOriginalConfig({
      vatType: initialVatType,
      deliveryFee: deliveryFee ?? "",
      restockingFee: restockingFee ?? "",
      whtType: whtType ?? "none",
      quotationSubject: quotationSubject ?? "For Quotation",
      hideDiscountInPreview: toBoolean(item.hide_discount_in_preview, false),
      showDiscountColumns: toBoolean(item.show_discount_columns, true),
      showSummaryDiscounts: toBoolean(item.show_summary_discounts, true),
    });
    setCheckedRows(newCheckedRows);

    // Seed signatory names from item owner data on initial load
    // so the PDF & preview show the owner's name, not the logged-in user's name
    const itemAny = item as any;
    const ownerAgentName =
      itemAny.owner_name ||
      ((itemAny.agent_firstname && itemAny.agent_lastname) ? `${itemAny.agent_firstname} ${itemAny.agent_lastname}`.trim() : null) ||
      ((itemAny.firstname && itemAny.lastname) ? `${itemAny.firstname} ${itemAny.lastname}`.trim() : null) ||
      null;
    if (ownerAgentName) setLoadedAgentName(ownerAgentName);
    const ownerTsmName = itemAny.tsm_name || null;
    if (ownerTsmName) setLoadedTsmName(ownerTsmName);
    const ownerManagerName = itemAny.manager_name || null;
    if (ownerManagerName) setLoadedManagerName(ownerManagerName);
  }, [item]);

  useEffect(() => {
    setPreviewStates(products.map(() => true));
  }, [products]);

  // Screenshot Prevention Effects
  useEffect(() => {
    // 1. Visibility change: Hide content when tab is not visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsContentHidden(true);
      } else {
        // Small delay before showing content again
        setTimeout(() => setIsContentHidden(false), 300);
      }
    };

    // 2. Key down: Hide content on print screen or screenshot keys
    const handleKeyDown = (e: KeyboardEvent) => {
      // Print Screen key (PrtScn)
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        setIsContentHidden(true);
        setTimeout(() => setIsContentHidden(false), 1000);
      }
      // Windows: Win + Shift + S (snipping tool)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        setIsContentHidden(true);
        setTimeout(() => setIsContentHidden(false), 1000);
      }
      // Mac: Cmd + Shift + 3 / 4
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '3' || e.key === '4')) {
        setIsContentHidden(true);
        setTimeout(() => setIsContentHidden(false), 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Check if there are unsaved changes (for PDF security)
  const hasUnsavedChanges = useCallback(() => {
    if (!originalConfig) return false;

    // Compare products
    if (products.length !== originalProducts.length) return true;

    const productsChanged = products.some((product, index) => {
      const original = originalProducts[index];
      if (!original) return true;

      // Compare key fields
      return (
        product.product_quantity !== original.product_quantity ||
        product.product_amount !== original.product_amount ||
        product.product_title !== original.product_title ||
        product.product_description !== original.product_description ||
        product.product_sku !== original.product_sku ||
        product.item_remarks !== original.item_remarks ||
        product.isDiscounted !== original.isDiscounted ||
        product.discount !== original.discount ||
        product.discountAmount !== original.discountAmount ||
        product.hideDiscountInPreview !== original.hideDiscountInPreview ||
        product.displayMode !== original.displayMode ||
        product.isPromo !== original.isPromo ||
        product.isHidden !== original.isHidden
      );
    });

    if (productsChanged) return true;

    // Compare configuration
    if (vatTypeState !== originalConfig.vatType) return true;
    if (deliveryFeeState !== originalConfig.deliveryFee) return true;
    if (restockingFeeState !== originalConfig.restockingFee) return true;
    if (whtTypeState !== originalConfig.whtType) return true;
    if (quotationSubjectState !== originalConfig.quotationSubject) return true;
    if (hideDiscountInPreview !== originalConfig.hideDiscountInPreview) return true;
    if (showDiscountColumns !== originalConfig.showDiscountColumns) return true;
    if (showSummaryDiscounts !== originalConfig.showSummaryDiscounts) return true;

    return false;
  }, [products, originalProducts, originalConfig, vatTypeState, deliveryFeeState, restockingFeeState, whtTypeState, quotationSubjectState, hideDiscountInPreview, showDiscountColumns, showSummaryDiscounts]);

  const calculateMargin = (price: number, cost: number): number => {
    if (price <= 0) return 0;
    return ((price - cost) / price) * 100;
  };

  const getMarginAlert = (price: number, cost: number, discountPct: number): { alert: boolean; message: string; severity: 'warning' | 'danger' } | null => {
    if (!showMarginAlerts) return null;

    const margin = calculateMargin(price, cost);

    if (margin < marginAlertThreshold) {
      return {
        alert: true,
        message: `Low margin: ${margin.toFixed(1)}%`,
        severity: margin < marginAlertThreshold / 2 ? 'danger' : 'warning'
      };
    }

    return null;
  };

  // ==================== TEMPLATE FUNCTIONS ====================
  const saveTemplate = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    const newTemplate = { name: templateName, products: [...products] };
    setSavedTemplates(prev => [...prev, newTemplate]);
    setTemplateName('');
    alert('Template saved successfully!');
  };

  // ==================== UNDO/REDO HISTORY ====================
  const saveToHistory = (action: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...products]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setLastHistoryAction(action);
  };

  const loadTemplate = (template: { name: string; products: ProductItem[] }) => {
    setProducts([...template.products]);
    setShowTemplateModal(false);
    saveToHistory('Load template');
  };

  // ==================== DATE HELPER ====================
  function addDaysToDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  // ── SPF 1: fetch approved SPF records when SPF1 panel is opened ────────────
  useEffect(() => {
    if (!isSpf1Mode) return;
    let cancelled = false;
    (async () => {
      setSpf1Loading(true);
      setSpf1Error(null);
      try {
        let q = supabase
          .from("spf_creation")
          .select("*")
          .eq("status", "Approved By Procurement");
        if (item.referenceid?.trim()) {
          q = q.eq("referenceid", item.referenceid.trim());
        }
        const { data, error } = await q.order("date_created", { ascending: false });
        if (error) throw error;
        if (!cancelled) setSpf1Records((data || []) as unknown as SpfCreationRow[]);
      } catch (err: any) {
        if (!cancelled) setSpf1Error(err?.message || "Failed to load SPF 1 records.");
      } finally {
        if (!cancelled) setSpf1Loading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSpf1Mode, item.referenceid]);

  const handleRemoveRow = (index: number) => {
    setProducts((prev) => {
      const n = [...prev];
      n.splice(index, 1);
      setHasDeleted(true);
      return n;
    });
    setPreviewStates((prev) => {
      const n = [...prev];
      n.splice(index, 1);
      return n;
    });
  };

  function serializeArrayFixed(arr: (string | undefined | null)[]): string {
    return arr.map((v) => v ?? "").join(",");
  }

  const performSave = async () => {
    try {
      const product_quantity = serializeArrayFixed(
        products.map((p) => p.product_quantity),
      );
      const product_amount = serializeArrayFixed(
        products.map((p) => p.product_amount),
      );
      const product_title = serializeArrayFixed(
        products.map((p) => p.product_title),
      );
      const item_remarks = serializeArrayFixed(
        products.map((p) => p.item_remarks),
      );
      const product_description = products
        .map((p) =>
          p.description?.trim() ? p.description : p.product_description || "",
        )
        .join(" || ");
      const product_photo = serializeArrayFixed(
        products.map((p) => p.product_photo),
      );
      const product_sku = serializeArrayFixed(
        products.map((p) => p.product_sku),
      );

      // Serialize discount percentages for each product
      const discounted_priced = serializeArrayFixed(
        products.map((p, idx) => {
          const isChecked = p.isDiscounted ?? false;
          if (!isChecked) return "0";
          return String(p.discount ?? 0);
        }),
      );

      // Serialize calculated discount amounts for each product (per-unit, matching getQuotationPayload)
      const discounted_amount = serializeArrayFixed(
        products.map((p) => {
          const isChecked = p.isDiscounted ?? false;
          if (!isChecked) return "0";
          const amt = p.price || parseFloat(p.product_amount ?? "0") || 0;
          const qty = p.quantity || parseFloat(p.product_quantity ?? "0") || 0;
          const discountPercent = p.discount ?? 0;
          // Prefer explicit peso amount stored on product; fall back to % calc
          let unitDiscountValue = p.discountAmount != null && p.discountAmount > 0
            ? p.discountAmount
            : p.isDiscounted ? (amt * discountPercent) / 100 : 0;
          // Normalize: if discountAmount >= unit price, it's likely a total for all qty — convert to per-unit first
          if (unitDiscountValue >= amt && qty > 1) {
            unitDiscountValue = unitDiscountValue / qty;
          }
          // DB convention: store as total discount (per-unit × qty)
          return (unitDiscountValue * qty).toFixed(2);
        }),
      );

      // Serialize product flags
      const product_is_promo = serializeArrayFixed(
        products.map((p) => (p.isPromo ? "1" : "0")),
      );
      const product_is_hidden = serializeArrayFixed(
        products.map((p) => (p.isHidden ? "1" : "0")),
      );
      const product_display_mode = serializeArrayFixed(
        products.map((p) => p.displayMode || "transparent"),
      );

      const deliveryFeeNum = parseFloat(deliveryFeeState) || 0;
      const restockingFeeNum = parseFloat(restockingFeeState) || 0;
      const totalPriceWithDelivery = subtotal + deliveryFeeNum + restockingFeeNum;
      // Calculate EWT deduction if applicable
      const whtAmount = whtTypeState !== "none"
        ? (vatTypeState === "vat_inc"
          ? totalPriceWithDelivery / 1.12
          : totalPriceWithDelivery
        ) * (whtTypeState === "wht_1" ? 0.01 : 0.02)
        : 0;
      const totalQuotationAmount = Math.round((totalPriceWithDelivery - whtAmount) * 100) / 100;

      const bodyData: Completed & {
        vat_type?: "vat_inc" | "vat_exe" | "zero_rated";
      } = {
        id: item.id,
        product_quantity,
        product_amount,
        product_title,
        product_description,
        product_photo,
        product_sku,
        item_remarks,
        discounted_priced,
        discounted_amount,
        quotation_amount: totalQuotationAmount,
        quotation_type: item.quotation_type,
        quotation_number: item.quotation_number,
        vat_type: vatTypeState,
        delivery_fee: deliveryFeeState,
        restocking_fee: restockingFeeState,
        quotation_vatable: whtTypeState,
        quotation_subject: quotationSubjectState,
        activity_reference_number: item.activity_reference_number,
        referenceid: item.referenceid,
        tsm: item.tsm,
        manager: item.manager,
        company_name: item.company_name,
        contact_person: contactPersonState,
        contact_number: contactNumberState,
        email_address: emailAddressState,
        address: item.address,
        start_date: startDate,
        end_date: endDate,

        // Quotation display configuration
        hide_discount_in_preview: hideDiscountInPreview,
        show_discount_columns: showDiscountColumns,
        show_summary_discounts: showSummaryDiscounts,
        show_profit_margins: showProfitMargins,
        margin_alert_threshold: marginAlertThreshold,
        show_margin_alerts: showMarginAlerts,
        product_view_mode: productViewMode,
        visible_columns: visibleColumns,

        // Product flags
        product_is_promo,
        product_is_hidden,
        product_display_mode,
      };

      const res = await fetch(`/api/act-update-history?id=${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("API Error:", errorData);
        throw new Error(errorData.error || "Failed to update activity");
      }
      sileo.success({
        title: "Successful",
        description: "Activity updated successfully!",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      onSave();
      setShowConfirmDialog(false);
    } catch {
      sileo.error({
        title: "Failed",
        description: "Update failed! Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  const onClickSave = () => setShowConfirmDialog(true);

  const getQuotationPayload = () => {
    const salesRepresentativeName = loadedAgentName
      || (item.agent_signature ? null : null) // placeholder to keep chain readable
      || (item as any).owner_name
      || (((item as any).agent_firstname && (item as any).agent_lastname) ? `${(item as any).agent_firstname} ${(item as any).agent_lastname}`.trim() : null)
      || (((item as any).firstname && (item as any).lastname) ? `${(item as any).firstname} ${(item as any).lastname}`.trim() : null)
      || loadedTsmName || loadedManagerName
      || `${firstname ?? ""} ${lastname ?? ""}`.trim();
    const emailUsername = email?.split("@")[0] ?? "";

    let emailDomain = "";
    const isEcoshift_ = item.quotation_type === "Ecoshift Corporation" || (item.quotation_number || "").startsWith("EC");
    if (isEcoshift_)
      emailDomain = "ecoshiftcorp.com";
    else
      emailDomain = "disruptivesolutionsinc.com";

    const salesemail =
      emailUsername && emailDomain ? `${emailUsername}@${emailDomain}` : "";

    const items = products.map((p: ProductItem, index: number) => {
      const qty = p.quantity || parseFloat(p.product_quantity ?? "0") || 0;
      const unitPrice = p.price || parseFloat(p.product_amount ?? "0") || 0;
      const isDiscounted = p.isDiscounted ?? false;
      const defaultDiscount = vatTypeState === "vat_exe" ? 12 : 0;
      const rowDiscount = isDiscounted ? (p.discount ?? defaultDiscount) : 0;
      // p.discountAmount in state is always per-unit (load paths normalize it)
      // Fall back to percent-derived if not set
      let unitDiscountAmount = isDiscounted
        ? (p.discountAmount != null && p.discountAmount > 0
          ? p.discountAmount
          : (unitPrice * rowDiscount) / 100)
        : 0;
      const discountedAmount = Math.max(0, unitPrice - unitDiscountAmount); // net unit price
      // Fix: Round net unit price to 2 decimal places to match UI display and avoid butal
      const fixedNetPrice = parseFloat(discountedAmount.toFixed(2));
      const totalAmount = fixedNetPrice * qty;
      
      // Fix: Recalculate unitDiscountAmount based on fixedNetPrice to keep everything consistent
      const fixedUnitDiscountAmount = parseFloat((unitPrice - fixedNetPrice).toFixed(2));

      return {
        itemNo: index + 1,
        qty,
        photo: p.product_photo ?? p.images?.[0]?.src ?? "",
        title: p.product_title ?? p.title ?? "",
        sku: p.product_sku ?? p.skus?.[0] ?? "",
        itemRemarks: p.item_remarks ?? "",
        product_description: p.description?.trim()
          ? p.description
          : p.product_description || "",
        unitPrice,
        discount: rowDiscount,
        discountAmount: fixedUnitDiscountAmount,
        discountedAmount: fixedNetPrice,
        totalAmount,
        isPromo: p.isPromo ?? false,
        hideDiscountInPreview: p.isHidden ?? p.hideDiscountInPreview ?? false,
        displayMode: p.displayMode ?? 'transparent',
        isSpf1: !!(p.procurementLockedPrice || p.procurementLeadTime || (() => {
          const rawD = p.product_description || p.description || "";
          return rawD.includes("Project lead time");
        })()),
        procurementLeadTime: (() => {
          if (p.procurementLeadTime) return p.procurementLeadTime;
          const rawD = p.product_description || p.description || "";
          const m = rawD.match(/Project lead time<\/strong><\/td><td[^>]*>([^<]+)/);
          return m?.[1]?.trim() ?? "";
        })(),
        remarks: p.item_remarks ?? "",
        pageBreakBefore: p.pageBreakBefore ?? false,
        spacerAfter: p.spacerAfter ?? 0,
        descSpacerAfter: p.descSpacerAfter ?? 0,
        descSpacerBefore: p.descSpacerBefore ?? 0,
        descSectionSpacing: p.descSectionSpacing ?? 0,
        sectionSpacings: p.sectionSpacings ?? [],
        sectionPageBreaks: p.sectionPageBreaks ?? [],
      };
    });

    const deliveryFeeNum = parseFloat(deliveryFeeState) || 0;
    const restockingFeeNum = parseFloat(restockingFeeState) || 0;
    // Fix: Use subtotal directly which is already rounded-sum of rounded line items
    const totalPriceWithDelivery = subtotal + deliveryFeeNum + restockingFeeNum;

    const activeItem = selectedRevisedQuotation || item;
    const activeItemAny = activeItem as any;
    
    const displayDate = activeItemAny.date_updated ?? activeItemAny.date_created ?? activeItemAny.start_date ?? new Date();
    
    const whtBase = vatTypeState === "vat_inc"
      ? totalPriceWithDelivery / 1.12
      : totalPriceWithDelivery;
    
    const whtAmount = whtTypeState !== "none"
      ? Math.round((whtBase * (whtTypeState === "wht_1" ? 0.01 : 0.02)) * 100) / 100
      : 0;
      
    const netAmountToCollect = Math.round((totalPriceWithDelivery - whtAmount) * 100) / 100;

    return {
      referenceNo: activeItemAny.quotation_number ?? "DRAFT-XXXX",
      version: activeItemAny.version,
      date: new Date(displayDate).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }),
      companyName: activeItemAny.company_name ?? "",
      address: activeItemAny.address ?? "",
      telNo: contactNumberState ?? "",
      email: emailAddressState ?? "",
      attention: contactPersonState ?? "",
      subject: quotationSubjectState || "For Quotation",
      items,
      vatTypeLabel:
        vatTypeState === "vat_inc"
          ? "VAT Inc"
          : vatTypeState === "vat_exe"
            ? "VAT Exe"
            : "Zero-Rated",
      totalPrice: totalPriceWithDelivery,
      salesRepresentative: salesRepresentativeName,
      salesemail,
      salescontact: contact ?? "",
      salestsmname: loadedTsmName || (item as any).tsm_name || (tsmname ?? ""),
      salestsmemail: tsmemail ?? "",
      salestsmcontact: tsmcontact ?? "",
      salesmanagername: loadedManagerName || (item as any).manager_name || (managername ?? ""),
      vatType: vatTypeState ?? null,
      deliveryFee: deliveryFeeState ?? "",
      restockingFee: parseFloat(restockingFeeState) || 0,
      whtType: whtTypeState ?? "none",
      whtLabel:
        whtTypeState === "wht_1" ? "EWT 1% (Goods)" :
          whtTypeState === "wht_2" ? "EWT 2% (Services)" : "None",
      whtBase: whtBase,
      whtAmount: whtAmount,
      netAmountToCollect: netAmountToCollect,
      agentSignature: loadedAgentSignature ?? agentSignature ?? null,
      agentContactNumber: loadedAgentContactNumber ?? agentContactNumber ?? null,
      agentEmailAddress: loadedAgentEmailAddress ?? agentEmailAddress ?? null,
      TsmSignature: loadedTsmSignature ?? TsmSignature ?? null,
      TsmEmailAddress: loadedTsmEmailAddress ?? TsmEmailAddress ?? null,
      TsmContactNumber: loadedTsmContactNumber ?? TsmContactNumber ?? null,
      ManagerSignature: loadedManagerSignature ?? ManagerSignature ?? null,
      ManagerContactNumber: loadedManagerContactNumber ?? ManagerContactNumber ?? null,
      ManagerEmailAddress: loadedManagerEmailAddress ?? ManagerEmailAddress ?? null,
    };
  };

  const DownloadExcel = async () => {
    const productCats = item.product_title?.split(",") || [];
    const quantities = item.product_quantity ? item.product_quantity.split(",") : [];
    const amounts = item.product_amount ? item.product_amount.split(",") : [];
    const photos = item.product_photo ? item.product_photo.split(",") : [];
    const titles = item.product_title ? item.product_title.split(",") : [];
    const skus = item.product_sku ? item.product_sku.split(",") : [];
    const descriptions = item.product_description
      ? item.product_description.split("||")
      : [];
    const remarks = item.item_remarks ? item.item_remarks.split(",") : [];

    const salesRepresentativeName = `${firstname} ${lastname}`;
    const emailUsername = email?.split("@")[0] ?? "";

    let emailDomain = "";
    if (item.company_name === "Disruptive Solutions Inc")
      emailDomain = "disruptivesolutionsinc.com";
    else if (item.company_name === "Ecoshift Corporation")
      emailDomain = "ecoshiftcorp.com";
    else emailDomain = email?.split("@")[1] ?? "";

    const activityRef = item.activity_reference_number || "N/A";
    const formattedDate = new Date().toLocaleDateString();
    const quotationAmountNum = quotationAmount || 0;

    const items = productCats.map((_: string, index: number) => {
      const qty = Number(quantities[index] || 0);
      const amount = Number(amounts[index] || 0);
      const photo = photos[index] || "";
      const title = titles[index] || "";
      const sku = skus[index] || "";
      const description = descriptions[index] || "";
      const descriptionTable = `<table><tr><td>${title}</td></tr><tr><td>${sku}</td></tr><tr><td>${description}</td></tr></table>`;
      return {
        itemNo: index + 1,
        qty,
        referencePhoto: photo,
        description: descriptionTable,
        unitPrice: qty > 0 ? amount / qty : 0,
        totalAmount: amount,
      };
    });

    const quotationData = {
      referenceNo: item.quotation_number || activityRef,
      date: formattedDate,
      companyName: item.company_name,
      address: item.address,
      telNo: contactNumberState,
      email: emailAddressState,
      attention: contactPersonState,
      subject: quotationSubjectState || "For Quotation",
      items,
      vatType: "Vat Inc",
      totalPrice: Number(quotationAmountNum),
      salesRepresentative: salesRepresentativeName,
      salesemail: `${emailUsername}@${emailDomain}`,
      salescontact: contact || "",
      salestsmname: tsmname || "",
      salesmanagername: managername || "",
    };

    let apiEndpoint = "/api/quotation/disruptive";
    const isEcoshift_ = item.quotation_type === "Ecoshift Corporation" || (item.quotation_number || "").startsWith("EC");
    
    if (isEcoshift_)
      apiEndpoint = "/api/quotation/ecoshift";
    else
      apiEndpoint = "/api/quotation/disruptive";

    try {
      const resExport = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotationData),
      });
      if (!resExport.ok) {
        sileo.error({
          title: "Failed",
          description: "Failed to export quotation.",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        return;
      }
      const blob = await resExport.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quotation_${item.quotation_number || item.id}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      sileo.error({
        title: "Failed",
        description: "Export failed. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  const handleAddProduct = (product: Product) => {
    setProducts((prev) => [
      ...prev,
      {
        uid: `added-${Date.now()}`,
        product_quantity: "1",
        product_amount: product.price || "0",
        product_title: product.title,
        product_description: product.description || "",
        product_photo: product.images?.[0]?.src || "",
        product_sku: product.skus?.[0] || "",
        description: product.description || "",
        item_remarks: product.remarks || "",
        skus: product.skus || [],
        title: product.title || "",
        images: product.images || [],
        isDiscounted: false,
        discount: 0,
        price: parseFloat(product.price || "0") || 0,
        quantity: 1,
      },
    ]);
    setRecentProducts((prev) => [product, ...prev].slice(0, 5));
    setMobilePanelTab("products");
  };

  useEffect(() => {
    if (!selectedRevisedQuotation) return;
    let productsArray = selectedRevisedQuotation.products;
    if (typeof productsArray === "string") {
      try {
        productsArray = JSON.parse(productsArray);
      } catch {
        productsArray = [];
      }
    }
    if (Array.isArray(productsArray) && productsArray.length > 0) {
      const mappedArr: ProductItem[] = productsArray.map((p, idx) => ({
        uid: `revised-${Date.now()}-${idx}`,
        description: p.description || "",
        skus: p.skus || [],
        title: p.title,
        images: p.images || [],
        isDiscounted: false,
        price: p.price ? parseFloat(p.price) : 0,
        quantity: 1,
        product_quantity: "1",
        product_amount: p.price ? p.price.toString() : "0",
        product_description: p.description || "",
        product_photo: p.images?.[0]?.src || "",
        product_title: p.title,
        product_sku: p.skus?.[0] || "",
        item_remarks: p.remarks?.[0] || "",
      }));
      setProducts(mappedArr);
      // Sync baseline so hasUnsavedChanges() stays false after loading a revision
      setOriginalProducts(JSON.parse(JSON.stringify(mappedArr)));
    } else {
      const quantities = splitAndTrim(
        selectedRevisedQuotation.product_quantity,
      );
      const amounts = splitAndTrim(selectedRevisedQuotation.product_amount);
      const titles = splitAndTrim(selectedRevisedQuotation.product_title);
      const descriptions = splitDescription(
        selectedRevisedQuotation.product_description,
      );
      const photos = splitAndTrim(selectedRevisedQuotation.product_photo);
      const sku = splitAndTrim(selectedRevisedQuotation.product_sku);
      const remarks = splitAndTrim(selectedRevisedQuotation.item_remarks);
      const discountedPrices = splitAndTrim(selectedRevisedQuotation.discounted_priced);
      const discountedAmounts = splitAndTrim(selectedRevisedQuotation.discounted_amount);
      const promoFlags = splitAndTrim(selectedRevisedQuotation.product_is_promo);
      const hiddenFlags = splitAndTrim(selectedRevisedQuotation.product_is_hidden);
      const displayModes = splitAndTrim(selectedRevisedQuotation.product_display_mode);
      const maxLen = Math.max(
        quantities.length,
        amounts.length,
        titles.length,
        descriptions.length,
        photos.length,
        sku.length,
        remarks.length,
      );
      const arr: ProductItem[] = [];
      for (let i = 0; i < maxLen; i++) {
        const discountPct = parseFloat(discountedPrices[i] ?? "0") || 0;
        const isDiscounted = discountPct > 0;
        const unitPrice = parseFloat(amounts[i] ?? "0") || 0;
        const qtyNum = parseFloat(quantities[i] ?? "0") || 1;
        let savedDiscountAmtR = parseFloat(discountedAmounts[i] ?? "0") || 0;
        
        // discounted_amount in DB is stored as the TOTAL discount (unit discount × qty).
        // Always divide by qty to get the per-unit discount amount.
        if (savedDiscountAmtR > 0 && qtyNum > 0) {
          savedDiscountAmtR = savedDiscountAmtR / qtyNum;
        }

        const unitDiscountAmount = savedDiscountAmtR > 0
          ? savedDiscountAmtR
          : isDiscounted ? (unitPrice * discountPct) / 100 : 0;
        const rawDisplayMode = displayModes[i] ?? "";
        arr.push({
          uid: `revised-${Date.now()}-${i}`,
          product_quantity: quantities[i] ?? "",
          product_amount: amounts[i] ?? "",
          product_title: titles[i] ?? "",
          product_description: descriptions[i] ?? "",
          product_photo: photos[i] ?? "",
          product_sku: sku[i] ?? "",
          item_remarks: remarks[i] ?? "",
          quantity: parseFloat(quantities[i] ?? "0") || 0,
          description: descriptions[i] ?? "",
          skus: sku[i] ? [sku[i]] : [],
          title: titles[i] ?? "",
          images: photos[i] ? [{ src: photos[i] }] : [],
          isDiscounted,
          discount: discountPct,
          discountAmount: unitDiscountAmount,
          price: unitPrice,
          isPromo: promoFlags[i] === "1",
          isHidden: hiddenFlags[i] === "1",
          displayMode: (() => {
            if (rawDisplayMode === 'full' || rawDisplayMode === 'transparent') return 'transparent';
            if (rawDisplayMode === 'compact' || rawDisplayMode === 'net_only') return 'net_only';
            if (rawDisplayMode === 'value_add') return 'value_add';
            if (rawDisplayMode === 'bundle') return 'bundle';
            if (rawDisplayMode === 'request') return 'request';
            return 'transparent';
          })(),
        });
      }
      setProducts(arr);
      // Sync baseline so hasUnsavedChanges() stays false after loading a revision
      setOriginalProducts(JSON.parse(JSON.stringify(arr)));
    }
  }, [selectedRevisedQuotation]);

  useEffect(() => {
    if (!item.quotation_number) return;
    const fetch_ = async () => {
      // Fetch original quotation from history
      const { data: historyData, error: historyError } = await supabase
        .from("history")
        .select("*")
        .eq("quotation_number", item.quotation_number)
        .order("id", { ascending: false });

      // Fetch revised quotations
      const { data: revisedData, error: revisedError } = await supabase
        .from("revised_quotations")
        .select("*")
        .eq("quotation_number", item.quotation_number)
        .order("id", { ascending: false });

      if (!historyError && !revisedError) {
        // Combine both history (original) and revised quotations
        const allQuotations = [
          ...(historyData || []),
          ...(revisedData || [])
        ];

        // Sort them by date_updated descending
        allQuotations.sort((a, b) => {
          const dateA = new Date(a.date_updated ?? a.date_created);
          const dateB = new Date(b.date_updated ?? b.date_created);
          return dateB.getTime() - dateA.getTime();
        });

        setRevisedQuotations(allQuotations);
        // Auto-select the latest (first row after sorting)
        if (allQuotations.length > 0) {
          setSelectedRevisedQuotation(allQuotations[0] as unknown as RevisedQuotation);
        }
      }
    };
    fetch_();
  }, [item.quotation_number]);

  const isEcoshift = item.quotation_type === "Ecoshift Corporation" || (item.quotation_number || "").startsWith("EC");
  const headerImagePath = isEcoshift
    ? "/ecoshift-banner.png"
    : "/disruptive-banner.png";

  // ── PDF Security helpers ───────────────────────────────────────────────────

  /** Simple non-crypto hash for anti-tamper fingerprint (visible in QR) */
  const buildSecurityToken = (referenceNo: string, date: string, total: number): string => {
    const raw = `${referenceNo}|${date}|${total.toFixed(2)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const chr = raw.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
    return `${raw}|VER:${hex}`;
  };

  /** Generate a QR code as a base64 PNG data URL using the qrcode library */
  const generateQrDataUrl = async (text: string): Promise<string | null> => {
    try {
      const QRCode = await import("qrcode");
      return await QRCode.toDataURL(text, {
        width: 96,
        margin: 1,
        color: { dark: "#121212", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
    } catch {
      return null;
    }
  };

  /** Stamp diagonal watermark text across the current jsPDF page */
  const stampPdfWatermark = (
    pdf: any,
    companyLabel: string,
    referenceNo: string,
    pdfWidth: number,
    pdfHeight: number,
  ) => {
    pdf.saveGraphicsState();
    // Use 0.06 to match preview precisely
    const gState = new (pdf as any).GState({ opacity: 0.06 });
    pdf.setGState(gState);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(18, 18, 18);
    const line = `${companyLabel}  ·  OFFICIAL QUOTATION  ·  ${referenceNo}`;

    // stepX matches pattern width 800
    // stepY is 75 to match 2 rows per 150 height pattern
    const stepX = 800;
    const stepY = 75;
    const angle = 25;

    let rowIdx = 0;
    for (let y = -400; y < pdfHeight + 400; y += stepY) {
      // Stagger by 400 (half of stepX) every other row
      const offset = (rowIdx % 2 === 0) ? 0 : 400;
      for (let x = -1000 + offset; x < pdfWidth + 1000; x += stepX) {
        pdf.text(line, x, y, { angle: angle });
      }
      rowIdx++;
    }
    pdf.restoreGraphicsState();
  };

  /** Stamp the QR code + security footer at the bottom of each PDF page */
  const stampPdfSecurityFooter = (
    pdf: any,
    qrDataUrl: string | null,
    referenceNo: string,
    issuedAt: string,
    pageNum: number,
    totalPages: number,
    pdfWidth: number,
    pdfHeight: number,
  ) => {
    const footerY = pdfHeight - 32;
    // Thin rule
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(20, footerY - 4, pdfWidth - 20, footerY - 4);

    // QR code (bottom-right)
    if (qrDataUrl) {
      pdf.addImage(qrDataUrl, "PNG", pdfWidth - 60, footerY - 22, 40, 40);
    }

    // Footer text (bottom-left / centre)
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(130, 130, 130);
    pdf.text(`REF: ${referenceNo}`, 20, footerY + 4);
    pdf.text(`ISSUED: ${issuedAt}`, 20, footerY + 12);
    pdf.text(`This document is only valid when downloaded from Taskflow.`, 20, footerY + 20);
    // Page counter (centre-bottom)
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Page ${pageNum} of ${totalPages}`, pdfWidth / 2, footerY + 14, { align: "center" });
  };

  const PreviewPDFBeforeDownload = async (showDiscount: boolean = false, summaryDiscounts: boolean = showSummaryDiscounts) => {
    if (typeof window === "undefined") return;
    
    // Generate PDF in iframe for preview
    setIsGeneratingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      
      // Show download confirmation dialog
      setPdfOptionsOpen(true);
      setPdfOption(showDiscount ? "with-discount" : "default-only");
    } catch (error) {
      console.error("Error generating PDF preview:", error);
      sileo.error({
        title: "Preview Error",
        description: "Failed to generate PDF preview. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const DownloadPDF = async (
    showDiscount: boolean = false,
    summaryDiscounts: boolean = showSummaryDiscounts,
    breakBuffer: number = 0,
    contHeaderGap: number = 0,
    returnMode: 'save' | 'blob' = 'save'
  ): Promise<string | void> => {
    if (typeof window === "undefined") return;
    
    setIsGeneratingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const payload = getQuotationPayload();
      const isEcoshift = item.quotation_type === "Ecoshift Corporation" || (item.quotation_number || "").startsWith("EC");
      
      // Define constants for PDF generation
      const PRIMARY_CHARCOAL = "#121212";
      const OFF_WHITE = "#F9FAFA";
      
      // ── Build security artefacts BEFORE rendering ────────────────────────
      const issuedAt = new Date().toISOString();
      const companyLabel = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";

      // Security Token Generation (must match verify page logic)
      const SECURITY_SALT = "TF-SECURE-2024-DS-EC";
      const generateToken = (ref: string, total: string) => {
        const raw = `${ref}|${total}|${SECURITY_SALT}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
          const char = raw.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
      };

      const totalStr = payload.totalPrice.toFixed(2);
      let token: string;
      let verificationUrl: string;
      let qrDataUrl: string | null;

      if (isDebugMode) {
        // Bypass security in debug mode
        token = "DEBUG-MODE";
        verificationUrl = `${window.location.origin}/verify-quotation?ref=${encodeURIComponent(payload.referenceNo)}&total=${totalStr}&v=${token}`;
        qrDataUrl = await generateQrDataUrl(verificationUrl);
      } else {
        // Normal security token generation
        token = generateToken(payload.referenceNo, totalStr);
        verificationUrl = `${window.location.origin}/verify-quotation?ref=${encodeURIComponent(payload.referenceNo)}&total=${totalStr}&v=${token}`;
        qrDataUrl = await generateQrDataUrl(verificationUrl);
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [612, 936],
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      // Reserve 50pt at the bottom for the security footer strip
      const BOTTOM_MARGIN = 50;

      const iframe = document.createElement("iframe");
      Object.assign(iframe.style, {
        position: "fixed",
        right: "1000%",
        width: "816px",
        visibility: "hidden",
      });
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Initialization Failed");

      iframeDoc.open();
      iframeDoc.write(`
          <html>
            <head>
            <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background: white; width: 816px; color: ${PRIMARY_CHARCOAL}; overflow: hidden; font-size: 10px; line-height: 1.4; }
            .header-img { width: 100%; display: block; }
            .content-area { padding: 0 50px; margin: 0; box-sizing: border-box; }
            /* CLIENT GRID */
            .client-grid { border: 1.5px solid black; background: white; }
            .grid-row { display: flex; align-items: stretch; border-bottom: 1px solid #e5e7eb; }
            .grid-row:last-child { border-bottom: none; }
            .label { width: 130px; font-weight: 900; font-size: 9px; flex-shrink: 0; padding: 4px 10px; background: #f3f4f6; border-right: 1px solid #d1d5db; display: flex; align-items: center; text-transform: uppercase; letter-spacing: 0.02em; }
            .value { flex-grow: 1; font-size: 9.5px; font-weight: 600; color: #1f2937; padding: 4px 10px; text-transform: uppercase; display: flex; align-items: center; }
            .intro-text { font-size: 9px; font-style: italic; color: #6b7280; font-weight: 400; padding: 5px 0 3px 0; }
            /* PRODUCT TABLE */
            .table-container { border: 1.5px solid black; border-bottom: none; background: white; margin: 0; }
            .main-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; }
            .main-table th { padding: 6px 8px; font-size: 8.5px; font-weight: 900; color: white; background: ${PRIMARY_CHARCOAL}; text-transform: uppercase; border-right: 1px solid #374151; letter-spacing: 0.04em; }
            .main-table th:last-child { border-right: none; }
            .main-table td { padding: 8px; vertical-align: top; border-right: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; font-size: 9px; }
            .main-table tr { page-break-inside: avoid; }
            .main-table td:last-child { border-right: none; }
            .item-no { color: #9ca3af; font-weight: 700; text-align: center; font-size: 11px; vertical-align: middle; }
            .qty-col { font-weight: 900; text-align: center; font-size: 12px; color: ${PRIMARY_CHARCOAL}; vertical-align: middle; }
            .product-title { font-weight: 900; text-transform: uppercase; font-size: 9.5px; margin: 0 0 2px 0; color: ${PRIMARY_CHARCOAL}; line-height: 1.3; }
            .sku-text { color: #2563eb; font-weight: 700; font-size: 8px; margin: 0 0 4px 0; }
            .desc-text { font-size: 8px; color: #374151; line-height: 1.3; margin: 0; page-break-inside: avoid; }
            .desc-remarks { background: #fed7aa; padding: 2px 5px; text-transform: uppercase; color: #7c2d12; display: inline-block; font-weight: 900; font-size: 7.5px; margin-top: 3px; }
            .price-col { font-size: 9.5px; font-weight: 600; text-align: right; color: #374151; vertical-align: middle; padding-right: 8px; }
            .total-col { font-size: 9.5px; font-weight: 900; text-align: right; color: ${PRIMARY_CHARCOAL}; vertical-align: middle; padding-right: 8px; }
            /* LOGISTICS */
            .variance-footnote { margin-top: 12px; font-size: 9.5px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid black; padding-bottom: 3px; }
            .logistics-container { margin-top: 10px; border: 1.5px solid black; font-size: 9px; line-height: 1.4; }
            .logistics-row { display: flex; border-bottom: 1px solid #d1d5db; }
            .logistics-row:last-child { border-bottom: none; }
            .logistics-label { width: 85px; padding: 7px 8px; font-weight: 900; font-size: 8.5px; border-right: 1px solid #d1d5db; flex-shrink: 0; text-transform: uppercase; }
            .logistics-value { padding: 7px 10px; flex-grow: 1; font-size: 8.5px; }
            .logistics-value p { margin: 0 0 3px 0; }
            .bg-yellow-header { background-color: #facc15; }
            .bg-yellow-content { background-color: #fef9c3; }
            .bg-yellow-note { background-color: #fefce8; }
            .text-red-strong { color: #dc2626; font-weight: 900; display: block; margin-top: 3px; text-decoration: underline; }
            /* TERMS */
            .terms-section { margin-top: 14px; border-top: 2px solid black; padding-top: 8px; }
            .terms-header { background: ${PRIMARY_CHARCOAL}; color: white; padding: 3px 10px; font-size: 9px; font-weight: 900; text-transform: uppercase; display: inline-block; margin-bottom: 8px; letter-spacing: 0.05em; }
            .terms-grid { display: grid; grid-template-columns: 105px 1fr; gap: 0; font-size: 8.5px; line-height: 1.45; }
            .terms-label { font-weight: 900; text-transform: uppercase; padding: 4px 4px; font-size: 8.5px; }
            .terms-val { padding: 4px 6px; font-size: 8.5px; }
            .terms-val p { margin: 0 0 2px 0; }
            .terms-highlight { background-color: #fef9c3; }
            .bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; font-size: 8.5px; line-height: 1.5; }
            /* SUMMARY */
            .tax-options { display: flex; gap: 12px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; }
            .tax-active { color: ${PRIMARY_CHARCOAL}; font-weight: 900; }
            .tax-inactive { color: #c0c5cf; }
            .summary-wrap { display: table; width: 100%; border-collapse: collapse; border-top: 2px solid black; }
            .summary-left { display: table-cell; width: 48%; border-right: 2px solid black; padding: 10px 14px; vertical-align: top; }
            .summary-right { display: table-cell; width: 52%; vertical-align: top; padding: 0; }
            .summary-tax-title { color: #e60b0d; font-style: italic; font-weight: 900; font-size: 10px; text-transform: uppercase; margin-bottom: 5px; }
            .summary-wht { display: inline-block; background: #dbeafe; color: #1e40af; font-size: 8px; font-weight: 900; padding: 2px 7px; margin-top: 5px; text-transform: uppercase; }
            .sum-tbl { width: 100%; border-collapse: collapse; }
            .sum-tbl td { padding: 3.5px 10px; }
            .sum-lbl { text-align: right; font-weight: 700; text-transform: uppercase; color: #6b7280; font-size: 7.5px; border-right: 2px solid black; white-space: nowrap; }
            .sum-val { text-align: right; font-weight: 900; color: ${PRIMARY_CHARCOAL}; font-size: 9px; white-space: nowrap; min-width: 90px; }
            .sum-divider td { border-bottom: 2px solid black; padding-bottom: 6px; }
            .sum-total-lbl { text-align: right; font-weight: 900; text-transform: uppercase; font-size: 9px; border-right: 2px solid black; background: #f3f4f6; padding: 5px 10px; white-space: nowrap; }
            .sum-total-val { text-align: right; font-weight: 900; color: #1e3a8a; font-size: 12px; background: #f3f4f6; padding: 5px 10px; white-space: nowrap; min-width: 90px; }
            .sum-gray-lbl { text-align: right; font-weight: 600; text-transform: uppercase; font-size: 7px; border-right: 2px solid black; color: #9ca3af; padding: 3px 10px; white-space: nowrap; }
            .sum-gray-val { text-align: right; font-weight: 600; color: #9ca3af; font-size: 8px; padding: 3px 10px; white-space: nowrap; }
            .sum-ewt-lbl { text-align: right; font-weight: 900; text-transform: uppercase; font-size: 7px; border-right: 2px solid black; color: #1d4ed8; background: #eff6ff; padding: 4px 10px; white-space: nowrap; }
            .sum-ewt-val { text-align: right; font-weight: 900; color: #1d4ed8; background: #eff6ff; font-size: 8.5px; padding: 4px 10px; white-space: nowrap; }
            .sum-final-row { background: ${PRIMARY_CHARCOAL}; padding-top: 10px; }
            .sum-final-lbl { text-align: right; font-weight: 900; text-transform: uppercase; font-size: 8.5px; border-right: 1px solid #374151; color: white; padding: 2px 10px; white-space: nowrap; line-height: 1.2; }
            .sum-final-val { text-align: right; font-weight: 900; font-size: 14px; color: white; padding: 2px 10px; white-space: nowrap; line-height: 1.2; }
            /* SIGNATURE */
            .sig-hierarchy { margin-top: 14px; padding-top: 12px; border-top: 3px solid #1d4ed8; padding-bottom: 16px; }
            .sig-message { font-size: 8.5px; margin-bottom: 18px; font-weight: 400; line-height: 1.5; color: #374151; }
            .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
            .sig-side-internal { display: flex; flex-direction: column; gap: 18px; }
            .sig-side-client { display: flex; flex-direction: column; align-items: flex-end; gap: 24px; }
            .sig-line { border-bottom: 1px solid black; width: 230px; }
            .sig-sub-label { font-size: 8px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
            .sig-italic { font-size: 9px; font-style: italic; font-weight: 700; margin-bottom: 18px; color: ${PRIMARY_CHARCOAL}; }
            .sig-name { font-size: 9.5px; font-weight: 900; text-transform: uppercase; margin: 0 0 0 0; }
            .sig-detail { font-size: 8.5px; font-style: italic; margin: 1px 0; color: #374151; }
            .sig-approved-label { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #9ca3af; margin-bottom: 18px; letter-spacing: 0.03em; }
            .sig-client-label { font-size: 8px; font-weight: 900; text-transform: uppercase; text-align: center; margin-top: 3px; }
            .sig-client-sub { font-size: 7.5px; font-weight: 600; text-transform: uppercase; text-align: center; margin-top: 1px; color: #6b7280; }
            </style></head><body></body></html>`);
      iframeDoc.close();

      const renderBlock = async (html: string) => {
        iframeDoc.body.innerHTML = html;
        const images = iframeDoc.querySelectorAll("img");
        await Promise.all(
          Array.from(images).map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }),
        );
        const canvas = await html2canvas(iframeDoc.body, {
          scale: 2.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          imageTimeout: 15000,
        });
        return {
          img: canvas.toDataURL("image/jpeg", 0.90),
          h: (canvas.height * pdfWidth) / canvas.width,
        };
      };

      let currentY = 0;
      let pageCount = 1;
      // totalPages will be updated retroactively after all pages are known;
      // we stamp footers at the very end in a second pass, so we track page
      // positions and stamp once complete. For simplicity, we stamp each page
      // immediately using a known total-pages approach: stamp immediately and accept
      // "Page N" without a "of X" if we don't know total yet — OR we make two
      // passes. The cleanest approach for this codebase: stamp each page with
      // watermark + footer right before moving to the next page.

      const finalizeCurrentPage = () => {
        stampPdfWatermark(pdf, companyLabel, payload.referenceNo, pdfWidth, pdfHeight);
      };

      const initiateNewPage = async () => {
        let referenceText = payload.referenceNo;
        if (payload.version) {
          const match = payload.version.match(/-(\d+)-/);
          const revNum = match ? match[1] : null;
          referenceText += revNum ? ` (Rev ${revNum})` : ` (${payload.version})`;
        }
        
        const banner = await renderBlock(
          `<div style="width:100%;display:block;"><img src="${headerImagePath}" class="header-img" style="width:100%;display:block;object-fit:contain;"/><div style="width:100%;text-align:right;font-weight:900;font-size:10px;margin-top:2px;display:inline-block;padding-bottom:5px;line-height:1.2;box-sizing:border-box;padding-right:60px;">REFERENCE NO: ${referenceText}<br/>DATE: ${payload.date}</div></div>`,
        );
        pdf.addImage(banner.img, "JPEG", 0, 0, pdfWidth, banner.h);
        return banner.h;
      };

      currentY = await initiateNewPage();

      const clientBlock = await renderBlock(
        `<div class="content-area" style="padding-top:6px;"><div class="client-grid"><div class="grid-row"><div class="label">Company Name</div><div class="value">${payload.companyName}</div></div><div class="grid-row"><div class="label">Address</div><div class="value">${payload.address}</div></div><div class="grid-row"><div class="label">Tel No</div><div class="value">${payload.telNo}</div></div><div class="grid-row"><div class="label">Email Address</div><div class="value">${payload.email}</div></div><div class="grid-row" style="border-bottom:1.5px solid black;"><div class="label">Attention</div><div class="value">${payload.attention}</div></div><div class="grid-row"><div class="label">Subject</div><div class="value">${payload.subject}</div></div></div><p class="intro-text">We are pleased to offer you the following products for consideration:</p></div>`,
      );
      pdf.addImage(
        clientBlock.img,
        "JPEG",
        0,
        currentY,
        pdfWidth,
        clientBlock.h,
      );
      currentY += clientBlock.h;

      const headerBlock = await renderBlock(
        `<div class="content-area">
        <div class="table-container" style="border-bottom:1.5px solid black;">
        <table class="main-table">
        <thead>
        <tr>
        <th style="width:35px;text-align:center;">NO</th>
        <th style="width:40px;text-align:center;">QTY</th>
        <th style="width:105px;text-align:center;">REF. PHOTO</th>
        <th style="text-align:left;">PRODUCT DESCRIPTION</th>
        <th style="width:60px;text-align:center;">UNIT PRICE</th>
        ${showDiscount ? `<th style="width:80px;text-align:center;">DISC</th>
        <th style="width:80px;text-align:center;">DISCOUNT PRICE</th>` : ""}
        <th style="width:90px;text-align:center;">TOTAL</th>
        </tr>
        </thead>
        </table>
        </div>
        </div>`,
      );
      pdf.addImage(
        headerBlock.img,
        "JPEG",
        0,
        currentY,
        pdfWidth,
        headerBlock.h,
      );
      currentY += 28;

      for (const [index, item] of payload.items.entries()) {
        // discountAmount is already per-unit (stored as per-unit in the data)
        const perUnitDiscountAmount = item.discountAmount || 0;

        // Calculate net unit price (unit price - per unit discount)
        const netUnitPrice = item.discount && item.discount > 0 && perUnitDiscountAmount > 0
          ? item.unitPrice - perUnitDiscountAmount
          : item.unitPrice;

        const mode = item.displayMode || 'transparent';
        const isRequest = mode === 'request';
        const isNetOnly = mode === 'net_only';
        const isBundle = mode === 'bundle';
        const isValueAdd = mode === 'value_add';
        const hidePriceCols = isRequest || isNetOnly || isBundle;

        // Build badges HTML
        const badges: string[] = [];
        if (item.isPromo) {
          badges.push(`<span style="display:inline-block;background:#facc15;color:#713f12;font-size:7px;font-weight:900;padding:2px 6px;border-radius:2px;text-transform:uppercase;letter-spacing:0.05em;margin-left:4px;">PROMO</span>`);
        }
        if (item.isSpf1) {
          badges.push(`<span style="display:inline-block;background:#dc2626;color:white;font-size:7px;font-weight:900;padding:2px 6px;border-radius:2px;text-transform:uppercase;letter-spacing:0.05em;margin-left:4px;">SPF</span>`);
        }
        if (isBundle) {
          badges.push(`<span style="display:inline-block;background:#8b5cf6;color:white;font-size:7px;font-weight:900;padding:2px 6px;border-radius:2px;text-transform:uppercase;letter-spacing:0.05em;margin-left:4px;">BUNDLE</span>`);
        }

        // Unit Price column content
        let unitPriceContent;
        if (isRequest) {
          unitPriceContent = `<span style="font-size:8px;color:#6b7280;font-style:italic;">Upon request</span>`;
        } else if (isNetOnly || isBundle) {
          unitPriceContent = `<span style="font-size:8px;color:#9ca3af;">—</span>`;
        } else {
          unitPriceContent = `₱${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        // DISC column content - show per-unit discount amount
        let discContent;
        if (hidePriceCols) {
          discContent = `<span style="font-size:8px;color:#9ca3af;">—</span>`;
        } else if (perUnitDiscountAmount > 0) {
          discContent = `<span style="color:#dc2626;">−₱${perUnitDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><br/><span style="font-size:7px;color:#9ca3af;font-weight:600;">(${item.discount ?? 0}%)</span>`;
        } else if (item.discount && item.discount > 0) {
          discContent = `<span style="color:#dc2626;font-weight:700;">${item.discount}%</span>`;
        } else {
          discContent = '-';
        }

        // Discount Price column content - show net unit price
        let discountPriceContent;
        if (hidePriceCols) {
          discountPriceContent = `<span style="font-size:8px;color:#9ca3af;">—</span>`;
        } else {
          discountPriceContent = `₱${netUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        // Total Amount column content
        let totalContent;
        if (isRequest) {
          totalContent = `<span style="font-size:8px;color:#6b7280;font-style:italic;">Upon request</span>`;
        } else {
          // Calculate total savings for value_add mode
          const totalSavings = isValueAdd && perUnitDiscountAmount > 0
            ? perUnitDiscountAmount * item.qty
            : 0;
          const savingsHtml = totalSavings > 0
            ? `<div style="font-size:7px;color:#16a34a;font-weight:600;margin-top:2px;">save ₱${totalSavings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>`
            : '';
          totalContent = `₱${item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${savingsHtml}`;
        }

        // ===== SECTION-AWARE INTELLIGENT PAGE SPLITTING =====
        // Strategy: Try full item first. If it doesn't fit, split into sections
        // breakBuffer: +N = fit more content (later break), -N = break earlier
        const usablePageHeight = pdfHeight - 50 + breakBuffer;

        // Helper: Build complete row HTML
        const buildFullRowHtml = (descContent: string, showRemarks = false): string => {
          return `<div class="content-area">
          <table class="main-table" style="border:1.5px solid black;border-top:none;">
          <tr>
          <td style="width:35px;" class="item-no">${index + 1}</td>
          <td style="width:40px;" class="qty-col">${item.qty}</td>
          <td style="width:105px;padding:8px;text-align:center;vertical-align:top;">
          <img src="${item.photo}" style="mix-blend-mode:multiply;width:82px;height:82px;object-fit:contain;display:block;margin:0 auto;">
          </td>
          <td style="padding:8px 10px;vertical-align:top;">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:4px;">
            <p class="product-title" style="margin:0;">${item.title}</p>
            ${badges.join('')}
          </div>
          ${item.sku ? `<p class="sku-text">ITEM CODE: ${item.sku}</p>` : ""}
          ${item.procurementLeadTime ? `<div style="display:inline-flex;align-items:center;gap:4px;margin:3px 0 4px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#6b7280;">Lead Time:</span><span style="font-size:9px;font-weight:700;color:#b45309;background:#fff7ed;border:1px solid #fed7aa;padding:1px 6px;">${item.procurementLeadTime}</span></div>` : ""}
          <div class="desc-text">${descContent}</div>
          ${showRemarks && item.remarks ? `<div class="desc-remarks">${item.remarks}</div>` : ""}
          </td>
          <td style="width:60px;text-align:center;${hidePriceCols ? 'background:#f9fafb;' : ''}" class="price-col">${unitPriceContent}</td>
          ${showDiscount ? `<td style="width:80px;text-align:center;font-weight:700;${hidePriceCols ? 'background:#f9fafb;' : ''}">${discContent}</td>
          <td style="width:80px;text-align:center;font-weight:600;${hidePriceCols ? 'background:#f9fafb;' : ''}">${discountPriceContent}</td>` : ""}
          <td style="width:90px;text-align:center;" class="total-col">${totalContent}</td>
          </tr></table></div>`;
        };

        // First get original sections using the SAME parsing as UI (parseDescriptionIntoSections), NO built-in spacing!
        const originalSections = parseDescriptionIntoSections(item.product_description);
        
        // Step 1: Split original sections into page groups with their ORIGINAL INDICES, based on user's per-section page breaks
        const pageGroupsWithIndices: Array<{sections: string[], originalIndices: number[]}> = [];
        let currentGroup: {sections: string[], originalIndices: number[]} = {sections: [], originalIndices: []};
        
        originalSections.forEach((section, idx) => {
          if (idx > 0 && item.sectionPageBreaks?.[idx]) {
            // Force a new page group before this section!
            if (currentGroup.sections.length > 0) {
              pageGroupsWithIndices.push({...currentGroup});
            }
            currentGroup = {sections: [section], originalIndices: [idx]};
          } else {
            currentGroup.sections.push(section);
            currentGroup.originalIndices.push(idx);
          }
        });
        if (currentGroup.sections.length > 0) {
          pageGroupsWithIndices.push({...currentGroup});
        }
        
        // Step 2: For EACH page group, build enhanced description with spacing applied!
        const finalDescGroups: string[] = [];
        
        pageGroupsWithIndices.forEach((group, groupIdx) => {
          let descContent: string[] = [];
          
          // Add before spacer ONLY to FIRST group!
          if (groupIdx === 0 && item.descSpacerBefore !== 0) {
            if (item.descSpacerBefore > 0) {
              descContent.push(`<div style="height:${item.descSpacerBefore}px;"></div>`);
            } else {
              descContent.push(`<div style="margin-top:${item.descSpacerBefore}px;"></div>`);
            }
          }
          
          // Add each section in this group with spacing!
          group.sections.forEach((section, sIdxInGroup) => {
            descContent.push(section);
            
            // Add spacing after this section (if NOT last section in group)
            if (sIdxInGroup < group.sections.length - 1) {
              // Original index is already tracked! No need for indexOf!
              const originalIdx = group.originalIndices[sIdxInGroup];
              const spacing = item.sectionSpacings?.[originalIdx] ?? item.descSectionSpacing ?? 0;
              if (spacing !== 0) {
                if (spacing > 0) {
                  descContent.push(`<div style="height:${spacing}px;"></div>`);
                } else {
                  descContent.push(`<div style="margin-top:${spacing}px;"></div>`);
                }
              }
            }
          });
          
          // Add after spacer ONLY to LAST group!
          if (groupIdx === pageGroupsWithIndices.length - 1 && item.descSpacerAfter !== 0) {
            if (item.descSpacerAfter > 0) {
              descContent.push(`<div style="height:${item.descSpacerAfter}px;"></div>`);
            } else {
              descContent.push(`<div style="margin-top:${item.descSpacerAfter}px;"></div>`);
            }
          }
          
          finalDescGroups.push(descContent.join(''));
        });

        // Okay, now we already have our finalDescGroups which are split by user's per-section page breaks!
        // Now, we just need to render each finalDescGroup as a separate page group!
        // So no need for complex bin packing — we already have our groups!
        // But we still need to check if they fit, and handle fit!
        // First, let's build the full enhancedDescription for step 1:
        const enhancedDescription = finalDescGroups.join('');
        const isOnlyOneGroup = finalDescGroups.length === 1;

        // Force page break before this item if requested (user-controlled)
        if (item.pageBreakBefore && index > 0) {
          pdf.addPage([612, 936]);
          stampPdfWatermark(pdf, companyLabel, payload.referenceNo, pdfWidth, pdfHeight);
          currentY = await initiateNewPage();
          pdf.addImage(headerBlock.img, "JPEG", 0, currentY, pdfWidth, headerBlock.h);
          currentY += 28;
        }

        // Step 1: Try rendering the FULL item first (using ENHANCED DESCRIPTION with spacing!)
        // If it's only one group, show remarks! Otherwise, no!
        const fullRowBlock = await renderBlock(buildFullRowHtml(enhancedDescription || '', isOnlyOneGroup));

        // If full item fits, just place it!
        if (currentY + fullRowBlock.h <= usablePageHeight) {
          pdf.addImage(fullRowBlock.img, "JPEG", 0, currentY, pdfWidth, fullRowBlock.h);
          currentY += fullRowBlock.h;
          if (item.spacerAfter !== 0) currentY += item.spacerAfter;
          continue;
        }

        // ── Continuation row wrapper (shared table context for measurement) ─
        // showRemarks=true on the LAST page group so remarks always appears at the end
        const buildContHtml = (descContent: string, showRemarks = false) => `
          <div class="content-area">
          <table class="main-table" style="border:1.5px solid black;border-top:none;">
          <tr>
          <td style="width:35px;" class="item-no">&nbsp;</td>
          <td style="width:40px;" class="qty-col">&nbsp;</td>
          <td style="width:105px;padding:8px;">&nbsp;</td>
          <td style="padding:0px 10px;vertical-align:top;">
          <div class="desc-text">${descContent}</div>
          ${showRemarks && item.remarks ? `<div class="desc-remarks">${item.remarks}</div>` : ''}
          </td>
          <td style="width:60px;" class="price-col">&nbsp;</td>
          ${showDiscount ? `<td style="width:80px;" class="price-col">&nbsp;</td>
          <td style="width:80px;" class="price-col">&nbsp;</td>` : ""}
          <td style="width:90px;" class="total-col">&nbsp;</td>
          </tr></table></div>`;

        // Now, let's just use our finalDescGroups directly! They are already split by user's page breaks!
        let isFirstGroup = true;
        for (let gIdx = 0; gIdx < finalDescGroups.length; gIdx++) {
          const descGroup = finalDescGroups[gIdx];
          const isLastGroup = gIdx === finalDescGroups.length - 1;
          
          // Build block for this group
          let blockToRender;
          if (isFirstGroup) {
            blockToRender = await renderBlock(buildFullRowHtml(descGroup, isLastGroup));
          } else {
            blockToRender = await renderBlock(buildContHtml(descGroup, isLastGroup));
          }

          // Check if fits
          const neededH = blockToRender.h + (isFirstGroup ? 0 : (headerBlock.h + 4 + contHeaderGap));
          let fits = true;
          
          if (isFirstGroup) {
            fits = currentY + blockToRender.h <= usablePageHeight;
          } else {
            // For continuation groups, need fresh page
            fits = false; // force new page
          }

          if (!fits || !isFirstGroup) {
            // Need new page!
            finalizeCurrentPage();
            pdf.addPage([612, 936]);
            pageCount++;
            currentY = await initiateNewPage();
            pdf.addImage(headerBlock.img, "JPEG", 0, currentY, pdfWidth, headerBlock.h);
            currentY += (isFirstGroup ? 28 : (headerBlock.h + 4 + contHeaderGap));
          }

          // Now place the block!
          pdf.addImage(blockToRender.img, "JPEG", 0, currentY, pdfWidth, blockToRender.h);
          currentY += blockToRender.h;
          
          isFirstGroup = false;
        }

        // Add user-defined spacer after this item (positive OR negative)
        if (item.spacerAfter !== 0) currentY += item.spacerAfter;

        // Continue to next item!
        continue;
      }

      // ✅ Helper (put above this block if possible)
      const peso = (val: any) =>
        Number(val ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const round2 = (n: number | string | undefined) =>
        Number(Number(n ?? 0).toFixed(2));

      // ✅ Safe numeric values
      const _deliveryNum = Number(payload.deliveryFee) || 0;
      const _restockingNum = Number(payload.restockingFee) || 0;
      const _total = Number(payload.totalPrice) || 0;

      // ✅ Calculations (rounded properly) - Match preview.tsx logic exactly
      // Gross Sales = sum of (unitPrice * qty)
      const _grossSales = round2((payload.items || []).reduce((acc, item) => acc + ((Number(item.qty) || 0) * (item.unitPrice || 0)), 0));
      // Net Sales is the sum of rounded line item totals to avoid floating point butal
      const _netSales = round2((payload.items || []).reduce((acc, item) => acc + (item.totalAmount || 0), 0));
      // Total Trade Discount is the difference between gross and net
      const _totalDiscount = round2(_grossSales - _netSales);
      
      const _vatAmount = round2(_total * (12 / 112));
      const _netOfVat = round2(_total / 1.12);
      const _whtAmount = round2(payload.whtAmount || 0);

      // ✅ VAT / WHT block
      const _vatBreak =
        payload.vatTypeLabel === "VAT Inc"
          ? `
<tr style="border-bottom: 1px solid #e5e7eb;">
  <td class="sum-gray-lbl">Less: VAT (12%)</td>
  <td class="sum-gray-val">₱${peso(_vatAmount)}</td>
</tr>
<tr${payload.whtType && payload.whtType !== "none" ? "" : " class='sum-divider'"}>
  <td class="sum-gray-lbl">Net of VAT (Tax Base)</td>
  <td class="sum-gray-val">₱${peso(_netOfVat)}</td>
</tr>
${payload.whtType && payload.whtType !== "none"
            ? `
<tr class="sum-divider">
  <td class="sum-ewt-lbl">Less: ${payload.whtLabel}</td>
  <td class="sum-ewt-val">− ₱${peso(_whtAmount)}</td>
</tr>`
            : ""
          }
`
          : `
<tr class="sum-divider">
  <td class="sum-gray-lbl">Tax Status</td>
  <td class="sum-gray-val" style="font-style:italic;">
    ${payload.vatTypeLabel === "VAT Exe" ? "VAT Exempt" : "Zero-Rated"}
  </td>
</tr>
`;

      // ✅ WHT badge
      const _whtBadge =
        payload.whtType && payload.whtType !== "none"
          ? `<div class="summary-wht">● ${payload.whtLabel} — on Net of VAT</div>`
          : "";

      // ✅ Final label + amount
      const _finalLbl =
        payload.whtType && payload.whtType !== "none"
          ? "Net Amount to Collect"
          : "Total Amount Due";

      const _finalAmt = peso(round2(payload.netAmountToCollect ?? _total));

      // ✅ FINAL RENDER BLOCK
      const footerBlock = await renderBlock(`
<div class="content-area" style="padding-top:0;padding-bottom:0;">
  <div class="table-container" style="border-bottom:2px solid black;">
    <div class="summary-wrap">

      <div class="summary-left">
        <div class="summary-tax-title">Tax Type:</div>

        <div class="tax-options">
          <span class="${payload.vatTypeLabel === "VAT Inc" ? "tax-active" : "tax-inactive"}">
            ${payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
          </span>
          <span class="${payload.vatTypeLabel === "VAT Exe" ? "tax-active" : "tax-inactive"}">
            ${payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
          </span>
          <span class="${payload.vatTypeLabel === "Zero-Rated" ? "tax-active" : "tax-inactive"}">
            ${payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated
          </span>
        </div>

        ${_whtBadge}
      </div>

      <div class="summary-right">
        <table class="sum-tbl">

          ${summaryDiscounts ? `
          <tr>
            <td class="sum-lbl">Gross Sales</td>
            <td class="sum-val">₱${peso(_grossSales)}</td>
          </tr>

          ${_totalDiscount > 0 ? `
          <tr style="background:#fef9c3;">
            <td class="sum-lbl" style="color:#a16207;">Less: Trade Discount</td>
            <td class="sum-val" style="color:#a16207;">−₱${peso(_totalDiscount)}</td>
          </tr>
          ` : ""}
          ` : ""}

          <tr class="${summaryDiscounts && _totalDiscount > 0 ? '' : 'border-b border-gray-100'}">
            <td class="sum-lbl">
              ${summaryDiscounts ? `Net Sales ${payload.vatTypeLabel === "VAT Inc" ? "(VAT Inc)" : "(Non-VAT)"}` : `Net Sales ${payload.vatTypeLabel === "VAT Inc" ? "(VAT Inc)" : "(Non-VAT)"}`}
            </td>
            <td class="sum-val">₱${peso(_netSales)}</td>
          </tr>

          <tr>
            <td class="sum-lbl">Delivery Charge</td>
            <td class="sum-val">₱${peso(_deliveryNum)}</td>
          </tr>

          <tr class="sum-divider">
            <td class="sum-lbl">Restocking Fee</td>
            <td class="sum-val">₱${peso(_restockingNum)}</td>
          </tr>

          <tr style="border-bottom: 2px solid black;">
            <td class="sum-total-lbl">Total Invoice Amount</td>
            <td class="sum-total-val">₱${peso(_total)}</td>
          </tr>

          ${_vatBreak}

          <tr class="sum-final-row">
            <td class="sum-final-lbl">${_finalLbl}</td>
            <td class="sum-final-val">₱${_finalAmt}</td>
          </tr>

        </table>
      </div>

    </div>
  </div>
</div>
`);
      if (currentY + footerBlock.h > pdfHeight - BOTTOM_MARGIN) {
        finalizeCurrentPage();
        pdf.addPage([612, 936]);
        pageCount++;
        currentY = await initiateNewPage();
      }
      pdf.addImage(
        footerBlock.img,
        "JPEG",
        0,
        currentY,
        pdfWidth,
        footerBlock.h,
      );
      currentY += footerBlock.h;

      const logisticsBlock = await renderBlock(
        `<div class="content-area" style="padding-top:0;">
        <div class="variance-footnote">*PHOTO MAY VARY FROM ACTUAL UNIT</div>
        <div class="logistics-container">
        <div class="logistics-row">
        <div class="logistics-label bg-yellow-header">Included:</div>
        <div class="logistics-value bg-yellow-content">
        <p>Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p>
        <p>Orders outside Metro Manila Free delivery is available for a minimum sales transaction of ₱10,000 in Rizal, ₱15,000 in Bulacan and Cavite, and ₱25,000 in Laguna, Pampanga, and Batangas.</p>
        </div>
        </div>
        <div class="logistics-row">
        <div class="logistics-label bg-yellow-header">Excluded:</div>
        <div class="logistics-value bg-yellow-content">
        <p>All lamp poles are subject to a delivery charge.</p>
        <p>Installation and all hardware/accessories not indicated above.</p>
        <p>Freight charges, arrastre, and other processing fees.</p>
        </div>
        </div>
        <div class="logistics-row">
        <div class="logistics-label">Notes:</div>
        <div class="logistics-value bg-yellow-note" style="font-style:italic;">
        <p>Deliveries are up to the vehicle unloading point only.</p>
        <p>Additional shipping fee applies for other areas not mentioned above.</p>
        <p>Subject to confirmation upon getting the actual weight and dimensions of the items.</p>
        <span class="text-red-strong">
        <u>In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</u>
        </span>
        </div>
        </div>
        </div>
        <div class="terms-section">
        <div class="terms-header">Terms and Conditions</div>
        <div class="terms-grid">
        <div class="terms-label">Availability:</div>
        <div class="terms-val terms-highlight">
        <p>*5-7 days if on stock upon receipt of approved PO.</p>
        <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment.</p>
        <p>*In the event of a conflict or inconsistency in estimated days under Availability and another estimate indicated elsewhere in this quotation, the latter will prevail.</p>
        </div>
        <div class="terms-label">Warranty:</div>
        <div class="terms-val terms-highlight">
                <p><b>Regular Item:</b> One (1) year from the time of delivery for all busted lights except the damaged fixture.</p>
                <p><b>Promo Item:</b> Three (3) months from the time of delivery for all busted lights except the damaged fixture.</p>
                <p>The warranty will be VOID under the following circumstances:</p>
                <p>*If the unit is being tampered with.</p>
                <p>*If the item(s) is/are altered in any way by unauthorized technicians.</p>
                <p>*If it has been subjected to misuse, mishandling, neglect, or accident.</p>
                <p>*If damaged due to spillage of liquids, tear corrosion, rusting, or stains.</p>
                <p>*This warranty does not cover loss of product accessories such as remote control, adaptor, battery, screws, etc.</p>
                <p>*Shipping costs for warranty claims are for customers' account.</p>
                <p>*If the product purchased is already phased out when the warranty is claimed, the latest model or closest product SKU will be given as a replacement.</p>
        </div>
        <div class="terms-label">SO Validity:</div>
        <div class="terms-val">
        <p>Sales order has <b style="color:red;">validity period of 14 working days.</b> Any sales order not confirmed and no verified payment within this <b style="color:red;">14-day period will be automatically cancelled.</b>
        </p>
        </div>
        <div class="terms-label">Storage:</div>
        <div class="terms-val terms-highlight">
        <p>Storage fee of 10% of the value of the orders per month <b style="color:red;">(10% / 30 days = 0.33% per day).</b>
        </p>
        </div>
        <div class="terms-label">Return:</div>
        <div class="terms-val terms-highlight">
        <p>
        <b style="color:red;"><u>7 days return policy -</u>
        </b> if the product received is defective, damaged, or incomplete.</p>
        </div>
        </div>
        </div>
        </div>`,
      );
      if (currentY + logisticsBlock.h > pdfHeight - BOTTOM_MARGIN) {
        finalizeCurrentPage();
        pdf.addPage([612, 936]);
        pageCount++;
        currentY = await initiateNewPage();
      }
      pdf.addImage(
        logisticsBlock.img,
        "JPEG",
        0,
        currentY,
        pdfWidth,
        logisticsBlock.h,
      );
      currentY += logisticsBlock.h;

      // Load QR code for Disruptive Solutions payment
      let qrCodeBase64 = "";
      try {
        const qrRes = await fetch("/qr/qr-code.jpg");
        if (qrRes.ok) {
          const blob = await qrRes.blob();
          qrCodeBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      } catch { /* silent — QR is optional */ }

      const termsAndSigBlock = await renderBlock(
        `<div class="content-area" style="padding-top:0;"><div class="terms-grid"><div class="terms-label">Payment:</div><div class="terms-val"><p><strong style="color:red;">For Cash on Delivery</strong></p><p><strong>NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery.</strong></p><p>For special items, Seventy Percent (70%) down payment, 30% upon delivery.</p><p><strong>BANK DETAILS</strong></p><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div><p><b>Payee to: </b><strong>${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}</strong></p><div class="bank-grid" style="display:flex;gap:20px;"><div><strong>BANK: METROBANK</strong><br/>Account Name: ${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}<br/>Account Number: ${isEcoshift ? "243-7-243805100" : "243-7-24354164-2"}</div><div><strong>BANK: BDO</strong><br/>Account Name: ${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}<br/>Account Number: ${isEcoshift ? "0021-8801-7271" : "0021-8801-9258"}</div></div></div>${!isEcoshift ? `<div style="flex-shrink:0;margin-left:16px;margin-top:-60;text-align:center;"><img src="${qrCodeBase64}" style="width:150px;height:150px;object-fit:contain;" /></div>` : ""}</div></div><div class="terms-label">DELIVERY:</div><div class="terms-val terms-highlight"><p>Delivery/Pick up is subject to confirmation.</p></div><div class="terms-label">Validity:</div><div class="terms-val"><p class="text-red-strong"><u>Thirty (30) calendar days from the date of this offer.</u></p></div><div class="terms-label">CANCELLATION:</div><div class="terms-val terms-highlight">
         <p>1. Above quoted items are non-cancellable.</p>
                            <p>2. If the customer cancels the order under any circumstances, the client shall be responsible for 100% cost incurred by Disruptive, including freight and delivery charges.</p>
                            <p>3. Downpayment for items not in stock/indent and order/special items are non-refundable and will be forfeited if the order is canceled.</p>
                            <p>4. COD transaction payments should be ready upon delivery. If the payment is not ready within seven (7) days from the date of order, the transaction is automatically canceled.</p>
                            <p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p>
        </div></div><div class="sig-hierarchy"><p class="sig-message">Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance. Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.</p><div class="sig-grid"><div class="sig-side-internal"><div style="position:relative;min-height:85px;"><p class="sig-italic">${isEcoshift ? "Ecoshift Corporation" : "Disruptive Solutions Inc"}</p>${payload.agentSignature ? `<img src="${payload.agentSignature}" style="position:absolute;top:28px;left:0;width:110px;height:auto;object-fit:contain;"/>` : ""}<p class="sig-name" style="margin-top:${payload.agentSignature ? "46px" : "8px"};">${payload.salesRepresentative}</p><div class="sig-line" style="width:220px;margin-top:2px;"></div><p class="sig-sub-label">Sales Representative</p><p class="sig-detail">Mobile: ${payload.agentContactNumber || "N/A"}</p><p class="sig-detail">Email: ${payload.agentEmailAddress || "N/A"}</p></div><div style="position:relative;min-height:85px;"><p class="sig-approved-label">Approved By:</p>${payload.TsmSignature ? `<img src="${payload.TsmSignature}" style="position:absolute;top:22px;left:0;width:110px;height:auto;object-fit:contain;"/>` : ""}<p class="sig-name" style="margin-top:${payload.TsmSignature ? "46px" : "8px"};">${payload.salestsmname}</p><div class="sig-line" style="width:220px;margin-top:2px;"></div><p class="sig-sub-label">Sales Manager</p><p class="sig-detail">Mobile: ${payload.TsmContactNumber || "N/A"}</p><p class="sig-detail">Email: ${payload.TsmEmailAddress || "N/A"}</p></div><div style="position:relative;min-height:75px;"><p class="sig-approved-label">Noted By:</p>${payload.ManagerSignature ? `<img src="${payload.ManagerSignature}" style="position:absolute;top:22px;left:0;width:110px;height:auto;object-fit:contain;"/>` : ""}<p class="sig-name" style="margin-top:${payload.ManagerSignature ? "46px" : "8px"};">${payload.salesmanagername}</p><div class="sig-line" style="width:220px;margin-top:2px;"></div><p class="sig-sub-label">Sales-B2B</p></div></div><div class="sig-side-client"><div style="text-align:center;"><p class="sig-client-name" style="font-size:10px;font-weight:900;text-transform:uppercase;margin-top:55px;margin-bottom:4px;">${payload.attention || "&nbsp;"}</p><div class="sig-line" style="width:220px;"></div><p class="sig-client-label">Company Authorized Representative</p><p class="sig-client-sub">(Please Sign Over Printed Name)</p></div><div style="text-align:center;"><div class="sig-line" style="margin-top:55px;width:220px;"></div><p class="sig-client-label">Payment Release Date</p></div><div style="text-align:center;"><div class="sig-line" style="margin-top:55px;width:220px;"></div><p class="sig-client-label">Position in the Company</p></div></div></div></div></div>`,
      );
      if (currentY + termsAndSigBlock.h > pdfHeight - BOTTOM_MARGIN) {
        finalizeCurrentPage();
        pdf.addPage([612, 936]);
        pageCount++;
        currentY = await initiateNewPage();
      }
      pdf.addImage(
        termsAndSigBlock.img,
        "JPEG",
        0,
        currentY,
        pdfWidth,
        termsAndSigBlock.h,
      );

      // ── Stamp watermark + security footer on ALL pages ─────────────────────
      const totalPages = pageCount;
      const totalPagesNum = pdf.internal.pages.length - 1; // jsPDF internal
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        // Watermark already stamped on pages that triggered a page break;
        // stamp the last/only page here (all others were stamped on addPage).
        if (p === totalPages) {
          stampPdfWatermark(pdf, companyLabel, payload.referenceNo, pdfWidth, pdfHeight);
        }
        stampPdfSecurityFooter(pdf, qrDataUrl, payload.referenceNo, issuedAt, p, totalPages, pdfWidth, pdfHeight);
      }

      const safeCompanyName = (payload.companyName || item.company_name || '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);

      if (returnMode === 'blob') {
        const blobUrl = pdf.output('bloburl') as unknown as string;
        document.body.removeChild(iframe);
        return blobUrl;
      } else {
        pdf.save(`${payload.referenceNo}_${safeCompanyName}.pdf`);
        document.body.removeChild(iframe);
      }
    } catch (error) {
      console.error("Critical Export Error:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const toggleDescription = (index: number) =>
    setOpenDescription((prev) => ({ ...prev, [index]: !prev[index] }));

  // ── Live PDF Preview ───────────────────────────────────────────────
  const generatePreview = async () => {
    setPdfPreviewLoading(true);
    // Revoke previous blob URL to prevent memory leak
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    try {
      const blobUrl = await DownloadPDF(
        pdfOption === "with-discount",
        showSummaryDiscounts,
        pdfBreakBuffer,
        pdfContHeaderGap,
        'blob'
      );
      if (blobUrl && typeof blobUrl === 'string') {
        setPdfPreviewUrl(blobUrl);
      }
    } catch (err) {
      console.error("Preview generation failed:", err);
      sileo.error({
        title: "Preview Error",
        description: "Failed to generate PDF preview.",
        duration: 3000,
        position: "top-right",
      });
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  // Clean up blob URL when preview dialog closes
  useEffect(() => {
    if (!pdfPreviewOpen && pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  }, [pdfPreviewOpen, pdfPreviewUrl]);

  // Generate preview when dialog opens
  useEffect(() => {
    if (pdfPreviewOpen && !pdfPreviewUrl && !pdfPreviewLoading) {
      // Small delay to ensure dialog is fully rendered
      const timer = setTimeout(() => {
        generatePreview();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pdfPreviewOpen]);

  // Auto-refresh preview when settings change (if enabled)
  // Track per-row break/spacer fingerprint to trigger refresh when rows change
  const productBreakFingerprint = products.map(p => 
    `${p.pageBreakBefore ? 1 : 0}:${p.spacerAfter ?? 0}:${p.descSpacerAfter ?? 0}:${p.descSpacerBefore ?? 0}:${p.descSectionSpacing ?? 0}:${(p.sectionSpacings || []).join('-')}:${(p.sectionPageBreaks || []).map(b => b ? '1' : '0').join('')}`
  ).join(',');
  useEffect(() => {
    if (!pdfPreviewOpen || !pdfAutoRefresh || pdfPreviewLoading) return;
    
    const timer = setTimeout(() => {
      generatePreview();
    }, 300); // Super fast auto-refresh for near-live updates!
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPreviewOpen, pdfAutoRefresh, pdfBreakBuffer, pdfContHeaderGap, pdfOption, productBreakFingerprint]);

  // Keyboard shortcut for quotation lookup (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isDebugMode) {
          // Already in debug mode — open lookup directly
          setLookupDialogOpen(true);
          setLookupQuotationNumber("");
          setLookupError("");
        } else {
          // Require IT master password to enter debug mode
          setDebugPasswordInput("");
          setDebugPasswordError("");
          setDebugPasswordDialogOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDebugMode]);

  // Verify IT master password to unlock debug mode
  const handleDebugPasswordSubmit = () => {
    const masterPassword = process.env.NEXT_PUBLIC_IT_MASTER_PASSWORD || "";
    if (!masterPassword) {
      setDebugPasswordError("IT_MASTER_PASSWORD is not configured.");
      return;
    }
    if (debugPasswordInput === masterPassword) {
      setIsDebugMode(true);
      setDebugPasswordDialogOpen(false);
      setDebugPasswordInput("");
      setDebugPasswordError("");
      // Open lookup dialog immediately after auth
      setLookupDialogOpen(true);
      setLookupQuotationNumber("");
      setLookupError("");
    } else {
      setDebugPasswordError("Incorrect password. Access denied.");
    }
  };

  // Function to fetch quotation by number
  const handleLookupQuotation = async () => {
    if (!lookupQuotationNumber.trim()) {
      setLookupError("Please enter a quotation number");
      return;
    }

    setIsLookingUp(true);
    setLookupError("");

    try {
      // Try history table first (main taskflow records)
      let { data, error } = await supabase
        .from("history")
        .select("*")
        .eq("quotation_number", lookupQuotationNumber.trim())
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fallback to revised_quotations if not found in history
      if (!data && !error) {
        const { data: revisedData, error: revisedError } = await supabase
          .from("revised_quotations")
          .select("*")
          .eq("quotation_number", lookupQuotationNumber.trim())
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (revisedData) {
          data = revisedData;
          error = revisedError;
        }
      }

      if (error || !data) {
        setLookupError("Quotation not found");
        return;
      }

      const quantities = splitAndTrim(data.product_quantity);
      const amounts = splitAndTrim(data.product_amount);
      const titles = splitAndTrim(data.product_title);
      const descriptions = splitDescription(data.product_description);
      const photos = splitAndTrim(data.product_photo);
      const sku = splitAndTrim(data.product_sku);
      const remarks = splitAndTrim(data.item_remarks);
      const discountedPrices = splitAndTrim(data.discounted_priced);
      const discountedAmounts = splitAndTrim(data.discounted_amount);
      const promoFlags = splitAndTrim(data.product_is_promo);
      const hiddenFlags = splitAndTrim(data.product_is_hidden);
      const displayModes = splitAndTrim(data.product_display_mode);

      const maxLen = Math.max(
        quantities.length,
        amounts.length,
        titles.length,
        descriptions.length,
        photos.length,
        sku.length,
        remarks.length,
      );

      const arr: ProductItem[] = [];
      const newCheckedRows: Record<number, boolean> = {};

      for (let i = 0; i < maxLen; i++) {
        const qty = quantities[i] ?? "";
        const amt = amounts[i] ?? "";
        const discountPct = parseFloat(discountedPrices[i] ?? "0") || 0;
        const isDiscounted = discountPct > 0;
        if (isDiscounted) {
          newCheckedRows[i] = true;
        }
        const unitPrice = parseFloat(amt) || 0;
        const qtyNum = parseFloat(qty) || 1;
        let savedDiscountAmt = parseFloat(discountedAmounts[i] ?? "0") || 0;

        // discounted_amount in DB is stored as the TOTAL discount (unit discount × qty).
        // Always divide by qty to get the per-unit discount amount.
        if (savedDiscountAmt > 0 && qtyNum > 0) {
          savedDiscountAmt = savedDiscountAmt / qtyNum;
        }

        const unitDiscountAmount = savedDiscountAmt > 0
          ? savedDiscountAmt
          : isDiscounted ? (unitPrice * discountPct) / 100 : 0;

        arr.push({
          uid: `product-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          product_quantity: qty,
          product_amount: amt,
          product_title: titles[i] ?? "",
          product_description: descriptions[i] ?? "",
          product_photo: photos[i] ?? "",
          product_sku: sku[i] ?? "",
          item_remarks: remarks[i] ?? "",
          quantity: parseFloat(qty) || 0,
          price: unitPrice,
          description: descriptions[i] ?? "",
          skus: sku[i] ? [sku[i]] : undefined,
          title: titles[i] ?? "",
          images: photos[i] ? [{ src: photos[i] }] : undefined,
          isDiscounted,
          discount: discountPct,
          discountAmount: unitDiscountAmount,
          isPromo: promoFlags[i] === "1",
          isHidden: hiddenFlags[i] === "1",
          displayMode: (() => {
            const rawDisplayMode = displayModes[i] ?? "";
            if (rawDisplayMode === 'full' || rawDisplayMode === 'transparent') return 'transparent';
            if (rawDisplayMode === 'compact' || rawDisplayMode === 'net_only') return 'net_only';
            if (rawDisplayMode === 'value_add') return 'value_add';
            if (rawDisplayMode === 'bundle') return 'bundle';
            if (rawDisplayMode === 'request') return 'request';
            return 'transparent';
          })(),
        });
      }

      setProducts(arr);
      setCheckedRows(newCheckedRows);

      if (data.vat_type) {
        setVatTypeState(data.vat_type === "vat_inc" || data.vat_type === "vat_exe" || data.vat_type === "zero_rated"
          ? data.vat_type
          : "zero_rated");
      }
      if (data.delivery_fee) setDeliveryFeeState(data.delivery_fee);
      if (data.restocking_fee) setRestockingFeeState(data.restocking_fee);
      if (data.wht_type) setWhtTypeState(data.wht_type);
      if (data.quotation_subject) setQuotationSubjectState(data.quotation_subject);
      if (data.contact_person) setContactPersonState(data.contact_person);
      if (data.contact_number) setContactNumberState(data.contact_number);
      if (data.email_address) setEmailAddressState(data.email_address);

      // Fetch signatories and user names for the loaded quotation
      let agentName = null;
      let tsmName = null;
      let managerName = null;
      
      try {
        // Fetch signatory data
        const { data: sigData, error: sigError } = await supabase
          .from("signatories")
          .select("*")
          .eq("quotation_number", lookupQuotationNumber.trim())
          .maybeSingle();

        // User data comes from MongoDB, not Supabase
        // Get referenceid from signatories table and fetch user from MongoDB to get full name
        if (sigData?.referenceid) {
          try {
            // Fetch user from MongoDB using referenceid
            const userResponse = await fetch(`/api/users/by-referenceid?referenceid=${sigData.referenceid}`);
            if (userResponse.ok) {
              const userData = await userResponse.json();
              agentName = userData.firstname && userData.lastname 
                ? `${userData.firstname} ${userData.lastname}`.trim()
                : userData.name || sigData.referenceid;
              console.log("Debug - Fetched user from MongoDB:", userData);
            } else {
              console.log("Debug - Failed to fetch user from MongoDB, using fallback");
              // Use proper name fields instead of reference ID initials
              agentName = 
                (data.agent_firstname && data.agent_lastname) ? `${data.agent_firstname} ${data.agent_lastname}`.trim() :
                (data.firstname && data.lastname) ? `${data.firstname} ${data.lastname}`.trim() :
                data.owner_name ||
                `${firstname ?? ""} ${lastname ?? ""}`.trim() || null;
            }
          } catch (err) {
            console.error("Debug - Error fetching user from MongoDB:", err);
            // Use proper name fields instead of reference ID initials
            agentName = 
              (data.agent_firstname && data.agent_lastname) ? `${data.agent_firstname} ${data.agent_lastname}`.trim() :
              (data.firstname && data.lastname) ? `${data.firstname} ${data.lastname}`.trim() :
              data.owner_name ||
              `${firstname ?? ""} ${lastname ?? ""}`.trim() || null;
          }
        } else {
          // Fallback to other options if no referenceid
          agentName = 
            (data.agent_firstname && data.agent_lastname) ? `${data.agent_firstname} ${data.agent_lastname}`.trim() :
            (data.firstname && data.lastname) ? `${data.firstname} ${data.lastname}`.trim() :
            data.owner_name ||
            `${firstname ?? ""} ${lastname ?? ""}`.trim() || null;
        }
        // In debug mode, prefer names stored on the looked-up quotation record
        tsmName = (data as any).tsm_name || tsmname || null;
        managerName = (data as any).manager_name || managername || null;

        if (!sigError && sigData) {
          // Update the item with signatory data from the loaded quotation
          item.agent_signature = sigData.agent_signature;
          item.agent_contact_number = sigData.agent_contact_number;
          item.agent_email_address = sigData.agent_email_address;
          item.tsm_signature = sigData.tsm_signature;
          item.tsm_contact_number = sigData.tsm_contact_number;
          item.tsm_email_address = sigData.tsm_email_address;
          item.manager_signature = sigData.manager_signature;
          item.manager_contact_number = sigData.manager_contact_number;
          item.manager_email_address = sigData.manager_email_address;
          
          // Set loaded signature states to override props
          setLoadedAgentSignature(sigData.agent_signature);
          setLoadedAgentContactNumber(sigData.agent_contact_number);
          setLoadedAgentEmailAddress(sigData.agent_email_address);
          setLoadedTsmSignature(sigData.tsm_signature);
          setLoadedTsmContactNumber(sigData.tsm_contact_number);
          setLoadedTsmEmailAddress(sigData.tsm_email_address);
          setLoadedManagerSignature(sigData.manager_signature);
          setLoadedManagerContactNumber(sigData.manager_contact_number);
          setLoadedManagerEmailAddress(sigData.manager_email_address);
        }
        
        // Debug: Log fetched user names and check for owner's name in quotation data
        console.log("Debug - Fetched user names:", {
          agentName,
          tsmName,
          managerName,
          agentId: data.agent,
          tsmId: data.tsm,
          managerId: data.manager
        });
        console.log("Debug - Signatories data:", {
          referenceid: sigData?.referenceid,
          agentName: agentName
        });
        console.log("Debug - Checking for owner's name in quotation data:", {
          firstname: data.firstname,
          lastname: data.lastname,
          agent_firstname: data.agent_firstname,
          agent_lastname: data.agent_lastname,
          created_by: data.created_by,
          owner_name: data.owner_name,
          account_reference_number: data.account_reference_number
        });
        
        // Set loaded name states from fetched user data
        setLoadedAgentName(agentName);
        setLoadedTsmName(tsmName);
        setLoadedManagerName(managerName);
      } catch (err) {
        console.error("Failed to fetch signatories or user names:", err);
      }

      Object.assign(item, {
        quotation_number: data.quotation_number,
        company_name: data.company_name,
        contact_person: data.contact_person,
        contact_number: data.contact_number,
        email_address: data.email_address,
        address: data.address,
        product_title: data.product_title,
        product_quantity: data.product_quantity,
        product_amount: data.product_amount,
        product_description: data.product_description,
        product_photo: data.product_photo,
        product_sku: data.product_sku,
        item_remarks: data.item_remarks,
        discounted_priced: data.discounted_priced,
        discounted_amount: data.discounted_amount,
        product_is_promo: data.product_is_promo,
        product_is_hidden: data.product_is_hidden,
        product_display_mode: data.product_display_mode,
        vat_type: data.vat_type,
        delivery_fee: data.delivery_fee,
        restocking_fee: data.restocking_fee,
        wht_type: data.wht_type,
        quotation_subject: data.quotation_subject,
        quotation_type: data.quotation_type,
        // Add signatory name fields from fetched user data
        salesrepresentative: agentName,
        salestsmname: tsmName,
        salesmanagername: managerName,
      });

      showToast(`Loaded quotation: ${data.quotation_number}`, 'success');
      setLookupDialogOpen(false);
    } catch (err) {
      console.error("Lookup error:", err);
      setLookupError("Failed to load quotation");
    } finally {
      setIsLookingUp(false);
    }
  };

  const subtotal = React.useMemo(() => {
    return products.reduce((acc, product) => {
      const qty = parseFloat(product.product_quantity ?? "0") || 0;
      const unitPrice = parseFloat(product.product_amount ?? "0") || 0;
      const isChecked = product.isDiscounted ?? false;
      if (isChecked) {
        const discPct = product.discount ?? (vatTypeState === "vat_exe" ? 12 : 0);
        // Prefer explicit peso amount; fall back to percent-derived (same logic as getQuotationPayload & performSave)
        // discountAmount in state is always per-unit; fall back to percent-derived
        let unitDiscountAmount = product.discountAmount != null && product.discountAmount > 0
          ? product.discountAmount
          : (unitPrice * discPct) / 100;
        const netUnitPrice = Math.max(0, unitPrice - unitDiscountAmount);
        // Fix: Round net unit price to 2 decimal places to match UI display and avoid butal
        const fixedNetPrice = parseFloat(netUnitPrice.toFixed(2));
        return acc + fixedNetPrice * qty;
      }
      return acc + unitPrice * qty;
    }, 0);
  }, [products, vatTypeState]);

  useEffect(() => {
    setQuotationAmount(subtotal);
  }, [subtotal]);

  // Calculate display total with EWT deduction (matching planner behavior)
  const displayTotal = React.useMemo(() => {
    const deliveryFeeNum = parseFloat(deliveryFeeState) || 0;
    const restockingFeeNum = parseFloat(restockingFeeState) || 0;
    const totalWithFees = subtotal + deliveryFeeNum + restockingFeeNum;
    const whtAmount = whtTypeState !== "none"
      ? (vatTypeState === "vat_inc"
        ? totalWithFees / 1.12
        : totalWithFees
      ) * (whtTypeState === "wht_1" ? 0.01 : 0.02)
      : 0;
    return Math.round((totalWithFees - whtAmount) * 100) / 100;
  }, [subtotal, deliveryFeeState, restockingFeeState, whtTypeState, vatTypeState]);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);

  const openSpfDetailView = (spfNumber: string) => {
    const record = spf1Records.find(r => r.spf_number === spfNumber);
    if (record) {
      setSpfDetailOffers([record]);
      setShowSpfDetailView(true);
    }
  };

  const openFullImage = (url: string) => {
    setFullImageUrl(url);
    setIsImageDialogOpen(true);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setProducts([...history[newIndex]]);
      setLastHistoryAction('Undo');
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setProducts([...history[newIndex]]);
      setLastHistoryAction('Redo');
    }
  };

  const copySelectedRows = () => {
    if (selectedRows.size === 0) return;
    const rowsToCopy = products.filter(p => selectedRows.has(p.uid));
    localStorage.setItem('clipboard_products', JSON.stringify(rowsToCopy));
    showToast(`Copied ${rowsToCopy.length} rows`, 'success');
  };

  const pasteFromClipboard = () => {
    const clipboard = localStorage.getItem('clipboard_products');
    if (!clipboard) {
      showToast('Clipboard is empty', 'error');
      return;
    }
    try {
      const parsed = JSON.parse(clipboard);
      if (Array.isArray(parsed)) {
        const newProducts = parsed.map((p: any) => ({
          ...p,
          uid: `pasted-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }));
        setProducts(prev => [...prev, ...newProducts]);
        saveToHistory('Paste rows');
        showToast(`Pasted ${newProducts.length} rows`, 'success');
      }
    } catch {
      showToast('Failed to paste', 'error');
    }
  };

  const handleProductChange = (index: number, field: keyof ProductItem, value: any) => {
    setProducts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent
          className="h-screen max-h-screen overflow-hidden p-0 flex flex-col [&>button]:hidden rounded-none border-0"
          style={{
            maxWidth: "100vw",
            width: "100vw",
            height: "100vh",
            maxHeight: "100vh",
            borderRadius: 0,
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* HEADER */}
          <div className="flex flex-col border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between pl-6 pr-4 py-2.5 sm:pl-8 sm:pr-5 bg-white">
              <div className="flex items-center gap-2 min-w-0">
                <DialogTitle className="font-black text-sm tracking-tight truncate">
                  Edit:{" "}
                  <button
                    type="button"
                    onClick={() => {
                      const text = item.quotation_number || String(item.id);
                      navigator.clipboard.writeText(text);
                      showToast(`Copied: ${text}`, 'success');
                    }}
                    className="hover:bg-blue-100 hover:text-blue-700 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                    title="Click to copy quotation number"
                  >
                    {item.quotation_number || item.id}
                  </button>
                </DialogTitle>
                <span className="hidden sm:inline text-gray-300">|</span>
                <span className="hidden sm:inline text-xs text-gray-500 truncate">{item.quotation_type}</span>
                {products.length > 0 && (
                  <span className="inline-flex items-center justify-center bg-[#121212] text-white text-[10px] font-black rounded-full w-5 h-5 ml-1">
                    {products.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {/* Running time */}
                <div className="hidden sm:flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-blue-400 font-bold uppercase text-[9px] tracking-widest">Duration</span>
                  <span className="font-mono font-black text-sm text-blue-700 tabular-nums">
                    {startDate && endDate ? (() => {
                      const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
                      if (diffMs <= 0) return "0s";
                      const s = Math.floor(diffMs / 1000) % 60;
                      const m = Math.floor(diffMs / (1000 * 60)) % 60;
                      const h = Math.floor(diffMs / (1000 * 60 * 60));
                      return `${h}h ${m}m ${s}s`;
                    })() : "N/A"}
                  </span>
                </div>
                {isDebugMode && (
                  <div className="hidden sm:flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span className="text-red-400 font-bold uppercase text-[9px] tracking-widest">DEBUG MODE</span>
                    <button
                      type="button"
                      onClick={() => setIsDebugMode(false)}
                      className="ml-1 text-[9px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest border border-red-300 hover:border-red-500 rounded px-1 py-0.5 transition-colors"
                      title="Exit debug mode"
                    >
                      EXIT
                    </button>
                  </div>
                )}
                {products.length > 0 && (
                  <div className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Total</span>
                    <span className="font-black text-lg text-[#121212] tabular-nums">
                      PHP {Number(displayTotal).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* Mobile tab switcher */}
            <div className="flex lg:hidden border-t border-gray-100 text-[11px] font-bold">
              <button type="button" onClick={() => setMobilePanelTab("search")}
                className={`flex-1 py-2.5 border-b-2 transition-colors ${mobilePanelTab === "search" ? "border-[#121212] text-[#121212] bg-white" : "border-transparent text-gray-400 bg-gray-50"}`}
                title="Search"
              >
                🔍 Search
              </button>
              <button type="button" onClick={() => setMobilePanelTab("products")}
                className={`flex-1 py-2.5 border-b-2 transition-colors ${mobilePanelTab === "products" ? "border-[#121212] text-[#121212] bg-white" : "border-transparent text-gray-400 bg-gray-50"}`}
                title="Products"
              >
                &#x1F6D2; Products ({products.length})
              </button>
            </div>
          </div>
          {/* BODY */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full flex flex-col lg:flex-row gap-0 lg:gap-3 lg:pl-3 lg:pr-3 lg:py-3 p-0 overflow-hidden">
              {/* Left side: Search + history */}
              <div className={`relative flex-col gap-2 overflow-y-auto px-3 pt-2 h-full flex-shrink-0 scrollbar-thin ${leftPanelCollapsed ? 'hidden lg:flex items-center w-12' : 'flex w-[280px] min-w-[280px]'} ${mobilePanelTab === "products" && products.length > 0 ? "hidden lg:flex" : "flex"}`}>
                {/* Collapse/Expand Button & Help */}
                <div className={`flex items-center gap-1 mb-1 ${leftPanelCollapsed ? 'flex-col' : 'justify-between'}`}>
                  <button
                    type="button"
                    onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                    title={leftPanelCollapsed ? "Expand panel" : "Collapse panel"}
                  >
                    <PanelLeft className={`w-4 h-4 transition-transform ${leftPanelCollapsed ? 'rotate-180' : ''}`} />
                  </button>
                  {!leftPanelCollapsed && (
                    <>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Product Search</span>
                      <button
                        type="button"
                        onClick={() => setShowHelp(!showHelp)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition-colors"
                        title="How to use"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* Help Tooltip */}
                {showHelp && !leftPanelCollapsed && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-800 mb-2">
                    <p className="font-bold mb-1 flex items-center gap-1"><Info className="w-3 h-3" /> How to add products:</p>
                    <ul className="space-y-1 ml-4 list-disc">
                      <li>Type product name in search box</li>
                      <li>Click the <Plus className="w-3 h-3 inline" /> button to add</li>
                      <li>Or drag the product card to the table</li>
                      <li>Click product image to preview</li>
                    </ul>
                  </div>
                )}

                <div className={`flex flex-col gap-3 sticky top-0 bg-white z-10 pb-2 ${leftPanelCollapsed ? 'hidden' : ''}`}>
                  {/* Source Switcher - Premium Pills */}
                  <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => { setProductSource("shopify"); setSearchTerm(""); setSearchResults([]); setIsSpfMode(false); setIsSpf1Mode(false); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] font-bold rounded-md transition-all ${productSource === "shopify" && !isSpfMode && !isSpf1Mode ? "bg-white text-[#121212] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      <span>🛍️</span>
                      <span className="hidden sm:inline">Shopify</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setProductSource("firebase_taskflow"); setSearchTerm(""); setSearchResults([]); setIsSpfMode(false); setIsSpf1Mode(false); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] font-bold rounded-md transition-all ${productSource === "firebase_taskflow" && !isSpfMode && !isSpf1Mode ? "bg-white text-[#121212] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      <span>🗄️</span>
                      <span className="hidden sm:inline">DB</span>
                    </button>
                    <div className="w-px h-6 bg-gray-300"></div>
                    <button
                      type="button"
                      onClick={() => { setIsSpf1Mode(false); setIsSpfMode(true); setSearchTerm(""); setSearchResults([]); }}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] font-bold rounded-md transition-all ${isSpfMode ? "bg-green-500 text-white shadow-sm" : "text-gray-500 hover:text-green-600"}`}
                      title="Service Request Form"
                    >
                      <span>🛠️</span>
                      <span className="hidden sm:inline">SRF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsSpf1Mode(true); setIsSpfMode(false); setSearchTerm(""); setSearchResults([]); }}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] font-bold rounded-md transition-all ${isSpf1Mode ? "bg-red-500 text-white shadow-sm" : "text-gray-500 hover:text-red-600"}`}
                      title="Special Price Form"
                    >
                      <span>🧾</span>
                      <span className="hidden sm:inline">SPF</span>
                    </button>
                  </div>

                  {/* SPF Manual Form / SPF1 Panel / Normal Search */}
                  {isSpfMode ? (
                    <div className="flex flex-col gap-2 border border-red-200 bg-red-50 p-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-red-600 tracking-widest">SRF</span>
                        <span className="text-[9px] text-red-400 italic">— Service Request Form</span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Service Name *</label>
                        <Input type="text" placeholder="Enter product name..." value={spfManualProduct.title} onChange={(e) => setSpfManualProduct(prev => ({ ...prev, title: e.target.value }))} className="rounded-none text-xs uppercase" />
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Qty</label>
                          <Input type="number" min={1} value={spfManualProduct.quantity} onChange={(e) => setSpfManualProduct(prev => ({ ...prev, quantity: String(Math.max(1, parseInt(e.target.value) || 1)) }))} className="rounded-none text-xs" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Unit Price</label>
                          <Input type="number" min={0} step="0.01" value={spfManualProduct.price} onChange={(e) => setSpfManualProduct(prev => ({ ...prev, price: String(Math.max(0, parseFloat(e.target.value) || 0)) }))} className="rounded-none text-xs" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Description / Specs</label>
                        <Textarea placeholder="Enter description..." value={spfManualProduct.description} onChange={(e) => setSpfManualProduct(prev => ({ ...prev, description: e.target.value }))} rows={3} className="rounded text-xs" />
                      </div>
                      <Button type="button" disabled={!spfManualProduct.title}
                        onClick={() => {
                          const newProduct: any = {
                            title: spfManualProduct.title.toUpperCase(),
                            product_title: spfManualProduct.title.toUpperCase(),
                            product_description: spfManualProduct.description,
                            product_sku: spfManualProduct.sku,
                            product_quantity: String(spfManualProduct.quantity),
                            product_amount: String(spfManualProduct.price),
                            product_photo: spfManualProduct.imageUrl,
                            images: spfManualProduct.imageUrl ? [{ src: spfManualProduct.imageUrl }] : [],
                            skus: spfManualProduct.sku ? [spfManualProduct.sku] : [],
                            description: spfManualProduct.description,
                            price: parseFloat(spfManualProduct.price) || 0,
                            quantity: parseFloat(spfManualProduct.quantity) || 0,
                            isDiscounted: false,
                            discount: 0,
                            cloudinaryPublicId: spfManualProduct.cloudinaryPublicId,
                          };
                          setProducts(prev => [...prev, newProduct]);
                          setSpfManualProduct({ title: "", sku: "", price: "", quantity: "1", description: "", imageUrl: "", cloudinaryPublicId: "", cost: "", leadTime: "", packaging: "", factory: "", port: "", pcsPerCarton: "", supplier: "", contact: "" });
                          setMobilePanelTab("products");
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg h-9 mt-1 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Submit Request
                      </Button>
                    </div>
                  ) : isSpf1Mode ? (
                    <div className="flex flex-col gap-2 border border-red-200 bg-red-50 p-2.5 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-red-600 tracking-widest">SPF 1</span>
                          <span className="text-[9px] text-red-400 italic">— approved SPF list</span>
                        </div>
                        {spf1Loading && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Loading…</span>
                        )}
                      </div>

                      <Input
                        type="text"
                        className="uppercase rounded-none bg-white"
                        placeholder="Search SPF number..."
                        value={spf1Search}
                        onChange={(e) => setSpf1Search(e.target.value)}
                      />

                      {spf1Error && (
                        <div className="text-[11px] text-red-600 font-medium">{spf1Error}</div>
                      )}

                      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                        {spf1Records
                          .filter((r) => {
                            const q = spf1Search.trim().toLowerCase();
                            if (!q) return true;
                            return (r.spf_number || "").toLowerCase().includes(q);
                          })
                          .map((r) => (
                            <div
                              key={r.id}
                              className={`w-full rounded-none border transition overflow-hidden ${spf1Selected?.id === r.id
                                ? "border-red-500 bg-white ring-1 ring-red-200 shadow-sm"
                                : "border-red-200 bg-white shadow-sm"
                                }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (spf1Selected?.id === r.id) { setSpf1Selected(null); return; }
                                  setSpf1Selected(r);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-red-50/70 transition flex items-center justify-between gap-2"
                              >
                                <div className="font-black text-[11px] uppercase tracking-wider text-gray-800 truncate">
                                  {r.spf_number || `SPF #${r.id}`}
                                </div>
                                <span className="text-[10px] font-black text-red-500 tabular-nums w-4 text-center shrink-0">
                                  {spf1Selected?.id === r.id ? "▾" : "▸"}
                                </span>
                              </button>

                              {spf1Selected?.id === r.id && (
                                <div className="border-t border-red-100 bg-gray-50/90">
                                  <div className="ml-2 border-l-2 border-red-400 pl-3 pr-2 py-2.5 space-y-3">
                                    <div className="text-[10px] text-gray-700 grid grid-cols-2 gap-x-3 gap-y-1.5">
                                      <span className="truncate col-span-2 text-[9px] text-gray-400 font-mono">
                                        Ref: {r.referenceid || "—"}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setMobilePanelTab("products")}
                                      className="w-full text-left text-[10px] font-black uppercase tracking-wider text-red-600 hover:text-red-800 py-1 border-t border-red-100/80"
                                    >
                                      View selected in quotation list →
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => r.spf_number && openSpfDetailView(r.spf_number)}
                                      className="w-full text-left text-[10px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-800 py-1 border-t border-blue-100/80"
                                    >
                                      View SPF Form Details →
                                    </button>
                                    <div className="space-y-2 pt-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Line items</span>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setSpf1Selected(null); }}
                                          className="text-[9px] font-black uppercase tracking-wider text-red-600 hover:text-red-800"
                                        >
                                          Collapse
                                        </button>
                                      </div>
                                      {parseSpfCreationProducts(r).map((p, idx) => (
                                        <div key={`${r.id}-${idx}`} className="border border-gray-200 bg-white p-2 shadow-sm">
                                          <div className="flex items-start gap-2">
                                            {p.imageUrl ? (
                                              <img src={p.imageUrl} alt={p.title} className="w-12 h-12 object-cover border border-gray-200 shrink-0" />
                                            ) : (
                                              <div className="w-12 h-12 bg-gray-50 border border-gray-200 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[10px] font-black uppercase tracking-wider text-gray-800 truncate">
                                                {p.title}
                                              </div>
                                              {p.sku && p.sku.trim().length > 0 && p.sku.trim().toUpperCase() !== (p.title || "").trim().toUpperCase() ? (
                                                <div className="text-[9px] text-gray-500 truncate font-mono">
                                                  {p.sku}
                                                </div>
                                              ) : null}
                                              <div className="text-[10px] text-gray-500 mt-0.5 grid grid-cols-2 gap-x-2">
                                                <span className="truncate"><span className="font-bold">Min qty:</span> {p.quantity}</span>
                                                <span className="truncate"><span className="font-bold">Price:</span> ₱{p.finalSellingPrice.toFixed(2)}</span>
                                                <span className="truncate col-span-2"><span className="font-bold">Lead:</span> {p.leadTime || "—"}</span>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="mt-2">
                                            <Button
                                              type="button"
                                              disabled={p.quantity <= 0}
                                              className="w-full rounded-none bg-red-600 hover:bg-red-700 text-white h-8 text-[11px] font-black uppercase tracking-wider"
                                              onClick={() => {
                                                const specHtml = formatSpfTechSpecToHtml(p.technicalSpecification || "");
                                                const leadHtml = formatProcurementLeadHtml(p.leadTime || "");
                                                const newProduct: any = {
                                                  title: p.title,
                                                  product_title: p.title,
                                                  product_description: `${specHtml}${leadHtml}`,
                                                  description: `${specHtml}${leadHtml}`,
                                                  product_sku: p.sku || "",
                                                  product_quantity: String(Math.max(1, p.quantity)),
                                                  product_amount: String(p.finalSellingPrice),
                                                  product_photo: p.imageUrl || "",
                                                  images: p.imageUrl ? [{ src: p.imageUrl }] : [],
                                                  skus: p.sku ? [p.sku] : [],
                                                  price: p.finalSellingPrice,
                                                  quantity: Math.max(1, p.quantity),
                                                  isDiscounted: false,
                                                  discount: 0,
                                                  item_remarks: "",
                                                  procurementMinQty: p.quantity,
                                                  procurementLeadTime: p.leadTime,
                                                  procurementLockedPrice: true,
                                                  originalPrice: p.finalSellingPrice,
                                                };
                                                setProducts(prev => [...prev, newProduct]);
                                                setMobilePanelTab("products");
                                              }}
                                            >
                                              {p.quantity <= 0 ? "No PD qty" : "Add to quotation"}
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    !isManualEntry && (
                      <>
                        {/* Premium Search Input with View Mode Switcher */}
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                            <Input
                              type="text"
                              className="uppercase rounded-lg pl-10 pr-4 py-2.5 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-sm w-full"
                              value={searchTerm}
                              placeholder="Search product by Title or SKU..."
                              onChange={async (e) => {
                                if (isManualEntry) return;
                                const rawValue = e.target.value;
                                setSearchTerm(rawValue);
                                if (rawValue.length < 2) {
                                  setSearchResults([]);
                                  return;
                                }
                                setIsSearching(true);
                                try {
                                  if (productSource === "shopify") {
                                    const res = await fetch(
                                      `/api/shopify/products?q=${rawValue.toLowerCase()}`,
                                    );
                                    const data = await res.json();
                                    setSearchResults(data.products || []);
                                  } else {
                                    const searchUpper = rawValue.toUpperCase();
                                    const websiteFilter =
                                      productSource === "firebase_shopify"
                                        ? "Shopify"
                                        : "Taskflow";
                                    const q = query(
                                      collection(db, "products"),
                                      where(
                                        "websites",
                                        "array-contains",
                                        websiteFilter,
                                      ),
                                    );
                                    const querySnapshot = await getDocs(q);
                                    const firebaseResults = querySnapshot.docs
                                      .map((doc) => {
                                        const data = doc.data();
                                        let specsHtml = `<p><strong>${data.shortDescription || ""}</strong></p>`;
                                        let rawSpecsText = "";
                                        if (Array.isArray(data.technicalSpecs)) {
                                          data.technicalSpecs.forEach((group: any) => {
                                            rawSpecsText += ` ${group.specGroup}`;
                                            specsHtml += `<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">${group.specGroup}</div>`;
                                            specsHtml += `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">`;
                                            group.specs?.forEach((spec: any) => {
                                              rawSpecsText += ` ${spec.name} ${spec.value}`;
                                              specsHtml += `<tr><td style="border:1px solid #e5e5eb;padding:4px;background:#f9fafb;width:40%"><b>${spec.name}</b></td><td style="border:1px solid #e5e5eb;padding:4px">${spec.value}</td></tr>`;
                                            });
                                            specsHtml += `</table>`;
                                          });
                                        }

                                        // Normalize all item code variants from itemCodes (object/array) + itemCode (string fallback)
                                        const rawItemCodes = data.itemCodes;
                                        const fallbackCode = data.itemCode || "";
                                        const allCodes: string[] = [];

                                        if (rawItemCodes && typeof rawItemCodes === "object" && !Array.isArray(rawItemCodes)) {
                                          Object.values(rawItemCodes as Record<string, string>).forEach((c) => {
                                            if (c && String(c).trim()) allCodes.push(String(c).trim());
                                          });
                                        } else if (Array.isArray(rawItemCodes)) {
                                          rawItemCodes.forEach((entry: any) => {
                                            const c = entry?.code ?? entry?.itemCode ?? entry;
                                            if (c && String(c).trim()) allCodes.push(String(c).trim());
                                          });
                                        } else if (typeof rawItemCodes === "string" && rawItemCodes.trim()) {
                                          rawItemCodes.split(",").forEach((c) => {
                                            if (c.trim()) allCodes.push(c.trim());
                                          });
                                        }

                                        if (allCodes.length === 0 && fallbackCode.trim()) {
                                          allCodes.push(fallbackCode.trim());
                                        }

                                        const defaultSku = allCodes[0] || fallbackCode;
                                        const allCodesText = allCodes.join(" ");

                                        const tempSearchMetadata = (
                                          data.name +
                                          " " +
                                          allCodesText +
                                          " " +
                                          rawSpecsText
                                        ).toUpperCase();

                                        return {
                                          id: doc.id,
                                          title: data.name || "No Name",
                                          price: data.salePrice || data.regularPrice || 0,
                                          description: specsHtml,
                                          images: data.mainImage ? [{ src: data.mainImage }] : [],
                                          skus: defaultSku ? [defaultSku] : [],
                                          discount: 0,
                                          tempSearchMetadata,
                                        };
                                      })
                                      .filter((p) =>
                                        p.tempSearchMetadata.includes(searchUpper),
                                      );

                                    // Deduplicate by doc ID — same product can appear
                                    // multiple times if Firebase returns duplicate snapshots
                                    const seen = new Set<string>();
                                    const dedupedResults = firebaseResults.filter((p) => {
                                      if (seen.has(p.id)) return false;
                                      seen.add(p.id);
                                      return true;
                                    });

                                    setSearchResults(dedupedResults);
                                  }
                                } catch (err) {
                                  console.error("Search error:", err);
                                } finally {
                                  setIsSearching(false);
                                }
                              }}
                            />
                          </div>
                          {/* View Mode Switcher - always visible */}
                          <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setProductViewMode('list')}
                              className={`p-1 rounded transition-all ${productViewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                              title="List view"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setProductViewMode('grid')}
                              className={`p-1 rounded transition-all ${productViewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                              title="Grid view"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {isSearching && (
                          <p className="text-[10px] animate-pulse">
                            Searching Source...
                          </p>
                        )}
                      </>
                    )
                  )}
                  {/* End SPF ternary */}
                </div>

                {/* Search Results — only shown when not in SPF mode */}
                {!isSpfMode && !isSpf1Mode && !isManualEntry && searchResults.length > 0 && (
                  <>
                    {/* Helper tip */}
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 px-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Click image to preview • Drag to add • Click + to add</span>
                    </div>

                    {/* Premium Product Cards - Respect View Mode */}
                    <div className={`overflow-x-hidden ${productViewMode === 'grid'
                      ? 'grid grid-cols-2 gap-2'
                      : 'flex flex-col gap-2'
                      }`}>
                      {searchResults.map((product) => (
                        <div
                          key={product.id}
                          className="group bg-white border border-gray-100 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-200 transition-all overflow-hidden min-h-[56px]"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "copy";
                            e.dataTransfer.setData("application/json", JSON.stringify(product));
                          }}
                        >
                          <div className="grid grid-cols-[40px_1fr_24px] gap-2 items-center h-10">
                            {/* Product Image */}
                            <div className="w-10 h-10 flex-shrink-0">
                              {product.images?.[0]?.src ? (
                                <img
                                  src={product.images[0].src}
                                  alt={product.title}
                                  className="w-full h-full object-cover rounded-md cursor-pointer"
                                  onClick={() => product.images?.[0]?.src && openFullImage(product.images[0].src)}
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-50 rounded-md flex items-center justify-center">
                                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Product Info */}
                            <div className="min-w-0 overflow-hidden">
                              <h4 className="text-[10px] font-semibold text-gray-800 leading-tight line-clamp-2">{product.title}</h4>
                              <p className="text-[9px] text-gray-400 truncate">{product.skus?.[0] || "No SKU"}</p>
                            </div>

                            {/* Add Button */}
                            <button
                              type="button"
                              onClick={() => handleAddProduct(product)}
                              className="w-6 h-6 flex items-center justify-center bg-[#121212] text-white rounded-full hover:bg-gray-800 transition-colors shadow-sm"
                              title="Add to quotation"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Empty state when search has no results */}
                {!isSpfMode && !isSpf1Mode && searchResults.length === 0 && searchTerm.length >= 2 && !isSearching && (
                  <p className="text-xs text-center text-gray-500 mt-4">No products found.</p>
                )}

                {/* Recently Added Products */}
                {!isSpfMode && !isSpf1Mode && !isManualEntry && recentProducts.length > 0 && (
                  <div className="flex flex-col gap-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Recently Added:</span>
                      <span className="text-[9px] text-gray-400">({recentProducts.length})</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {recentProducts.map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                          onClick={() => handleAddProduct(product)}
                          title="Click to add again"
                        >
                          <div className="w-6 h-6 flex-shrink-0">
                            {product.images?.[0]?.src ? (
                              <img
                                src={product.images[0].src}
                                alt={product.title}
                                className="w-full h-full object-cover rounded"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 rounded" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-gray-700 truncate">{product.title}</p>
                          </div>
                          <button
                            type="button"
                            className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            title="Re-add to quotation"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>)}


                {/* Selected Products checkboxes */}
                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[20vh] lg:max-h-[35vh] border border-dashed p-2 rounded-lg">
                  {products.length === 0 && (
                    <p className="text-xs text-gray-500">No products selected.</p>
                  )}

                  {products.map((item, index) => (
                    <div key={index} className="flex flex-col">
                      {index !== 0 && <div className="border-t border-gray-200 my-1" />}
                      <label className="flex items-center gap-2 text-xs cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked
                          className="accent-blue-500"
                          onChange={() => {
                            setProducts((prev) =>
                              prev.filter((_, i) => i !== index)
                            );
                          }}
                        />
                        <span>{item.title || item.product_title}</span>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 max-h-64 overflow-auto custom-scrollbar">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    Revised Quotations History
                    <span className="bg-[#121212] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      {revisedQuotations.length}
                    </span>
                  </h3>
                  {revisedQuotations.length === 0 ? (
                    <p>No revised quotations found.</p>
                  ) : (
                    <div className="space-y-3">
                      {revisedQuotations.map((q) => {
                        const isOriginal = !q.version && q.type_activity !== "Revised Quotations";
                        const label = isOriginal ? "Original Quotation" : q.version || "N/A";
                        const displayDate = q.date_updated ?? q.date_created ?? q.start_date;
                        console.log("📅 Quotation history item:", { q, isOriginal, displayDate });
                        
                        return (
                        <Item
                          key={q.id}
                          className={`border border-gray-300 rounded-sm p-3 shadow-sm hover:shadow-md transition cursor-pointer ${selectedRevisedQuotation?.id === q.id ? "bg-gray-100" : ""} ${isOriginal ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-yellow-500"}`}
                          onClick={() => setSelectedRevisedQuotation(q)}
                        >
                          <ItemContent>
                            <ItemTitle className="font-semibold text-sm flex items-center gap-2">
                              {label}
                              {isOriginal && (
                                <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                  ORIGINAL
                                </span>
                              )}
                            </ItemTitle>
                            <ItemDescription className="text-xs text-gray-600 line-clamp-none">
                              <div>
                                <strong>Amount:</strong>{" "}
                                {q.quotation_amount ? `₱${parseFloat(String(q.quotation_amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "N/A"}
                              </div>
                              {displayDate && (
                                <div className="text-xs text-gray-500 mt-1">
                                  <strong>Date:</strong>{" "}
                                  {new Date(displayDate).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
                                </div>
                              )}
                            </ItemDescription>
                          </ItemContent>
                        </Item>
                      );})}
                    </div>
                  )}
                </div>
              </div>

              {/* Right side: Products table */}
              <div
                className={`flex-col w-full overflow-y-auto px-3 lg:px-0 pb-3 lg:pb-0 min-h-0 ${mobilePanelTab === "search" ? "hidden lg:flex" : "flex"} ${isDragOver ? "ring-2 ring-blue-400 ring-inset rounded-lg bg-blue-50/30" : ""} transition-all`}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes("application/json")) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDragOver(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  try {
                    const raw = e.dataTransfer.getData("application/json");
                    if (!raw) return;
                    const item = JSON.parse(raw) as Product;
                    handleAddProduct(item);
                  } catch (err) {
                    console.error("Drop failed:", err);
                  }
                }}
              >

                {/* Premium Controls Bar - matching quotation layout */}
                <div className="flex flex-col gap-2 mb-3">
                  {/* Row 1: Title + Search + Legend */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Product List title */}
                      <h4 className="font-black text-sm tracking-tight shrink-0">
                        Product List
                        <span className="ml-2 text-xs font-normal text-gray-400">({products.length} item{products.length !== 1 ? "s" : ""})</span>
                      </h4>

                      {/* Search */}
                      <div className="relative flex-shrink-0">
                        <input
                          type="text"
                          placeholder="Search in products..."
                          value={productSearchQuery}
                          onChange={(e) => setProductSearchQuery(e.target.value)}
                          className="w-48 pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>

                    {/* Helper tips / Legend */}
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Click any text to edit • Check boxes to enable features</span>
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                          <span>Promo</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                          <span>Hide Price</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                          <span>Drag</span>
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* PDF Options Toolbar */}
                  <div className="flex items-center gap-2 text-xs bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-2 mb-2 overflow-x-auto">
                    {/* Visual Guide Badge */}
                    <div className="flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded shrink-0">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      PDF OPTIONS
                    </div>

                    {/* Show Discounts Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const newValue = !showDiscountColumns;
                        setConfirmDialog({
                          isOpen: true,
                          title: newValue ? 'Show Discount Columns?' : 'Hide Discount Columns?',
                          description: newValue
                            ? 'When ENABLED, your client will see detailed discount breakdown including: Discount %, Discount Amount, and Net Price after discount for each item. This provides full transparency on pricing.'
                            : 'When DISABLED, discount details will be hidden from the client view. They will only see: Product name, Quantity, Unit Price, and Total. The discount is applied but not visible.',
                          example: newValue
                            ? 'LED Bulb - Qty: 10 | Unit: ₱500 | Discount: 20% (₱100 off) | Net: ₱400 | Total: ₱4,000'
                            : 'LED Bulb - Qty: 10 | Unit: ₱400 | Total: ₱4,000 (Discount applied invisibly)',
                          onConfirm: () => {
                            setShowDiscountColumns(newValue);
                            // Sync summary discounts with column visibility (same as planner)
                            setShowSummaryDiscounts(newValue);
                            saveToHistory(newValue ? 'Show discount columns' : 'Hide discount columns');
                          },
                          onCancel: () => { },
                        });
                      }}
                      className="flex items-center gap-1.5 cursor-pointer hover:bg-blue-100/50 px-1.5 py-0.5 rounded transition-colors shrink-0"
                      title="Click for detailed explanation with examples"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showDiscountColumns ? 'bg-blue-600 border-blue-600' : 'bg-white border-blue-300'}`}>
                        {showDiscountColumns && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={`font-medium ${showDiscountColumns ? 'text-blue-700' : 'text-gray-500'}`}>
                        {showDiscountColumns ? '✓ Show Discounts' : '○ Hide Discounts'}
                      </span>
                    </button>

                    <div className="w-px h-4 bg-blue-200 shrink-0"></div>

                    {/* SRP Only PDF Toggle — checked=SRP Only (hideDiscountInPreview=true) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        const newValue = !hideDiscountInPreview;
                        setConfirmDialog({
                          isOpen: true,
                          title: newValue ? 'SRP Only PDF?' : 'Full Detail PDF?',
                          description: newValue
                            ? 'SRP ONLY mode: Your PDF will display the Suggested Retail Price (SRP) as the Unit Price. Discounts are completely hidden from view. The client sees a clean, standard price list without knowing they received special pricing.'
                            : 'FULL DETAIL mode: Your PDF will show the actual negotiated prices with discount breakdown. The client can see exactly how much discount they received per item and in total.',
                          example: newValue
                            ? 'LED Bulb - Qty: 10 | Unit: ₱500 (SRP) | Total: ₱5,000 (Client sees SRP only, discount is hidden)'
                            : 'LED Bulb - Qty: 10 | Unit: ₱400 (Nego Price) | You Saved: ₱100/item | Total: ₱4,000',
                          onConfirm: () => {
                            setHideDiscountInPreview(newValue);
                            saveToHistory(newValue ? 'SRP Only PDF mode' : 'Full Detail PDF mode');
                          },
                          onCancel: () => { },
                        });
                      }}
                      className="flex items-center gap-1.5 cursor-pointer hover:bg-purple-100/50 px-1.5 py-0.5 rounded transition-colors shrink-0"
                      title="Click for detailed explanation with examples"
                    >
                      {/* Checked = SRP Only (hideDiscountInPreview=true), Unchecked = Full Detail (hideDiscountInPreview=false) */}
                      <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${hideDiscountInPreview ? 'bg-purple-600 border-purple-600' : 'bg-white border-purple-300'}`}>
                        {hideDiscountInPreview && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={`font-medium ${hideDiscountInPreview ? 'text-purple-700' : 'text-gray-500'}`}>
                        {hideDiscountInPreview ? '✓ SRP Only PDF' : '○ Full Detail PDF'}
                      </span>
                    </button>

                    <div className="w-px h-4 bg-blue-200 shrink-0"></div>

                    {/* Show Discount Row Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const newValue = !showSummaryDiscounts;
                        setConfirmDialog({
                          isOpen: true,
                          title: newValue ? 'Show Summary Discount Row?' : 'Hide Summary Discount Row?',
                          description: newValue
                            ? 'When ENABLED, your PDF summary will include a "Less: Trade Discount" row showing the total discount amount deducted from Gross Sales. This provides a clear accounting view of the discount given.'
                            : 'When DISABLED, the discount row is hidden from the summary. The summary jumps from Gross Sales directly to Net Sales without showing the discount deduction line.',
                          example: newValue
                            ? 'Gross Sales: ₱10,000 | Less: Trade Discount: ₱2,000 | Net Sales: ₱8,000 (Clear discount breakdown shown)'
                            : 'Gross Sales: ₱10,000 | Net Sales: ₱8,000 (Discount applied but not shown as separate line)',
                          onConfirm: () => {
                            setShowSummaryDiscounts(newValue);
                            saveToHistory(newValue ? 'Show discount row' : 'Hide discount row');
                          },
                          onCancel: () => { },
                        });
                      }}
                      className="flex items-center gap-1.5 cursor-pointer hover:bg-red-100/50 px-1.5 py-0.5 rounded transition-colors shrink-0"
                      title="Click for detailed explanation with examples"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showSummaryDiscounts ? 'bg-red-600 border-red-600' : 'bg-white border-red-300'}`}>
                        {showSummaryDiscounts && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={`font-medium ${showSummaryDiscounts ? 'text-red-700' : 'text-gray-500'}`}>
                        {showSummaryDiscounts ? '✓ Show Discount Row' : '○ Hide Discount Row'}
                      </span>
                    </button>

                    <div className="w-px h-4 bg-blue-200 shrink-0"></div>

                    {/* No Alert Toggle — checked (orange) = alerts OFF = "No Alert" active */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const newValue = !showMarginAlerts;
                        setConfirmDialog({
                          isOpen: true,
                          title: newValue ? 'Enable Margin Alert?' : 'Disable Margin Alert (No Alert)?',
                          description: newValue
                            ? `Margin alerts will warn you when your profit margin drops below ${marginAlertThreshold}%. This helps protect your profitability on quotes.`
                            : 'Margin alerts will be disabled. You will no longer receive warnings when margins drop below threshold.',
                          onConfirm: () => {
                            setShowMarginAlerts(newValue);
                            saveToHistory(newValue ? 'Enable margin alerts' : 'Disable margin alerts');
                          },
                          onCancel: () => { },
                        });
                      }}
                      className="flex items-center gap-1.5 cursor-pointer hover:bg-orange-100/50 px-1.5 py-0.5 rounded transition-colors shrink-0"
                      title="Toggle margin alerts"
                    >
                      {/* Orange/checked = No Alert mode (alerts OFF). Gray/unchecked = Alerts ON */}
                      <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${!showMarginAlerts ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}>
                        {!showMarginAlerts && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={`font-medium ${!showMarginAlerts ? 'text-orange-700' : 'text-gray-400'}`}>
                        {!showMarginAlerts ? '✓ No Alert' : '○ No Alert'}
                      </span>
                    </button>

                    <div className="w-px h-4 bg-blue-200 shrink-0"></div>

                    {/* Templates Button */}
                    <button
                      type="button"
                      onClick={() => setShowTemplateModal(true)}
                      className="flex items-center gap-1 text-[10px] font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-100/50 px-1.5 py-0.5 rounded transition-colors shrink-0"
                      title="Save/Load quote templates"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 002-2h6M8 7H6a2 2 0 00-2 2v6a2 2 0 002 2h2M8 7v-2a2 2 0 002-2h2m0 5a2 2 0 002 2v2m0-4a2 2 0 002 2h2m-4 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-4a2 2 0 012-2h2m0-1a1 1 0 000-2h-1a1 1 0 01-1-1V7a1 1 0 011-1h1a1 1 0 011 1v1a1 1 0 001 1h1a1 1 0 001 1v1a2 2 0 01-2 2z" />
                      </svg>
                      Templates
                    </button>

                    {/* Undo/Redo Buttons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
                        title="Undo (Ctrl+Z)"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
                        title="Redo (Ctrl+Y)"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                        </svg>
                      </button>
                    </div>

                    {/* Bulk Mode Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setBulkMode(!bulkMode);
                        setSelectedRows(new Set());
                      }}
                      className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded transition-colors shrink-0 ${bulkMode ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      title="Enable bulk selection mode"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Bulk
                    </button>
                  </div>

                  {/* Bulk Operations Toolbar (shown when bulk mode active) */}
                  {bulkMode && selectedRows.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs bg-orange-50/50 border border-orange-200 rounded-lg px-3 py-2 mb-2">
                      <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded">
                        {selectedRows.size} selected
                      </span>
                      <div className="w-px h-4 bg-orange-200"></div>
                      <button
                        type="button"
                        onClick={() => {
                          const newProducts = products.filter((_, idx) => !selectedRows.has(idx.toString()));
                          setProducts(newProducts);
                          setSelectedRows(new Set());
                          saveToHistory('Bulk delete');
                        }}
                        className="flex items-center gap-1 text-[10px] font-medium text-red-600 hover:text-red-800 hover:bg-red-100/50 px-1.5 py-0.5 rounded transition-colors"
                        title="Delete selected rows"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const selectedIndices = Array.from(selectedRows).map(Number);
                          const selectedProducts = selectedIndices.map(idx => products[idx]);
                          const duplicatedProducts = selectedProducts.map(p => ({ ...p }));
                          setProducts([...products, ...duplicatedProducts]);
                          setSelectedRows(new Set());
                          saveToHistory('Bulk duplicate');
                        }}
                        className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100/50 px-1.5 py-0.5 rounded transition-colors"
                        title="Duplicate selected rows"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Duplicate
                      </button>
                      <div className="w-px h-4 bg-orange-200"></div>
                      <button
                        type="button"
                        onClick={copySelectedRows}
                        className="flex items-center gap-1 text-[10px] font-medium text-green-600 hover:text-green-800 hover:bg-green-100/50 px-1.5 py-0.5 rounded transition-colors"
                        title="Copy selected rows to clipboard"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={pasteFromClipboard}
                        className="flex items-center gap-1 text-[10px] font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-100/50 px-1.5 py-0.5 rounded transition-colors"
                        title="Paste from clipboard"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Paste
                      </button>
                    </div>
                  )}

                  {/* Subject + Contact Person + VAT + EWT - all in one row */}
                  <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-0 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden text-[10px]">
                    {/* Subject */}
                    <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-gray-200">
                      <span className="font-black uppercase text-red-600 tracking-wider shrink-0 text-[9px]">Subject *</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 group">
                        <input
                          type="text"
                          value={quotationSubjectState}
                          onChange={(e) => setQuotationSubjectState(e.target.value)}
                          placeholder="For Quotation"
                          className="border border-gray-200 bg-white px-2 py-0.5 rounded text-[9px] font-bold uppercase flex-1 min-w-0 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder-gray-400"
                        />
                      </div>
                    </div>
                    {/* Contact Person - with all editable fields inline */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b lg:border-b-0 lg:border-r border-gray-200">
                      <span className="font-black uppercase text-blue-600 tracking-wider shrink-0 text-[9px]">Contact Person</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="text"
                          value={contactPersonState}
                          onChange={(e) => setContactPersonState(e.target.value)}
                          placeholder="Name"
                          className="border border-gray-200 bg-white px-2 py-0.5 rounded text-[9px] font-bold uppercase flex-1 min-w-0 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder-gray-400"
                        />
                        <input
                          type="text"
                          value={contactNumberState}
                          onChange={(e) => setContactNumberState(e.target.value)}
                          placeholder="Number"
                          className="border border-gray-200 bg-white px-2 py-0.5 rounded text-[9px] w-24 shrink-0 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder-gray-400"
                        />
                        <input
                          type="text"
                          value={emailAddressState}
                          onChange={(e) => setEmailAddressState(e.target.value)}
                          placeholder="Email"
                          className="border border-gray-200 bg-white px-2 py-0.5 rounded text-[9px] w-32 shrink-0 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder-gray-400"
                        />
                      </div>
                    </div>
                    {/* VAT */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b lg:border-b-0 lg:border-r border-gray-200">
                      <span className="font-black uppercase text-gray-400 tracking-widest shrink-0 text-[9px]">VAT</span>
                      <div className="flex gap-2">
                        {[
                          { v: "vat_inc", l: "Inc", desc: "VAT Inclusive", explanation: "Price includes 12% VAT. Client sees: 'VAT Inclusive' on quote.", example: "Unit: ₱500 | VAT: ₱53.57 | Net: ₱446.43" },
                          { v: "vat_exe", l: "Exe", desc: "VAT Exempt", explanation: "No VAT charged. Common for zero-rated or exempt transactions.", example: "Unit: ₱500 | VAT: ₱0.00 | Net: ₱500.00" },
                          { v: "zero_rated", l: "0%", desc: "Zero Rated", explanation: "0% VAT rate applies. Common for export or special transactions.", example: "Unit: ₱500 | VAT: 0% | Net: ₱500.00" }
                        ].map(({ v, l, desc, explanation, example }) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => {
                              if (vatTypeState === v) return;
                              setConfirmDialog({
                                isOpen: true,
                                title: `Switch to ${desc}?`,
                                description: explanation,
                                example: example,
                                onConfirm: () => {
                                  setVatTypeState(v as "vat_inc" | "vat_exe" | "zero_rated");
                                  setDiscount(v === "vat_exe" ? 12 : 0);
                                },
                                onCancel: () => { }
                              });
                            }}
                            className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-all ${vatTypeState === v ? "text-[#121212]" : "text-gray-300 hover:text-gray-500"}`}
                          >
                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${vatTypeState === v ? "border-[#121212]" : "border-gray-300"}`}>
                              {vatTypeState === v && <div className="w-1.5 h-1.5 rounded-full bg-[#121212]" />}
                            </div>
                            <span className="font-black uppercase text-[10px]">{l}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* EWT */}
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="font-black uppercase text-gray-400 tracking-widest shrink-0 text-[9px]">EWT</span>
                      <div className="flex gap-2">
                        {[
                          { v: "none", l: "None", desc: "No EWT", explanation: "No Expanded Withholding Tax deduction applied.", example: "Gross: ₱500 | EWT: ₱0.00 | Net: ₱500.00" },
                          { v: "wht_1", l: "1%", desc: "EWT 1%", explanation: "1% withholding tax deduction for regular transactions.", example: "Gross: ₱500 | EWT: ₱5.00 | Net: ₱495.00" },
                          { v: "wht_2", l: "2%", desc: "EWT 2%", explanation: "2% withholding tax deduction for government or specified transactions.", example: "Gross: ₱500 | EWT: ₱10.00 | Net: ₱490.00" }
                        ].map(({ v, l, desc, explanation, example }) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => {
                              if (whtTypeState === v) return;
                              setConfirmDialog({
                                isOpen: true,
                                title: `Switch to ${desc}?`,
                                description: explanation,
                                example: example,
                                onConfirm: () => setWhtTypeState(v as "none" | "wht_1" | "wht_2"),
                                onCancel: () => { }
                              });
                            }}
                            className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-all ${whtTypeState === v ? "text-[#121212]" : "text-gray-300 hover:text-gray-500"}`}
                          >
                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${whtTypeState === v ? "border-[#121212]" : "border-gray-300"}`}>
                              {whtTypeState === v && <div className="w-1.5 h-1.5 rounded-full bg-[#121212]" />}
                            </div>
                            <span className="font-black uppercase text-[10px]">{l}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs table-fixed border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-[#121212] text-white text-[10px] uppercase tracking-wider">
                          {/* Drag Handle Column */}
                          <th className="border border-gray-700 p-1 text-center w-6" title="Drag to reorder">
                            <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </th>
                          {bulkMode && (
                            <th className="border border-gray-700 p-2 text-center w-8" title="Select rows for bulk operations">
                              <input
                                type="checkbox"
                                checked={selectedRows.size === products.length && products.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRows(new Set(products.map((_, idx) => idx.toString())));
                                  } else {
                                    setSelectedRows(new Set());
                                  }
                                }}
                                className="w-4 h-4 accent-blue-500"
                              />
                            </th>
                          )}
                          <th className="border border-gray-700 p-1 text-center w-6 font-bold">#</th>
                          <th className="border border-gray-700 p-1 text-center w-10">
                            <span className="font-bold">Disc</span>
                          </th>
                          <th className="border border-gray-700 p-1 text-center w-10">
                            <span className="font-bold text-yellow-400">Promo</span>
                          </th>
                          <th className="border border-gray-700 p-1 text-center w-10">
                            <span className="font-bold text-blue-400">Hide</span>
                          </th>
                          <th className="border border-gray-700 p-1 text-center w-24">
                            <span className="font-bold">Display</span>
                          </th>
                          <th className="border border-gray-700 p-1 text-left font-bold">Product</th>
                          <th className="border border-gray-700 p-1 text-center font-bold w-20">
                            <div className="flex items-center justify-center gap-1">
                              <span>Qty</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Quantity Column',
                                    description: 'The number of items or units being ordered. This multiplies by the Unit Price to calculate the line total before discounts.',
                                    example: 'Formula: Line Total = Quantity × Unit Price\n\nExample: 10 × ₱500 = ₱5,000',
                                    onConfirm: () => setConfirmDialog(null),
                                    onCancel: () => setConfirmDialog(null),
                                  });
                                }}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </th>
                          <th className="border border-gray-700 p-1 text-center font-bold w-28">
                            <div className="flex items-center justify-center gap-1">
                              <span>Unit</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Unit Price Column',
                                    description: 'The original price per item before any discounts are applied. This is the base price that clients would normally pay without any special pricing.',
                                    example: 'Formula: Unit Price = Original Product Price\n\nExample: LED Bulb = ₱500.00 per unit',
                                    onConfirm: () => setConfirmDialog(null),
                                    onCancel: () => setConfirmDialog(null),
                                  });
                                }}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </th>
                          <th className="border border-gray-700 p-1 text-center font-bold w-48">
                            <div className="flex items-center justify-center gap-1">
                              <span>Discount</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Discount Column',
                                    description: 'Shows both the discount percentage and discount amount per unit. The discount reduces the Unit Price to calculate the Net Price.',
                                    example: 'Formula: Discount Amount = Unit Price × (Discount % ÷ 100)\n\nExample: ₱500 × (20% ÷ 100) = ₱100 discount\n\nNet Price = Unit Price − Discount Amount\nNet Price = ₱500 − ₱100 = ₱400',
                                    onConfirm: () => setConfirmDialog(null),
                                    onCancel: () => setConfirmDialog(null),
                                  });
                                }}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </th>
                          <th className="border border-gray-700 p-1 text-center font-bold w-28 bg-blue-900/20">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-blue-300">Net</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Net Price Column',
                                    description: 'The price per unit after discount has been applied. This is calculated by subtracting the discount amount from the Unit Price.',
                                    example: 'Formula: Net Price = Unit Price − Discount Amount\n\nExample: ₱500 − ₱100 = ₱400 net price per unit',
                                    onConfirm: () => setConfirmDialog(null),
                                    onCancel: () => setConfirmDialog(null),
                                  });
                                }}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </th>
                          <th className="border border-gray-700 p-1 text-center font-bold w-28">
                            <div className="flex items-center justify-center gap-1">
                              <span>Total</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Total Column',
                                    description: 'The final line total after discount, calculated by multiplying Net Price by Quantity. This is the amount the client pays for this line item.',
                                    example: 'Formula: Total = Net Price × Quantity\n\nExample: ₱400 × 10 = ₱4,000 total',
                                    onConfirm: () => setConfirmDialog(null),
                                    onCancel: () => setConfirmDialog(null),
                                  });
                                }}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </th>
                          <th className="border border-gray-700 p-1 text-center font-bold w-20">Act</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.length === 0 && (
                          <tr>
                            <td colSpan={bulkMode ? 13 : 12} className="text-center p-4 text-xs text-gray-400 italic">
                              No products found.
                            </td>
                          </tr>
                        )}
                        {products
                          .filter((product) => {
                            if (!productSearchQuery.trim()) return true;
                            const query = productSearchQuery.toLowerCase();
                            const title = (product.title || product.product_title || '').toLowerCase();
                            const sku = (product.product_sku || product.skus?.[0] || '').toLowerCase();
                            return title.includes(query) || sku.includes(query);
                          })
                          .map((product, index) => {
                            const qty = product.quantity || parseFloat(product.product_quantity ?? "0") || 0;
                            const amt = product.price || parseFloat(product.product_amount ?? "0") || 0;
                            const isDiscounted = product.isDiscounted ?? false;
                            const defaultDiscount = vatTypeState === "vat_exe" ? 12 : 0;
                            const rowDiscountPct = isDiscounted
                              ? (product.discount ?? defaultDiscount)
                              : 0;
                            // Prefer explicit peso amount; fall back to % calculation
                            // discountAmount in state is always per-unit; fall back to percent-derived
                            let unitDiscountAmt = isDiscounted
                              ? (product.discountAmount != null && product.discountAmount > 0
                                ? product.discountAmount
                                : (amt * rowDiscountPct) / 100)
                              : 0;
                            const discountedUnitPrice = Math.max(0, amt - unitDiscountAmt);
                            // Round net price to 2 decimal places to match UI display and avoid floating point butal in total
                            const fixedNetPrice = parseFloat(discountedUnitPrice.toFixed(2));
                            const totalAfterDiscount = fixedNetPrice * qty;
                            return (
                              <React.Fragment key={index}>
                                <tr
                                  className={`even:bg-gray-50 align-middle cursor-move ${dragRowUid === index.toString() ? 'opacity-50' : ''} ${dragOverRowUid === index.toString() ? 'border-t-2 border-blue-500' : ''}`}
                                  draggable
                                  onDragStart={() => setDragRowUid(index.toString())}
                                  onDragEnd={() => {
                                    setDragRowUid(null);
                                    setDragOverRowUid(null);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    if (dragRowUid !== null && dragRowUid !== index.toString()) {
                                      setDragOverRowUid(index.toString());
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (dragRowUid !== null && dragRowUid !== index.toString()) {
                                      const fromIndex = parseInt(dragRowUid);
                                      const toIndex = index;
                                      const newProducts = [...products];
                                      const [movedItem] = newProducts.splice(fromIndex, 1);
                                      newProducts.splice(toIndex, 0, movedItem);
                                      setProducts(newProducts);
                                      saveToHistory('Reorder rows');
                                    }
                                    setDragRowUid(null);
                                    setDragOverRowUid(null);
                                  }}
                                >
                                  {/* Drag Handle */}
                                  <td className="border border-gray-300 p-1 text-center cursor-grab active:cursor-grabbing">
                                    <svg className="w-4 h-4 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                    </svg>
                                  </td>
                                  {/* Bulk Selection Checkbox */}
                                  {bulkMode && (
                                    <td className="border border-gray-300 p-1 text-center">
                                      <input
                                        type="checkbox"
                                        checked={selectedRows.has(index.toString())}
                                        onChange={(e) => {
                                          const newSelectedRows = new Set(selectedRows);
                                          if (e.target.checked) {
                                            newSelectedRows.add(index.toString());
                                          } else {
                                            newSelectedRows.delete(index.toString());
                                          }
                                          setSelectedRows(newSelectedRows);
                                        }}
                                        className="w-4 h-4 accent-blue-500"
                                      />
                                    </td>
                                  )}

                                  {/* Row Number */}
                                  <td className="border border-gray-300 p-1 text-center text-[10px] font-medium text-gray-500">
                                    {index + 1}
                                  </td>

                                  {/* Disc Checkbox */}
                                  <td className="border border-gray-300 p-1 text-center w-10">
                                    <input
                                      type="checkbox"
                                      checked={product.isDiscounted}
                                      onChange={(e) => {
                                        const newVal = e.target.checked;
                                        setProducts((prev) => {
                                          const copy = [...prev];
                                          const defaultDisc = vatTypeState === "vat_exe" ? 12 : 0;
                                          copy[index] = {
                                            ...copy[index],
                                            isDiscounted: newVal,
                                            discount: newVal ? defaultDisc : 0,
                                            discountAmount: newVal
                                              ? ((copy[index].price || parseFloat(copy[index].product_amount ?? "0") || 0) * defaultDisc) / 100
                                              : 0,
                                          };
                                          return copy;
                                        });
                                        saveToHistory(newVal ? 'Enable discount' : 'Disable discount');
                                      }}
                                      className="w-4 h-4 accent-blue-500"
                                    />
                                  </td>

                                  {/* Promo Checkbox */}
                                  <td className="border border-gray-300 p-1 text-center w-10">
                                    <input
                                      type="checkbox"
                                      checked={product.isPromo || false}
                                      onChange={(e) => {
                                        setProducts((prev) => {
                                          const copy = [...prev];
                                          copy[index] = { ...copy[index], isPromo: e.target.checked };
                                          return copy;
                                        });
                                      }}
                                      className="w-4 h-4 accent-yellow-500"
                                    />
                                  </td>

                                  {/* Hide Checkbox */}
                                  <td className="border border-gray-300 p-1 text-center w-10">
                                    <input
                                      type="checkbox"
                                      checked={product.isHidden || false}
                                      onChange={(e) => {
                                        setProducts((prev) => {
                                          const copy = [...prev];
                                          copy[index] = { ...copy[index], isHidden: e.target.checked };
                                          return copy;
                                        });
                                      }}
                                      className="w-4 h-4 accent-blue-400"
                                    />
                                  </td>

                                  {/* Display Mode — Select dropdown with confirmation dialog */}
                                  <td className="border border-gray-300 p-0.5 bg-purple-50/30 w-24">
                                    <Select
                                      value={product.displayMode || 'transparent'}
                                      onValueChange={(value) => {
                                        const displayLabels: Record<string, string> = {
                                          'transparent': 'Full',
                                          'net_only': 'Net Only',
                                          'value_add': 'Show Savings',
                                          'bundle': 'Bundle',
                                          'request': 'On Request'
                                        };
                                        const displayDesc: Record<string, string> = {
                                          'transparent': 'Show all pricing details: Unit Price, Discount, and Net Price. Provides complete transparency to the client.',
                                          'net_only': 'Show only the Net Price. Unit Price and Discount columns are hidden. Client sees final price only.',
                                          'value_add': 'Highlight the savings with "You Save" messaging. Shows discount value prominently to emphasize the deal.',
                                          'bundle': 'Show as bundled package pricing. Emphasizes the package deal value rather than individual item pricing.',
                                          'request': 'Display "Price Upon Request" instead of actual pricing. Use for custom quotations or variable pricing.'
                                        };
                                        setConfirmDialog({
                                          isOpen: true,
                                          title: `Change Display Mode for "${product.product_title}" to ${displayLabels[value]}?`,
                                          description: displayDesc[value],
                                          example: `${displayLabels[value]} mode: ${displayDesc[value].split('.')[0]}`,
                                          onConfirm: () => {
                                            setProducts((prev) => {
                                              const copy = [...prev];
                                              copy[index] = { ...copy[index], displayMode: value as ProductItem['displayMode'] };
                                              return copy;
                                            });
                                          },
                                          onCancel: () => { }
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="w-full text-[9px] border border-gray-300 rounded px-1 py-0 bg-white h-7 focus:ring-1 focus:ring-purple-500">
                                        <SelectValue placeholder="Full" />
                                      </SelectTrigger>
                                      <SelectContent className="min-w-[110px]">
                                        <SelectItem value="transparent" className="text-xs py-1">Full</SelectItem>
                                        <SelectItem value="net_only" className="text-xs py-1">Net Only</SelectItem>
                                        <SelectItem value="value_add" className="text-xs py-1">Savings</SelectItem>
                                        <SelectItem value="bundle" className="text-xs py-1">Bundle</SelectItem>
                                        <SelectItem value="request" className="text-xs py-1">On Request</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>

                                  {/* Product */}
                                  <td className="p-1 sm:p-2">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      {(product.product_photo || product.images?.[0]?.src) ? (
                                        <button
                                          type="button"
                                          onClick={() => openFullImage(product.product_photo || product.images?.[0]?.src || "")}
                                          className="p-0 m-0 bg-transparent border-0 cursor-pointer hover:ring-2 hover:ring-blue-400 rounded transition-all"
                                          title="Click to preview image"
                                        >
                                          <img
                                            src={product.product_photo || product.images?.[0]?.src}
                                            alt={`Product ${index + 1}`}
                                            className="w-8 h-8 sm:w-12 sm:h-12 object-contain rounded shrink-0 border border-gray-100"
                                          />
                                        </button>
                                      ) : (
                                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gray-50 border border-gray-200 rounded shrink-0 flex items-center justify-center">
                                          <span className="text-[8px] text-gray-300">IMG</span>
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        {/* Promo Badge */}
                                        {product.isPromo && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-yellow-400 text-yellow-900 shrink-0 animate-pulse mb-0.5">
                                            🏷️ PROMO
                                          </span>
                                        )}
                                        <div
                                          contentEditable
                                          suppressContentEditableWarning
                                          className="outline-none text-[10px] sm:text-xs min-w-0 break-words font-semibold"
                                          onBlur={(e) => {
                                            handleProductChange(index, "product_title", e.currentTarget.innerText);
                                          }}
                                          dangerouslySetInnerHTML={{ __html: product.product_title ?? "" }}
                                        />
                                        {(product.product_sku || product.skus?.[0]) && (
                                          <div className="text-[9px] text-blue-600 font-medium mt-0.5">
                                            ITEM CODE: {product.product_sku || product.skus?.[0]}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Qty with +/- buttons */}
                                  <td className="border border-gray-300 p-1">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        className="w-5 h-5 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-600 text-xs font-bold transition-all"
                                        onClick={() => {
                                          const currentQty = product.quantity || parseFloat(product.product_quantity ?? "1") || 1;
                                          const floor = product.procurementMinQty && product.procurementMinQty > 0 ? product.procurementMinQty : 1;
                                          const newQty = Math.max(floor, currentQty - 1);
                                          setProducts(prev => {
                                            const copy = [...prev];
                                            copy[index] = { ...copy[index], quantity: newQty, product_quantity: String(newQty) };
                                            return copy;
                                          });
                                        }}
                                        disabled={(product.quantity || parseFloat(product.product_quantity ?? "1")) <= (product.procurementMinQty || 1)}
                                      >−</button>
                                      <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={product.quantity || product.product_quantity || ""}
                                        onChange={(e) => {
                                          const raw = e.target.value;
                                          if (raw === '' || /^\d*$/.test(raw)) {
                                            const val = parseInt(raw, 10) || 1;
                                            const floor = product.procurementMinQty && product.procurementMinQty > 0 ? product.procurementMinQty : 1;
                                            const finalVal = Math.max(floor, val);
                                            setProducts(prev => {
                                              const copy = [...prev];
                                              copy[index] = { ...copy[index], quantity: finalVal, product_quantity: String(finalVal) };
                                              return copy;
                                            });
                                          }
                                        }}
                                        className="w-10 p-0 rounded-none text-xs text-center border-none shadow-none focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        className="w-5 h-5 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-600 text-xs font-bold transition-all"
                                        onClick={() => {
                                          const currentQty = product.quantity || parseFloat(product.product_quantity ?? "1") || 1;
                                          const newQty = currentQty + 1;
                                          setProducts(prev => {
                                            const copy = [...prev];
                                            copy[index] = { ...copy[index], quantity: newQty, product_quantity: String(newQty) };
                                            return copy;
                                          });
                                        }}
                                      >+</button>
                                    </div>
                                    {product.procurementMinQty != null && product.procurementMinQty > 0 && (
                                      <div className="text-[8px] text-gray-400 mt-0.5 text-center">
                                        Min: <span className="font-bold">{product.procurementMinQty}</span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Unit Price — editable, syncs price and re-derives discountAmount */}
                                  <td className="border border-gray-300 p-1">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <span className="text-[9px] text-gray-400">₱</span>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={rawInputValues[`${product.uid}-price`] ?? (product.price > 0 ? product.price.toFixed(2) : (product.product_amount || '0.00'))}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const raw = val.replace(/,/g, '');
                                          if (raw === '' || raw === '.' || /^\d+\.?\d{0,2}$/.test(raw)) {
                                            setRawInputValues(prev => ({ ...prev, [`${product.uid}-price`]: val }));
                                            const num = parseFloat(raw) || 0;
                                            const locked = product.procurementLockedPrice;
                                            const original = product.originalPrice ?? 0;
                                            const finalPrice = locked && original > 0 ? Math.max(original, num) : num;
                                            setProducts((prev) => {
                                              const copy = [...prev];
                                              const prod = copy[index];
                                              if (!prod) return prev;
                                              const newDiscAmt = prod.isDiscounted && prod.discount != null
                                                ? parseFloat(((finalPrice * prod.discount) / 100).toFixed(4))
                                                : prod.discountAmount ?? 0;
                                              copy[index] = {
                                                ...prod,
                                                price: finalPrice,
                                                product_amount: String(finalPrice),
                                                discountAmount: newDiscAmt,
                                              };
                                              return copy;
                                            });
                                          }
                                        }}
                                        onBlur={() => setRawInputValues(prev => { const c = { ...prev }; delete c[`${product.uid}-price`]; return c; })}
                                        className={`w-full min-w-[90px] p-1 rounded-none text-[10px] text-right font-medium border-gray-300 h-7 focus:outline-none ${product.procurementLockedPrice ? 'bg-gray-50 font-bold' : ''}`}
                                      />
                                    </div>
                                    {product.procurementLockedPrice && product.originalPrice != null && (
                                      <div className="text-[8px] text-orange-600 mt-0.5 text-center">
                                        Min: ₱{product.originalPrice.toFixed(2)}
                                      </div>
                                    )}
                                  </td>

                                  {/* Discount column — preset buttons + % input + ₱ input (bidirectional) */}
                                  <td className="border border-gray-300 p-1 text-center">
                                    {isDiscounted ? (
                                      <div className="flex flex-col gap-1">
                                        {/* Preset discount buttons */}
                                        <div className="flex justify-center gap-0.5">
                                          {[5, 10, 15, 20].map((pct) => (
                                            <button
                                              key={pct}
                                              type="button"
                                              onClick={() => {
                                                const price = product.price || parseFloat(product.product_amount ?? "0") || 0;
                                                setProducts((prev) => {
                                                  const copy = [...prev];
                                                  copy[index] = {
                                                    ...copy[index],
                                                    discount: pct,
                                                    discountAmount: parseFloat(((price * pct) / 100).toFixed(4)),
                                                  };
                                                  return copy;
                                                });
                                              }}
                                              className={`text-[8px] px-1 py-0.5 rounded font-bold transition-all ${rowDiscountPct === pct ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                            >
                                              {pct}%
                                            </button>
                                          ))}
                                        </div>
                                        {/* Discount % input */}
                                        <div className="flex items-center justify-center gap-1">
                                          <div className="relative">
                                            <Input
                                              type="text"
                                              inputMode="decimal"
                                              value={rawInputValues[`${product.uid}-disc`] ?? rowDiscountPct.toString()}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || val === '.' || /^\d+\.?\d{0,2}$/.test(val)) {
                                                  setRawInputValues(prev => ({ ...prev, [`${product.uid}-disc`]: val }));
                                                  const pct = Math.min(100, Math.max(0, parseFloat(val) || 0));
                                                  const price = product.price || parseFloat(product.product_amount ?? "0") || 0;
                                                  setProducts((prev) => {
                                                    const copy = [...prev];
                                                    copy[index] = {
                                                      ...copy[index],
                                                      discount: pct,
                                                      discountAmount: parseFloat(((price * pct) / 100).toFixed(4)),
                                                    };
                                                    return copy;
                                                  });
                                                }
                                              }}
                                              onBlur={() => setRawInputValues(prev => { const c = { ...prev }; delete c[`${product.uid}-disc`]; return c; })}
                                              className="w-20 p-1 pr-5 rounded-none text-[10px] text-center border-gray-300 h-7 focus:outline-none"
                                              placeholder="%"
                                            />
                                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-bold pointer-events-none">%</span>
                                          </div>
                                          <span className="text-[8px] text-gray-400">|</span>
                                          {/* Discount ₱ amount input — bidirectional */}
                                          <div className="relative">
                                            <Input
                                              type="text"
                                              inputMode="decimal"
                                              value={rawInputValues[`${product.uid}-discAmt`] ?? unitDiscountAmt.toFixed(2)}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                const raw = val.replace(/,/g, '');
                                                if (raw === '' || raw === '.' || /^\d+\.?\d{0,2}$/.test(raw)) {
                                                  setRawInputValues(prev => ({ ...prev, [`${product.uid}-discAmt`]: val }));
                                                  const amt = Math.max(0, parseFloat(raw) || 0);
                                                  const price = product.price || parseFloat(product.product_amount ?? "0") || 0;
                                                  const newPct = price > 0 ? parseFloat(((amt / price) * 100).toFixed(4)) : 0;
                                                  setProducts((prev) => {
                                                    const copy = [...prev];
                                                    copy[index] = {
                                                      ...copy[index],
                                                      discountAmount: amt,
                                                      discount: Math.min(100, newPct),
                                                    };
                                                    return copy;
                                                  });
                                                }
                                              }}
                                              onBlur={() => setRawInputValues(prev => { const c = { ...prev }; delete c[`${product.uid}-discAmt`]; return c; })}
                                              className="w-20 p-1 pr-4 rounded-none text-[10px] text-center border-gray-300 h-7 focus:outline-none"
                                              placeholder="₱"
                                            />
                                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-bold pointer-events-none">₱</span>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-gray-300">—</span>
                                    )}
                                  </td>

                                  {/* Net — editable, back-calculates discount */}
                                  <td className="border border-gray-300 p-1 text-center bg-blue-50/30">
                                    {isDiscounted ? (
                                      <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center justify-center gap-0.5">
                                          <span className="text-[9px] text-gray-400">₱</span>
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={rawInputValues[`${product.uid}-net`] ?? discountedUnitPrice.toFixed(2)}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              const raw = val.replace(/,/g, '');
                                              if (raw === '' || raw === '.' || /^\d+\.?\d{0,2}$/.test(raw)) {
                                                setRawInputValues(prev => ({ ...prev, [`${product.uid}-net`]: val }));
                                                const newNet = Math.max(0, parseFloat(raw) || 0);
                                                const price = product.price || parseFloat(product.product_amount ?? "0") || 0;
                                                if (price > 0 && newNet < price) {
                                                  const discAmt = price - newNet;
                                                  const discPct = (discAmt / price) * 100;
                                                  setProducts((prev) => {
                                                    const copy = [...prev];
                                                    copy[index] = {
                                                      ...copy[index],
                                                      isDiscounted: true,
                                                      discountAmount: parseFloat(discAmt.toFixed(4)),
                                                      discount: parseFloat(Math.min(100, Math.max(0, discPct)).toFixed(4)),
                                                    };
                                                    return copy;
                                                  });
                                                } else if (newNet >= price) {
                                                  setProducts((prev) => {
                                                    const copy = [...prev];
                                                    copy[index] = { ...copy[index], isDiscounted: false, discountAmount: 0, discount: 0 };
                                                    return copy;
                                                  });
                                                }
                                              }
                                            }}
                                            onBlur={() => setRawInputValues(prev => { const c = { ...prev }; delete c[`${product.uid}-net`]; return c; })}
                                            className="w-20 p-1 rounded-none text-[10px] text-right font-bold text-blue-700 border-gray-300 h-7 focus:outline-none"
                                            placeholder="₱"
                                          />
                                        </div>
                                        <div className="text-[8px] text-blue-600 text-center">
                                          {rowDiscountPct.toFixed(2)}% off
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-gray-300">—</span>
                                    )}
                                  </td>

                                  {/* Total — editable, back-calculates discount from total */}
                                  <td className="border border-gray-300 p-1 text-center">
                                    <div className="flex flex-col gap-0.5">
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={rawInputValues[`${product.uid}-total`] ?? totalAfterDiscount.toFixed(2)}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const raw = val.replace(/,/g, '');
                                          if (raw === '' || raw === '.' || /^\d+\.?\d{0,2}$/.test(raw)) {
                                            setRawInputValues(prev => ({ ...prev, [`${product.uid}-total`]: val }));
                                            const newTotal = Math.max(0, parseFloat(raw) || 0);
                                            const price = product.price || parseFloat(product.product_amount ?? "0") || 0;
                                            const qty = product.quantity || parseFloat(product.product_quantity ?? "0") || 0;
                                            const gross = price * qty;
                                            if (gross > 0 && newTotal <= gross && qty > 0) {
                                              const totalDiscAmt = gross - newTotal;
                                              const unitDiscAmt = totalDiscAmt / qty;
                                              const newPct = price > 0 ? (unitDiscAmt / price) * 100 : 0;
                                              setProducts((prev) => {
                                                const copy = [...prev];
                                                copy[index] = {
                                                  ...copy[index],
                                                  isDiscounted: true,
                                                  discountAmount: parseFloat(unitDiscAmt.toFixed(4)),
                                                  discount: parseFloat(Math.min(100, Math.max(0, newPct)).toFixed(4)),
                                                };
                                                return copy;
                                              });
                                            } else if (newTotal > gross && qty > 0) {
                                              // Total exceeds gross — increase unit price
                                              const newUnitPrice = newTotal / qty;
                                              setProducts((prev) => {
                                                const copy = [...prev];
                                                copy[index] = {
                                                  ...copy[index],
                                                  price: parseFloat(newUnitPrice.toFixed(4)),
                                                  product_amount: newUnitPrice.toFixed(2),
                                                  isDiscounted: false,
                                                  discount: 0,
                                                  discountAmount: 0,
                                                };
                                                return copy;
                                              });
                                            }
                                          }
                                        }}
                                        onBlur={() => setRawInputValues(prev => { const c = { ...prev }; delete c[`${product.uid}-total`]; return c; })}
                                        className="w-full min-w-[80px] p-1 rounded-none text-[10px] font-bold text-right border-gray-300 h-7 focus:outline-none"
                                        placeholder="₱"
                                      />
                                      {isDiscounted && unitDiscountAmt > 0 && !(product.isHidden || product.hideDiscountInPreview) && (
                                        <span className="text-[8px] text-green-600 font-semibold text-right whitespace-nowrap">
                                          save ₱{(unitDiscountAmt * qty).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                      )}
                                      {(product.isHidden || product.hideDiscountInPreview) && isDiscounted && (
                                        <span className="text-[8px] text-blue-500 font-semibold italic text-right whitespace-nowrap">
                                          hidden
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Actions */}
                                  <td className="border border-gray-300 text-center p-1">
                                    <div className="flex items-center justify-center gap-1">
                                      {/* Expand/Collapse PDF Controls */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedProductRows((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(index.toString())) {
                                              next.delete(index.toString());
                                            } else {
                                              next.add(index.toString());
                                            }
                                            return next;
                                          });
                                        }}
                                        className="h-6 w-6 p-0 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-all"
                                        title="Toggle PDF spacing & page break controls"
                                      >
                                        {expandedProductRows.has(index.toString()) ? (
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        ) : (
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        )}
                                      </button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleDescription(index)}
                                        className="h-6 w-6 p-0"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveRow(index)}
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                      >
                                        <Trash className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>

                                {openDescription[index] && (
                                  <tr className="even:bg-[#F9FAFA]">
                                    <td colSpan={bulkMode ? 13 : 12} className="border border-gray-300 p-4 align-top">
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Technical Description */}
                                        <div>
                                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Technical Description:</label>
                                          <div
                                            className="w-full max-h-90 overflow-auto border border-gray-200 rounded-sm bg-white p-3 text-xs leading-relaxed"
                                            dangerouslySetInnerHTML={{
                                              __html:
                                                product.description ||
                                                product.product_description ||
                                                '<span class="text-gray-400 italic">No specifications provided.</span>',
                                            }}
                                          />
                                        </div>
                                        {/* Item Remarks */}
                                        <div>
                                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Item Remarks:</label>
                                          <textarea
                                            value={product.item_remarks || ""}
                                            onChange={(e) => handleProductChange(index, "item_remarks", e.target.value)}
                                            placeholder="Enter remarks..."
                                            className="w-full h-32 resize-y border border-gray-200 rounded-sm bg-white p-3 text-xs leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                                          />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}

                                {expandedProductRows.has(index.toString()) && (
                                  <tr className="bg-blue-50/30">
                                    <td colSpan={bulkMode ? 13 : 12} className="border border-blue-200 p-3 align-top">
                                      <div className="flex flex-wrap gap-4 items-start">
                                        {/* Row spacer (between rows) */}
                                        <div className="flex flex-col gap-1">
                                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Row Spacing</p>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[8px] text-gray-500 w-20 shrink-0">Row gap</span>
                                            <button onClick={() => { 
                                              const u = [...products]; 
                                              u[index] = { ...u[index], spacerAfter: Math.max(-400, (u[index].spacerAfter ?? 0) - 10) }; 
                                              setProducts(u); 
                                            }}
                                              className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-300 text-gray-500 text-[11px] font-bold leading-none">-</button>
                                            <span className="w-10 text-center text-[9px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">
                                              {product.spacerAfter ?? 0}px
                                            </span>
                                            <button onClick={() => { 
                                              const u = [...products]; 
                                              u[index] = { ...u[index], spacerAfter: Math.min(300, (u[index].spacerAfter ?? 0) + 10) }; 
                                              setProducts(u); 
                                            }}
                                              className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-300 text-gray-500 text-[11px] font-bold leading-none">+</button>
                                            <span className="text-[7px] text-gray-400 ml-0.5">after row</span>
                                          </div>

                                          {/* Desc before spacer */}
                                          <div className="flex items-center gap-1">
                                            <span className="text-[8px] text-gray-500 w-20 shrink-0">Desc top</span>
                                            <button onClick={() => { 
                                              const u = [...products]; 
                                              u[index] = { ...u[index], descSpacerBefore: Math.max(-400, (u[index].descSpacerBefore ?? 0) - 10) }; 
                                              setProducts(u); 
                                            }}
                                              className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-300 text-gray-500 text-[11px] font-bold leading-none">-</button>
                                            <span className="w-10 text-center text-[9px] font-mono text-blue-700 bg-blue-50 border border-blue-200 rounded px-1">
                                              {product.descSpacerBefore ?? 0}px
                                            </span>
                                            <button onClick={() => { 
                                              const u = [...products]; 
                                              u[index] = { ...u[index], descSpacerBefore: Math.min(300, (u[index].descSpacerBefore ?? 0) + 10) }; 
                                              setProducts(u); 
                                            }}
                                              className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-300 text-gray-500 text-[11px] font-bold leading-none">+</button>
                                            <span className="text-[7px] text-gray-400 ml-0.5">before desc</span>
                                          </div>

                                          {/* Desc global section gaps */}
                                          <div className="flex items-center gap-1">
                                            <span className="text-[8px] text-gray-500 w-20 shrink-0">Desc gaps</span>
                                            <button onClick={() => { 
                                              const u = [...products]; 
                                              u[index] = { ...u[index], descSectionSpacing: Math.max(-400, (u[index].descSectionSpacing ?? 0) - 10) }; 
                                              setProducts(u); 
                                            }}
                                              className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-300 text-gray-500 text-[11px] font-bold leading-none">-</button>
                                            <span className="w-10 text-center text-[9px] font-mono text-purple-700 bg-purple-50 border border-purple-200 rounded px-1">
                                              {product.descSectionSpacing ?? 0}px
                                            </span>
                                            <button onClick={() => { 
                                              const u = [...products]; 
                                              u[index] = { ...u[index], descSectionSpacing: Math.min(300, (u[index].descSectionSpacing ?? 0) + 10) }; 
                                              setProducts(u); 
                                            }}
                                              className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-300 text-gray-500 text-[11px] font-bold leading-none">+</button>
                                            <span className="text-[7px] text-gray-400 ml-0.5">btw sections</span>
                                          </div>

                                          {/* Desc after spacer */}
                                          <div className="flex items-center gap-1">
                                            <span className="text-[8px] text-gray-500 w-20 shrink-0">Desc bottom</span>
                                            <button onClick={() => { 
                                              const u = [...products]; 
                                              u[index] = { ...u[index], descSpacerAfter: Math.max(-400, (u[index].descSpacerAfter ?? 0) - 10) }; 
                                              setProducts(u); 
                                            }}
                                              className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-300 text-gray-500 text-[11px] font-bold leading-none">-</button>
                                            <span className="w-10 text-center text-[9px] font-mono text-green-700 bg-green-50 border border-green-200 rounded px-1">
                                              {product.descSpacerAfter ?? 0}px
                                            </span>
                                            <button onClick={() => { 
                                              const u = [...products]; 
                                              u[index] = { ...u[index], descSpacerAfter: Math.min(300, (u[index].descSpacerAfter ?? 0) + 10) }; 
                                              setProducts(u); 
                                            }}
                                              className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-300 text-gray-500 text-[11px] font-bold leading-none">+</button>
                                            <span className="text-[7px] text-gray-400 ml-0.5">after desc</span>
                                          </div>
                                        </div>

                                        {/* Per-section spacing & page breaks */}
                                        <div className="flex flex-col gap-2">
                                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Per‑Section Controls</p>
                                          {(() => {
                                            const sections = parseDescriptionIntoSections(product.product_description || product.description);
                                            const currentSpacings = product.sectionSpacings || [];
                                            
                                            return (
                                              <div className="flex flex-col gap-2">
                                                {sections.map((section, sIdx) => {
                                                  // Extract section name for display
                                                  let sectionName = `Section ${sIdx + 1}`;
                                                  const headerMatch = section.match(/background\s*:\s*#121212[^>]*>([^<]+)</);
                                                  if (headerMatch && headerMatch[1]) {
                                                    sectionName = headerMatch[1].trim();
                                                  }
                                                  
                                                  const spacing = currentSpacings[sIdx] ?? 0;
                                                  
                                                  return (
                                                    <div key={sIdx} className="bg-white border border-gray-200 rounded p-2 flex flex-col gap-1">
                                                      <div className="flex items-center justify-between">
                                                        <span className="text-[8px] font-medium text-gray-700 truncate flex-1">
                                                          {sectionName.slice(0, 30)}{sectionName.length > 30 ? '...' : ''}
                                                        </span>
                                                        {sIdx > 0 && (
                                                          <button
                                                            onClick={() => {
                                                              const u = [...products];
                                                              const newPageBreaks = [...(u[index].sectionPageBreaks || [])];
                                                              newPageBreaks[sIdx] = !newPageBreaks[sIdx];
                                                              u[index] = { ...u[index], sectionPageBreaks: newPageBreaks };
                                                              setProducts(u);
                                                            }}
                                                            className={`ml-1 px-1.5 py-0.5 text-[6px] font-bold uppercase border rounded transition-colors
                                                              ${(product.sectionPageBreaks?.[sIdx])
                                                                ? 'bg-blue-500 border-blue-500 text-white'
                                                                : 'bg-white border-gray-300 text-gray-500 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600'
                                                              }`}
                                                          >
                                                            {(product.sectionPageBreaks?.[sIdx]) ? 'PB ON' : 'PB'}
                                                          </button>
                                                        )}
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                        <button
                                                          onClick={() => {
                                                            const u = [...products];
                                                            const newSpacings = [...(u[index].sectionSpacings || [])];
                                                            newSpacings[sIdx] = Math.max(-400, (newSpacings[sIdx] ?? 0) - 5);
                                                            u[index] = { ...u[index], sectionSpacings: newSpacings };
                                                            setProducts(u);
                                                          }}
                                                          className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-300 text-gray-500 text-[10px] font-bold leading-none"
                                                        >-</button>
                                                        <span className="w-8 text-center text-[8px] font-mono text-cyan-700 bg-cyan-50 border border-cyan-200 rounded px-1">
                                                          {spacing}px
                                                        </span>
                                                        <button
                                                          onClick={() => {
                                                            const u = [...products];
                                                            const newSpacings = [...(u[index].sectionSpacings || [])];
                                                            newSpacings[sIdx] = Math.min(200, (newSpacings[sIdx] ?? 0) + 5);
                                                            u[index] = { ...u[index], sectionSpacings: newSpacings };
                                                            setProducts(u);
                                                          }}
                                                          className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-300 text-gray-500 text-[10px] font-bold leading-none"
                                                        >+</button>
                                                        <span className="text-[7px] text-gray-400 ml-0.5">space after</span>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        {/* Page break before item */}
                                        <div className="flex flex-col gap-2">
                                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Page Breaks</p>
                                          {index > 0 && (
                                            <button
                                              onClick={() => {
                                                const u = [...products];
                                                u[index] = { ...u[index], pageBreakBefore: !u[index].pageBreakBefore };
                                                setProducts(u);
                                              }}
                                              className={`px-3 py-1.5 text-[8px] font-bold uppercase border rounded transition-colors
                                                ${product.pageBreakBefore
                                                  ? 'bg-red-500 border-red-500 text-white'
                                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-red-50 hover:border-red-400 hover:text-red-600'
                                                }`}
                                            >
                                              {product.pageBreakBefore ? '❌ Remove Page Break' : '✓ Force Page Break'}
                                            </button>
                                          )}

                                          {/* Clear button */}
                                          <button
                                            onClick={() => {
                                              const u = [...products];
                                              u[index] = {
                                                ...u[index],
                                                pageBreakBefore: false,
                                                spacerAfter: 0,
                                                descSpacerAfter: 0,
                                                descSpacerBefore: 0,
                                                descSectionSpacing: 0,
                                                sectionSpacings: [],
                                                sectionPageBreaks: [],
                                              };
                                              setProducts(u);
                                            }}
                                            className="px-3 py-1.5 text-[8px] font-semibold border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                          >
                                            Clear
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                      <tfoot className="bg-gray-100 font-bold text-xs">
                        <tr>
                          {/* Drag Handle */}
                          <td className="border border-gray-300 p-2"></td>
                          {/* Row Number */}
                          <td className="border border-gray-300 p-2"></td>
                          {/* Disc, Promo, Hide, Display checkboxes - 4 empty cells */}
                          <td className="border border-gray-300 p-2"></td>
                          <td className="border border-gray-300 p-2"></td>
                          <td className="border border-gray-300 p-2"></td>
                          <td className="border border-gray-300 p-2"></td>
                          {/* Product */}
                          <td className="border border-gray-300 p-2"></td>
                          {/* Qty total */}
                          <td className="border border-gray-300 p-2 text-center font-black">
                            {products.reduce((acc, p) => acc + (parseFloat(p.product_quantity ?? "0") || 0), 0)}
                          </td>
                          {/* Unit price total */}
                          <td className="border border-gray-300 p-2 text-center font-black">
                            {products.reduce((acc, p) => acc + (parseFloat(p.product_amount ?? "0") || 0), 0).toFixed(2)}
                          </td>
                          {/* Discount - empty */}
                          <td className="border border-gray-300 p-2"></td>
                          {/* Net total */}
                          <td className="border border-gray-300 p-2 text-center font-black">
                            ₱{products.reduce((acc, p) => {
                              const qty = parseFloat(p.product_quantity ?? "0") || 0;
                              const amt = parseFloat(p.product_amount ?? "0") || 0;
                              // discountAmount in state is always per-unit
                              let unitDiscountAmt = p.isDiscounted ? (p.discountAmount ?? (amt * (p.discount ?? 0)) / 100) : 0;
                              const discountedUnitPrice = Math.max(0, amt - unitDiscountAmt);
                              // Fix: Use 2-decimal rounded net price for total
                              const fixedNetPrice = parseFloat(discountedUnitPrice.toFixed(2));
                              return acc + (fixedNetPrice * qty);
                            }, 0).toFixed(2)}
                          </td>
                          {/* Total */}
                          <td className="border border-gray-300 p-2 text-center font-black">
                            ₱{products.reduce((acc, p) => {
                              const qty = parseFloat(p.product_quantity ?? "0") || 0;
                              const amt = parseFloat(p.product_amount ?? "0") || 0;
                              // discountAmount in state is always per-unit
                              let unitDiscountAmt = p.isDiscounted ? (p.discountAmount ?? (amt * (p.discount ?? 0)) / 100) : 0;
                              const discountedUnitPrice = Math.max(0, amt - unitDiscountAmt);
                              // Fix: Use 2-decimal rounded net price for total
                              const fixedNetPrice = parseFloat(discountedUnitPrice.toFixed(2));
                              return acc + (fixedNetPrice * qty);
                            }, 0).toFixed(2)}
                          </td>
                          {/* Actions */}
                          <td className="border border-gray-300 p-2"></td>
                        </tr>

                        {/* Delivery & Restocking Fee — desktop inside table */}
                        <tr className="hidden sm:table-row">
                          <td colSpan={8} className="border border-gray-300 p-2"></td>
                          <td colSpan={4} className="border border-gray-300 p-2">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs whitespace-nowrap font-bold">Delivery Fee:</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  className="w-24 text-center border border-gray-300 rounded-none px-2 py-1 text-xs"
                                  placeholder="0.00"
                                  value={deliveryFeeState}
                                  onChange={(e) => setDeliveryFeeState(e.target.value)}
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs whitespace-nowrap font-bold">Restocking Fee:</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  className="w-24 text-center border border-gray-300 rounded-none px-2 py-1 text-xs"
                                  placeholder="0.00"
                                  value={restockingFeeState}
                                  onChange={(e) => setRestockingFeeState(e.target.value)}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="border border-gray-300 p-2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Delivery & Restocking Fee — mobile only */}
                  <div className="sm:hidden border border-gray-200 bg-gray-50 p-3 mt-1">
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-200">
                      <span className="text-xs font-bold uppercase text-gray-600">Delivery Fee</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="w-28 text-right border border-gray-300 rounded-none px-2 py-1 text-xs bg-white"
                        placeholder="0.00"
                        value={deliveryFeeState}
                        onChange={(e) => setDeliveryFeeState(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-xs font-bold uppercase text-gray-600">Restocking Fee</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="w-28 text-right border border-gray-300 rounded-none px-2 py-1 text-xs bg-white"
                        placeholder="0.00"
                        value={restockingFeeState}
                        onChange={(e) => setRestockingFeeState(e.target.value)}
                      />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>{/* end BODY */}

          {/* Note bar */}
          <div className="text-[10px] text-red-500 text-center italic px-3 py-1.5 bg-red-50 border-t border-red-200 shrink-0">
            ⚠️ Quotation Number only appears on the final downloaded quotation.
          </div>

          <DialogFooter className="flex flex-col gap-2 pl-8 pr-5 py-3 sm:pl-10 sm:pr-6 border-t border-gray-200 shrink-0 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex gap-2 w-full sm:w-auto flex-wrap p-2 items-center justify-end">
              {/* Review Button */}
              <Button
                className="flex-1 lg:flex-none bg-[#121212] rounded-none hover:bg-black text-white flex gap-2 items-center h-12 px-6"
                onClick={() => setIsPreviewOpen(true)}
              >
                <Eye className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Review Quotation</span>
              </Button>

              {((ApprovedStatus === "Approved" || ApprovedStatus === "Approved By Sales Head" || ApprovedStatus === "APPROVED" || ApprovedStatus === "Approved By Manager") && !hasChanges && !isUsingOwnerName) && (
                <>
                  <Button
                    type="button"
                    onClick={() => {
                      setPdfPreviewOpen(true);
                      // Auto-generate preview after dialog is fully rendered and states are stable
                      setTimeout(() => generatePreview(), 300);
                    }}
                    className="rounded-none h-12 px-6 bg-yellow-600 flex items-center gap-2"
                  >
                    <FileText /> PDF
                  </Button>

                  {/* <Button
                    type="button"
                    onClick={DownloadExcel}
                    className="rounded-none h-12 px-6 bg-green-600 flex items-center gap-2"
                  >
                    <FileSpreadsheet /> Excel
                  </Button> */}
                </>
              )}

              <Button variant="outline" className="rounded-none h-12 px-6 border-2" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={onClickSave} className="rounded-none h-12 px-6">
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onSave={performSave}
      />

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white shadow-2xl"
          style={{ maxWidth: "950px", width: "100vw" }}
        >
          <div className="sr-only">
            <DialogTitle>Official Quotation Protocol Preview</DialogTitle>
            <DialogDescription>
              Validated engineering export protocol.
            </DialogDescription>
          </div>
          <Preview
            key={`${loadedAgentName}-${loadedTsmName}-${loadedManagerName}-${item.quotation_number}`}
            payload={getQuotationPayload()}
            quotationType={item.quotation_type}
            setIsPreviewOpen={setIsPreviewOpen}
            hideDiscountInPreview={hideDiscountInPreview}
            showDiscountColumns={showDiscountColumns}
            showSummaryDiscounts={showSummaryDiscounts}
            showProfitMargins={showProfitMargins}
            marginAlertThreshold={marginAlertThreshold}
            showMarginAlerts={showMarginAlerts}
            productViewMode={productViewMode}
            visibleColumns={visibleColumns}
            approvedStatus={ApprovedStatus}
            hasChanges={hasUnsavedChanges()}
          />
        </DialogContent>
      </Dialog>

      {/* PDF Live Preview Dialog */}
      <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
        <DialogContent className="p-0 border-none bg-gray-100 shadow-2xl overflow-hidden flex flex-col" style={{width: '98vw', height: '98vh', maxWidth: '98vw', maxHeight: '98vh'}}>
          <DialogHeader className="px-4 py-2 border-b bg-white shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-bold uppercase tracking-wider">PDF Live Preview</DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Adjust settings and update preview before downloading
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar — settings */}
            <div className="w-[240px] shrink-0 bg-gray-50 border-r overflow-y-auto flex flex-col">
              {/* Sidebar Header */}
              <div className="bg-white border-b px-4 py-3">
                <h3 className="text-sm font-bold text-gray-800 tracking-wide uppercase">PDF Preview Settings</h3>
              </div>
              
              {/* Auto Refresh Toggle */}
              <div className="bg-white border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Auto Refresh</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="auto-refresh"
                      checked={pdfAutoRefresh}
                      onChange={(e) => setPdfAutoRefresh(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="auto-refresh" className="text-xs text-gray-600 font-medium">
                      {pdfAutoRefresh ? "Enabled" : "Disabled"}
                    </label>
                  </div>
                </div>
              </div>

              {/* PDF Format Option */}
              <div className="bg-white border-b px-4 py-3">
                <label className="text-xs font-semibold text-gray-700 mb-2 block">PDF Format</label>
                <RadioGroup
                  value={pdfOption}
                  onValueChange={(value) => setPdfOption(value as "with-discount" | "default-only")}
                  className="flex flex-col gap-2"
                >
                  <div className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-xs ${pdfOption === "with-discount" ? "bg-blue-50 border border-blue-200" : "bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300"}`}>
                    <RadioGroupItem value="with-discount" id="prev-with-discount" />
                    <label htmlFor="prev-with-discount" className="flex-1 cursor-pointer">
                      <span className="font-semibold text-gray-800">With Discount</span>
                      <span className="block text-[10px] text-gray-500">Include discount % and discounted price columns</span>
                    </label>
                  </div>
                  <div className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-xs ${pdfOption === "default-only" ? "bg-blue-50 border border-blue-200" : "bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300"}`}>
                    <RadioGroupItem value="default-only" id="prev-default-only" />
                    <label htmlFor="prev-default-only" className="flex-1 cursor-pointer">
                      <span className="font-semibold text-gray-800">Default Only</span>
                      <span className="block text-[10px] text-gray-500">No discount columns - clean standard format</span>
                    </label>
                  </div>
                </RadioGroup>
              </div>

              {/* Page Break Buffer Adjustment */}
              <div className="bg-white border-b px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Page Break Buffer</label>
                    <p className="text-[10px] text-gray-500 mt-0.5">↑ Later break · ↓ Earlier break</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPdfBreakBuffer(v => Math.max(-100, v - 5))}
                      className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-400 text-gray-600 hover:text-red-600 font-bold text-sm leading-none transition-colors"
                      title="Earlier break"
                    >-</button>
                    <input
                      type="number"
                      value={pdfBreakBuffer}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (val >= -100 && val <= 100) setPdfBreakBuffer(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "ArrowUp") {
                          e.preventDefault();
                          setPdfBreakBuffer(v => Math.min(100, v + 5));
                        } else if (e.key === "Delete" || e.key === "ArrowDown") {
                          e.preventDefault();
                          setPdfBreakBuffer(v => Math.max(-100, v - 5));
                        }
                      }}
                      className="w-14 px-1 py-0.5 text-[10px] border border-gray-300 rounded text-center focus:border-blue-400 focus:outline-none"
                      min="-100"
                      max="100"
                    />
                    <button
                      onClick={() => setPdfBreakBuffer(v => Math.min(100, v + 5))}
                      className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-400 text-gray-600 hover:text-green-600 font-bold text-sm leading-none transition-colors"
                      title="Later break"
                    >+</button>
                    <span className="text-[10px] text-gray-500">px</span>
                  </div>
                </div>
                <Slider
                  value={[pdfBreakBuffer]}
                  onValueChange={(v) => setPdfBreakBuffer(v[0])}
                  min={-100}
                  max={100}
                  step={2}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>Earlier (-100)</span>
                  <button onClick={() => setPdfBreakBuffer(-70)} className="text-blue-500 hover:text-blue-600 underline">Reset</button>
                  <span>Later (+100)</span>
                </div>
              </div>

              {/* Continuation Gap */}
              <div className="bg-white border-b px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Continuation Gap</label>
                    <p className="text-[10px] text-gray-500 mt-0.5">↑ More space · ↓ Tighter</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPdfContHeaderGap(v => Math.max(-500, v - 20))}
                      className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-400 text-gray-600 hover:text-red-600 font-bold text-sm leading-none transition-colors"
                      title="Tighter"
                    >-</button>
                    <input
                      type="number"
                      value={pdfContHeaderGap}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (val >= -500 && val <= 500) setPdfContHeaderGap(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "ArrowUp") {
                          e.preventDefault();
                          setPdfContHeaderGap(v => Math.min(500, v + 20));
                        } else if (e.key === "Delete" || e.key === "ArrowDown") {
                          e.preventDefault();
                          setPdfContHeaderGap(v => Math.max(-500, v - 20));
                        }
                      }}
                      className="w-14 px-1 py-0.5 text-[10px] border border-gray-300 rounded text-center focus:border-blue-400 focus:outline-none"
                      min="-500"
                      max="500"
                    />
                    <button
                      onClick={() => setPdfContHeaderGap(v => Math.min(500, v + 20))}
                      className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-400 text-gray-600 hover:text-green-600 font-bold text-sm leading-none transition-colors"
                      title="More space"
                    >+</button>
                    <span className="text-[10px] text-gray-500">px</span>
                  </div>
                </div>
                <Slider
                  value={[pdfContHeaderGap]}
                  onValueChange={(v) => setPdfContHeaderGap(v[0])}
                  min={-500}
                  max={500}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>Tighter (-500)</span>
                  <button onClick={() => setPdfContHeaderGap(-85)} className="text-blue-500 hover:text-blue-600 underline">Reset</button>
                  <span>More space (+500)</span>
                </div>
              </div>


                            {/* Action Buttons */}
              <div className="border-t pt-3 mt-auto space-y-2">
                <Button
                  onClick={() => generatePreview()}
                  disabled={pdfPreviewLoading || isGeneratingPdf}
                  variant="outline"
                  className="rounded-none w-full h-10 text-xs"
                >
                  {pdfPreviewLoading ? (
                    <>
                      <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3.7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 mr-1" />
                      Update Preview
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setPdfPreviewOpen(false);
                    DownloadPDF(pdfOption === "with-discount", showSummaryDiscounts, pdfBreakBuffer, pdfContHeaderGap, 'save');
                  }}
                  disabled={isGeneratingPdf}
                  className="rounded-none w-full h-10 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>

            {/* Center area — iframe preview */}
            <div className="flex-1 bg-gray-100 relative overflow-hidden">
              {pdfPreviewLoading && !pdfPreviewUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                  <div className="flex flex-col items-center gap-4">
                    <svg className="animate-spin h-12 w-12 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-lg text-gray-700 font-semibold">Generating PDF Preview...</span>
                    <p className="text-sm text-gray-500">Please wait while we render your quotation</p>
                  </div>
                </div>
              )}
              {pdfPreviewUrl ? (
                <div className="w-full h-full bg-white">
                  <iframe
                    src={pdfPreviewUrl}
                    className="w-full h-full border-0 bg-white"
                    title="PDF Preview"
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-white">
                  <div className="text-center p-8">
                    <FileText className="w-20 h-20 mx-auto mb-4 opacity-30" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">PDF Preview Ready</h3>
                    <p className="text-base text-gray-500 mb-4">Click "Update Preview" to generate your quotation</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <Eye className="w-5 h-5 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-700">Preview will appear here</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right panel — Row Controls */}
            <div className="w-[260px] shrink-0 bg-white border-l flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b bg-gray-50 shrink-0">
                <p className="text-[11px] font-bold uppercase text-gray-700 tracking-wide">Row Controls</p>
                <p className="text-[9px] text-gray-400 mt-0.5">Adjust spacing & page breaks per item</p>
              </div>

              {/* Legend */}
              <div className="px-3 py-2 border-b bg-gray-50 shrink-0">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[8px] text-gray-500">
                  <span><span className="font-bold text-blue-500">P</span> = page break before</span>
                  <span><span className="font-bold text-amber-500">↕</span> = row spacer (gap after row)</span>
                  <span><span className="font-bold text-purple-600">T</span> = desc top (space before desc)</span>
                  <span><span className="font-bold text-orange-600">G</span> = desc gaps (between sections)</span>
                  <span><span className="font-bold text-green-600">B</span> = desc bottom (space after desc)</span>
                  <span><span className="font-bold text-red-400">Del</span> = clear all on row</span>
                </div>
              </div>

              {/* Per-item rows list */}
              <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-2">
                {products.map((product, idx) => (
                  <div
                    key={product.uid || idx}
                    className={`rounded border text-[10px] transition-colors
                      ${product.pageBreakBefore ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}
                  >
                    {/* Row header */}
                    <div
                      className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer select-none"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (idx === 0) return;
                          const u = [...products];
                          u[idx] = { ...u[idx], pageBreakBefore: !u[idx].pageBreakBefore, spacerAfter: 0 };
                          setProducts(u);
                        } else if (e.key === 'Delete' || e.key === 'Backspace') {
                          e.preventDefault();
                          const u = [...products];
                          u[idx] = { ...u[idx], pageBreakBefore: false, spacerAfter: 0, descSpacerAfter: 0, descSpacerBefore: 0, descSectionSpacing: 0, sectionSpacings: [] };
                          setProducts(u);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const u = [...products];
                          u[idx] = { ...u[idx], spacerAfter: Math.min(300, (u[idx].spacerAfter ?? 0) + 10) };
                          setProducts(u);
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const u = [...products];
                          u[idx] = { ...u[idx], spacerAfter: Math.max(0, (u[idx].spacerAfter ?? 0) - 10) };
                          setProducts(u);
                        }
                      }}
                    >
                      <span className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold
                        ${product.pageBreakBefore ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate text-gray-700 font-medium text-[9px]" title={product.product_title ?? product.title}>
                        {(product.product_title ?? product.title ?? 'Item').slice(0, 22)}
                      </span>
                      {product.pageBreakBefore && idx > 0 && (
                        <span className="shrink-0 text-[7px] bg-blue-100 text-blue-600 font-bold px-1 rounded">PB</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedSections(prev => ({
                            ...prev,
                            [product.uid || idx]: !prev[product.uid || idx]
                          }));
                        }}
                        className="shrink-0 w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-600 text-[9px]"
                      >
                        {expandedSections[product.uid || idx] ? '▼' : '▶'}
                      </button>
                    </div>

                    {/* Description preview */}
                    {(product.product_description || product.description) && (
                      <div className="px-2 py-1 border-t border-gray-100 bg-gray-50">
                        <div 
                          className="text-[7px] text-gray-600 line-clamp-3 overflow-hidden"
                          dangerouslySetInnerHTML={{ 
                            __html: (product.product_description || product.description || '')
                              .replace(/<[^>]*>/g, '') 
                              .slice(0, 150)
                          }}
                        />
                      </div>
                    )}

                    {/* Expandable per-section controls */}
                    {expandedSections[product.uid || idx] && (product.product_description || product.description) && (
                      <div className="border-t border-gray-200 bg-gray-50 px-2 py-2">
                        <p className="text-[8px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Section Spacing</p>
                        {(() => {
                          const sections = parseDescriptionIntoSections(product.product_description || product.description);
                          const currentSpacings = product.sectionSpacings || [];
                          
                          return sections.map((section, sIdx) => {
                            // Extract section name for display
                            let sectionName = `Section ${sIdx + 1}`;
                            const headerMatch = section.match(/background\s*:\s*#121212[^>]*>([^<]+)</);
                            if (headerMatch && headerMatch[1]) {
                              sectionName = headerMatch[1].trim();
                            }
                            
                            const spacing = currentSpacings[sIdx] ?? 0;
                            
                            return (
                              <div key={sIdx} className="mb-2 last:mb-0">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[7px] text-gray-600 truncate flex-1" title={sectionName}>
                                    {sectionName.slice(0, 25)}
                                    {sectionName.length > 25 ? '...' : ''}
                                  </p>
                                  {sIdx > 0 && (
                                    <button
                                      onClick={() => {
                                        const u = [...products];
                                        const newPageBreaks = [...(u[idx].sectionPageBreaks || [])];
                                        newPageBreaks[sIdx] = !newPageBreaks[sIdx];
                                        u[idx] = { ...u[idx], sectionPageBreaks: newPageBreaks };
                                        setProducts(u);
                                      }}
                                      className={`ml-1 px-1.5 py-0.5 text-[6px] font-bold uppercase border rounded transition-colors
                                        ${(product.sectionPageBreaks?.[sIdx])
                                          ? 'bg-blue-500 border-blue-500 text-white'
                                          : 'bg-white border-gray-300 text-gray-500 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600'
                                        }`}
                                    >
                                      {(product.sectionPageBreaks?.[sIdx]) ? 'PB ON' : 'PB'}
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      const u = [...products];
                                      const newSpacings = [...(u[idx].sectionSpacings || [])];
                                      newSpacings[sIdx] = Math.max(-400, (newSpacings[sIdx] ?? 0) - 5);
                                      u[idx] = { ...u[idx], sectionSpacings: newSpacings };
                                      setProducts(u);
                                    }}
                                    className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-300 text-gray-500 text-[10px] font-bold leading-none"
                                  >-</button>
                                  <span className="w-8 text-center text-[8px] font-mono text-cyan-700 bg-cyan-50 border border-cyan-200 rounded px-1">
                                    {spacing}px
                                  </span>
                                  <button
                                    onClick={() => {
                                      const u = [...products];
                                      const newSpacings = [...(u[idx].sectionSpacings || [])];
                                      newSpacings[sIdx] = Math.min(200, (newSpacings[sIdx] ?? 0) + 5);
                                      u[idx] = { ...u[idx], sectionSpacings: newSpacings };
                                      setProducts(u);
                                    }}
                                    className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-300 text-gray-500 text-[10px] font-bold leading-none"
                                  >+</button>
                                  <span className="text-[6px] text-gray-400 ml-0.5">space after</span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}

                    {/* Controls row */}
                    <div className="border-t border-gray-100 px-2 py-1.5 flex flex-col gap-1.5">

                      {/* Row spacer (between rows) */}
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-gray-500 w-20 shrink-0">Row gap</span>
                        <button onClick={() => { const u=[...products]; u[idx]={...u[idx],spacerAfter:Math.max(-400,(u[idx].spacerAfter??0)-10)}; setProducts(u); }}
                          className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-300 text-gray-500 text-[11px] font-bold leading-none">-</button>
                        <span className="w-10 text-center text-[9px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">
                          {product.spacerAfter ?? 0}px
                        </span>
                        <button onClick={() => { const u=[...products]; u[idx]={...u[idx],spacerAfter:Math.min(300,(u[idx].spacerAfter??0)+10)}; setProducts(u); }}
                          className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-300 text-gray-500 text-[11px] font-bold leading-none">+</button>
                        <span className="text-[7px] text-gray-400 ml-0.5">↕ space after row</span>
                      </div>

                      {/* Desc before spacer */}
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-gray-500 w-20 shrink-0">Desc top</span>
                        <button onClick={() => { const u=[...products]; u[idx]={...u[idx],descSpacerBefore:Math.max(-400,(u[idx].descSpacerBefore??0)-10)}; setProducts(u); }}
                          className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-300 text-gray-500 text-[11px] font-bold leading-none">-</button>
                        <span className="w-10 text-center text-[9px] font-mono text-purple-700 bg-purple-50 border border-purple-200 rounded px-1">
                          {product.descSpacerBefore ?? 0}px
                        </span>
                        <button onClick={() => { const u=[...products]; u[idx]={...u[idx],descSpacerBefore:Math.min(400,(u[idx].descSpacerBefore??0)+10)}; setProducts(u); }}
                          className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-300 text-gray-500 text-[11px] font-bold leading-none">+</button>
                        <span className="text-[7px] text-gray-400 ml-0.5">before desc</span>
                      </div>

                      {/* Desc section spacing */}
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-gray-500 w-20 shrink-0">Desc gaps</span>
                        <button onClick={() => { const u=[...products]; u[idx]={...u[idx],descSectionSpacing:Math.max(-400,(u[idx].descSectionSpacing??0)-10)}; setProducts(u); }}
                          className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-300 text-gray-500 text-[11px] font-bold leading-none">-</button>
                        <span className="w-10 text-center text-[9px] font-mono text-orange-700 bg-orange-50 border border-orange-200 rounded px-1">
                          {product.descSectionSpacing ?? 0}px
                        </span>
                        <button onClick={() => { const u=[...products]; u[idx]={...u[idx],descSectionSpacing:Math.min(400,(u[idx].descSectionSpacing??0)+10)}; setProducts(u); }}
                          className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-300 text-gray-500 text-[11px] font-bold leading-none">+</button>
                        <span className="text-[7px] text-gray-400 ml-0.5">btw sections</span>
                      </div>

                      {/* Desc after spacer */}
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-gray-500 w-20 shrink-0">Desc bottom</span>
                        <button onClick={() => { const u=[...products]; u[idx]={...u[idx],descSpacerAfter:Math.max(-400,(u[idx].descSpacerAfter??0)-10)}; setProducts(u); }}
                          className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-red-50 hover:border-red-300 text-gray-500 text-[11px] font-bold leading-none">-</button>
                        <span className="w-10 text-center text-[9px] font-mono text-green-700 bg-green-50 border border-green-200 rounded px-1">
                          {product.descSpacerAfter ?? 0}px
                        </span>
                        <button onClick={() => { const u=[...products]; u[idx]={...u[idx],descSpacerAfter:Math.min(400,(u[idx].descSpacerAfter??0)+10)}; setProducts(u); }}
                          className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-green-50 hover:border-green-300 text-gray-500 text-[11px] font-bold leading-none">+</button>
                        <span className="text-[7px] text-gray-400 ml-0.5">after desc</span>
                      </div>

                      {/* Page break + clear */}
                      <div className="flex items-center gap-1">
                        {idx > 0 && (
                          <button
                            onClick={() => { const u=[...products]; u[idx]={...u[idx],pageBreakBefore:!u[idx].pageBreakBefore,spacerAfter:0}; setProducts(u); }}
                            className={`flex-1 h-5 flex items-center justify-center border rounded text-[8px] font-bold transition-colors
                              ${product.pageBreakBefore
                                ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600'}`}
                          >
                            {product.pageBreakBefore ? '❌ Remove Page Break' : '↵ Force Page Break'}
                          </button>
                        )}
                        <button
                          onClick={() => { const u=[...products]; u[idx]={...u[idx],pageBreakBefore:false,spacerAfter:0,descSpacerAfter:0,descSpacerBefore:0,descSectionSpacing:0,sectionSpacings:[],sectionPageBreaks:[]}; setProducts(u); }}
                          className="h-5 px-2 flex items-center justify-center border border-gray-200 rounded text-[8px] text-red-400 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                        >Clear</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom actions */}
              <div className="px-3 py-2 border-t bg-gray-50 shrink-0 flex justify-between items-center">
                <span className="text-[8px] text-gray-400">Enter=page break � ↑↓=row gap</span>
                <button
                  onClick={() => setProducts(products.map(p => ({ ...p, pageBreakBefore: false, spacerAfter: 0, descSpacerAfter: 0, descSpacerBefore: 0, descSectionSpacing: 0, sectionSpacings: [], sectionPageBreaks: [] })))}
                  className="text-[8px] text-red-400 hover:text-red-600 underline"
                >Clear all</button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quotation Lookup Dialog */}
      {/* ── IT MASTER PASSWORD DIALOG (Debug Mode Gate) ──────────────────── */}
      <Dialog open={debugPasswordDialogOpen} onOpenChange={(open) => {
        if (!open) { setDebugPasswordDialogOpen(false); setDebugPasswordInput(""); setDebugPasswordError(""); }
      }}>
        <DialogContent className="max-w-[380px] w-[90vw] p-6 border-none bg-[#0f0f0f] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              IT Debug Access
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              This mode is restricted to IT personnel only. Enter the master password to proceed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">IT Master Password</label>
              <input
                type="password"
                value={debugPasswordInput}
                onChange={(e) => { setDebugPasswordInput(e.target.value); setDebugPasswordError(""); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDebugPasswordSubmit(); }}
                placeholder="Enter master password"
                className="bg-[#1a1a1a] border border-gray-700 text-white rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-gray-600"
                autoFocus
              />
              {debugPasswordError && (
                <p className="text-red-400 text-[11px] font-bold flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {debugPasswordError}
                </p>
              )}
            </div>
            <p className="text-[10px] text-gray-600 italic">⌨ Press Enter or click Authenticate</p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setDebugPasswordDialogOpen(false); setDebugPasswordInput(""); setDebugPasswordError(""); }}
              className="rounded-none flex-1 border-gray-700 text-gray-400 hover:bg-gray-800 bg-transparent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDebugPasswordSubmit}
              disabled={!debugPasswordInput.trim()}
              className="rounded-none flex-1 bg-red-700 hover:bg-red-800 text-white font-black disabled:opacity-40"
            >
              Authenticate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lookupDialogOpen} onOpenChange={setLookupDialogOpen}>
        <DialogContent className="max-w-[400px] w-[90vw] p-6 border-none bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold uppercase tracking-wider">Load Quotation</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Enter quotation number to load its data (Ctrl+K)
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="quotation-number-input" className="text-sm font-bold uppercase text-gray-700">
                Quotation Number
              </label>
              <input
                id="quotation-number-input"
                type="text"
                value={lookupQuotationNumber}
                onChange={(e) => setLookupQuotationNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLookupQuotation();
                  }
                }}
                placeholder="e.g., QT-2024-001"
                className="border border-gray-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                disabled={isLookingUp}
                autoFocus
              />
              {lookupError && (
                <div className="text-red-500 text-xs font-bold">{lookupError}</div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setLookupDialogOpen(false)}
              disabled={isLookingUp}
              className="rounded-none flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLookupQuotation}
              disabled={isLookingUp || !lookupQuotationNumber.trim()}
              className="rounded-none flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 disabled:cursor-not-allowed"
            >
              {isLookingUp ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                "Load Quotation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SPF Detail View Dialog */}
      <Dialog open={showSpfDetailView} onOpenChange={setShowSpfDetailView}>
        <DialogContent
          className="p-0 overflow-hidden"
          style={{
            maxWidth: "1280px",
            width: "100%",
            borderRadius: "2px",
            border: "1px solid #d1d5db",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ background: "#f8f7f4", maxHeight: "calc(100vh - 60px)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              {/* LEFT — SPF Form */}
              <div style={{ flex: "0 0 490px", minWidth: 0 }}>
                <div style={{ background: "#fff", margin: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
                  {/* Letterhead */}
                  <div style={{ borderBottom: "3px solid #1f2937", padding: "16px 22px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "15px", fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1f2937", lineHeight: 1 }}>SPF Form</div>
                      <div style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.1em", color: "#6b7280", marginTop: "4px", textTransform: "uppercase" }}>Internal Document · For Approval</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#1f2937", padding: "4px 10px" }}>
                        <FileText style={{ width: "10px", height: "10px", color: "#f9fafb" }} />
                        <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "10px", color: "#f9fafb", fontWeight: 700 }}>{spfDetailOffers[0]?.spf_number || "SPF-PENDING"}</span>
                      </div>
                      <div style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", color: "#9ca3af", marginTop: "5px" }}>{new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div style={{ background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", padding: "5px 22px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Status:</span>
                    <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#065f46", fontWeight: 700, background: "#d1fae5", padding: "2px 8px", border: "1px solid #6ee7b7" }}>
                      Ready for Quotation
                    </span>
                  </div>

                  <div style={{ padding: "14px 18px 18px", overflowY: "auto", maxHeight: "70vh" }}>
                    {/* 01 Customer Info */}
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ background: "#1f2937", padding: "5px 12px", marginBottom: "10px" }}>
                        <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#f9fafb", fontWeight: 700 }}>01 · Customer Information</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px 14px", padding: "0 2px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Customer Name</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.customer_name ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.customer_name || "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Contact Person</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.contact_name ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.contact_name || "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Contact Number</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.contact_number ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.contact_number || "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>TIN Number</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.tin_no ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.tin_no || "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5", gridColumn: "span 2" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Registered Address</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.registered_address ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.registered_address || "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 02 Order Terms */}
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ background: "#1f2937", padding: "5px 12px", marginBottom: "10px" }}>
                        <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#f9fafb", fontWeight: 700 }}>02 · Order Terms</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px 14px", padding: "0 2px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Payment Terms</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.payment_terms ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.payment_terms || "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Warranty</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.warranty ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.warranty || "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Delivery Date</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.delivery_date ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.delivery_date ? new Date(spfDetailOffers[0].delivery_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5", gridColumn: "span 2" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Special Instructions</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.special_instructions ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.special_instructions || "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 03 Items */}
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ background: "#1f2937", padding: "5px 12px", marginBottom: "10px" }}>
                        <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#f9fafb", fontWeight: 700 }}>03 · Items ({spfDetailOffers[0]?.item_description?.split(",").length || 0})</span>
                      </div>
                      {(!spfDetailOffers[0]?.item_description || spfDetailOffers[0].item_description.split(",").length === 0) ? (
                        <div style={{ border: "1.5px dashed #d1d5db", padding: "18px", textAlign: "center" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "10px", color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" }}>No items on record</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 2px" }}>
                          {spfDetailOffers[0]?.item_description?.split(",").map((desc: string, i: number) => {
                            const photos = spfDetailOffers[0]?.item_photo?.split(",") || [];
                            return (
                              <div key={i} style={{ border: "1px solid #e5e7eb", display: "grid", gridTemplateColumns: "76px 1fr" }}>
                                <div style={{ background: "#f3f4f6", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 6px", gap: "5px" }}>
                                  <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "7px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700 }}>Item</span>
                                  <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "18px", fontWeight: 900, color: "#374151", lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</span>
                                  {photos[i] ? (
                                    <>
                                      <div
                                        style={{ width: "50px", height: "50px", border: "1px solid #d1d5db", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                                        onClick={() => openFullImage(photos[i])}
                                      >
                                        <img src={photos[i]} alt={`Item ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                      </div>
                                      <button
                                        onClick={() => openFullImage(photos[i])}
                                        style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "7px", color: "#1e3a8a", background: "#dbeafe", padding: "2px 6px", border: "1px solid #93c5fd", cursor: "pointer", fontWeight: 600 }}
                                      >
                                        View Full
                                      </button>
                                    </>
                                  ) : (
                                    <div style={{ width: "50px", height: "50px", border: "1.5px dashed #d1d5db", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <span style={{ fontSize: "7px", color: "#d1d5db", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", textTransform: "uppercase" }}>No Photo</span>
                                    </div>
                                  )}
                                </div>
                                <div style={{ padding: "9px 10px" }}>
                                  <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "7.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700, display: "block", marginBottom: "4px" }}>Description</span>
                                  <p
                                    style={{
                                      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                                      fontSize: "11px",
                                      color: desc ? "#111827" : "#9ca3af",
                                      margin: 0,
                                      whiteSpace: "pre-line",
                                    }}
                                  >
                                    {(desc || "No description provided.")
                                      .replace(/([A-Za-z ]+:\s*)/g, "\n$1")
                                      .trim()}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 04 Signatories */}
                    <div>
                      <div style={{ background: "#1f2937", padding: "5px 12px", marginBottom: "10px" }}>
                        <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#f9fafb", fontWeight: 700 }}>04 · Signatories</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", padding: "0 2px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Sales Person</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.sales_person ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.sales_person || "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Prepared By</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.prepared_by ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.prepared_by || "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5" }}>
                          <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Approved By</span>
                          <div style={{ borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: spfDetailOffers[0]?.approved_by ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
                            {spfDetailOffers[0]?.approved_by || "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb", padding: "6px 18px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "8px", color: "#d1d5db", letterSpacing: "0.08em", textTransform: "uppercase" }}>Confidential · Internal Use Only</span>
                    <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "8px", color: "#d1d5db" }}>{spfDetailOffers[0]?.spf_number || "—"}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT — Product Offers */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ background: "#fff", margin: "16px 16px 16px 0", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", height: "calc(100% - 32px)" }}>
                  <div style={{ borderBottom: "3px solid #1e3a8a", padding: "16px 20px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
                    <div>
                      <div style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "13px", fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e3a8a", lineHeight: 1 }}>Product Offers</div>
                      <div style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", letterSpacing: "0.1em", color: "#6b7280", marginTop: "3px", textTransform: "uppercase" }}>Procurement Results</div>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#1e3a8a", padding: "4px 10px" }}>
                      <Package style={{ width: "10px", height: "10px", color: "#93c5fd" }} />
                      <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "10px", color: "#bfdbfe", fontWeight: 700, letterSpacing: "0.08em" }}>
                        {spfDetailOffers.length} Offer{spfDetailOffers.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
                    {spfDetailOffers.length === 0 ? (
                      <div style={{ border: "1.5px dashed #dbeafe", padding: "28px", textAlign: "center" }}>
                        <Package style={{ width: "26px", height: "26px", color: "#bfdbfe", margin: "0 auto 8px" }} />
                        <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "10px", color: "#93c5fd", letterSpacing: "0.08em", textTransform: "uppercase" }}>No offers recorded yet</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {spfDetailOffers.map((offer, oi) => {
                          const offerRows = parseOfferRows(offer);
                          const totalProducts = offerRows.reduce((sum, r) => sum + r.length, 0);
                          return (
                            <div key={offer.id} style={{ border: "1px solid #e2e8f0", overflow: "hidden" }}>
                              <div style={{ background: "#1e3a8a", padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                  <Building2 style={{ width: "11px", height: "11px", color: "#93c5fd", flexShrink: 0 }} />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "8px", color: "#93c5fd", background: "rgba(255,255,255,0.1)", padding: "2px 7px", border: "1px solid rgba(147,197,253,0.3)" }}>
                                    {offerRows.length} row{offerRows.length !== 1 ? "s" : ""} · {totalProducts} product{totalProducts !== 1 ? "s" : ""}
                                  </span>
                                  <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "10px", color: "#60a5fa", fontWeight: 900 }}>{String(oi + 1).padStart(2, "0")}</span>
                                </div>
                              </div>

                              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                {offerRows.map((rowProducts, ri) => (
                                  <div key={ri}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px" }}>
                                      <div style={{ background: "#1e3a8a", padding: "2px 8px" }}>
                                        <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "7.5px", color: "#bfdbfe", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Item Row {ri + 1}</span>
                                      </div>
                                      <div style={{ flex: 1, height: "1px", background: "#dbeafe" }} />
                                      <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "7.5px", color: "#93c5fd" }}>{rowProducts.length} variant{rowProducts.length !== 1 ? "s" : ""}</span>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: rowProducts.length > 1 ? `repeat(${Math.min(rowProducts.length, 2)}, 1fr)` : "1fr", gap: "8px" }}>
                                      {rowProducts.map((prod, pi) => (
                                        <div key={pi} style={{ border: "1px solid #e5e7eb", overflow: "hidden" }}>
                                          <div style={{ background: "#f0f9ff", borderBottom: "1px solid #dbeafe", padding: "4px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "7.5px", color: "#1e40af", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Variant {pi + 1}</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                              {prod.image ? (
                                                <>
                                                  <div
                                                    style={{ width: "32px", height: "32px", border: "1px solid #bfdbfe", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                                                    onClick={() => openFullImage(prod.image)}
                                                  >
                                                    <img src={prod.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                                  </div>
                                                  <button
                                                    onClick={() => openFullImage(prod.image)}
                                                    style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "7px", color: "#1e40af", background: "#dbeafe", padding: "2px 6px", border: "1px solid #93c5fd", cursor: "pointer", fontWeight: 600 }}
                                                  >
                                                    View
                                                  </button>
                                                </>
                                              ) : (
                                                <div style={{ width: "32px", height: "32px", border: "1.5px dashed #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                  <span style={{ fontSize: "6px", color: "#bfdbfe", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", textTransform: "uppercase" }}>No Img</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid #e5e7eb" }}>
                                            {[
                                              { label: "Item Code", value: prod.item_code },
                                              { label: "Lead Time", value: prod.lead_time },
                                              { label: "Selling Cost", value: prod.final_selling },
                                              { label: "Qty", value: prod.qty },
                                            ].map(({ label, value }, mi) => (
                                              <div key={mi} style={{ padding: "4px 8px", borderRight: mi < 3 ? "1px solid #e5e7eb" : "none" }}>
                                                <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "7px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700, display: "block", marginBottom: "2px" }}>{label}</span>
                                                <span style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "9px", color: "#374151" }}>{value || "—"}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Screenshot Prevention: Content-hiding overlay */}
          {isContentHidden && (
            <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center pointer-events-auto">
              <div className="text-center">
                <div className="text-4xl mb-2">🔒</div>
                <div className="text-gray-500 font-semibold text-lg">Content Protected</div>
                <div className="text-gray-400 text-sm mt-1">Screenshot functionality detected</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Image Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-w-4xl p-0 border-none bg-transparent shadow-2xl">
          {fullImageUrl && (
            <img src={fullImageUrl} alt="Full size" className="w-full h-auto object-contain" />
          )}
        </DialogContent>
      </Dialog>

      {/* Templates Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-sm font-black uppercase tracking-widest">Quote Templates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Template name..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={saveTemplate}
                size="sm"
              >
                Save Current
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {savedTemplates.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No templates saved yet</p>
              ) : (
                savedTemplates.map((template, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{template.name}</p>
                      <p className="text-xs text-gray-500">{template.products.length} items</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadTemplate(template)}
                      >
                        Load
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSavedTemplates(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog — rich toggle confirmation (mirrors quotation.tsx) */}
      <Dialog open={!!confirmDialog?.isOpen} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-xl border border-gray-200 shadow-2xl [&>button]:hidden">
          {/* Header - Blue like planner */}
          <div className="bg-blue-600 px-5 py-4 flex items-center justify-between">
            <DialogTitle className="text-white text-sm font-black uppercase tracking-widest leading-tight flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {confirmDialog?.title}
            </DialogTitle>
            <button
              type="button"
              onClick={() => setConfirmDialog(null)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            <p className="text-xs text-gray-600 leading-relaxed">
              {confirmDialog?.description}
            </p>

            {/* Visual Example Preview - VAT/EWT/Zero-Rated style like planner */}
            {(confirmDialog?.title?.toLowerCase().includes('vat') || confirmDialog?.title?.toLowerCase().includes('ewt') || confirmDialog?.title?.toLowerCase().includes('zero')) && (
              <div className="overflow-hidden rounded-lg border-2 border-yellow-300 bg-gradient-to-b from-yellow-50 to-white">
                {/* Example Label */}
                <div className="bg-yellow-100 px-3 py-1.5 border-b border-yellow-200">
                  <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Example Preview
                  </p>
                </div>

                {/* VAT Type Indicator */}
                <div className="px-3 py-2 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Tax Type:</span>
                    <div className="flex gap-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${confirmDialog?.title?.toLowerCase().includes('vat inc') ? 'bg-yellow-400 text-yellow-900 font-bold' : 'bg-gray-100 text-gray-400'}`}>VAT INC</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${confirmDialog?.title?.toLowerCase().includes('vat exe') || confirmDialog?.title?.toLowerCase().includes('exempt') ? 'bg-yellow-400 text-yellow-900 font-bold' : 'bg-gray-100 text-gray-400'}`}>VAT EXE</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${confirmDialog?.title?.toLowerCase().includes('zero') ? 'bg-yellow-400 text-yellow-900 font-bold' : 'bg-gray-100 text-gray-400'}`}>ZERO-RATED</span>
                    </div>
                  </div>

                  {/* Mini Invoice Preview */}
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-500">Net Sales (Non-VAT):</span>
                      <span className="font-mono font-medium">₱100,000.00</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-500">Delivery Charge:</span>
                      <span className="font-mono font-medium">₱0.00</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-500">Restocking Fee:</span>
                      <span className="font-mono font-medium">₱0.00</span>
                    </div>
                    <div className="border-t border-gray-200 my-1"></div>
                    <div className="flex justify-between py-0.5">
                      <span className="font-bold text-gray-700">Total Invoice Amount:</span>
                      <span className="font-mono font-bold">₱100,000.00</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-[9px]">
                      <span className="text-gray-400">Tax Status:</span>
                      <span className="font-bold text-yellow-600">{confirmDialog?.title?.replace('Switch to ', '').replace('?', '')}</span>
                    </div>
                    <div className="bg-gray-900 text-white p-2 rounded mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] uppercase tracking-wider">Total Amount Due:</span>
                        <span className="font-mono font-bold text-sm">₱100,000.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {confirmDialog?.example && !confirmDialog?.title?.toLowerCase().includes('vat') && !confirmDialog?.title?.toLowerCase().includes('ewt') && !confirmDialog?.title?.toLowerCase().includes('zero') && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Example</p>
                <p className="text-[11px] text-gray-700 font-mono leading-snug whitespace-pre-line">{confirmDialog?.example}</p>
              </div>
            )}

            {/* Discount Example Preview */}
            {(confirmDialog?.title?.toLowerCase().includes('discount') && !confirmDialog?.title?.toLowerCase().includes('summary') && !confirmDialog?.title?.toLowerCase().includes('row')) && (
              <div className="overflow-hidden rounded border border-yellow-200">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-[#121212] text-white">
                      <th className="px-2 py-1 text-left font-bold">Product</th>
                      <th className="px-2 py-1 text-right font-bold">Qty</th>
                      <th className="px-2 py-1 text-right font-bold">Unit</th>
                      {confirmDialog?.title?.toLowerCase().includes('show') && <th className="px-2 py-1 text-right font-bold text-yellow-400">Disc%</th>}
                      {confirmDialog?.title?.toLowerCase().includes('show') && <th className="px-2 py-1 text-right font-bold text-yellow-400">Net</th>}
                      <th className="px-2 py-1 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="px-2 py-1 font-medium">LED Bulb</td>
                      <td className="px-2 py-1 text-right">10</td>
                      <td className="px-2 py-1 text-right">₱500</td>
                      {confirmDialog?.title?.toLowerCase().includes('show') && <td className="px-2 py-1 text-right text-yellow-700 font-bold">20%</td>}
                      {confirmDialog?.title?.toLowerCase().includes('show') && <td className="px-2 py-1 text-right text-blue-700 font-bold">₱400</td>}
                      <td className="px-2 py-1 text-right font-bold">₱{confirmDialog?.title?.toLowerCase().includes('show') ? '4,000' : '5,000'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary Discount Row Preview */}
            {confirmDialog?.title?.toLowerCase().includes('summary') && (
              <div className="overflow-hidden rounded border border-yellow-200">
                <table className="w-full text-[10px] border-collapse">
                  <tbody>
                    <tr className="bg-white border-b border-yellow-100">
                      <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[8px]">Gross Sales</td>
                      <td className="px-2 py-1 text-right font-bold">₱10,000.00</td>
                    </tr>
                    {confirmDialog?.title?.toLowerCase().includes('show') && (
                      <tr className="bg-yellow-50 border-b border-yellow-200">
                        <td className="px-2 py-1 text-right font-bold uppercase text-yellow-700 text-[8px]">Less: Trade Discount</td>
                        <td className="px-2 py-1 text-right font-bold text-yellow-700">−₱2,000.00</td>
                      </tr>
                    )}
                    <tr className="bg-gray-900 text-white">
                      <td className="px-2 py-1.5 text-right font-black uppercase text-[9px]">Net Sales</td>
                      <td className="px-2 py-1.5 text-right font-black text-[11px]">₱8,000.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Display Mode Preview */}
            {confirmDialog?.title?.toLowerCase().includes('display mode') && (
              <div className="overflow-hidden rounded-lg border-2 border-purple-300 bg-gradient-to-b from-purple-50 to-white">
                {/* Example Label */}
                <div className="bg-purple-100 px-3 py-1.5 border-b border-purple-200">
                  <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Example Preview
                  </p>
                </div>

                <div className="px-3 py-2 bg-white">
                  {/* Display Mode Indicator */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Display Mode:</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-400 text-white font-bold">
                      {confirmDialog?.title?.includes('Net Only') ? 'NET ONLY' :
                        confirmDialog?.title?.includes('Full') ? 'FULL' :
                          confirmDialog?.title?.includes('Savings') ? 'SAVINGS' :
                            confirmDialog?.title?.includes('Bundle') ? 'BUNDLE' :
                              confirmDialog?.title?.includes('On Request') ? 'ON REQUEST' : 'CUSTOM'}
                    </span>
                  </div>

                  {/* Product Table Preview */}
                  <div className="overflow-hidden rounded border border-gray-200">
                    <table className="w-full text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-[#121212] text-white">
                          <th className="px-2 py-1 text-left font-bold">Product</th>
                          {confirmDialog?.title?.includes('Net Only') ? (
                            <>
                              <th className="px-2 py-1 text-right font-bold bg-purple-900/40 text-purple-200">Net Price</th>
                              <th className="px-2 py-1 text-right font-bold">Total</th>
                            </>
                          ) : confirmDialog?.title?.includes('On Request') ? (
                            <th className="px-2 py-1 text-center font-bold bg-purple-900/40 text-purple-200" colSpan={2}>Price</th>
                          ) : (
                            <>
                              <th className="px-2 py-1 text-right font-bold">Unit</th>
                              {confirmDialog?.title?.includes('Savings') && <th className="px-2 py-1 text-right font-bold text-green-400">You Save</th>}
                              <th className="px-2 py-1 text-right font-bold bg-purple-900/40 text-purple-200">Net</th>
                              <th className="px-2 py-1 text-right font-bold">Total</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          <td className="px-2 py-1 font-medium">BOLLARD FIXTURE E27</td>
                          {confirmDialog?.title?.includes('Net Only') ? (
                            <>
                              <td className="px-2 py-1 text-right text-purple-700 font-bold">₱400.00</td>
                              <td className="px-2 py-1 text-right font-bold">₱4,000.00</td>
                            </>
                          ) : confirmDialog?.title?.includes('On Request') ? (
                            <td className="px-2 py-1 text-center text-purple-700 font-bold italic" colSpan={2}>Price Upon Request</td>
                          ) : (
                            <>
                              <td className="px-2 py-1 text-right">₱500.00</td>
                              {confirmDialog?.title?.includes('Savings') && <td className="px-2 py-1 text-right text-green-600 font-bold">₱100.00</td>}
                              <td className="px-2 py-1 text-right text-purple-700 font-bold">₱400.00</td>
                              <td className="px-2 py-1 text-right font-bold">₱4,000.00</td>
                            </>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Client View Note */}
                  <div className="mt-2 text-[9px] text-purple-600 italic">
                    {confirmDialog?.title?.includes('Net Only') && 'Client sees: Only final net price, unit price hidden'}
                    {confirmDialog?.title?.includes('Full') && 'Client sees: All pricing details including unit price, discount, and net price'}
                    {confirmDialog?.title?.includes('Savings') && 'Client sees: Emphasized savings amount with "You Save" messaging'}
                    {confirmDialog?.title?.includes('Bundle') && 'Client sees: Package deal pricing, individual items de-emphasized'}
                    {confirmDialog?.title?.includes('On Request') && 'Client sees: "Price Upon Request" - contact for pricing'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                confirmDialog?.onCancel();
                setTimeout(() => setConfirmDialog(null), 50);
              }}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                confirmDialog?.onConfirm();
                setTimeout(() => setConfirmDialog(null), 50);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm"
            >
              Confirm & Apply
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── PREMIUM TOAST NOTIFICATION ──────────────────────────────────────── */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`group flex items-center gap-4 pl-2 pr-4 py-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md border ${toast.type === 'success'
              ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/95 border-white/20 text-white'
              : 'bg-gradient-to-r from-rose-500/95 to-red-500/95 border-white/20 text-white'
            }`}>
            {/* Icon with glass effect */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${toast.type === 'success'
                ? 'bg-white/20 backdrop-blur-sm'
                : 'bg-white/20 backdrop-blur-sm'
              }`}>
              {toast.type === 'success' ? (
                <svg className="w-6 h-6 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            {/* Message */}
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm tracking-wide uppercase ${toast.type === 'success' ? 'text-emerald-50' : 'text-rose-50'
                }`}>
                {toast.type === 'success' ? 'Success' : 'Error'}
              </p>
              <p className="text-white/95 text-sm font-medium truncate">{toast.message}</p>
            </div>

            {/* Close button */}
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── IMAGE PREVIEW DIALOG ─────────────────────────────────────────────── */}
      {isImageDialogOpen && fullImageUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
          onClick={() => setIsImageDialogOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            <button
              onClick={() => setIsImageDialogOpen(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={fullImageUrl}
              alt="Product Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}
