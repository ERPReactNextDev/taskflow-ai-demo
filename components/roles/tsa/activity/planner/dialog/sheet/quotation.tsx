"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { sileo } from "sileo";
import { Separator } from "@/components/ui/separator"
import { Trash, Download, ImagePlus, Plus, RefreshCcw, Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle2Icon, XCircle, X, HelpCircle, PanelLeft, Info } from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import {
  buildSearchContext,
  executeSingleQuery,
  matchesSearchText,
  resolveVariantSelection,
} from "./quotation-search-utils";

interface SupervisorDetails {
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  profilePicture: string | null;
  signatureImage: string | null;
  contact: string | null;
}

interface Props {
  step: number;
  setStep: (step: number) => void;
  source: string;
  setSource: (v: string) => void;
  productCat: string; // JSON string of selected products with qty and price
  setProductCat: (v: string) => void;
  productQuantity: string;
  setProductQuantity: (v: string) => void;
  productAmount: string;
  setProductAmount: (v: string) => void;
  productDescription: string;
  setProductDescription: (v: string) => void;
  productPhoto: string;
  setProductPhoto: (v: string) => void;
  productSku: string; // comma separated SKUs
  setProductSku: (v: string) => void;
  productTitle: string; // comma separated titles
  setProductTitle: (v: string) => void;
  productDiscountedPrice: string; // comma separated discount percentages
  setProductDiscountedPrice: (v: string) => void;
  productDiscountedAmount: string; // comma separated calculated discount amounts
  setProductDiscountedAmount: (v: string) => void;
  productIsPromo: string; // comma separated "1"/"0" flags
  setProductIsPromo: (v: string) => void;
  productIsHidden: string; // comma separated "1"/"0" flags
  setProductIsHidden: (v: string) => void;
  productRowDisplayMode: string; // comma separated "full"/"compact" values
  setProductRowDisplayMode: (v: string) => void;
  projectType: string;
  setProjectType: (v: string) => void;
  projectName: string;
  setProjectName: (v: string) => void;
  quotationNumber: string;
  setQuotationNumber: (v: string) => void;
  quotationAmount: string;
  setQuotationAmount: (v: string) => void;
  quotationType: string;
  setQuotationType: (v: string) => void;
  //quotationStatus: string;
  //setQuotationStatus: (v: string) => void;
  callType: string;
  setCallType: (v: string) => void;
  followUpDate: string;
  setFollowUpDate: (v: string) => void;
  remarks: string;
  setRemarks: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  tsm: string;
  setTSM: (v: string) => void;
  typeClient: string;
  setTypeClient: (value: string) => void;

  // --- TAX & LOGISTICS UPDATED ---
  vatType: string;         // e.g., "vat_inc", "vat_exe", "zero_rated"
  setVatType: (value: string) => void;
  whtType: string;         // e.g., "none", "wht_1", "wht_2"
  setWhtType: (value: string) => void;
  deliveryFee: string;
  setDeliveryFee: (value: string) => void;
  deliveryAddress?: string;
  setDeliveryAddress?: (value: string) => void;
  restockingFee: string;
  setRestockingFee: (value: string) => void;
  itemRemarks: string;
  setItemRemarks: (value: string) => void;
  quotationSubject: string;
  setQuotationSubject: (value: string) => void;
  tsmApprovalStatus: string;
  setTsmApprovalStatus: (value: string) => void;

  // --- ACTIONS ---
  handleBack: () => void;
  handleNext: () => void;
  handleSave: () => void;

  // --- USER & CLIENT DATA ---
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
  managername: string;
  company_name: string;
  address: string;
  contact_number: string;
  email_address: string;
  contact_person: string;

  // --- AVAILABLE CONTACTS (for dropdown selection) ---
  availableContacts?: Array<{
    name: string;
    contact_number: string;
    email_address: string;
  }>;

  // --- CONTACT SETTERS (for local edits) ---
  setContactPerson?: (value: string) => void;
  setContactNumber?: (value: string) => void;
  setEmailAddress?: (value: string) => void;

  // --- SUPERVISOR & TRACEABILITY ---
  salesManagerContact?: string;
  salesManagerEmail?: string;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
  signature: string | null;

  /** Logged-in TSA cluster id — SPF 1 list is filtered to this user's requests when set */
  referenceid?: string;

  // --- QUOTATION DISPLAY CONFIGURATION ---
  hideDiscountInPreview?: boolean;
  setHideDiscountInPreview?: (value: boolean) => void;
  showDiscountColumns?: boolean;
  setShowDiscountColumns?: (value: boolean) => void;
  showSummaryDiscounts?: boolean;
  setShowSummaryDiscounts?: (value: boolean) => void;
  showProfitMargins?: boolean;
  setShowProfitMargins?: (value: boolean) => void;
  marginAlertThreshold?: number;
  setMarginAlertThreshold?: (value: number) => void;
  showMarginAlerts?: boolean;
  setShowMarginAlerts?: (value: boolean) => void;
  productViewMode?: string;
  setProductViewMode?: (value: string) => void;
  visibleColumns?: any;
  setVisibleColumns?: (value: any) => void;
}

const Quotation_SOURCES = [
  { label: "Existing Client", description: "Clients with active accounts or previous transactions.", },
  { label: "CSR Endorsement", description: "Customer Service Representative inquiries.", },
  { label: "Government", description: "Calls coming from government agencies.", },
  { label: "Philgeps Website", description: "Inquiries from Philgeps online platform.", },
  { label: "Philgeps", description: "Other Philgeps related contacts.", },
  { label: "Distributor", description: "Calls from product distributors or resellers.", },
  { label: "Modern Trade", description: "Contacts from retail or modern trade partners.", },
  { label: "Facebook Marketplace", description: "Leads or inquiries from Facebook Marketplace.", },
  { label: "Walk-in Showroom", description: "Visitors physically coming to showroom.", },
];

interface Product {
  id: string | number;
  title: string;
  description?: string;
  itemRemarks?: string;
  brand?: string;
  itemCodes?: Record<string, string>;
  itemCodeVariants?: Array<{
    label: string;
    code: string;
  }>;
  requiresItemCodeSelection?: boolean;
  images?: Array<{
    src: string;
  }>;
  skus?: string[];
  price?: number;
  regPrice?: number;
  discount?: number;
}

const normalizeItemCodeVariants = (
  rawItemCodes: unknown,
  fallbackItemCode?: string | null
): Array<{ label: string; code: string }> => {
  const variants: Array<{ label: string; code: string }> = [];

  const pushVariant = (rawLabel: unknown, rawCode: unknown, indexHint: number) => {
    const code = String(rawCode ?? "").trim();
    if (!code) return;

    const label = String(rawLabel ?? "").trim() || `CODE ${indexHint + 1}`;
    const exists = variants.some((v) => v.code.toUpperCase() === code.toUpperCase());
    if (exists) return;

    variants.push({
      label: label.toUpperCase(),
      code,
    });
  };

  if (rawItemCodes && typeof rawItemCodes === "object" && !Array.isArray(rawItemCodes)) {
    Object.entries(rawItemCodes as Record<string, unknown>).forEach(([label, code], index) => {
      pushVariant(label, code, index);
    });
  } else if (Array.isArray(rawItemCodes)) {
    rawItemCodes.forEach((entry, index) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const obj = entry as Record<string, unknown>;
        pushVariant(obj.label ?? obj.brand ?? `CODE ${index + 1}`, obj.code ?? obj.itemCode ?? obj.value, index);
      } else {
        pushVariant(`CODE ${index + 1}`, entry, index);
      }
    });
  } else if (typeof rawItemCodes === "string" && rawItemCodes.trim().length > 0) {
    const text = rawItemCodes.trim();
    try {
      const parsed = JSON.parse(text);
      return normalizeItemCodeVariants(parsed, fallbackItemCode);
    } catch {
      text
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((code, index) => pushVariant(`CODE ${index + 1}`, code, index));
    }
  }

  if (variants.length === 0 && fallbackItemCode && fallbackItemCode.trim().length > 0) {
    pushVariant("DEFAULT", fallbackItemCode.trim(), 0);
  }

  return variants;
};

interface SelectedProduct extends Product {
  uid: string;
  quantity: number;
  price: number;
  discount: number;           // discount as percentage (0-100)
  discountAmount?: number;    // discount as peso amount per unit (synced with discount %)
  isDiscounted?: boolean;
  isPromo?: boolean;          // promo flag — shows "PROMO" badge on quotation
  isHidden?: boolean;        // hidden price flag
  rowDisplayMode?: 'full' | 'compact'; // display mode for product row (full/compact)
  hideDiscountInPreview?: boolean; // hide discount details in preview - shows as "Special Price"
  cloudinaryPublicId?: string;
  /** Minimum order qty from PD/procurement — sales may enter equal or higher */
  procurementMinQty?: number;
  procurementLeadTime?: string;
  procurementLockedPrice?: boolean;
  originalPrice?: number;
  procurementItemCode?: string;
  regPrice?: number;
  /** Per-item visibility controls for granular pricing display */
  displayMode?: 'transparent' | 'net_only' | 'value_add' | 'bundle' | 'request';
  showUnitPrice?: boolean;
  showDiscount?: boolean;
  showTotal?: boolean;
  customLabel?: string;
  /** Competitor and market intelligence */
  competitorPrice?: number;
  marketPosition?: 'above' | 'at' | 'below';
  /** Multi-currency support */
  currency?: string;
  exchangeRate?: number;
}

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
  // NOTE: Column names vary in DB; we read via fallbacks below.
  [key: string]: any;
};

type SpfOfferProduct = {
  title: string;
  sku: string;
  quantity: number;
  /** Shown as unit price — from procurement `final_selling_cost` (not unit cost) */
  finalSellingPrice: number;
  imageUrl: string;
  technicalSpecification: string;
  packagingDetails: string;
  factoryDetails: string;
  url: string;
  leadTime: string;
};

function extractTsmPrefix(tsm: string): string {
  if (!tsm) return "";
  const firstSegment = tsm.split("-")[0];
  return firstSegment.substring(0, 2);
}

// Isang function lang para sa prefix mapping
function getQuotationPrefix(type: string): string {
  const map: Record<string, string> = {
    "Ecoshift Corporation": "EC",
    "Disruptive Solutions Inc": "DSI",
  };

  return map[type.trim()] || "";
}

const SEARCH_CACHE_TTL_MS = 60_000;
const SEARCH_DEBOUNCE_MS = 350;

type SearchCacheEntry = {
  timestamp: number;
  results: Product[];
};

const dedupeProductsById = (items: Product[]) => {
  const map = new Map<string, Product>();
  items.forEach((item) => {
    map.set(String(item.id), item);
  });
  return Array.from(map.values());
};

const toSearchCacheKey = (source: string, term: string) =>
  `${source}::${term.trim().toUpperCase()}`;

export function QuotationSheet(props: Props) {
  const {
    step, setStep,
    source, setSource,
    productCat, setProductCat,
    productQuantity, setProductQuantity,
    productAmount, setProductAmount,
    productDescription, setProductDescription,
    productPhoto, setProductPhoto,
    productSku, setProductSku,
    productTitle, setProductTitle,
    productDiscountedPrice, setProductDiscountedPrice,
    productDiscountedAmount, setProductDiscountedAmount,
    productIsPromo, setProductIsPromo,
    productIsHidden, setProductIsHidden,
    productRowDisplayMode, setProductRowDisplayMode,
    projectType, setProjectType,
    projectName, setProjectName,
    quotationNumber, setQuotationNumber,
    quotationAmount, setQuotationAmount,
    quotationType, setQuotationType,
    //quotationStatus, setQuotationStatus,
    callType, setCallType,
    followUpDate, setFollowUpDate,
    remarks, setRemarks,
    status, setStatus,
    tsm, setTSM,
    typeClient, setTypeClient,

    // --- TAX & FINANCIALS ---
    vatType, setVatType,
    whtType, setWhtType,       // Added Withholding Tax State
    deliveryFee, setDeliveryFee,
    deliveryAddress, setDeliveryAddress,
    restockingFee, setRestockingFee,
    itemRemarks, setItemRemarks,
    quotationSubject, setQuotationSubject,

    // --- CRM & STATUS ---
    tsmApprovalStatus, setTsmApprovalStatus,

    // --- ACTIONS ---
    handleBack,
    handleNext,
    handleSave,

    // --- USER / REP DETAILS ---
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,

    // --- CLIENT DETAILS ---
    company_name,
    address,
    contact_number,
    email_address,
    contact_person,

    // --- AVAILABLE CONTACTS ---
    availableContacts = [],

    // --- CONTACT SETTERS ---
    setContactPerson,
    setContactNumber,
    setEmailAddress,

    // --- SUPERVISOR & TRACEABILITY ---
    salesManagerContact,
    salesManagerEmail,
    managerDetails,
    tsmDetails,
    signature,
    referenceid: tsaReferenceId,
  } = props;

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchCacheRef = useRef<Map<string, SearchCacheEntry>>(new Map());
  const activeSearchRequestRef = useRef(0);
  const [visibleDescriptions, setVisibleDescriptions] = useState<Record<string, boolean>>({});
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [noProductsAvailable, setNoProductsAvailable] = useState(false);
  const [showConfirmFollowUp, setShowConfirmFollowUp] = useState(false);
  const [open, setOpen] = useState(false);
  const [discount, setDiscount] = React.useState(0);

  // Track raw input values for smooth decimal typing (keyed by product uid + field)
  const [rawInputValues, setRawInputValues] = useState<Record<string, string>>({});

  const [useToday, setUseToday] = useState(false);

  const [showQuotationAlert, setShowQuotationAlert] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localQuotationNumber, setLocalQuotationNumber] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  // Local state for contact person details (editable by sales agent)
  const [localContactPerson, setLocalContactPerson] = useState(contact_person || "");
  const [localContactNumber, setLocalContactNumber] = useState(contact_number || "");
  const [localEmailAddress, setLocalEmailAddress] = useState(email_address || "");
  const [localDeliveryAddress, setLocalDeliveryAddress] = useState(deliveryAddress || "");

  const [productSource, setProductSource] = useState<
    "shopify" | "firebase_shopify" | "firebase_taskflow"
  >("shopify");
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>("");

  const [showHelp, setShowHelp] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [mobilePanelTab, setMobilePanelTab] = useState<"search" | "products">("search");

  // NEW: Discount column visibility (accounting requirement - hide from clients)
  const [showDiscountColumns, setShowDiscountColumns] = useState(props.showDiscountColumns ?? true);

  // NEW: Show/hide summary discount row in preview
  const [showSummaryDiscounts, setShowSummaryDiscounts] = useState(props.showSummaryDiscounts ?? true);

  // Sync Show Discount Row with Show Discounts (but allow manual override)
  useEffect(() => {
    if (showDiscountColumns) {
      setShowSummaryDiscounts(true);
    } else {
      setShowSummaryDiscounts(false);
    }
  }, [showDiscountColumns]);

  // NEW: Hide discount columns in preview (for SRP-only quotes)
  const [hideDiscountInPreview, setHideDiscountInPreview] = useState(props.hideDiscountInPreview ?? false);

  // Sync hideDiscountInPreview from parent when prop changes
  useEffect(() => {
    if (props.hideDiscountInPreview !== undefined) {
      setHideDiscountInPreview(props.hideDiscountInPreview);
    }
  }, [props.hideDiscountInPreview]);

  // NEW: Quotation display configuration fields
  const [showProfitMargins, setShowProfitMargins] = useState(props.showProfitMargins ?? false);
  const [marginAlertThreshold, setMarginAlertThreshold] = useState(props.marginAlertThreshold ?? 10);
  const [showMarginAlerts, setShowMarginAlerts] = useState(props.showMarginAlerts ?? true);
  const [productViewMode, setProductViewMode] = useState(props.productViewMode ?? 'list');
  const [visibleColumns, setVisibleColumns] = useState(props.visibleColumns ?? {
    dragHandle: true,
    rowNumber: true,
    discountToggle: true,
    promoBadge: true,
    hideDiscount: true,
    displayMode: true,
  });

  // SYNC: PDF display options back to parent so they get saved to database
  useEffect(() => {
    if (props.setShowDiscountColumns) {
      props.setShowDiscountColumns(showDiscountColumns);
    }
  }, [showDiscountColumns, props.setShowDiscountColumns]);

  useEffect(() => {
    if (props.setHideDiscountInPreview) {
      props.setHideDiscountInPreview(hideDiscountInPreview);
    }
  }, [hideDiscountInPreview, props.setHideDiscountInPreview]);

  useEffect(() => {
    if (props.setShowSummaryDiscounts) {
      props.setShowSummaryDiscounts(showSummaryDiscounts);
    }
  }, [showSummaryDiscounts, props.setShowSummaryDiscounts]);

  useEffect(() => {
    if (props.setShowProfitMargins) {
      props.setShowProfitMargins(showProfitMargins);
    }
  }, [showProfitMargins, props.setShowProfitMargins]);

  useEffect(() => {
    if (props.setMarginAlertThreshold) {
      props.setMarginAlertThreshold(marginAlertThreshold);
    }
  }, [marginAlertThreshold, props.setMarginAlertThreshold]);

  useEffect(() => {
    if (props.setShowMarginAlerts) {
      props.setShowMarginAlerts(showMarginAlerts);
    }
  }, [showMarginAlerts, props.setShowMarginAlerts]);

  // Restore selected products from props on mount
  useEffect(() => {
    if (!productCat || productCat.trim() === "") return;
    
    const splitAndTrim = (value: string | null | undefined, separator: string = ",") => {
      if (!value) return [];
      return value.split(separator).map((v) => v.trim());
    };
    
    const ids = splitAndTrim(productCat);
    const quantities = splitAndTrim(productQuantity);
    const amounts = splitAndTrim(productAmount);
    const skus = splitAndTrim(productSku);
    const titles = splitAndTrim(productTitle);
    const descriptions = splitAndTrim(productDescription, " || ");
    const photos = splitAndTrim(productPhoto);
    const discountedPrices = splitAndTrim(productDiscountedPrice);
    const discountedAmounts = splitAndTrim(productDiscountedAmount);
    const isPromoFlags = splitAndTrim(productIsPromo);
    const isHiddenFlags = splitAndTrim(productIsHidden);
    const rowDisplayModes = splitAndTrim(productRowDisplayMode);
    const remarks = splitAndTrim(itemRemarks);
    
    const newSelectedProducts: SelectedProduct[] = ids.map((id, index) => {
      const quantity = parseInt(quantities[index] || "1") || 1;
      const price = parseFloat(amounts[index] || "0") || 0;
      const discount = parseFloat(discountedPrices[index] || "0") || 0;
      const discountAmount = parseFloat(discountedAmounts[index] || "0") || 0;
      const isPromo = isPromoFlags[index] === "1";
      const isHidden = isHiddenFlags[index] === "1";
      const rowDisplayMode = (rowDisplayModes[index] || "full") as 'full' | 'compact';
      
      return {
        id: id || `restored-${index}`,
        uid: crypto.randomUUID(),
        title: titles[index] || "Restored Product",
        quantity,
        price,
        discount,
        discountAmount,
        isDiscounted: discount > 0 || discountAmount > 0,
        isPromo,
        isHidden,
        rowDisplayMode,
        skus: skus[index] ? [skus[index]] : [],
        images: photos[index] ? [{ src: photos[index] }] : [],
        description: descriptions[index] || "",
        itemRemarks: remarks[index] || "",
      };
    });
    
    setSelectedProducts(newSelectedProducts);
  }, []);

  // NEW: Search filter for product table
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [quotationSubjectState, setQuotationSubjectState] = useState<string>(
    quotationSubject ?? "For Quotation",
  );

  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    example?: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Confirmation dialog for important toggles
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    example?: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // NEW: Bulk selection for multi-row operations
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // NEW: Undo/Redo history
  const [history, setHistory] = useState<SelectedProduct[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lastHistoryAction, setLastHistoryAction] = useState<string>("");

  // NEW: Recent Products (last 5 added)
  const [recentProducts, setRecentProducts] = useState<SelectedProduct[]>([]);

  // NEW: Quote templates
  const [savedTemplates, setSavedTemplates] = useState<Array<{name: string; products: SelectedProduct[]}>>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const [expandedRows, setExpandedRows] = useState<{ [uid: string]: boolean }>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragRowUid, setDragRowUid] = useState<string | null>(null);
  const [dragOverRowUid, setDragOverRowUid] = useState<string | null>(null);

  const [isSpfMode, setIsSpfMode] = useState(false);
  const [isSpf1Mode, setIsSpf1Mode] = useState(false);
  const [spf1Loading, setSpf1Loading] = useState(false);
  const [spf1Error, setSpf1Error] = useState<string | null>(null);
  const [spf1Records, setSpf1Records] = useState<SpfCreationRow[]>([]);
  const [spf1Search, setSpf1Search] = useState("");
  const [spf1Selected, setSpf1Selected] = useState<SpfCreationRow | null>(null);
  const [spfUploading, setSpfUploading] = useState(false);
  const [itemCodeDropDialogOpen, setItemCodeDropDialogOpen] = useState(false);
  const [pendingDropProduct, setPendingDropProduct] = useState<Product | null>(null);
  const [spfManualProduct, setSpfManualProduct] = useState({
    title: "",
    sku: "",
    price: 0,
    quantity: 1,
    description: "",
    imageUrl: "",
    cloudinaryPublicId: "",
  });

  // Delete image from Cloudinary when product is removed
  const deleteCloudinaryImage = async (publicId: string) => {
    if (!publicId) return;
    try {
      await fetch("/api/cloudinary/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId }),
      });
    } catch (err) {
      console.error("Failed to delete Cloudinary image:", err);
    }
  };

  // ==================== UNDO/REDO HISTORY ====================
  const saveToHistory = (action: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...selectedProducts]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setLastHistoryAction(action);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSelectedProducts([...history[historyIndex - 1]]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setSelectedProducts([...history[historyIndex + 1]]);
    }
  };

  // Keyboard shortcuts for undo/redo and copy/paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedRows.size > 0) {
        e.preventDefault();
        copySelectedRows();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        // Don't intercept paste if user is focused on an input/textarea (e.g. search bar)
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        pasteFromClipboard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, selectedRows]);

  // ==================== BULK OPERATIONS ====================
  const toggleRowSelection = (uid: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(uid)) {
      newSelected.delete(uid);
    } else {
      newSelected.add(uid);
    }
    setSelectedRows(newSelected);
  };

  const selectAllRows = () => {
    if (selectedRows.size === selectedProducts.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(selectedProducts.map(p => p.uid)));
    }
  };

  const duplicateSelectedRows = () => {
    saveToHistory('Duplicate rows');
    const newProducts = [...selectedProducts];
    selectedRows.forEach(uid => {
      const product = selectedProducts.find(p => p.uid === uid);
      if (product) {
        newProducts.push({
          ...product,
          uid: crypto.randomUUID(),
        });
      }
    });
    setSelectedProducts(newProducts);
    setSelectedRows(new Set());
  };

  const deleteSelectedRows = () => {
    saveToHistory('Delete rows');
    selectedRows.forEach(uid => {
      const product = selectedProducts.find(p => p.uid === uid);
      if (product?.cloudinaryPublicId) {
        deleteCloudinaryImage(product.cloudinaryPublicId);
      }
    });
    setSelectedProducts(prev => prev.filter(p => !selectedRows.has(p.uid)));
    setSelectedRows(new Set());
  };

  // ==================== EXCEL COPY/PASTE ====================
  const copySelectedRows = async () => {
    if (selectedRows.size === 0) return;
    
    const rowsToCopy = selectedProducts.filter(p => selectedRows.has(p.uid));
    const headers = ['Title', 'Quantity', 'Price', 'Discount%', 'DiscountAmt'];
    const data = rowsToCopy.map(p => [
      p.title,
      p.quantity,
      p.price,
      p.discount || 0,
      p.discountAmount || 0
    ]);
    
    const tsvContent = [headers.join('\t'), ...data.map(row => row.join('\t'))].join('\n');
    
    try {
      await navigator.clipboard.writeText(tsvContent);
      toast.success(`✓ Copied ${rowsToCopy.length} row(s) - Ready to paste`);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      
      // Parse tab-separated or comma-separated data
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length === 0) return;
      
      saveToHistory('Paste rows from clipboard');
      
      const newProducts: SelectedProduct[] = [];
      
      lines.forEach(line => {
        // Try tab-separated first, then comma-separated
        const cells = line.includes('\t') ? line.split('\t') : line.split(',');
        
        // Skip header row if detected
        if (cells[0]?.toLowerCase().includes('title') || 
            cells[0]?.toLowerCase().includes('product')) return;
        
        const title = cells[0]?.trim() || 'New Product';
        const quantity = parseInt(cells[1]) || 1;
        const price = parseFloat(cells[2]) || 0;
        const discount = parseFloat(cells[3]) || 0;
        const discountAmount = parseFloat(cells[4]) || 0;
        
        newProducts.push({
          uid: crypto.randomUUID(),
          id: crypto.randomUUID(),
          title,
          quantity,
          price,
          discount,
          discountAmount,
          description: '',
          isDiscounted: discount > 0 || discountAmount > 0,
          isPromo: false,
          isHidden: false,
          displayMode: 'transparent',
        } as SelectedProduct);
      });
      
      if (newProducts.length > 0) {
        setSelectedProducts(prev => [...prev, ...newProducts]);
        toast.success(`✓ Pasted ${newProducts.length} row(s) - New products added`);
      }
    } catch (err) {
      console.error('Failed to paste:', err);
      toast.error("Paste failed - Could not read clipboard data. Try copying from Excel first.");
    }
  };

  // ==================== RECENT PRODUCTS ====================
  const addToRecentProducts = useCallback((product: SelectedProduct) => {
    setRecentProducts((prev) => {
      const filtered = prev.filter((p) => p.id !== product.id);
      const updated = [product, ...filtered].slice(0, 5);
      return updated;
    });
  }, []);

  const reAddRecentProduct = useCallback((product: SelectedProduct) => {
    saveToHistory('Re-add recent product');
    const newProduct: SelectedProduct = {
      ...product,
      uid: crypto.randomUUID(),
      quantity: 1,
      isPromo: product.isPromo ?? false,
      isHidden: product.isHidden ?? false,
      displayMode: product.displayMode ?? 'transparent',
    };
    setSelectedProducts((prev) => [...prev, newProduct]);
    addToRecentProducts(newProduct);
  }, []);

  const addSearchResultProduct = (
    item: Product,
    forcedSku?: string,
    actionLabel = "Add product"
  ) => {
    const resolvedSku = (forcedSku || item.skus?.[0] || "").trim();

    if (item.requiresItemCodeSelection && !resolvedSku) {
      toast.error("Select an item code variant first.");
      return;
    }

    saveToHistory(actionLabel);

    const newProduct: SelectedProduct = {
      id: item.id,
      title: item.title,
      description: item.description || "",
      itemRemarks: item.itemRemarks,
      brand: item.brand,
      images: item.images,
      skus: resolvedSku ? [resolvedSku] : [],
      uid: crypto.randomUUID(),
      quantity: 1,
      price: item.price ?? 0,
      discount: 0,
      regPrice: item.regPrice || 0,
      isPromo: false,
      isHidden: false,
      isDiscounted: false,
      displayMode: 'transparent',
    };

    setSelectedProducts((prev) => [...prev, newProduct]);
    addToRecentProducts(newProduct);
    setMobilePanelTab("products");
  };

  const closeItemCodeDropDialog = () => {
    setItemCodeDropDialogOpen(false);
    setPendingDropProduct(null);
  };

  const handleSearchProductDrop = (item: Product) => {
    const droppedSku = (item.skus?.[0] || "").trim();
    const variants = item.itemCodeVariants || [];
    const needsVariantSelection =
      item.requiresItemCodeSelection &&
      variants.length > 1 &&
      !droppedSku;

    if (needsVariantSelection) {
      setPendingDropProduct(item);
      setItemCodeDropDialogOpen(true);
      return;
    }

    addSearchResultProduct(
      item,
      droppedSku,
      droppedSku ? `Add product (${droppedSku})` : "Add product (drag-drop)"
    );
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const mapFirestoreProductDoc = useCallback(
    (
      docSnap: { id: string; data: () => DocumentData },
      isDbSource: boolean,
      searchContext: ReturnType<typeof buildSearchContext>
    ): Product | null => {
      const data = docSnap.data();
      let specsHtml = `<p><strong>${data.shortDescription || ""}</strong></p>`;
      let rawSpecsText = "";

      if (Array.isArray(data.technicalSpecs)) {
        data.technicalSpecs.forEach((group: any) => {
          rawSpecsText += ` ${group.specGroup || ""}`;
          specsHtml += `
<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">
${group.specGroup}
</div>`;

          specsHtml += `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">`;

          group.specs?.forEach((spec: any) => {
            rawSpecsText += ` ${spec?.name || ""} ${spec?.value || ""}`;
            specsHtml += `
<tr>
<td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%">
<b>${spec.name}</b>
</td>
<td style="border:1px solid #e5e7eb;padding:4px">
${spec.value}
</td>
</tr>`;
          });

          specsHtml += `</table>`;
        });
      }

      const itemCodeVariants = normalizeItemCodeVariants(
        data.itemCodes,
        data.itemCode
      );
      const variantSelection = resolveVariantSelection(
        itemCodeVariants,
        searchContext.phraseUpper,
        searchContext.codeTokensUpper
      );
      const matchesNameOrSpecs = matchesSearchText(
        `${data.name || ""} ${rawSpecsText}`.toUpperCase(),
        searchContext.phraseUpper,
        searchContext.tokensUpper
      );

      if (!matchesNameOrSpecs && variantSelection.matchedVariants.length === 0) {
        return null;
      }

      const variantsForResult =
        isDbSource && variantSelection.matchedVariants.length > 0
          ? variantSelection.matchedVariants
          : itemCodeVariants;

      const itemCodes = variantsForResult.reduce<Record<string, string>>(
        (acc, variant) => {
          acc[variant.label] = variant.code;
          return acc;
        },
        {}
      );

      const shouldAutoSelectSku = isDbSource
        ? variantSelection.autoSelectedVariant
        : null;
      const requiresItemCodeSelection =
        isDbSource && variantsForResult.length > 1 && !shouldAutoSelectSku;
      const defaultSku = requiresItemCodeSelection
        ? ""
        : shouldAutoSelectSku?.code || variantsForResult[0]?.code || "";

      return {
        id: docSnap.id,
        title: data.name || "No Name",
        price: data.regularPrice || 0,
        regPrice: data.regularPrice || 0,
        description: specsHtml,
        images: data.mainImage ? [{ src: data.mainImage }] : [],
        itemCodes,
        itemCodeVariants: variantsForResult,
        requiresItemCodeSelection,
        skus: defaultSku ? [defaultSku] : [],
        discount: 0,
      };
    },
    []
  );

  const fetchFirebaseSearchResults = useCallback(
    async (term: string) => {
      const normalizedTerm = term.trim();
      if (normalizedTerm.length < 2) {
        setSearchResults((prev) => (prev.length > 0 ? [] : prev));
        setSearchError((prev) => (prev ? null : prev));
        return;
      }

      const requestId = ++activeSearchRequestRef.current;
      const isDbSource = productSource === "firebase_taskflow";
      const websiteFilter =
        productSource === "firebase_shopify" ? "Shopify" : "Taskflow";
      const cacheKey = toSearchCacheKey(productSource, normalizedTerm);
      const now = Date.now();
      const searchContext = buildSearchContext(normalizedTerm);

      const cached = searchCacheRef.current.get(cacheKey);
      if (cached && now - cached.timestamp <= SEARCH_CACHE_TTL_MS) {
        setSearchResults(cached.results);
        setSearchError(null);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        // Query the full website-scoped product set so every DB product remains searchable.
        const constraints: QueryConstraint[] = [
          where("websites", "array-contains", websiteFilter),
        ];
        const snapshot = await executeSingleQuery(
          () => getDocs(query(collection(db, "products"), ...constraints)),
          (querySnapshot) => querySnapshot
        );
        if (requestId !== activeSearchRequestRef.current) return;

        const matchedItems = snapshot.docs
          .map((docSnap) =>
            mapFirestoreProductDoc(docSnap, isDbSource, searchContext)
          )
          .filter((item): item is Product => Boolean(item));
        const deduped = dedupeProductsById(matchedItems);

        setSearchResults(deduped);
        searchCacheRef.current.set(cacheKey, {
          timestamp: now,
          results: deduped,
        });
      } catch (err) {
        console.error("Search Protocol Failure:", err);
        setSearchResults([]);
        setSearchError("Unable to search products right now. Please try again.");
      } finally {
        if (requestId !== activeSearchRequestRef.current) return;
        setIsSearching(false);
      }
    },
    [mapFirestoreProductDoc, productSource]
  );

  const fetchShopifyProducts = useCallback(
    async (term: string) => {
      const normalizedTerm = term.trim();
      if (normalizedTerm.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }

      const cacheKey = toSearchCacheKey(productSource, normalizedTerm);
      const cached = searchCacheRef.current.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp <= SEARCH_CACHE_TTL_MS) {
        setSearchResults(cached.results);
        setSearchError(null);
        return;
      }

      const requestId = ++activeSearchRequestRef.current;
      setIsSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/shopify/products?q=${normalizedTerm.toLowerCase()}`);
        const data = await res.json();
        if (requestId !== activeSearchRequestRef.current) return;
        const products = data.products || [];
        setSearchResults(products);
        searchCacheRef.current.set(cacheKey, {
          timestamp: now,
          results: products,
        });
      } catch (err) {
        console.error("Search Protocol Failure:", err);
        setSearchResults([]);
        setSearchError("Unable to search products right now. Please try again.");
      } finally {
        if (requestId !== activeSearchRequestRef.current) return;
        setIsSearching(false);
      }
    },
    [productSource]
  );

  useEffect(() => {
    if (isManualEntry || isSpfMode || isSpf1Mode) return;
    if (debouncedSearchTerm.length < 2) {
      setSearchResults((prev) => (prev.length > 0 ? [] : prev));
      setIsSearching((prev) => (prev ? false : prev));
      setSearchError((prev) => (prev ? null : prev));
      return;
    }

    if (productSource === "shopify") {
      fetchShopifyProducts(debouncedSearchTerm);
      return;
    }

    if (
      productSource === "firebase_shopify" ||
      productSource === "firebase_taskflow"
    ) {
      fetchFirebaseSearchResults(debouncedSearchTerm);
    }
  }, [
    debouncedSearchTerm,
    fetchFirebaseSearchResults,
    fetchShopifyProducts,
    isManualEntry,
    isSpf1Mode,
    isSpfMode,
    productSource,
  ]);

  // ==================== USER PREFERENCES PERSISTENCE ====================
  // NOTE: Parent component (create.tsx) is now the single source of truth for PDF display options
  // The parent loads from localStorage, saves to localStorage, and passes values as props to this component
  // This component syncs changes back to parent via useEffect hooks above

  // ==================== MARGIN CALCULATION & ALERTS ====================
  const calculateMargin = (price: number, cost: number): number => {
    if (!price || price === 0) return 0;
    return ((price - cost) / price) * 100;
  };

  const getMarginAlert = (price: number, cost: number, discountPct: number): { alert: boolean; message: string; severity: 'warning' | 'danger' } | null => {
    if (!showMarginAlerts) return null;

    // If cost data is available, use margin calculation
    if (cost && cost > 0) {
      const margin = calculateMargin(price, cost);
      if (margin < 0) {
        return { alert: true, message: `Loss: ${margin.toFixed(1)}% margin`, severity: 'danger' };
      }
      if (margin < marginAlertThreshold) {
        return { alert: true, message: `Low margin: ${margin.toFixed(1)}%`, severity: 'warning' };
      }
    } else {
      // Without cost data, warn based on discount percentage
      if (discountPct > 50) {
        return { alert: true, message: `Very high discount: ${discountPct.toFixed(1)}%`, severity: 'danger' };
      }
      if (discountPct > 30) {
        return { alert: true, message: `High discount: ${discountPct.toFixed(1)}%`, severity: 'warning' };
      }
    }

    return null;
  };

  // ==================== TEMPLATES ====================
  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const newTemplate = { name: templateName, products: [...selectedProducts] };
    setSavedTemplates(prev => [...prev, newTemplate]);
    setTemplateName('');
    setShowTemplateModal(false);
  };

  const loadTemplate = (template: {name: string; products: SelectedProduct[]}) => {
    saveToHistory(`Load template: ${template.name}`);
    const newProducts = template.products.map(p => ({
      ...p,
      uid: crypto.randomUUID(), // Generate new UIDs
    }));
    setSelectedProducts(newProducts);
    setShowTemplateModal(false);
  };

  function addDaysToDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0]; // YYYY-MM-DD format for input[type=date]
  }

  useEffect(() => {
    if (!callType) {
      setFollowUpDate("");
      return;
    }

    // ✅ PRIORITY: Today checkbox
    if (useToday) {
      const today = new Date().toISOString().split("T")[0];
      if (followUpDate !== today) {
        setFollowUpDate(today);
      }
      return; // ⛔ stop here, wag na mag auto
    }

    // 🔁 AUTO FOLLOW UP LOGIC
    if (
      callType === "Quotation Standard Preparation" ||
      callType === "Quotation with Special Price Preparation"
    ) {
      setFollowUpDate(addDaysToDate(1)); // tomorrow
    } else if (callType === "Quotation with SPF Preparation") {
      setFollowUpDate(addDaysToDate(5)); // after 5 days
    } else {
      setFollowUpDate("");
    }
  }, [callType, useToday]);

  const splitByPipe = (value?: string | null) =>
    (value || "")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const splitByRow = (value?: string | null) =>
    (value || "")
      .split("|ROW|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const splitComma = (value?: string | null) =>
    (value || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const explodeRowGroups = (value?: string | null): string[] => {
    const groups = splitByRow(value);
    if (groups.length === 0) return splitComma(value);
    return groups.flatMap((g) => splitComma(g));
  };

  const summarizeProcField = (value?: string | null, max = 2): string => {
    const items = explodeRowGroups(value)
      .map((v) => v.replace(/\|ROW\|/g, "").trim())
      .filter((v) => v && v !== "-" && v !== "--");
    const unique = Array.from(new Set(items));
    if (unique.length === 0) return "—";
    const head = unique.slice(0, max).join(", ");
    return unique.length > max ? `${head}...` : head;
  };

  const explodeTechSpecs = (value?: string | null): string[] => {
    const v = (value || "").trim();
    if (!v) return [];

    // Prefer the |ROW| separator — this is the clean multi-item format
    const rowGroups = splitByRow(v);
    if (rowGroups.length > 0) return rowGroups;

    // NOTE: Do NOT split on plain "||" here.
    // The DB sometimes embeds "||" inside a single item's field value as an
    // artifact (e.g. "Dimensions: 631mm || LAMP DETAILS~~CCT: ...").
    // Splitting on "||" would create phantom extra spec blocks from one item.
    // Treat the entire string as one spec block per item instead.
    return [v];
  };

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const formatSpfTechSpecToHtml = (raw: string): string => {
    const text = (raw || "").trim();
    if (!text) return '<span class="text-gray-400 italic">No specifications provided.</span>';

    // ── DB ARTIFACT CLEANUP ───────────────────────────────────────────────────
    // The DB sometimes writes a field value that ends with "|| NEXT_GROUP~~..."
    // (a legacy artifact where the multi-item separator `||` leaked into the
    // last column of a spec table).  We normalise this into the standard `@@`
    // group-separator format so the parser below handles it correctly.
    //
    // Pattern:  "...some value || GROUP_NAME~~key: value"
    // Fix:      replace " || GROUP_NAME~~" with "@@GROUP_NAME~~"
    //
    // We only do this when the token after `||` looks like a spec-group header,
    // i.e. it is followed by `~~` (the key:value separator used in this format).
    const normalised = text.replace(/\s*\|\|\s*([^|@~]+~~)/g, "@@$1");

    // Example format after normalisation:
    // GROUP~~key: value;;key: value@@GROUP 2~~key: value
    const groups = normalised.split("@@").map((g) => g.trim()).filter(Boolean);

    const out: string[] = [];
    for (const g of groups) {
      const [groupTitleRaw, ...rest] = g.split("~~");
      const groupTitle = escapeHtml((groupTitleRaw || "").trim());
      const body = rest.join("~~").trim();
      const lines = body
        .split(";;")
        .map((l) => l.trim())
        .filter(Boolean);

      out.push(`
<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">
${groupTitle || "SPECIFICATIONS"}
</div>`);

      if (lines.length === 0) {
        continue;
      }

      out.push(`<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">`);
      for (const line of lines) {
        const idx = line.indexOf(":");
        const name = escapeHtml((idx >= 0 ? line.slice(0, idx) : line).trim());
        const value = escapeHtml((idx >= 0 ? line.slice(idx + 1) : "").trim());
        out.push(`
<tr>
  <td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%"><strong>${name}</strong></td>
  <td style="border:1px solid #e5e7eb;padding:4px">${value}</td>
</tr>`);
      }
      out.push(`</table>`);
    }

    return out.join("\n");
  };

  const formatProcurementLeadHtml = (lead: string): string => {
    const t = (lead || "").trim();
    if (!t) return "";
    return `
<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">
Procurement
</div>
<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">
<tr>
  <td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%"><strong>Project lead time</strong></td>
  <td style="border:1px solid #e5e7eb;padding:4px">${escapeHtml(t)}</td>
</tr>
</table>`;
  };

  const parseSpfCreationProducts = (row: SpfCreationRow): SpfOfferProduct[] => {
    // In `spf_creation` export, multi-items are stored as:
    // - groups separated by `|ROW|`
    // - inside each group, items separated by commas
    const skus = explodeRowGroups(row.item_code);
    const productNames = explodeRowGroups(row.product_name);
    const qtys = explodeRowGroups(row.product_offer_qty);
    const sellingPrices = explodeRowGroups(row.final_selling_cost);
    const leadRaw = row.proj_lead_time ?? row.project_lead_time;
    const leadTimes = explodeRowGroups(leadRaw);
    const imgs = explodeRowGroups(row.product_offer_image);
    const techSpecs = explodeTechSpecs(row.product_offer_technical_specification);
    const packaging = explodeRowGroups(row.product_offer_packaging_details);
    const factory = explodeRowGroups(row.product_offer_factory_address);
    const urls: string[] = [];

    const maxLen = skus.length || Math.max(
      qtys.length,
      sellingPrices.length,
      leadTimes.length,
      imgs.length,
      1
    );

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
        url: urls[i] || "",
        leadTime: leadTimes[i] || leadTimes[0] || "",
      };
    }).filter((p) => p.sku.trim().length > 0);
  };

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
        if (tsaReferenceId?.trim()) {
          q = q.eq("referenceid", tsaReferenceId.trim());
        }
        const { data, error } = await q.order("date_created", { ascending: false });

        if (error) throw error;
        const rows = (data || []) as unknown as SpfCreationRow[];
        if (!cancelled) setSpf1Records(rows);
      } catch (err: any) {
        if (!cancelled) setSpf1Error(err?.message || "Failed to load SPF 1 records.");
      } finally {
        if (!cancelled) setSpf1Loading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSpf1Mode, tsaReferenceId]);

  useEffect(() => {
    setUseToday(false);
  }, [callType]);

  async function handleGenerateQuotation() {
    if (!quotationType || !tsm || isGenerating) return;

    setIsGenerating(true);

    try {
      // reset previous generated state (optional but recommended)
      setHasGenerated(false);
      setLocalQuotationNumber("");
      setQuotationNumber("");

      const cleanQuotationType = quotationType.trim();
      const prefixBase = `${getQuotationPrefix(cleanQuotationType)}-${extractTsmPrefix(tsm)}`;
      const currentYear = new Date().getFullYear();

      const nextSeq = await fetchNextQuotationSequence(prefixBase);
      const newQuotationNumber = `${prefixBase}-${currentYear}-${nextSeq}`;

      setLocalQuotationNumber(newQuotationNumber);
      setQuotationNumber(newQuotationNumber);
      setHasGenerated(true);
    } catch (err) {
      console.error("Generate quotation failed", err);
    } finally {
      setIsGenerating(false);
    }
  }

  async function fetchNextQuotationSequence(prefixBase: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefixWithYear = `${prefixBase}-${currentYear}`;

    try {
      const response = await fetch(`/api/fetch-quotation-number?prefix=${encodeURIComponent(prefixWithYear)}`);
      const data = await response.json();

      const existingNumbers: string[] = data.quotationNumbers || [];

      const sequences = existingNumbers
        .map((q) => {
          const parts = q.split("-");
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          return isNaN(num) ? 0 : num;
        })
        .filter((num) => num > 0);

      const maxSeq = sequences.length > 0 ? Math.max(...sequences) : 0;
      const nextSeq = (maxSeq + 1).toString().padStart(4, "0");

      return nextSeq;
    } catch (error) {
      console.error("Failed to fetch quotation sequence", error);
      return "0001";
    }
  }

  useEffect(() => {
    // Calculate total quotation amount considering discount per product
    const productTotal = selectedProducts.reduce((acc, p) => {
      const isDiscounted = p.isDiscounted ?? false;
      const rowDiscount = isDiscounted ? (p.discount ?? 0) : 0; // per-product discount
      const unitDiscountAmount = (p.price * rowDiscount) / 100;
      const netUnitPrice = p.price - unitDiscountAmount;
      const totalAfterDiscount = netUnitPrice * p.quantity;

      return acc + totalAfterDiscount;
    }, 0);

    // Round productTotal to 2 decimals to prevent floating-point precision issues
    const roundedProductTotal = Math.round(productTotal * 100) / 100;

    const deliveryFeeNumber = parseFloat(deliveryFee) || 0;
    const restockingFeeNumber = parseFloat(restockingFee) || 0;
    const subtotalWithFees = roundedProductTotal + deliveryFeeNumber + restockingFeeNumber;

    // Calculate EWT deduction
    const whtBase = vatType === "vat_inc"
      ? subtotalWithFees / 1.12
      : subtotalWithFees;
    const whtRate = whtType === "wht_1" ? 0.01 : whtType === "wht_2" ? 0.02 : 0;
    const whtAmount = Math.round((whtBase * whtRate) * 100) / 100;

    // Quotation amount should be the NET amount (after EWT deduction)
    // This is what gets saved to the database
    const finalAmount = Math.round((subtotalWithFees - whtAmount) * 100) / 100;

    setQuotationAmount(finalAmount.toFixed(2));
  }, [selectedProducts, deliveryFee, restockingFee, discount, vatType, whtType]);

  useEffect(() => {
    setLocalQuotationNumber(quotationNumber);
  }, [quotationNumber]);

  useEffect(() => {
    // Ensure VAT Inc is selected by default
    if (!vatType) {
      setVatType("vat_inc");
    }
  }, [vatType, setVatType]);

  // Sync local contact person state with props on initial load
  useEffect(() => {
    if (contact_person !== undefined) setLocalContactPerson(contact_person);
  }, [contact_person]);

  useEffect(() => {
    if (contact_number !== undefined) setLocalContactNumber(contact_number);
  }, [contact_number]);

  useEffect(() => {
    if (email_address !== undefined) setLocalEmailAddress(email_address);
  }, [email_address]);

  useEffect(() => {
    if (deliveryAddress !== undefined) setLocalDeliveryAddress(deliveryAddress);
  }, [deliveryAddress]);

  // Pass local edits back to parent
  useEffect(() => {
    if (setContactPerson) setContactPerson(localContactPerson);
  }, [localContactPerson, setContactPerson]);

  useEffect(() => {
    if (setContactNumber) setContactNumber(localContactNumber);
  }, [localContactNumber, setContactNumber]);

  useEffect(() => {
    if (setEmailAddress) setEmailAddress(localEmailAddress);
  }, [localEmailAddress, setEmailAddress]);

  useEffect(() => {
    if (setDeliveryAddress) setDeliveryAddress(localDeliveryAddress);
  }, [localDeliveryAddress, setDeliveryAddress]);

  useEffect(() => {
    const ids = selectedProducts.map((p) => p.id.toString());
    const quantities = selectedProducts.map((p) => p.quantity.toString());
    const amounts = selectedProducts.map((p) => p.price.toString());

    // Dito: I-save ang buong description with regPrice, hindi lang table
    const descriptions = selectedProducts.map((p) => {
      const regPriceHtml = p.regPrice
        ? `<div style="background:#facc15;color:#121212;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-bottom:8px">Regular Price: ₱${p.regPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>`
        : "";
      return regPriceHtml + (p.description || "");
    });

    const photos = selectedProducts.map((p) => p.images?.[0]?.src || "");
    const skus = selectedProducts.map((p) => (p.skus && p.skus.length > 0 ? p.skus[0] : ""));
    const titles = selectedProducts.map((p) => p.title);
    const remarks = selectedProducts.map((p) => p.itemRemarks || "");

    // Save discount percentage for each product
    const discountedPrices = selectedProducts.map((p) => {
      const isDiscounted = p.isDiscounted ?? false;
      if (!isDiscounted) return "0";
      return String(p.discount ?? 0);
    });

    // Save calculated discount amount for each product
    const discountedAmounts = selectedProducts.map((p) => {
      const isDiscounted = p.isDiscounted ?? false;
      if (!isDiscounted) return "0";
      const unitDiscountAmount = (p.price * (p.discount ?? 0)) / 100;
      const qty = p.quantity ?? 1;
      const totalDiscountAmount = unitDiscountAmount * qty;
      return totalDiscountAmount.toFixed(2);
    });

    // Save product flags
    const isPromoFlags = selectedProducts.map((p) => (p.isPromo ? "1" : "0"));
    const isHiddenFlags = selectedProducts.map((p) => (p.isHidden ? "1" : "0"));
    const rowDisplayModes = selectedProducts.map((p) => p.rowDisplayMode || "full");

    // Debug logging
    console.log("[Quotation] Serializing product flags:", {
      isPromoFlags,
      isPromoJoined: isPromoFlags.join(","),
      selectedProducts: selectedProducts.map(p => ({ title: p.title, isPromo: p.isPromo })),
    });

    setProductCat(ids.join(","));
    setProductQuantity(quantities.join(","));
    setProductAmount(amounts.join(","));
    setProductSku(skus.join(","));
    setProductTitle(titles.join(","));
    setProductDescription(descriptions.join(" || "));
    setProductPhoto(photos.join(","));
    setItemRemarks(remarks.join(","));
    setProductDiscountedPrice(discountedPrices.join(","));
    setProductDiscountedAmount(discountedAmounts.join(","));
    setProductIsPromo(isPromoFlags.join(","));
    setProductIsHidden(isHiddenFlags.join(","));
    setProductRowDisplayMode(rowDisplayModes.join(","));
  }, [
    selectedProducts,
    setProductCat,
    setProductQuantity,
    setProductAmount,
    setProductDescription,
    setProductPhoto,
    setProductSku,
    setProductTitle,
    setItemRemarks,
    setProductDiscountedPrice,
    setProductDiscountedAmount,
    setProductIsPromo,
    setProductIsHidden,
    setProductRowDisplayMode,
  ]);

  // Save handler with validation
  const saveWithSelectedProducts = () => {
    setShowQuotationAlert(true);  // Show the Shadcn alert
    //handleDownloadQuotationPDF(); // Generate PDF before saving
    handleSave();
  };

  const filteredSources =
    typeClient === "CSR Client"
      ? [
        {
          label: "CSR Endorsement",
          description: "Customer Service Representative inquiries.",
        },
      ]
      : Quotation_SOURCES.filter(
        (source) => source.label !== "CSR Endorsement"
      );

  const handleSaveClick = () => {
    // Show confirmation alert muna bago save
    setShowConfirmFollowUp(true);
  };

  // Handler kapag OK na sa follow up alert
  const handleConfirmFollowUp = () => {
    setShowConfirmFollowUp(false);
    // Dito talaga ang save
    saveWithSelectedProducts();
  };

  // Handler kapag Cancel sa alert
  const handleCancelFollowUp = () => {
    setShowConfirmFollowUp(false);
  };

  function formatCurrency(value: number | null | undefined): string {
    if (value == null) return "₱0.00";
    return `₱${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const handleDownloadQuotation = async () => {
    if (!productCat || productCat.trim() === "") {
      sileo.error({
        title: "Failed",
        description: "Cannot export quotation: Product Category is empty.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
      return;
    }

    try {
      // --- SAFE DEFAULTS (OPTIONAL FIELDS) ---
      const safeCompanyName = company_name ?? "";
      const safeAddress = address ?? "";
      const safeContactNumber = localContactNumber ?? "";
      const safeEmailAddress = localEmailAddress ?? "";
      const safeContactPerson = localContactPerson ?? "";

      // --- SALES DETAILS ---
      const salesRepresentativeName = `${firstname ?? ""} ${lastname ?? ""}`.trim();
      const emailUsername = email?.split("@")[0] ?? "";

      let emailDomain = "";
      if (quotationType === "Disruptive Solutions Inc") {
        emailDomain = "disruptivesolutionsinc.com";
      } else if (quotationType === "Ecoshift Corporation") {
        emailDomain = "ecoshiftcorp.com";
      } else {
        emailDomain = email?.split("@")[1] ?? "";
      }

      const salesemail = emailUsername && emailDomain
        ? `${emailUsername}@${emailDomain}`
        : "";

      const salescontact = contact ?? "";
      const salestsmname = tsmname ?? "";
      const salesmanagername = managername ?? "";

      // --- ITEMS ---
      const items = selectedProducts.map((p, index) => {
        const qty = p.quantity ?? 0;
        const unitPrice = p.price ?? 0;
        const isDiscounted = p.isDiscounted ?? false;

        const rowDiscount = isDiscounted ? (p.discount ?? 0) : 0;
        const unitDiscountAmount = isDiscounted && rowDiscount > 0 ? (unitPrice * rowDiscount) / 100 : 0;
        const netUnitPrice = unitPrice - unitDiscountAmount;
        const totalAmount = netUnitPrice * qty;

        const title = p.title ?? "";
        const sku = p.skus?.join(", ") ?? "";
        const description = p.description ?? "";
        const photo = p.images?.[0]?.src ?? "";

        const descriptionTable = `
        <table>
          <tr><td>${title}</td></tr>
          <tr><td>${sku}</td></tr>
          <tr><td>${description}</td></tr>
        </table>
      `;

        return {
          itemNo: index + 1,
          qty,
          referencePhoto: photo,
          description: descriptionTable,
          unitPrice: formatCurrency(unitPrice),
          totalAmount: formatCurrency(totalAmount),
        };
      });

      const formattedDate = new Date().toLocaleDateString();

      // --- QUOTATION DATA (ALL OPTIONAL SAFE) ---
      const quotationData = {
        referenceNo: quotationNumber ?? "",
        date: formattedDate,
        companyName: safeCompanyName,
        address: safeAddress,
        telNo: safeContactNumber,
        email: safeEmailAddress,
        attention: safeContactPerson ? safeContactPerson : "",
        subject: quotationSubject || "For Quotation",
        items,

        // --- TAX & WITHHOLDING LOGIC ---
        // VAT Type (Tax property of the Sale)
        vatType: vatType,
        vatTypeLabel:
          vatType === "vat_inc" ? "VAT Inc" :
            vatType === "vat_exe" ? "VAT Exe" : "Zero-Rated",

        // Withholding Tax (Tax property of the Buyer/Relationship)
        whtType: whtType, // value like "wht_1", "wht_2", or "none"
        whtLabel:
          whtType === "wht_1" ? "EWT 1% (Goods)" :
            whtType === "wht_2" ? "EWT 2% (Services)" : "None",

        // --- CALCULATION LOGIC ---
        totalPrice: Number(quotationAmount ?? 0),
        deliveryFee: Number(deliveryFee ?? 0),
        restockingFee: Number(restockingFee ?? 0),

        // EWT is calculated on Net of VAT (Total / 1.12)
        whtAmount: whtType !== "none"
          ? (Number(quotationAmount ?? 0) / 1.12) * (whtType === "wht_1" ? 0.01 : 0.02)
          : 0,

        // This is the actual cash expected to be received
        netAmountToCollect: Number(quotationAmount ?? 0) - (
          whtType !== "none" ? (Number(quotationAmount ?? 0) / 1.12) * (whtType === "wht_1" ? 0.01 : 0.02) : 0
        ),

        // --- REPRESENTATIVE DETAILS ---
        salesRepresentative: salesRepresentativeName,
        salesemail,
        salescontact,
        salestsmname,
        salesmanagername,
      };

      let apiEndpoint = "/api/quotation/disruptive";
      if (quotationType === "Ecoshift Corporation") {
        apiEndpoint = "/api/quotation/ecoshift";
      }

      const resExport = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotationData),
      });

      if (!resExport.ok) {
        const errorText = await resExport.text();
        sileo.error({
          title: "Failed",
          description: "Failed to download quotation: " + errorText,
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
        return;
      }

      const blob = await resExport.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `Quotation_${quotationNumber || "unknown"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      sileo.error({
        title: "Failed",
        description: "Failed to download quotation. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    }
  };

  const getQuotationPayload = () => {
    const salesRepresentativeName = `${firstname ?? ""} ${lastname ?? ""}`.trim();
    const emailUsername = email?.split("@")[0] ?? "";

    let emailDomain = "";
    if (quotationType === "Disruptive Solutions Inc") {
      emailDomain = "disruptivesolutionsinc.com";
    } else if (quotationType === "Ecoshift Corporation") {
      emailDomain = "ecoshiftcorp.com";
    } else {
      emailDomain = email?.split("@")[1] ?? "";
    }

    const salesemail = emailUsername && emailDomain ? `${emailUsername}@${emailDomain}` : "";

    const items = selectedProducts.map((p, index) => {
      const qty = p.quantity ?? 0;
      const unitPrice = p.price ?? 0;
      const isDiscounted = p.isDiscounted ?? false;
      const discountPct = isDiscounted ? (p.discount ?? 0) : 0;

      // Prefer explicit peso amount if set, otherwise compute from %
      const unitDiscountAmt = isDiscounted
        ? p.discountAmount != null && p.discountAmount > 0
          ? p.discountAmount
          : (unitPrice * discountPct) / 100
        : 0;

      const discountedUnitPrice = unitPrice - unitDiscountAmt; // Net unit price after discount
      const totalAmount = discountedUnitPrice * qty;           // Total net

      return {
        itemNo: index + 1,
        qty,
        photo: p.images?.[0]?.src ?? "",
        title: p.title ?? "",
        sku: p.skus?.join(", ") ?? "",
        description: p.description ?? "",
        itemRemarks: p.itemRemarks ?? "",
        isPromo: p.isPromo ?? false,
        hideDiscountInPreview: p.hideDiscountInPreview ?? false,
        unitPrice,
        discount: discountPct,
        discountAmount: unitDiscountAmt,
        totalDiscountAmount: unitDiscountAmt * qty,
        discountedAmount: discountedUnitPrice,
        totalAmount,
        isSpf1: typeof p.id === "string" && p.id.startsWith("spf1-"),
        procurementLeadTime: p.procurementLeadTime ?? "",
        regPrice: p.regPrice ?? 0,
        displayMode: p.displayMode || 'transparent',
      };
    });

    const netAmountToCollect = Math.round((Number(quotationAmount ?? 0)) * 100) / 100;
    const totalDiscount = items.reduce((acc, item) => acc + (item.discountAmount || 0), 0);
    const totalGross = items.reduce((acc, item) => acc + (item.totalAmount || 0), 0);

    const whtRate = whtType === "wht_1" ? 0.01 : whtType === "wht_2" ? 0.02 : 0;

    let totalInvoiceAmount: number;
    if (whtRate === 0) {
      totalInvoiceAmount = netAmountToCollect;
    } else if (vatType === "vat_inc") {
      totalInvoiceAmount = netAmountToCollect / (1 - (whtRate / 1.12));
    } else {
      totalInvoiceAmount = netAmountToCollect / (1 - whtRate);
    }
    totalInvoiceAmount = Math.round(totalInvoiceAmount * 100) / 100;

    const whtBase = vatType === "vat_inc" ? totalInvoiceAmount / 1.12 : totalInvoiceAmount;
    const whtAmount = Math.round((whtBase * whtRate) * 100) / 100;

    return {
      referenceNo: quotationNumber ?? "DRAFT-XXXX",
      date: new Date().toLocaleDateString(),
      companyName: company_name ?? "",
      address: address ?? "",
      telNo: localContactNumber ?? "",
      email: localEmailAddress ?? "",
      attention: localContactPerson ? localContactPerson : "",
      subject: quotationSubject || "For Quotation",
      items,
      vatType,
      vatTypeLabel: vatType === "vat_inc" ? "VAT Inc" : vatType === "vat_exe" ? "VAT Exe" : "Zero-Rated",
      whtType,
      whtLabel: whtType === "wht_1" ? "EWT 1% (Goods)" : whtType === "wht_2" ? "EWT 2% (Services)" : "No Withholding",
      whtAmount,
      whtBase,
      totalPrice: totalInvoiceAmount,
      totalGross,
      totalDiscount,
      deliveryFee: Number(deliveryFee ?? 0),
      netAmountToCollect,
      salesRepresentative: salesRepresentativeName,
      salesemail,
      salescontact: contact ?? "",
      salestsmname: tsmname ?? "",
      salesmanagername: managername ?? "",
      salesManagerContact: salesManagerContact ?? "",
      salesManagerEmail: salesManagerEmail ?? "",
      tsmDetails,
      managerDetails,
      signature,
    };
  };

  const payload = getQuotationPayload();

  // 1. BRAND SELECTION LOGIC
  const isEcoshift = quotationType === "Ecoshift Corporation";

  // 2. ASSET PATH RESOLUTION
  const headerImagePath = isEcoshift
    ? "/ecoshift-banner.png"
    : "/disruptive-banner.png";

  const handleDownloadQuotationPDF = async () => {
    console.log('pdf dl');
    if (typeof window === 'undefined') return;
    const PRIMARY_CHARCOAL = '#121212';
    const OFF_WHITE = '#F9FAFA';
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const payload = getQuotationPayload();
      const isEcoshift = quotationType === "Ecoshift Corporation";

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [612, 936] // Legal Format
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const BOTTOM_MARGIN = 0;

      // 1. CREATE VIRTUAL CANVAS
      const iframe = document.createElement('iframe');
      Object.assign(iframe.style, {
        position: 'fixed',
        right: '1000%',
        width: '816px',
        visibility: 'hidden'
      });
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Initialization Failed");

      iframeDoc.open();
      iframeDoc.write(`
          <html>
            <head>
            <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
            body { 
            font-family: 'Arial', sans-serif; 
            margin: 0; 
            padding: 0; 
            background: white; /* Changed from OFF_WHITE to white for seamless capture */
            width: 816px; 
            color: ${PRIMARY_CHARCOAL};
            overflow: hidden; /* Prevents scrollbar padding */
            }
            
            .header-img { width: 100%; display: block; }
            .content-area { 
            padding: 0px 60px; 
            margin: 0 !important; /* Ensure no external margins */
            }
            
            /* 1. CLIENT INFORMATION GRID */
            .client-grid { border-left: 1.5px solid black; border-right: 1.5px solid black; background: white; }
            .grid-row { display: flex; align-items: center; min-height: 20px; padding: 2px 15px; }
            .border-t { border-top: 1.5px solid black; }
            .border-b { border-bottom: 1.5px solid black; padding-bottom: 10px;}
            .label { width: 140px; font-weight: 900; font-size: 10px; flex-shrink: 0; }
            .value { flex-grow: 1; font-size: 11px; font-weight: bold; color: #374151; padding-left: 15px; }
            .intro-text { font-size: 10px; font-style: italic; color: #6b7280; font-weight: 500; padding: 5px 0; }
            
            /* 2. SPECIFICATION TABLE */
            .table-container { 
            border: 1.5px solid black; 
            border-bottom: none; /* Let the row blocks handle the bottom border */
            background: white; 
            margin: 0;
            }
            
            .main-table { 
            width: 100%; 
            border-collapse: collapse; 
            table-layout: fixed; 
            margin: 0;
            }
            
            .main-table thead tr { background: ${OFF_WHITE}; border-bottom: 1.5px solid black;}
            .main-table th { 
            padding: 5px 8px; font-size: 9px; font-weight: 900; color: ${PRIMARY_CHARCOAL}; 
            text-transform: uppercase; border-right: 1px solid black;
            }
            
            .main-table td { 
            padding: 15px 10px; vertical-align: top; border-right: 1px solid black; 
            border-bottom: 1px solid black; font-size: 10px; 
            }
            
            .main-table td:last-child, .main-table th:last-child { border-right: none; }
            .item-no { color: #9ca3af; font-weight: bold; text-align: center; }
            .qty-col { font-weight: 900; text-align: center; color: ${PRIMARY_CHARCOAL}; }
            .ref-photo { mix-blend-mode: multiply; width: 96px; height: 96px; object-fit: contain; display: block; margin: 0 auto; }
            .product-title { font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 4px; }
            .sku-text { color: #2563eb; font-weight: bold; font-size: 9px; margin-bottom: 10px; letter-spacing: -0.025em; }
            .desc-text { width: 100%; font-size: 9px; color: #000000; line-height: 1.2; }
            .variance-footnote { margin-top: 15px; font-size: 10px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid black; padding-bottom: 4px; }
            
            /* LOGISTICS GRID */
            .logistics-container { margin-top: 15px; border: 1px solid black; font-size: 9.5px; line-height: 1.3; }
            .logistics-row { display: flex; border-bottom: 1px solid black; }
            .logistics-row:last-child { border-bottom: none; }
            .logistics-label { width: 100px; padding: 8px; font-weight: 900; border-right: 1px solid black; flex-shrink: 0; }
            .logistics-value { padding: 8px; flex-grow: 1; }
            .bg-yellow-header { background-color: #facc15; }
            .bg-yellow-content { background-color: #fef9c3; }
            .bg-yellow-note { background-color: #fefce8; }
            .text-red-strong { color: #dc2626; font-weight: 900; display: block; margin-top: 4px; }

            /* 3. EXTENDED TERMS & CONDITIONS */
            .terms-section { margin-top: 25px; border-top: 2.5px solid black; padding-top: 10px; }
            .terms-header { background: ${PRIMARY_CHARCOAL}; color: white; padding: 4px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
            .terms-grid { display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 9px; line-height: 1.4; }
            .terms-label { font-weight: 900; text-transform: uppercase; padding: 4px 0; }
            .terms-val { padding: 4px 12px; border-left: 1px solid #e5e7eb; }
            .terms-highlight { background-color: #fef9c3; }
            .bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            
            /* SUMMARY BAR */
            .summary-bar { background: ${PRIMARY_CHARCOAL}; color: white; height: 45px; }
            .summary-bar td { border: none; vertical-align: middle; padding: 0 15px; }
            .tax-label { color: #f87171; font-style: italic; font-weight: 900; font-size: 9px; text-transform: uppercase; }
            .tax-options { display: flex; gap: 15px; font-size: 9px; font-weight: 900; text-transform: uppercase; }
            .tax-active { color: white; }
            .tax-inactive { color: rgba(255,255,255,0.3); }
            .grand-total-label { text-align: right; font-weight: 900; font-size: 10px; text-transform: uppercase; }
            .grand-total-value { text-align: right; font-weight: 900; font-size: 18px; }
            
            /* 4. OFFICIAL SIGNATURE HIERARCHY */
            .sig-hierarchy { margin-top: 48px; padding-top: 16px; border-top: 4px solid #1d4ed8; padding-bottom: 80px; }
            .sig-message { font-size: 9px; margin-bottom: 20px; font-weight: 500; line-height: 1.4; }
            .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .sig-side-internal { display: flex; flex-direction: column; gap: 10px; }
            .sig-side-client { display: flex; flex-direction: column; align-items: flex-end; gap: 40px; }
            .sig-line { border-bottom: 1px solid black; width: 256px; }
            .sig-rep-box { width: 256px; height: 40px; background: rgba(248, 113, 113, 0.1); 
            border: 1px solid #f87171; display: flex; align-items: center; 
            justify-content: center; text-align: center; font-size: 8px; 
            font-weight: 900; color: #dc2626; text-transform: uppercase; padding: 0 8px;
            }
            
            .sig-sub-label { font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

            /* WATERMARK */
            .watermark-container {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              pointer-events: none;
              z-index: 1000;
              overflow: hidden;
            }
            .watermark-text {
              position: absolute;
              font-size: 9px;
              font-weight: bold;
              color: rgba(18, 18, 18, 0.06);
              text-transform: uppercase;
              transform: rotate(-25deg);
              white-space: nowrap;
              width: 800px;
              letter-spacing: 1px;
            }
            </style>
          </head>
        <body></body>
      </html>
      `);
      iframeDoc.close();

      const companyLabel = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";
      const watermarkText = `${companyLabel} · OFFICIAL QUOTATION · ${payload.referenceNo}`;

      // 2. HELPER: ATOMIC SECTION CAPTURE
      const renderBlock = async (html: string, showWatermark = false) => {
        let finalHtml = html;
        if (showWatermark) {
          let watermarks = "";
          let rowIdx = 0;
          for (let y = -400; y < 1400; y += 75) {
            const offset = (rowIdx % 2 === 0) ? 0 : 400;
            for (let x = -800 + offset; x < 1200; x += 800) {
              watermarks += `<div class="watermark-text" style="top:${y}px; left:${x}px;">${watermarkText}</div>`;
            }
            rowIdx++;
          }
          finalHtml = `<div class="watermark-container">${watermarks}</div>${html}`;
        }
        iframeDoc.body.innerHTML = finalHtml;
        // Allow time for images to resolve
        const images = iframeDoc.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        }));

        const canvas = await html2canvas(iframeDoc.body, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        return {
          img: canvas.toDataURL('image/jpeg', 1.0),
          h: (canvas.height * pdfWidth) / canvas.width
        };
      };

      let currentY = 0;
      let pageCount = 1;

      const drawPageNumber = (currentCount: number) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Page ${currentCount}`, pdfWidth - 60, pdfHeight - 20);
      };

      const initiateNewPage = async () => {
        const banner = await renderBlock(`<img src="${headerImagePath}" class="header-img" />`, true);
        pdf.addImage(banner.img, 'JPEG', 0, 0, pdfWidth, banner.h);

        // Draw number for the CURRENT page
        drawPageNumber(pageCount);

        return banner.h;
      };

      // --- START GENERATION ---
      currentY = await initiateNewPage();

      // A. CLIENT INFO BLOCK
      const clientBlock = await renderBlock(`
        <div class="content-area">
        <div style="text-align:right; font-weight:900; font-size:10px; margin-bottom:10px;">
        REFERENCE NO: ${payload.referenceNo}<br>DATE: ${payload.date}
        </div>
        
        <div class="client-grid">
        <div class="grid-row border-t">
        <div class="label">COMPANY NAME:</div>
        <div class="value">${payload.companyName}</div>
        </div>

        <div class="grid-row"><div class="label">ADDRESS:</div>
        <div class="value">${payload.address}</div></div>
        <div class="grid-row">
        <div class="label">TEL NO:</div>
        <div class="value">${payload.telNo}</div>
        </div>

        <div class="grid-row border-b">
        <div class="label">EMAIL ADDRESS:</div>
        <div class="value">${payload.email}</div>
        </div>

        <div class="grid-row">
        <div class="label">ATTENTION:</div>
        <div class="value">${payload.attention}</div>
        </div>

        <div class="grid-row border-b">
        <div class="label">SUBJECT:</div>
        <div class="value">${payload.subject}</div>
        </div>
        </div>
        <p class="intro-text">We are pleased to offer you the following products for consideration:</p>
        </div>
        `, true);
      pdf.addImage(clientBlock.img, 'JPEG', 0, currentY, pdfWidth, clientBlock.h);
      currentY += clientBlock.h;

      // B. TABLE HEADER BLOCK
      const headerBlock = await renderBlock(`
        <div class="content-area">
        <div class="table-container">
        <table class="main-table">
        <thead>
        <tr>
        <th style="width: 40px;">ITEM NO</th>
        <th style="width: 40px;">QTY</th>
        <th style="width: 120px;">REFERENCE PHOTO</th>
        <th style="width: 200px;">PRODUCT DESCRIPTION</th>
        <th style="width: 80px; text-align:right;">UNIT PRICE</th>
        <th style="width: 80px; text-align:right;">TOTAL AMOUNT</th>
        </tr>
        </thead>
        </table>
        </div>
        </div>
        `, true);
      pdf.addImage(headerBlock.img, 'JPEG', 0, currentY, pdfWidth, headerBlock.h);
      currentY += 28; // Header height minus stitch to first row

      // C. ITEM ROWS
      for (const [index, item] of payload.items.entries()) {
        const rowBlock = await renderBlock(`
          <div class="content-area">
          <table class="main-table" style="border: 1.5px solid black; border-top: none;">
          <tr>
          <td style="width: 40px;" class="item-no">${index + 1}</td>
          <td style="width: 40px;" class="qty-col">${item.qty}</td>
          <td style="width: 120px;"><img src="${item.photo}" class="ref-photo"></td>
          <td style="width: 200px;">
          <div class="product-title" style="font-size: 7px;">${item.title}</div>
          <div class="sku-text">${item.sku}</div>
          <div class="desc-text">${item.description}</div>
          </td>
          <td style="width: 70px; text-align:right;">₱${item.unitPrice.toLocaleString()}</td>
          <td style="width: 40px; text-align:center;">${item.discount > 0 ? item.discount + '%' : '-'}</td>
          <td style="width: 70px; text-align:right;">₱${item.discount > 0 ? item.discountedAmount.toLocaleString() : item.unitPrice.toLocaleString()}</td>
          <td style="width: 80px; text-align:right; font-weight:900;">₱${item.totalAmount.toLocaleString()}</td>
          </tr>
          </table>
          </div>
          `, true);

        // Handle Page Breaks (Same logic)
        if (currentY + rowBlock.h > (pdfHeight - 50)) {
          pdf.addPage([612, 936]);
          pageCount++;
          currentY = await initiateNewPage();
          pdf.addImage(headerBlock.img, 'JPEG', 0, currentY, pdfWidth, headerBlock.h);
          currentY += 28; // Re-apply stitch on new page
        }

        pdf.addImage(rowBlock.img, 'JPEG', 0, currentY, pdfWidth, rowBlock.h);

        // UPDATE: Maintain the stitch for the next row
        currentY += rowBlock.h;
      }

      // D. GRAND TOTAL & LOGISTICS
      const footerBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0; padding-bottom:0;">
        <div class="table-container">
        <table class="main-table">
        <tr class="summary-bar">
        <td colspan="2"></td>
        <td class="tax-label">Tax Type:</td>
        <td style="width: 200px;">
        <div class="tax-options">
        <span class="${payload.vatTypeLabel === "VAT Inc" ? 'tax-active' : 'tax-inactive'}">
        ${payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
        </span>
        <span class="${payload.vatTypeLabel === "VAT Exe" ? 'tax-active' : 'tax-inactive'}">
        ${payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
        </span>
        </div>
        </td>
        <td style="width: 80px; text-align:right;" class="grand-total-label">Grand Total:</td>
        <td style="width: 80px; text-align:right;" class="grand-total-value">₱${payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>
        </table>
        </div>
        </div>
        `, true);
      if (currentY + footerBlock.h > (pdfHeight - BOTTOM_MARGIN)) {
        pdf.addPage([612, 936]); pageCount++; currentY = await initiateNewPage();
        pageCount++;
      }
      pdf.addImage(footerBlock.img, 'JPEG', 0, currentY, pdfWidth, footerBlock.h);
      currentY += footerBlock.h;

      // --- SECTION E.1: LOGISTICS & EXCLUSIONS ---
      const logisticsBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0;">
        <div class="variance-footnote">*PHOTO MAY VARY FROM ACTUAL UNIT</div>
        <div class="logistics-container">
        <div class="logistics-row">
        <div class="logistics-label bg-yellow-header">Included:</div>
        <div class="logistics-value bg-yellow-content">
        <p>Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p>
        <p>Orders outside Metro Manila Free delivery is available for a minimum sales transaction of ₱10,000 in Rizal, ₱15,000 in Bulacan and Cavite, and ₱25,000 in Laguna, Pampanga, and Batangas.</p>
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
        <div class="logistics-value bg-yellow-note" style="font-style: italic;">
        <p>Deliveries are up to the vehicle unloading point only.</p>
        <p>Additional shipping fee applies for other areas not mentioned above.</p>
        <p>Subject to confirmation upon getting the actual weight and dimensions of the items.</p>
        <span class="text-red-strong"><u>In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</u></span>
        </div>
        </div>
        </div>
        
        <div class="terms-section">
        <div class="terms-header">Terms and Conditions</div>
        <div class="terms-grid">
        <div class="terms-label">Availability:</div>
        <div class="terms-val terms-highlight">
        <p>*5-7 days if on stock upon receipt of approved PO.</p>
        <p>*For items not on stock/indent and order/special items are subject to a lead time of 45-60 days upon receipt of approved PO & down payment. Barring any delay in shipping and customs clearance beyond Disruptive's control.</p>
        <p>*In the event of a conflict or inconsistency in estimated days under Availability and another estimate indicated elsewhere in this quotation, the latter will prevail.</p>
        </div>
        
        <div class="terms-label">Warranty:</div>
        <div class="terms-val terms-highlight">
        <p>One (1) year from the time of delivery for all busted lights except the damaged fixture.</p>
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
        <p>Sales order has <b style="color:red;">validity period of 14 working days.</b> (excluding holidays and Sundays) from the date of issuance. Any sales order not confirmed and no verified payment within this <b style="color:red;">14-day period will be automatically cancelled.</b></p>
        </div>
        
        <div class="terms-label">Storage:</div>
        <div class="terms-val terms-highlight">
        <p>Orders with confirmation/verified payment but undelivered after 14 working days (excluding holidays and Sundays starting from picking date) due to clients’ request or shortcomings will be charged a storage fee of 10% of the value of the orders per month <b style="color:red;">(10% / 30 days = 0.33% per day).</b></p>
        </div>
        
        <div class="terms-label">Return:</div>
        <div class="terms-val terms-highlight">
        <p><b style="color:red;"><u>7 days return policy -</u></b>  if the product received is defective, damaged, or incomplete. This must be communicated to Disruptive, and Disruptive has duly acknowledged communication as received within a maximum of 7 days to qualify for replacement.</p>
        </div>
        </div>
        </div>
        </div>
        `, true);

      if (currentY + logisticsBlock.h > (pdfHeight - BOTTOM_MARGIN)) {
        pdf.addPage([612, 936]); pageCount++; currentY = await initiateNewPage();
      }
      pdf.addImage(logisticsBlock.img, 'JPEG', 0, currentY, pdfWidth, logisticsBlock.h);
      currentY += logisticsBlock.h;

      // --- SECTION E.2: FULL TERMS & SIGNATURE HIERARCHY ---
      const termsAndSigBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0;">
        <div class="terms-grid">
        <div class="terms-label">Payment:</div>
        <div class="terms-val">
        <p><strong style="color:red;">Cash on Delivery (COD)</strong></p>
        <p><strong>NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery. Exceeding 10,000 pesos should be transacted through bank deposit or mobile electronic transactions.</strong></p>
        <p>For special items, Seventy Percent (70%) down payment, 30% upon delivery.</p>
        <br>
        <p><strong>BANK DETAILS</strong></p>
        <p><b>Payee to: </b><strong>${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</strong></p>
        <br>
        
        <div class="bank-grid" style="display: flex; gap: 20px;">
        <div><strong>BANK: METROBANK</strong><br/>Account Name: ${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}<br/>Account Number: ${isEcoshift ? '243-7-243805100' : '243-7-24354164-2'}</div>
        <div><strong>BANK: BDO</strong><br/>Account Name: ${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}<br/>Account Number: ${isEcoshift ? '0021-8801-7271' : '0021-8801-9258'}</div>
        </div>
        </div>
        
        <div class="terms-label">DELIVERY:</div>
        <div class="terms-val terms-highlight">
        <p>Delivery/Pick up is subject to confirmation.</p>
        </div>
        
        <div class="terms-label">Validity:</div>
        <div class="terms-val">
        <p><b style="color:red;"><u>Thirty (30) calendar days from the date of this offer.</u></b></p>
        <p>In the event of changes in prevailing market conditions, duties, taxes, and all other importation charges, quoted prices are subject to change.</p>
        </div>
        
        <div class="terms-label">CANCELLATION:</div>
        <div class="terms-val terms-highlight">
        <p>1. Above quoted items are non-cancellable.</p>
        <p>2. If the customer cancels the order under any circumstances, the client shall be responsible for 100% cost incurred by Disruptive, including freight and delivery charges.</p>
        <p>3. Downpayment for items not in stock/indent and order/special items are non-refundable and will be forfeited if the order is canceled.</p>
        <p>4. COD transaction payments should be ready upon delivery. If the payment is not ready within seven (7) days from the date of order, the transaction is automatically canceled.</p>
        <p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p>
        </div>
        </div>
        
        <div class="sig-hierarchy">
        <p class="sig-message">
        Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance. Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.
        </p>
        
        <div class="sig-grid">
        <div class="sig-side-internal">
        <div>
          <p style="font-style: italic; font-size: 10px; font-weight: 900; margin-bottom: 25px;">${isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</p>
          <img src="${payload.signature || ''}" class="sig-rep-box" />
          <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; mt-1">${payload.salesRepresentative}</p>
          <div class="sig-line"></div>
          <p class="sig-sub-label">Sales Representative</p>
          <p style="font-size: 8px; font-style: italic;">Mobile: ${payload.salescontact || 'N/A'}</p>
          <p style="font-size: 8px; font-style: italic;">Email: ${payload.salesemail || 'N/A'}</p>
        </div>
        <div>
          <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #9ca3af; margin-bottom: 25px;">Approved By:</p>
          <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; mt-1">${payload.salestsmname}</p>
          <div class="sig-line"></div>
          <p class="sig-sub-label">SALES MANAGER</p>
          <p style="font-size: 8px; font-style: italic;">Mobile: ${payload.tsmDetails?.contact || 'N/A'}</p>
          <p style="font-size: 8px; font-style: italic;">Email: ${payload.tsmDetails?.email || 'N/A'}</p>
        </div>
        <div>
        
          <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #9ca3af; margin-bottom: 25px;">Noted By:</p>
          <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; mt-1">${payload.salesmanagername}</p>
          <div class="sig-line"></div>
          <p class="sig-sub-label">Sales-B2B</p>
        </div>
        </div>
        
        <div class="sig-side-client">
        <div>
        <div class="sig-line" style="margin-top: 73px;"></div>
        <p style="font-size: 9px; text-align: center; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Company Authorized Representative</p>
        </div>
        <div style="width: 256px;">
        <div class="sig-line" style="margin-top: 68px;"></div>
        <p style="font-size: 9px; text-align: center; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Payment Release Date</p>
        </div>
        <div style="width: 256px;">
        <div class="sig-line" style="margin-top: 68px;"></div>
        <p style="font-size: 9px; text-align: center; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Position in the Company</p>
        </div>
        </div>
        </div>
        </div>
        </div>
        <div style="margin-top: 20px; border-top: 1px dashed #e5e7eb; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8px; color: #9ca3af; font-weight: 500;">
          <div>Document ID: <b>${payload.referenceNo}</b> · Issued: ${new Date().toISOString()} · ${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</div>
          <div style="font-style: italic;">Valid only when downloaded from Taskflow.</div>
        </div>
        `, true);

      if (currentY + termsAndSigBlock.h > (pdfHeight - BOTTOM_MARGIN)) {
        pdf.addPage([612, 936]); pageCount++; currentY = await initiateNewPage();
      }
      pdf.addImage(termsAndSigBlock.img, 'JPEG', 0, currentY, pdfWidth, termsAndSigBlock.h);

      // 3. FINALIZATION
      pdf.save(`QUOTATION_${payload.referenceNo}.pdf`);
      document.body.removeChild(iframe);
    } catch (error) {
      console.error("Critical Export Error:", error);
    }
  };

  const toggleRow = (uid: string) => {
    setExpandedRows((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  return (
    <>
      {/* STEP 2 — SOURCE */}
      {step === 2 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel className="font-bold">Source</FieldLabel>
              <RadioGroup value={source} onValueChange={setSource}>
                {filteredSources.map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal" className="w-full items-start">
                      {/* LEFT */}
                      <FieldContent className="flex-1">
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>

                        {/* Buttons only visible if selected */}
                        {source === label && (
                          <div className="mt-4 flex gap-2">
                            <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                              <ArrowLeft /> Back
                            </Button>
                            <Button type="button" className="rounded-none" onClick={handleNext}>
                              Next <ArrowRight />
                            </Button>
                          </div>
                        )}
                      </FieldContent>
                      {/* RIGHT */}
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
        </div>
      )}

      {/* STEP 3 — PRODUCT DETAILS */}
      {step === 3 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel className="font-bold">Type</FieldLabel>
              <RadioGroup value={callType} onValueChange={setCallType}>
                {[
                  {
                    label: "Quotation Standard Preparation",
                    description: "Preparation of Standard quotation to client.",
                  },
                  {
                    label: "Quotation with Special Price Preparation",
                    description: "Preparation of Quotation with a special pricing offer.",
                  },
                  {
                    label: "Quotation with SPF Preparation",
                    description: "Preparation of Quotation including SPF.",
                  },
                ].map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal" className="w-full items-start">
                      {/* LEFT */}
                      <FieldContent className="flex-1">
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>
                      </FieldContent>

                      {/* RIGHT */}
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>

              <FieldLabel className="font-bold">Quotation For</FieldLabel>
              <RadioGroup
                value={quotationType}
                onValueChange={setQuotationType}
                required
                className="space-y-4"
              >
                {[
                  {
                    label: "Ecoshift Corporation",
                    description:
                      "The Fastest-Growing Provider of Innovative Lighting Solutions",
                  },
                  {
                    label: "Disruptive Solutions Inc",
                    description:
                      "future-ready lighting solutions that brighten spaces, cut costs, and power smarter business",
                  },
                ].map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal" className="w-full items-start">
                      {/* LEFT */}
                      <FieldContent className="flex-1">
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>

                        {/* Buttons only visible if selected */}
                        {quotationType === label && (
                          <div className="mt-4 flex gap-2">
                            <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                              <ArrowLeft /> Back
                            </Button>
                            <Button type="button" className="rounded-none" onClick={handleNext}>
                              Next <ArrowRight />
                            </Button>
                          </div>
                        )}
                      </FieldContent>

                      {/* RIGHT */}
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
        </div>
      )}

      {/* STEP 4 — PROJECT DETAILS */}
      {step === 4 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel className="font-bold">Project Name (Optional)</FieldLabel>
              <Input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="capitalize rounded-none"
              />

              <FieldLabel className="font-bold">Project Type</FieldLabel>
              <RadioGroup
                value={projectType}
                onValueChange={setProjectType}
              >
                {[
                  {
                    label: "B2B",
                    description: "Business to Business transactions.",
                  },
                  {
                    label: "B2C",
                    description: "Business to Consumer transactions.",
                  },
                  {
                    label: "B2G",
                    description: "Business to Government contracts.",
                  },
                  {
                    label: "Gentrade",
                    description: "General trade activities.",
                  },
                  {
                    label: "Modern Trade",
                    description: "Retail and modern trade partners.",
                  },
                ].map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal" className="w-full items-start">
                      {/* LEFT */}
                      <FieldContent className="flex-1">
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>

                        {/* Buttons only show if selected */}
                        {projectType === label && (
                          <div className="mt-4 flex gap-2">
                            <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                              <ArrowLeft /> Back
                            </Button>
                            <Button type="button" className="rounded-none" onClick={handleNext}>
                              Next <ArrowRight />
                            </Button>
                          </div>
                        )}
                      </FieldContent>

                      {/* RIGHT */}
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
        </div>
      )}

      {/* STEP 5 — QUOTATION DETAILS */}
      {step === 5 && (
        <div>
          <FieldGroup>
            <FieldSet>
              {/* <label className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  checked={isManualEntry}
                  onChange={(e) => {
                    const manual = e.target.checked;
                    setIsManualEntry(manual);
                    if (!manual) setManualProducts([]);
                  }}
                />
                <span className="text-xs font-medium">Add New Products</span>
              </label> */}

              {/* No Products Available Checkbox */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={noProductsAvailable}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNoProductsAvailable(checked);

                    if (checked) {
                      // Reset product related states kapag no products available
                      setSearchTerm("");
                      setSearchResults([]);
                    }
                  }}
                  className="h-6 w-6"
                />
                <span className="text-sm font-medium">No products available</span>
              </label>

              {/* Selected Products with quantity and price inputs */}
              {!noProductsAvailable && (
                <Button
                  onClick={() => setOpen(true)}
                  className="flex flex-col items-center justify-center gap-3 border-2 border-dashed bg-white text-black h-40 w-full hover:bg-gray-100 transition cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <ImagePlus className="h-10 w-10 text-gray-500" />
                  <span className="text-sm font-bold">
                    Select Products
                  </span>
                  {selectedProducts.length > 0 && (
                    <span className="text-xs text-green-700">
                      ({selectedProducts.length}) product{selectedProducts.length > 1 ? 's' : ''} selected
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    Browse and add items to this quotation
                  </span>
                </Button>
              )}

              <FieldLabel className="font-bold">Quotation Amount</FieldLabel>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={quotationAmount}
                onChange={(e) => setQuotationAmount(e.target.value)}
                placeholder="Enter quotation amount"
                className="rounded-none"
              />
              {Number(quotationAmount) === 0 && (<span className="text-red-600 text-sm block">Amount is Empty</span>)}
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button variant="outline" className="rounded-none" onClick={handleBack}>
              <ArrowLeft /> Back
            </Button>
            <Button className="rounded-none" onClick={handleNext}>
              Next <ArrowRight />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 6 — REMARKS & STATUS */}
      {step === 6 && (
        <div>
          <FieldGroup>
            <FieldSet>
              {followUpDate ? (
                <Alert variant="default" className="mb-4 flex flex-col gap-3 border-cyan-300 border-3 bg-cyan-100">
                  <div>
                    <AlertTitle className="font-bold">Follow Up Date:</AlertTitle>
                    <AlertDescription>
                      {followUpDate} — This is the scheduled date to reconnect with the client.
                    </AlertDescription>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Input
                      type="checkbox"
                      checked={useToday}
                      onChange={(e) => setUseToday(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="font-semibold">Today <span className="text-red-500 italic text-[10px]">(check if today)</span></span>
                  </label>
                </Alert>
              ) : (
                <></>
              )}

              {/**/}

              <FieldLabel className="font-bold">Remarks</FieldLabel>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any remarks here..."
                rows={3}
                className="capitalize rounded-none"
              />

              <FieldLabel className="font-bold">Status </FieldLabel>
              {/*<Select value={quotationStatus} onValueChange={setQuotationStatus} required>
                <SelectTrigger className="w-full rounded-none">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Pending Client Approval">Pending Client Approval</SelectItem>
                    <SelectItem value="For Bidding">For Bidding</SelectItem>
                    <SelectItem value="Nego">Nego</SelectItem>
                    <SelectItem value="Order Completed">Order Completed</SelectItem>
                    <SelectItem value="Convert to SO">Convert to SO</SelectItem>
                    <SelectItem value="Loss Price is Too High">Loss Price is Too High</SelectItem>
                    <SelectItem value="Lead Time Issue">Lead Time Issue</SelectItem>
                    <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                    <SelectItem value="Insufficient Stock">Insufficient Stock</SelectItem>
                    <SelectItem value="Lost Bid">Lost Bid</SelectItem>
                    <SelectItem value="Canvass Only">Canvass Only</SelectItem>
                    <SelectItem value="Did Not Meet the Specs">Did Not Meet the Specs</SelectItem>
                    <SelectItem value="Declined / Disapproved">Decline / Disapproved</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>*/}

              <FieldLabel className="font-bold">Approval Process </FieldLabel>
              <Select value={tsmApprovalStatus} onValueChange={setTsmApprovalStatus} required>
                <SelectTrigger className="w-full rounded-none">
                  <SelectValue placeholder="Select Approval Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Pending">Endorsed to TSM</SelectItem>
                    <SelectItem value="Endorsed to Sales Head">Endorsed to Sales Head</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {/* Quote-Done action — only visible once both Status and Approval Process are filled */}
              {tsmApprovalStatus ? (
                <>
                  <FieldLabel className="mt-3">Action</FieldLabel>
                  <RadioGroup value={status} onValueChange={setStatus} className="space-y-4">
                    {[
                      {
                        value: "Quote-Done",
                        title: "Quote-Done",
                        desc: "The quotation process is complete and finalized.",
                      },
                    ].map((item) => (
                      <FieldLabel key={item.value}>
                        <Field orientation="horizontal" className="w-full items-start">
                          {/* LEFT */}
                          <FieldContent className="flex-1">
                            <FieldTitle>{item.title}</FieldTitle>
                            <FieldDescription>{item.desc}</FieldDescription>

                            {/* Buttons only visible if selected */}
                            {status === item.value && (
                              <div className="mt-4 flex gap-2">
                                <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                                  <ArrowLeft /> Back
                                </Button>
                                <Button className="rounded-none" onClick={handleSaveClick}>
                                  Save <CheckCircle2Icon />
                                </Button>
                              </div>
                            )}
                          </FieldContent>

                          {/* RIGHT */}
                          <RadioGroupItem value={item.value} />
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                </>
              ) : (
                <p className="mt-3 text-xs text-gray-400 italic">
                  Complete the Status and Approval Process fields above to proceed.
                </p>
              )}
            </FieldSet>
          </FieldGroup>

          {/* Confirmation alert modal/dialog */}
          {showConfirmFollowUp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-black">
              <div className="max-w-md rounded-none bg-white p-6 shadow-lg">
                <Alert variant="default" className="p-4 flex items-center gap-3 w-full min-w-[400px] rounded-none">
                  <div className="flex-1">
                    <div className="mb-1">
                      <AlertTitle className="font-bold">Quotation Number</AlertTitle>
                    </div>

                    {isGenerating ? (
                      <AlertDescription className="text-sm text-gray-700 flex items-center gap-2">
                        <p>Generating your quotation number, please wait...</p>
                      </AlertDescription>
                    ) : hasGenerated ? (
                      <AlertDescription className="text-sm text-black">
                        Your quotation number is{" "}
                        <strong className="text-lg">{localQuotationNumber}</strong>
                        <br />
                        <p className="mt-1 text-xs text-gray-600">
                          It is automatically generated based on the quotation type, TSM
                          prefix, current year, and a sequential number.
                        </p>
                      </AlertDescription>
                    ) : (
                      <AlertDescription className="text-sm text-gray-500">
                        Click Generate to create a quotation number.
                      </AlertDescription>
                    )}
                  </div>
                </Alert>

                {/* Action buttons */}
                <div className="mt-4 flex flex-col gap-3">
                  <Button onClick={handleGenerateQuotation} variant="outline" className="w-full flex items-center justify-center gap-2 border border-dashed rounded-none p-10">
                    {isGenerating ? (
                      <>
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : hasGenerated ? (
                      <>
                        <RefreshCcw className="h-4 w-4" />
                        Generate Again
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="h-4 w-4" />
                        Generate Quotation Number
                      </>
                    )}
                  </Button>

                  {/*<Button onClick={handleDownloadQuotation} disabled={!hasGenerated} hidden={false} className="cursor-pointer rounded-none" style={{ padding: "2.5rem" }}>
                    <Download /> Download Quotation Excel
                  </Button>

                  <Button onClick={handleDownloadQuotationPDF} disabled={!hasGenerated} hidden={false} className="cursor-pointer rounded-none" style={{ padding: "2.5rem" }}>
                    <Download /> Download Quotation PDF
                  </Button>*/}

                  {!hasDownloaded && hasGenerated && (
                    <p className="text-sm text-yellow-600 mt-2 border border-dashed p-2 bg-red-100" hidden={false}>
                      ⚠️ Please download the quotation before saving.
                      <span className="text-sm text-red-600 italic ml-1">
                        Note: If there are no products or the quotation is empty, please do not download.
                      </span>
                    </p>
                  )}

                  <div className="flex justify-end gap-4 pt-10">
                    <Button variant="outline" className="rounded-none p-6" onClick={handleCancelFollowUp} disabled={isGenerating}>
                      Cancel
                    </Button>

                    <Button onClick={handleConfirmFollowUp} className="rounded-none p-6" disabled={!hasGenerated}>
                      Submit
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* product selection dialog/modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="h-screen max-h-screen overflow-hidden p-0 sm:p-0 w-full max-w-full flex flex-col [&>button]:hidden rounded-none"
          style={{
            maxWidth: "100vw",
            width: "100vw",
          }}
        >
          {/* HEADER */}
          <div className="flex flex-col border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between pl-6 pr-4 py-2.5 sm:pl-8 sm:pr-5">
              <div className="flex items-center gap-2">
                <DialogTitle className="font-black text-sm tracking-tight">Select Products</DialogTitle>
                {selectedProducts.length > 0 && (
                  <span className="hidden lg:inline-flex items-center justify-center bg-[#121212] text-white text-[10px] font-black rounded-full w-5 h-5">
                    {selectedProducts.length}
                  </span>
                )}
              </div>
              {/* Desktop: show total in header when products selected */}
              {selectedProducts.length > 0 && (
                <div className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
                  <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Total</span>
                  <span className="font-black text-lg text-[#121212] tabular-nums">
                    PHP {Number(quotationAmount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            {/* Mobile Tab Switcher — always shown on mobile */}
            <div className="flex lg:hidden border-t border-gray-100 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setMobilePanelTab("search")}
                className={`flex-1 py-2.5 transition-colors border-b-2 ${mobilePanelTab === "search" ? "border-[#121212] text-[#121212] bg-white" : "border-transparent text-gray-400 bg-gray-50"}`}
              >
                🔍 Search
              </button>
              <button
                type="button"
                onClick={() => setMobilePanelTab("products")}
                className={`flex-1 py-2.5 transition-colors border-b-2 ${mobilePanelTab === "products" ? "border-[#121212] text-[#121212] bg-white" : "border-transparent text-gray-400 bg-gray-50"}`}
              >
                🛒 Products ({selectedProducts.length})
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-hidden">
            <div
              className={`h-full flex flex-col lg:flex-row gap-0 lg:gap-3 lg:pl-3 lg:pr-3 lg:py-3 p-0 overflow-hidden`}
            >

              {/* Left side: Search + checkbox selected */}
              <div className={`relative flex-col gap-2 overflow-y-auto px-3 pt-2 h-full shrink-0 scrollbar-thin ${leftPanelCollapsed ? 'hidden lg:flex items-center w-12' : 'flex w-88 min-w-88'} ${mobilePanelTab === "products" && selectedProducts.length > 0 ? "hidden lg:flex" : "flex"}`}>
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
                      onClick={() => { setProductSource("shopify"); setSearchTerm(""); setSearchResults([]); setSearchError(null); setIsSpfMode(false); setIsSpf1Mode(false); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] font-bold rounded-md transition-all ${productSource === "shopify" && !isSpfMode && !isSpf1Mode ? "bg-white text-[#121212] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      <span>🛍️</span>
                      <span className="hidden sm:inline">Shopify</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setProductSource("firebase_taskflow"); setSearchTerm(""); setSearchResults([]); setSearchError(null); setIsSpfMode(false); setIsSpf1Mode(false); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] font-bold rounded-md transition-all ${productSource === "firebase_taskflow" && !isSpfMode && !isSpf1Mode ? "bg-white text-[#121212] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      <span>🗄️</span>
                      <span className="hidden sm:inline">DB</span>
                    </button>
                    <div className="w-px h-6 bg-gray-300"></div>
                    <button
                      type="button"
                      onClick={() => { setIsSpf1Mode(false); setIsSpfMode(true); setSearchTerm(""); setSearchResults([]); setSearchError(null); }}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] font-bold rounded-md transition-all ${isSpfMode ? "bg-green-500 text-white shadow-sm" : "text-gray-500 hover:text-green-600"}`}
                      title="Service Request Form"
                    >
                      <span>🛠️</span>
                      <span className="hidden sm:inline">SRF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsSpf1Mode(true); setIsSpfMode(false); setSearchTerm(""); setSearchResults([]); setSearchError(null); }}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] font-bold rounded-md transition-all ${isSpf1Mode ? "bg-red-500 text-white shadow-sm" : "text-gray-500 hover:text-red-600"}`}
                      title="Special Price Form"
                    >
                      <span>🧾</span>
                      <span className="hidden sm:inline">SPF</span>
                    </button>
                  </div>

                  {/* SPF Manual Entry Form OR Normal Search Input — never both */}
                  {isSpfMode ? (
                    <div className="flex flex-col gap-2 border border-red-200 bg-red-50 p-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-red-600 tracking-widest">SRF</span>
                        <span className="text-[9px] text-red-400 italic">— Service Request Form</span>
                      </div>

                      {/* Cloudinary Image Upload */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Service Image (optional)</label>
                        <div className="flex items-center gap-2">
                          <label className={`flex items-center justify-center gap-2 w-full border-2 border-dashed border-red-300 bg-white px-3 py-2 cursor-pointer hover:bg-red-50 transition ${spfUploading ? "opacity-50 pointer-events-none" : ""}`}>
                            <ImagePlus className="w-4 h-4 text-red-400" />
                            <span className="text-[10px] font-bold uppercase text-red-500">
                              {spfUploading ? "Uploading..." : spfManualProduct.imageUrl ? "Change Image" : "Upload Image"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={spfUploading}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setSpfUploading(true);
                                try {
                                  // Delete old image if replacing
                                  if (spfManualProduct.cloudinaryPublicId) {
                                    await deleteCloudinaryImage(spfManualProduct.cloudinaryPublicId);
                                  }
                                  const formData = new FormData();
                                  formData.append("file", file);
                                  const res = await fetch("/api/cloudinary/upload", {
                                    method: "POST",
                                    body: formData,
                                  });
                                  const data = await res.json();
                                  if (data.url) {
                                    setSpfManualProduct(prev => ({
                                      ...prev,
                                      imageUrl: data.url,
                                      cloudinaryPublicId: data.publicId || "",
                                    }));
                                  }
                                } catch (err) {
                                  console.error("Upload failed:", err);
                                } finally {
                                  setSpfUploading(false);
                                }
                              }}
                            />
                          </label>
                          {spfManualProduct.imageUrl && (
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteCloudinaryImage(spfManualProduct.cloudinaryPublicId);
                                setSpfManualProduct(prev => ({ ...prev, imageUrl: "", cloudinaryPublicId: "" }));
                              }}
                              className="p-1 text-red-500 hover:text-red-700"
                              title="Remove image"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {spfManualProduct.imageUrl && (
                          <img
                            src={spfManualProduct.imageUrl}
                            alt="preview"
                            className="w-20 h-20 object-cover border border-gray-200 mt-1 rounded-sm"
                          />
                        )}
                      </div>

                      {/* Product Name */}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Service Name *</label>
                        <Input
                          type="text"
                          placeholder="Enter service name..."
                          value={spfManualProduct.title}
                          onChange={(e) => setSpfManualProduct(prev => ({ ...prev, title: e.target.value }))}
                          className="rounded-none text-xs uppercase"
                        />
                      </div>

                      {/* SKU */}
                      {/* <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Item Code / SKU</label>
                        <Input
                          type="text"
                          placeholder="Enter item code..."
                          value={spfManualProduct.sku}
                          onChange={(e) => setSpfManualProduct(prev => ({ ...prev, sku: e.target.value }))}
                          className="rounded-none text-xs uppercase"
                        />
                      </div> */}

                      {/* Quantity & Price */}
                      <div className="grid grid-cols-1 gap-1.5">
                        {/* <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Qty</label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="1"
                            value={spfManualProduct.quantity}
                            onChange={(e) => setSpfManualProduct(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="rounded-none text-xs"
                          />
                        </div> */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Service Price</label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            value={spfManualProduct.price}
                            onChange={(e) => setSpfManualProduct(prev => ({ ...prev, price: Math.max(0, parseFloat(e.target.value) || 0) }))}
                            className="rounded-none text-xs"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Description</label>
                        <Textarea
                          placeholder="Enter service details"
                          value={spfManualProduct.description}
                          onChange={(e) => setSpfManualProduct(prev => ({ ...prev, description: e.target.value }))}
                          rows={3}
                          className="rounded text-xs"
                        />
                      </div>

                      {/* Add Button */}
                      <Button
                        type="button"
                        disabled={!spfManualProduct.title}
                        onClick={() => {
                          saveToHistory('Add SPF manual product');
                          setSelectedProducts(prev => [
                            ...prev,
                            {
                              id: `spf-${crypto.randomUUID()}`,
                              uid: crypto.randomUUID(),
                              title: spfManualProduct.title.toUpperCase(),
                              description: spfManualProduct.description,
                              skus: spfManualProduct.sku ? [spfManualProduct.sku] : [],
                              images: spfManualProduct.imageUrl ? [{ src: spfManualProduct.imageUrl }] : [],
                              quantity: spfManualProduct.quantity,
                              price: spfManualProduct.price,
                              discount: 0,
                              isDiscounted: false,
                              cloudinaryPublicId: spfManualProduct.cloudinaryPublicId,
                              regPrice: 0,
                            }
                          ]);
                          setSpfManualProduct({ title: "", sku: "", price: 0, quantity: 1, description: "", imageUrl: "", cloudinaryPublicId: "" });
                          setMobilePanelTab("products"); // auto-switch to products view on mobile
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 h-9 mt-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Service
                      </Button>
                    </div>
                  ) : isSpf1Mode ? (
                    <div className="flex flex-col gap-2 border border-red-200 bg-red-50 p-2.5 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-red-600 tracking-widest">SPF</span>
                          <span className="text-[9px] text-red-400 italic">— approved SPF list</span>
                        </div>
                        {spf1Loading && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                            Loading…
                          </span>
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
                        <div className="text-[11px] text-red-600 font-medium">
                          {spf1Error}
                        </div>
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
                                  if (spf1Selected?.id === r.id) {
                                    setSpf1Selected(null);
                                    return;
                                  }
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
                                      <span className="truncate col-span-2 text-[9px] text-gray-500 font-mono">
                                        Ref: {r.referenceid || "—"}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setMobilePanelTab("products")}
                                      className="w-full text-left text-[10px] font-black uppercase tracking-wider text-red-600 hover:text-red-800 py-1 border-t border-red-100/80"
                                    >
                                      View selected in quotation list →
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
                                              <img
                                                src={p.imageUrl}
                                                alt={p.title}
                                                className="w-12 h-12 object-cover border border-gray-200 shrink-0"
                                              />
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
                                                saveToHistory('Add SPF1 product');
                                                const specHtml = formatSpfTechSpecToHtml(p.technicalSpecification || "");
                                                const leadHtml = formatProcurementLeadHtml(p.leadTime || "");
                                                setSelectedProducts((prev) => [
                                                  ...prev,
                                                  {
                                                    id: `spf1-${crypto.randomUUID()}`,
                                                    uid: crypto.randomUUID(),
                                                    title: p.title,
                                                    description: `${specHtml}${leadHtml}`,
                                                    skus: p.sku ? [p.sku] : [],
                                                    images: p.imageUrl ? [{ src: p.imageUrl }] : [],
                                                    quantity: Math.max(1, p.quantity),
                                                    price: p.finalSellingPrice,
                                                    discount: 0,
                                                    isDiscounted: false,
                                                    procurementMinQty: p.quantity,
                                                    procurementLeadTime: p.leadTime,
                                                    procurementLockedPrice: true,
                                                    originalPrice: p.finalSellingPrice,
                                                    procurementItemCode: p.sku || "",
                                                    regPrice: 0,
                                                  },
                                                ]);
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
                              placeholder="Type product name or SKU..."
                              value={searchTerm}
                              onChange={(e) => {
                                if (isManualEntry) return;
                                setSearchTerm(e.target.value);
                                if (searchError) setSearchError(null);
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
                        {isSearching && <p className="text-[10px] animate-pulse">Searching...</p>}
                        {searchError && !isSearching && (
                          <p className="text-[10px] text-red-500">{searchError}</p>
                        )}
                      </>
                    )
                  )}
                </div>

                {/* Search Results — only shown when not in SPF mode */}
                {!isSpfMode && !isSpf1Mode && !isManualEntry && searchResults.length > 0 && (
                  <>
                    {/* Premium Product Cards - Respect View Mode */}
                    <div className={`overflow-x-hidden ${
                      productViewMode === 'grid' 
                        ? 'grid grid-cols-2 gap-2' 
                        : 'flex flex-col gap-2'
                    }`}>
                      {searchResults.map((item) => {
                        const isDbSource = productSource === "firebase_taskflow";
                        const variantOptions = item.itemCodeVariants || [];
                        const showVariantSelector =
                          isDbSource &&
                          item.requiresItemCodeSelection &&
                          variantOptions.length > 0;
                        const quickSku = item.skus?.[0] || variantOptions[0]?.code || "";

                        return (
                          <div
                            key={item.id}
                            className="group bg-white border border-gray-100 rounded-lg px-2 py-1.5 hover:shadow-md hover:border-blue-200 transition-all overflow-hidden min-h-14 cursor-grab active:cursor-grabbing"
                            draggable
                            onDragStart={(e) => {
                              const dragSku = showVariantSelector ? "" : quickSku;
                              const dragPayload: Product = {
                                ...item,
                                skus: dragSku ? [dragSku] : [],
                              };
                              e.dataTransfer.effectAllowed = "copy";
                              e.dataTransfer.setData("application/json", JSON.stringify(dragPayload));
                            }}
                          >
                            <div className="grid grid-cols-[40px_1fr_24px] gap-2 items-center">
                              {/* Product Image */}
                              <div className="w-10 h-10 shrink-0">
                                {item.images?.[0]?.src ? (
                                  <img
                                    src={item.images[0].src}
                                    alt={item.title}
                                    className="w-full h-full object-cover rounded-md"
                                    onClick={() => {
                                      setPreviewImageUrl(item.images?.[0]?.src || "");
                                      setImagePreviewOpen(true);
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-50 rounded-md flex items-center justify-center">
                                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              {/* Product Info */}
                              <div className="min-w-0 overflow-hidden">
                                <h4 className="text-[10px] font-semibold text-gray-800 leading-tight line-clamp-2">{item.title}</h4>
                                <p className="text-[9px] text-gray-400 truncate">
                                  {showVariantSelector ? "Multiple item codes available" : (quickSku || "No SKU")}
                                </p>
                              </div>

                              {/* Add Button */}
                              {showVariantSelector ? (
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="w-6 h-6 flex items-center justify-center bg-[#121212] text-white rounded-full hover:bg-gray-800 transition-colors shadow-sm"
                                      title="Select item code variant"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56 p-1.5">
                                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-gray-500 px-1.5 py-1">
                                      Item Codes
                                    </DropdownMenuLabel>
                                    <div className="flex flex-col gap-1">
                                      {variantOptions.map((variant, index) => (
                                        <div
                                          key={`${item.id}-${variant.label}-${variant.code}-${index}`}
                                          role="button"
                                          tabIndex={0}
                                          draggable
                                          onDragStart={(e) => {
                                            // Prevent parent card drag handler from overriding variant payload
                                            e.stopPropagation();
                                            const variantPayload: Product = {
                                              ...item,
                                              skus: [variant.code],
                                            };
                                            e.dataTransfer.effectAllowed = "copy";
                                            e.dataTransfer.setData("application/json", JSON.stringify(variantPayload));
                                          }}
                                          onClick={() =>
                                            addSearchResultProduct(
                                              item,
                                              variant.code,
                                              `Add product (${variant.code})`
                                            )
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              addSearchResultProduct(
                                                item,
                                                variant.code,
                                                `Add product (${variant.code})`
                                              );
                                            }
                                          }}
                                          className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing rounded-md border border-blue-100 bg-blue-50 px-2 py-1.5 hover:bg-blue-100 transition-colors"
                                          title="Click to add or drag this item code variant"
                                        >
                                          <span className="text-[9px] font-semibold text-blue-800 uppercase">
                                            {variant.label}
                                          </span>
                                          <span className="text-[9px] text-blue-700 font-medium truncate">
                                            {variant.code}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => addSearchResultProduct(item, quickSku)}
                                  className="w-6 h-6 flex items-center justify-center text-white rounded-full transition-colors bg-[#121212] hover:bg-gray-800 shadow-sm"
                                  title="Add to quotation"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Recent Products Section */}
                {!isSpfMode && !isSpf1Mode && !isManualEntry && recentProducts.length > 0 && (
                  <div className="flex flex-col gap-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Recently Added:</span>
                      <span className="text-[9px] text-gray-400">({recentProducts.length})</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {recentProducts.map((product) => (
                        <div
                          key={product.uid}
                          className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                          onClick={() => reAddRecentProduct(product)}
                          title="Click to add again"
                        >
                          <div className="w-6 h-6 shrink-0">
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
                  </div>
                )}

                {/* Selected Products checkboxes */}
                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[20vh] lg:max-h-[35vh] border border-dashed p-2 rounded-lg">
                  {selectedProducts.length === 0 && (
                    <p className="text-xs text-gray-500">No products selected.</p>
                  )}

                  {selectedProducts.map((item, index) => (
                    <div key={item.uid} className="flex flex-col">
                      {index !== 0 && <Separator className="my-1" />}
                      <label className="flex items-center gap-2 text-xs cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked
                          className="accent-blue-500"
                          onChange={() => {
                            saveToHistory('Remove product');
                            const toRemove = selectedProducts.find((p) => p.uid === item.uid);
                            if (toRemove?.cloudinaryPublicId) {
                              deleteCloudinaryImage(toRemove.cloudinaryPublicId);
                            }
                            setSelectedProducts((prev) =>
                              prev.filter((p) => p.uid !== item.uid)
                            );
                            setVisibleDescriptions((prev) => {
                              const copy = { ...prev };
                              delete copy[item.uid];
                              return copy;
                            });
                          }}
                        />
                        <span>{item.title}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right side: Selected Products as Table with Image & Editable Description */}
              <div
                className={`flex-1 overflow-y-auto px-2 lg:px-3 pb-3 lg:pb-0 min-h-0 ${selectedProducts.length > 0 && mobilePanelTab === "search" ? "hidden lg:block" : "block"} ${isDragOver ? "ring-2 ring-blue-400 ring-inset rounded-lg bg-blue-50/30" : ""} transition-all`}
                onDragOver={(e) => {
                  // Only show drop highlight for product cards from left panel, not row reorders
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
                    handleSearchProductDrop(item);
                  } catch (err) {
                    console.error("Drop failed:", err);
                  }
                }}
              >
                {selectedProducts.length === 0 && (
                  <div className={`flex flex-col items-center justify-center h-full min-h-[300px] border-2 border-dashed rounded-lg transition-all ${isDragOver ? "border-blue-400 bg-blue-50 text-blue-500" : "border-gray-200 text-gray-400"}`}>
                    <div className="text-5xl mb-3">{isDragOver ? "📥" : "📋"}</div>
                    <p className="font-black text-sm uppercase tracking-widest">
                      {isDragOver ? "Drop to add product" : "No products selected"}
                    </p>
                    {!isDragOver && (
                      <div className="flex flex-col items-center gap-2 mt-4">
                        <div className="flex items-center gap-2 text-xs bg-white px-3 py-2 rounded-lg shadow-sm border">
                          <span className="bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                          <span>Search product on left panel</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs bg-white px-3 py-2 rounded-lg shadow-sm border">
                          <span className="bg-green-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                          <span>Click + or drag to add</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs bg-white px-3 py-2 rounded-lg shadow-sm border">
                          <span className="bg-purple-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
                          <span>Edit prices & quantities here</span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs mt-4 opacity-60 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> Click help button for detailed guide
                    </p>
                  </div>
                )}
                {selectedProducts.length > 0 && (
                  <>
                    {/* Premium Controls Bar */}
                    <div className="flex flex-col gap-2 mb-3">
                      {/* Row 1: Title + Search + Legend */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h4 className="font-black text-sm tracking-tight">
                            Product List
                            <span className="ml-2 text-xs font-normal text-gray-400">({selectedProducts.length} items)</span>
                          </h4>
                          {/* Search */}
                          <div className="relative w-48">
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              type="text"
                              value={productSearchQuery}
                              onChange={(e) => setProductSearchQuery(e.target.value)}
                              placeholder="Search in products..."
                              className="w-full pl-9 pr-8 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {productSearchQuery && (
                              <button
                                onClick={() => setProductSearchQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {productSearchQuery && (
                            <span className="text-xs text-gray-500">
                              {selectedProducts.filter(p =>
                                p.title?.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                                p.skus?.some(sku => sku?.toLowerCase().includes(productSearchQuery.toLowerCase()))
                              ).length} found
                            </span>
                          )}
                        </div>
                        {/* Quick Legend with Help */}
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">Click any text to edit • Check boxes to enable features</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-500">
                            <span className="flex items-center gap-1.5" title="Promo items are highlighted in yellow"><span className="w-3 h-3 bg-yellow-400 rounded-sm"></span>Promo</span>
                            <span className="flex items-center gap-1.5" title="Hides pricing details on PDF"><span className="w-3 h-3 bg-blue-400 rounded-sm"></span>Hide Price</span>
                            <span className="flex items-center gap-1.5" title="Drag ⠿ handle to reorder rows">⠿ Drag</span>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Options Bar */}
                      <div className="flex flex-wrap items-center gap-2 text-xs bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-2">
                        {/* Visual Guide Badge */}
                        <div className="flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          PDF OPTIONS
                        </div>

                        {/* Discount Column Toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const newValue = !showDiscountColumns;
                            console.log('Show Discounts clicked, newValue:', newValue);
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
                                console.log('Confirm clicked, setting showDiscountColumns to:', newValue);
                                setShowDiscountColumns(newValue);
                              },
                              onCancel: () => {
                                console.log('Cancel clicked');
                              }
                            });
                          }}
                          className="flex items-center gap-1.5 cursor-pointer hover:bg-blue-100/50 px-1.5 py-0.5 rounded transition-colors group pointer-events-auto"
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
                          <svg className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        <div className="w-px h-4 bg-blue-200"></div>

                        {/* NEW: Hide discount in preview toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const newValue = !hideDiscountInPreview;
                            console.log('SRP Only PDF clicked, newValue:', newValue);
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
                                console.log('Confirm SRP clicked, setting hideDiscountInPreview to:', newValue);
                                setHideDiscountInPreview(newValue);
                              },
                              onCancel: () => {
                                console.log('Cancel SRP clicked');
                              }
                            });
                          }}
                          className="flex items-center gap-1.5 cursor-pointer hover:bg-purple-100/50 px-1.5 py-0.5 rounded transition-colors group pointer-events-auto"
                          title="Click for detailed explanation with examples"
                        >
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
                          <svg className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        <div className="w-px h-4 bg-blue-200"></div>

                        {/* Summary Discount Toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const newValue = !showSummaryDiscounts;
                            console.log('Show Discount Row clicked, newValue:', newValue);
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
                                console.log('Confirm Discount Row clicked, setting showSummaryDiscounts to:', newValue);
                                setShowSummaryDiscounts(newValue);
                              },
                              onCancel: () => {
                                console.log('Cancel Discount Row clicked');
                              }
                            });
                          }}
                          className="flex items-center gap-1.5 cursor-pointer hover:bg-red-100/50 px-1.5 py-0.5 rounded transition-colors group pointer-events-auto"
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
                          <svg className="w-3 h-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        <div className="w-px h-4 bg-blue-200"></div>

                        {/* Profit Margin Toggle (Internal Only) */}
                        {/* <label className="flex items-center gap-1 cursor-pointer hover:bg-green-100/50 px-1.5 py-0.5 rounded transition-colors group relative" title="Show cost and margin (sales team only)">
                          <input
                            type="checkbox"
                            checked={showProfitMargins}
                            onChange={(e) => setShowProfitMargins(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-green-300 text-green-600 focus:ring-green-500"
                          />
                          <span className={`font-medium ${showProfitMargins ? 'text-green-700' : 'text-gray-500'}`}>
                            {showProfitMargins ? '✓ Show Margins' : '○ Hide Margins'}
                          </span>
                          <span className="text-[8px] bg-green-100 text-green-600 px-1 rounded border border-green-200">INTERNAL</span>
                          <span className="absolute -bottom-8 left-0 w-48 bg-gray-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-tight">
                            {showProfitMargins
                              ? 'Shows Cost & Margin % per item (Sales team only)'
                              : 'Hidden from view. Toggle ON to see profit margins'}
                          </span>
                        </label> */}

                        <div className="w-px h-4 bg-blue-200"></div>

                        {/* Margin Alert Toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const newValue = !showMarginAlerts;
                            console.log('Margin Alert clicked, newValue:', newValue);
                            setConfirmDialog({
                              isOpen: true,
                              title: newValue ? 'Enable Margin Alert?' : 'Disable Margin Alert?',
                              description: newValue
                                ? `Margin alerts will warn you when your profit margin drops below ${marginAlertThreshold}%. This helps protect your profitability on quotes.`
                                : 'Margin alerts will be disabled. You will no longer receive warnings when margins drop below threshold.',
                              onConfirm: () => {
                                console.log('Confirm Margin Alert clicked, setting to:', newValue);
                                setShowMarginAlerts(newValue);
                              },
                              onCancel: () => {
                                console.log('Cancel Margin Alert clicked');
                              }
                            });
                          }}
                          className="flex items-center gap-1 cursor-pointer hover:bg-orange-100/50 px-1.5 py-0.5 rounded transition-colors group pointer-events-auto"
                          title="Click to enable/disable margin alerts"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showMarginAlerts ? 'bg-orange-600 border-orange-600' : 'bg-white border-orange-300'}`}>
                            {showMarginAlerts && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className={`font-medium ${showMarginAlerts ? 'text-orange-700' : 'text-gray-500'}`}>
                            {showMarginAlerts ? '✓ Margin Alert' : '○ No Alert'}
                          </span>
                          {showMarginAlerts && (
                            <input
                              type="number"
                              value={marginAlertThreshold}
                              onChange={(e) => setMarginAlertThreshold(Number(e.target.value))}
                              onClick={(e) => e.stopPropagation()}
                              className="w-12 text-[9px] border border-orange-300 rounded px-1 py-0.5"
                              min="0"
                              max="100"
                              title="Alert threshold %"
                            />
                          )}
                          <span className="absolute -bottom-6 left-0 w-44 bg-gray-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Alert when margin below {marginAlertThreshold}%
                          </span>
                        </button>

                        <div className="w-px h-4 bg-blue-200"></div>

                        {/* Template Button */}
                        <button
                          type="button"
                          onClick={() => setShowTemplateModal(true)}
                          className="flex items-center gap-1 text-[10px] font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-100/50 px-1.5 py-0.5 rounded transition-colors"
                          title="Save/Load quote templates"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                          </svg>
                          Templates
                        </button>

                        {/* Undo/Redo Buttons */}
                        <div className="flex items-center gap-0.5">
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
                          className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded transition-colors ${
                            bulkMode ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
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
                        <div className="flex items-center gap-2 text-[10px] bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                          <span className="font-medium text-yellow-700">{selectedRows.size} selected</span>
                          <div className="w-px h-3 bg-yellow-300"></div>
                          <button
                            type="button"
                            onClick={selectAllRows}
                            className="text-yellow-700 hover:text-yellow-900 font-medium"
                          >
                            {selectedRows.size === selectedProducts.length ? 'Deselect All' : 'Select All'}
                          </button>
                          <button
                            type="button"
                            onClick={duplicateSelectedRows}
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={copySelectedRows}
                            className="text-green-600 hover:text-green-800 font-medium flex items-center gap-1"
                            title="Copy selected rows to clipboard (Ctrl+C)"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={pasteFromClipboard}
                            className="text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                            title="Paste from clipboard (Ctrl+V)"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            Paste
                          </button>
                          <button
                            type="button"
                            onClick={deleteSelectedRows}
                            className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                      {/* Subject + VAT + WHT — single compact toolbar */}
                      <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-0 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden text-[10px]">
                        {/* Subject */}
                        <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-[200px] border-b lg:border-b-0 lg:border-r border-gray-200">
                          <span className="font-black uppercase text-red-600 tracking-wider shrink-0 text-[9px]">Subject *</span>
                          <div className="flex items-center gap-1.5 flex-1 min-w-[120px] group">
                            <input
                              type="text"
                              value={quotationSubject}
                              onChange={(e) => setQuotationSubject(e.target.value)}
                              placeholder="Click to edit subject..."
                              className="border border-gray-200 bg-white px-2 py-1 rounded text-[11px] font-bold uppercase flex-1 min-w-[100px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder-gray-400"
                            />
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                        </div>

                        {/* Contact Person - dropdown selection with editable details */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b lg:border-b-0 lg:border-r border-gray-200">
                          <span className="font-black uppercase text-blue-600 tracking-wider shrink-0 text-[9px]">Contact Person</span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Contact Person Dropdown */}
                            <Select
                              value={localContactPerson}
                              onValueChange={(value) => {
                                const selected = availableContacts?.find(c => c.name === value);
                                if (selected) {
                                  setLocalContactPerson(selected.name);
                                  setLocalContactNumber(selected.contact_number);
                                  setLocalEmailAddress(selected.email_address);
                                }
                              }}
                            >
                              <SelectTrigger className="border border-gray-200 bg-white px-2 py-0.5 rounded text-[10px] font-bold uppercase w-32 shrink-0 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent className="text-[10px]">
                                {availableContacts && availableContacts.length > 0 ? (
                                  availableContacts.filter((c) => c.name).map((contact, idx) => (
                                    <SelectItem key={idx} value={contact.name} className="text-[10px] py-1">
                                      <span className="font-bold">{contact.name}</span>
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1 text-[9px] text-gray-500">No contacts</div>
                                )}
                              </SelectContent>
                            </Select>
                            {/* Editable Contact Details - inline */}
                            <input
                              type="text"
                              value={localContactPerson}
                              onChange={(e) => setLocalContactPerson(e.target.value)}
                              placeholder="Name"
                              className="border border-gray-200 bg-white px-2 py-0.5 rounded text-[9px] font-bold uppercase flex-1 min-w-0 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder-gray-400"
                            />
                            <input
                              type="text"
                              value={localContactNumber}
                              onChange={(e) => setLocalContactNumber(e.target.value)}
                              placeholder="Number"
                              className="border border-gray-200 bg-white px-2 py-0.5 rounded text-[9px] w-24 shrink-0 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder-gray-400"
                            />
                            <input
                              type="text"
                              value={localEmailAddress}
                              onChange={(e) => setLocalEmailAddress(e.target.value)}
                              placeholder="Email"
                              className="border border-gray-200 bg-white px-2 py-0.5 rounded text-[9px] w-32 shrink-0 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder-gray-400"
                            />
                          </div>
                        </div>

                        {/* Delivery Address */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b lg:border-b-0 lg:border-r border-gray-200 flex-1 min-w-[200px]">
                          <span className="font-black uppercase text-green-600 tracking-wider shrink-0 text-[9px]">Delivery Address</span>
                          <div className="flex items-center gap-1.5 flex-1 min-w-[120px] group">
                            <input
                              type="text"
                              value={localDeliveryAddress}
                              onChange={(e) => setLocalDeliveryAddress(e.target.value)}
                              placeholder="Enter delivery address..."
                              className="border border-gray-200 bg-white px-2 py-1 rounded text-[11px] font-bold uppercase flex-1 min-w-[100px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder-gray-400"
                            />
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                        </div>

                        {/* VAT */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b lg:border-b-0 lg:border-r border-gray-200">
                          <span className="font-black uppercase text-gray-400 tracking-wider shrink-0 text-[9px]">VAT</span>
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
                                  if (vatType === v) return;
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: `Switch to ${desc}?`,
                                    description: explanation,
                                    example: example,
                                    onConfirm: () => setVatType(v),
                                    onCancel: () => {}
                                  });
                                }}
                                className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-all ${vatType === v ? "text-[#121212]" : "text-gray-300 hover:text-gray-500"}`}
                              >
                                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${vatType === v ? "border-[#121212]" : "border-gray-300"}`}>
                                  {vatType === v && <div className="w-1.5 h-1.5 rounded-full bg-[#121212]" />}
                                </div>
                                <span className="font-black uppercase text-[10px]">{l}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* EWT */}
                        <div className="flex items-center gap-2 px-3 py-2">
                          <span className="font-black uppercase text-gray-400 tracking-wider shrink-0 text-[9px]">EWT</span>
                          <div className="flex gap-2">
                            {[
                              { v: "none", l: "None", desc: "No EWT", explanation: "No Expanded Withholding Tax deducted. Full amount paid to supplier.", example: "Total: ₱100,000 | EWT: ₱0 | Pay to Supplier: ₱100,000" },
                              { v: "wht_1", l: "1%", desc: "1% EWT", explanation: "1% withholding tax deducted. For rent, services, or contractors.", example: "Total: ₱100,000 | EWT (1%): ₱1,000 | Pay to Supplier: ₱99,000" },
                              { v: "wht_2", l: "2%", desc: "2% EWT", explanation: "2% withholding tax deducted. For regular suppliers of goods.", example: "Total: ₱100,000 | EWT (2%): ₱2,000 | Pay to Supplier: ₱98,000" }
                            ].map(({ v, l, desc, explanation, example }) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => {
                                  if (whtType === v) return;
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: `Switch to ${desc}?`,
                                    description: explanation,
                                    example: example,
                                    onConfirm: () => setWhtType(v),
                                    onCancel: () => {}
                                  });
                                }}
                                className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-all ${whtType === v ? "text-[#121212]" : "text-gray-300 hover:text-gray-500"}`}
                              >
                                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${whtType === v ? "border-[#121212]" : "border-gray-300"}`}>
                                  {whtType === v && <div className="w-1.5 h-1.5 rounded-full bg-[#121212]" />}
                                </div>
                                <span className="font-black uppercase text-[10px]">{l}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative">
                      {isDragOver && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none rounded border-2 border-dashed border-blue-400 bg-blue-50/70">
                          <p className="font-black text-blue-500 text-base uppercase tracking-widest">📥 Drop to add product</p>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs table-auto border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-[#121212] text-white text-[10px] uppercase tracking-wider">
                              {visibleColumns.dragHandle && (
                                <th className="border border-gray-700 p-2 text-center w-7 text-gray-400 select-none" title="Drag ⠿ to reorder rows">⠿</th>
                              )}
                              {bulkMode && (
                                <th className="border border-gray-700 p-2 text-center w-8" title="Select rows for bulk operations">
                                  <input
                                    type="checkbox"
                                    checked={selectedRows.size === selectedProducts.length && selectedProducts.length > 0}
                                    onChange={selectAllRows}
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                </th>
                              )}
                              {visibleColumns.rowNumber && (
                                <th className="border border-gray-700 p-2 text-center w-8 font-bold" title="Row number">#</th>
                              )}
                              {visibleColumns.discountToggle && (
                                <th className="border border-gray-700 p-2 text-center w-8" title="Click to apply discount to ALL items">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      const allDiscounted = selectedProducts.every((p) => p.isDiscounted);
                                      const newValue = !allDiscounted;
                                      const affectedCount = selectedProducts.length;
                                      console.log('DISC header clicked, newValue:', newValue, 'affected items:', affectedCount);
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: newValue ? `Enable Discount for ALL ${affectedCount} items?` : `Disable Discount for ALL ${affectedCount} items?`,
                                        description: newValue
                                          ? `This will apply a ${vatType === "vat_exe" ? 12 : 0}% discount to ALL ${affectedCount} items in your quotation. Each item will show the discount badge and calculate discounted prices.`
                                          : `This will remove discounts from ALL ${affectedCount} items. All items will revert to their original prices without discounts.`,
                                        example: newValue
                                          ? `All ${affectedCount} items will show: Unit Price → Discount ${vatType === "vat_exe" ? 12 : 0}% → Net Price with discount badge`
                                          : `All ${affectedCount} items revert to original pricing without discount badges`,
                                        onConfirm: () => {
                                          console.log('Confirm DISC all clicked, setting all items to:', newValue);
                                          setSelectedProducts((prev) =>
                                            prev.map((p) => ({
                                              ...p,
                                              isDiscounted: newValue,
                                              discount: newValue ? (vatType === "vat_exe" ? 12 : 0) : 0,
                                              discountAmount: 0,
                                            }))
                                          );
                                        },
                                        onCancel: () => {
                                          console.log('Cancel DISC all clicked');
                                        }
                                      });
                                    }}
                                    className="flex flex-col items-center justify-center gap-0.5 cursor-pointer w-full"
                                  >
                                    <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedProducts.every((p) => p.isDiscounted) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400'}`}>
                                      {selectedProducts.every((p) => p.isDiscounted) && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </span>
                                    <span className="font-bold text-[9px]">Disc</span>
                                  </button>
                                </th>
                              )}
                              {visibleColumns.promoBadge && (
                                <th className="border border-gray-700 p-2 text-center w-8" title="Check to show PROMO badge on quote">
                                  <span className="font-bold text-yellow-300 text-[9px]">Promo</span>
                                </th>
                              )}
                              {visibleColumns.hideDiscount && (
                                <th className="border border-gray-700 p-2 text-center w-8" title="Check to HIDE discount details on PDF">
                                  <span className="font-bold text-blue-300 text-[9px]">Hide</span>
                                </th>
                              )}
                              {visibleColumns.displayMode && (
                                <th className="border border-gray-700 p-2 text-center font-bold w-20 bg-purple-900/20" title="How to display pricing to client">
                                  <span className="text-purple-300 text-[9px]">Display</span>
                                </th>
                              )}
                              <th className="border border-gray-700 p-2 text-left font-bold min-w-[120px]" title="Click image to preview, click title to edit">Product</th>
                              <th className="border border-gray-700 p-2 text-center font-bold w-20" title="Quantity">Qty</th>
                              <th className="border border-gray-700 p-2 text-center font-bold w-28" title="Unit price (can be edited)">
                                <div className="flex items-center justify-center gap-1">
                                  <span>Unit</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Unit Price Column',
                                        description: 'The Unit Price is the original price per item before any discounts are applied. This is the base price that clients would normally pay without any special pricing.',
                                        example: 'Formula: Unit Price = Original Product Price\n\nExample: LED Bulb = ₱500.00 per unit',
                                        onConfirm: () => setConfirmDialog(null),
                                        onCancel: () => setConfirmDialog(null)
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
                              {showDiscountColumns && (
                                <th className="border border-gray-700 p-2 text-center font-bold w-52" title="Discount % and amount per unit">
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
                                          onCancel: () => setConfirmDialog(null)
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
                              )}
                              <th className="border border-gray-700 p-2 text-center font-bold w-24 bg-blue-900/20" title="Net price after discount (editable - changes discount %)">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-blue-300">Net</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Net Price Column',
                                        description: 'The Net Price is the final price per item after discount has been applied. This is what the client actually pays per unit. You can directly edit this value and it will automatically recalculate the discount percentage.',
                                        example: 'Formula: Net Price = Unit Price − Discount Amount\n\nExample: ₱500 − ₱100 = ₱400 Net Price\n\nReverse Calculation:\nIf you set Net = ₱400, Discount % = ((500−400)÷500)×100 = 20%',
                                        onConfirm: () => setConfirmDialog(null),
                                        onCancel: () => setConfirmDialog(null)
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
                              {showProfitMargins && (
                                <>
                                  <th className="border border-gray-700 p-2 text-center font-bold w-24 bg-green-900/20" title="Cost price (from procurement)">
                                    <span className="text-green-400">Cost</span>
                                  </th>
                                  <th className="border border-gray-700 p-2 text-center font-bold w-20 bg-green-900/20" title="Profit margin % ((Price - Cost) / Price × 100)">
                                    <span className="text-green-400">Margin</span>
                                  </th>
                                </>
                              )}
                              <th className="border border-gray-700 p-2 text-center font-bold w-32" title="Total after discount (can be edited)">
                                <div className="flex items-center justify-center gap-1">
                                  <span>Total</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Total Amount Column',
                                        description: 'The Total is the final amount for the line item, calculated by multiplying Net Price by Quantity. This is the total amount the client pays for this specific product.',
                                        example: 'Formula: Total = Net Price × Quantity\n\nExample: ₱400 × 10 qty = ₱4,000 Total\n\nOr if editing Total directly:\nNet Price = Total ÷ Quantity\n₱4,000 ÷ 10 = ₱400 Net Price',
                                        onConfirm: () => setConfirmDialog(null),
                                        onCancel: () => setConfirmDialog(null)
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
                              <th className="border border-gray-700 p-2 text-center font-bold w-28" title="View details or delete">Act</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedProducts
                              .filter((p) => {
                                if (!productSearchQuery) return true;
                                const query = productSearchQuery.toLowerCase();
                                return (
                                  p.title?.toLowerCase().includes(query) ||
                                  p.skus?.some((sku) => sku?.toLowerCase().includes(query)) ||
                                  p.description?.toLowerCase().includes(query) ||
                                  p.itemRemarks?.toLowerCase().includes(query)
                                );
                              })
                              .map((p, idx) => {
                                const isDiscounted = p.isDiscounted ?? false;

                                // default discount based on VAT type
                                const defaultDiscount = vatType === "vat_exe" ? 12 : 0;
                                const rowDiscountPct = p.discount ?? defaultDiscount;
                                const unitDiscountAmt = isDiscounted
                                  ? p.discountAmount != null && p.discountAmount > 0
                                    ? p.discountAmount  // use peso amount if set
                                    : (p.price * rowDiscountPct) / 100
                                  : 0;

                              const discountedUnitPrice = p.price - unitDiscountAmt;
                              const totalAfterDiscount = discountedUnitPrice * p.quantity;

                              const isExpanded = expandedRows[p.uid] ?? false;

                              // Calculate margin alert for row styling
                              const cost = p.regPrice || p.originalPrice || 0;
                              const marginAlert = showMarginAlerts ? getMarginAlert(p.price, cost, rowDiscountPct) : null;

                              return (
                                <React.Fragment key={p.uid}>
                                  <tr
                                    className={`even:bg-gray-50 cursor-pointer transition-all ${dragOverRowUid === p.uid && dragRowUid !== p.uid
                                        ? "border-t-2 border-t-blue-400"
                                        : ""
                                      } ${dragRowUid === p.uid ? "opacity-40" : ""} ${
                                        marginAlert?.severity === 'danger'
                                          ? 'animate-pulse border-l-4 border-l-red-500'
                                          : marginAlert?.severity === 'warning'
                                          ? 'animate-pulse border-l-4 border-l-orange-500'
                                          : ''
                                      }`}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.effectAllowed = "move";
                                      e.dataTransfer.setData("text/x-row-uid", p.uid);
                                      setDragRowUid(p.uid);
                                    }}
                                    onDragEnd={() => {
                                      setDragRowUid(null);
                                      setDragOverRowUid(null);
                                    }}
                                    onDragOver={(e) => {
                                      // Only process row reorder, not product-from-left drops
                                      if (!e.dataTransfer.types.includes("text/x-row-uid")) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (dragOverRowUid !== p.uid) setDragOverRowUid(p.uid);
                                    }}
                                    onDrop={(e) => {
                                      const fromUid = e.dataTransfer.getData("text/x-row-uid");
                                      if (!fromUid || fromUid === p.uid) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedProducts((prev) => {
                                        const arr = [...prev];
                                        const fromIdx = arr.findIndex((x) => x.uid === fromUid);
                                        const toIdx = arr.findIndex((x) => x.uid === p.uid);
                                        if (fromIdx === -1 || toIdx === -1) return prev;
                                        const [moved] = arr.splice(fromIdx, 1);
                                        arr.splice(toIdx, 0, moved);
                                        return arr;
                                      });
                                      setDragRowUid(null);
                                      setDragOverRowUid(null);
                                    }}
                                  >
                                    {/* Drag handle */}
                                    {visibleColumns.dragHandle && (
                                      <td className="border border-gray-300 p-2 text-center text-gray-300 cursor-grab active:cursor-grabbing select-none text-base">
                                        ⠿
                                      </td>
                                    )}
                                    {bulkMode && (
                                      <td className="border border-gray-300 p-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={selectedRows.has(p.uid)}
                                          onChange={() => toggleRowSelection(p.uid)}
                                          className="w-4 h-4 cursor-pointer"
                                        />
                                      </td>
                                    )}
                                    {visibleColumns.rowNumber && (
                                      <td className="border border-gray-300 p-2 text-center text-gray-400 font-mono font-bold text-[11px]">
                                        {idx + 1}
                                      </td>
                                    )}
                                    {/* Discount Checkbox */}
                                    {visibleColumns.discountToggle && (
                                      <td className="border border-gray-300 p-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            const newValue = !isDiscounted;
                                            setConfirmDialog({
                                              isOpen: true,
                                              title: newValue ? `Enable Discount for "${p.title}"?` : `Disable Discount for "${p.title}"?`,
                                              description: newValue
                                                ? `This will apply a ${vatType === "vat_exe" ? 12 : 0}% discount to this item. The discount badge will appear on the quote.`
                                                : `This will remove the discount from this item and revert to original price.`,
                                              example: newValue
                                                ? `Unit Price: ₱${p.price.toFixed(2)} → Discount: ${vatType === "vat_exe" ? 12 : 0}% → Net: ₱${(p.price * (1 - (vatType === "vat_exe" ? 0.12 : 0))).toFixed(2)}`
                                                : `Revert to original price: ₱${p.price.toFixed(2)} (no discount applied)`,
                                              onConfirm: () => {
                                                setSelectedProducts((prev) => {
                                                  const copy = [...prev];
                                                  copy[idx] = {
                                                    ...copy[idx],
                                                    isDiscounted: newValue,
                                                    discount: newValue ? (vatType === "vat_exe" ? 12 : 0) : 0,
                                                    discountAmount: 0,
                                                  };
                                                  return copy;
                                                });
                                              },
                                              onCancel: () => {}
                                            });
                                          }}
                                          className="flex items-center justify-center w-full"
                                          title="Enable discount"
                                        >
                                          <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isDiscounted ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400'}`}>
                                            {isDiscounted && (
                                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </span>
                                        </button>
                                      </td>
                                    )}
                                    {/* Promo Checkbox */}
                                    {visibleColumns.promoBadge && (
                                      <td className="border border-gray-300 p-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            const newValue = !(p.isPromo ?? false);
                                            setConfirmDialog({
                                              isOpen: true,
                                              title: newValue ? `Mark "${p.title}" as PROMO?` : `Remove PROMO from "${p.title}"?`,
                                              description: newValue
                                                ? 'This item will display a yellow "PROMO" badge on the quotation, highlighting it as a special offer.'
                                                : 'The PROMO badge will be removed from this item on the quotation.',
                                              example: newValue
                                                ? '🏷️ PROMO badge will appear next to the product name: "BOLLARD FIXTURE E27 🏷️ PROMO"'
                                                : 'PROMO badge removed: "BOLLARD FIXTURE E27" (no badge)',
                                              onConfirm: () => {
                                                setSelectedProducts((prev) => {
                                                  const copy = [...prev];
                                                  copy[idx] = { ...copy[idx], isPromo: newValue };
                                                  return copy;
                                                });
                                              },
                                              onCancel: () => {}
                                            });
                                          }}
                                          className="flex items-center justify-center w-full"
                                          title="Mark as promo item"
                                        >
                                          <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${p.isPromo ? 'bg-yellow-500 border-yellow-500' : 'bg-white border-gray-400'}`}>
                                            {p.isPromo && (
                                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </span>
                                        </button>
                                      </td>
                                    )}
                                    {/* Hide Discount in Preview Checkbox */}
                                    {visibleColumns.hideDiscount && (
                                      <td className="border border-gray-300 p-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            const newValue = !(p.hideDiscountInPreview ?? false);
                                            setConfirmDialog({
                                              isOpen: true,
                                              title: newValue ? `Hide Discount for "${p.title}"?` : `Show Discount for "${p.title}"?`,
                                              description: newValue
                                                ? 'Discount details will be hidden on the PDF. Client sees clean pricing without discount breakdown.'
                                                : 'Discount details will be visible on the PDF showing savings to client.',
                                              example: newValue
                                                ? 'Client sees: Product only, no discount % shown (hidden calculation)'
                                                : 'Client sees: Product + Discount % + Amount saved + Net Price',
                                              onConfirm: () => {
                                                setSelectedProducts((prev) => {
                                                  const copy = [...prev];
                                                  copy[idx] = { ...copy[idx], hideDiscountInPreview: newValue };
                                                  return copy;
                                                });
                                              },
                                              onCancel: () => {}
                                            });
                                          }}
                                          className="flex items-center justify-center w-full"
                                          title="Hide discount in preview"
                                        >
                                          <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${p.hideDiscountInPreview ? 'bg-blue-400 border-blue-400' : 'bg-white border-gray-400'}`}>
                                            {p.hideDiscountInPreview && (
                                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </span>
                                        </button>
                                      </td>
                                    )}
                                    {/* Per-Item Display Mode Dropdown */}
                                    {visibleColumns.displayMode && (
                                      <td className="border border-gray-300 p-0.5 bg-purple-50/30">
                                        <Select
                                          value={p.displayMode || 'transparent'}
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
                                              title: `Change Display Mode for "${p.title}" to ${displayLabels[value]}?`,
                                              description: displayDesc[value],
                                              example: `${displayLabels[value]} mode: ${displayDesc[value].split('.')[0]}`,
                                              onConfirm: () => {
                                                setSelectedProducts((prev) => {
                                                  const copy = [...prev];
                                                  copy[idx] = { ...copy[idx], displayMode: value as SelectedProduct['displayMode'] };
                                                  return copy;
                                                });
                                              },
                                              onCancel: () => {}
                                            });
                                          }}
                                        >
                                          <SelectTrigger className="w-20 text-[9px] border border-gray-300 rounded px-1 py-0 bg-white h-6 focus:ring-1 focus:ring-purple-500">
                                            <SelectValue placeholder="..." />
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
                                    )}

                                    <td className="p-0.5">
                                      <div className="flex items-center gap-1 sm:gap-2">
                                        {/* Product Image - Clickable */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const imgUrl = p.images?.[0]?.src || "/Taskflow.png";
                                            setPreviewImageUrl(imgUrl);
                                            setImagePreviewOpen(true);
                                          }}
                                          className="w-8 h-8 sm:w-12 sm:h-12 rounded shrink-0 overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer p-0 border-0 bg-transparent"
                                          title="Click to preview image"
                                        >
                                          <img
                                            src={p.images?.[0]?.src || "/Taskflow.png"}
                                            alt={p.title}
                                            className="w-full h-full object-cover"
                                          />
                                        </button>

                                        <div className="flex-1 min-w-0">
                                          {/* Product Title (Editable) */}
                                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                            {p.isPromo && (
                                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-yellow-400 text-yellow-900 shrink-0 animate-pulse">
                                                🏷️ PROMO
                                              </span>
                                            )}
                                          </div>
                                          <div>
                                            {p.title}
                                          </div>
                                          
                                          {/* Regular Price Display */}
                                          {typeof p.regPrice === "number" && p.regPrice > 0 && (
                                            <div className="text-[9px] text-yellow-700 font-bold mt-0.5">
                                              Reg Price: ₱{p.regPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                            </div>
                                          )}
                                          {p.procurementLeadTime && (
                                            <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide">
                                              Lead Time: {p.procurementLeadTime}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    <td className="border border-gray-300 p-0.5">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const floor = p.procurementMinQty && p.procurementMinQty > 0 ? p.procurementMinQty : 1;
                                            const newVal = Math.max(floor, p.quantity - 1);
                                            if (newVal !== p.quantity) {
                                              setSelectedProducts((prev) => {
                                                const copy = [...prev];
                                                copy[idx] = { ...copy[idx], quantity: newVal };
                                                return copy;
                                              });
                                            }
                                          }}
                                          className="w-5 h-5 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-600 text-xs font-bold transition-all duration-150 ease-in-out"
                                          disabled={p.quantity <= (p.procurementMinQty && p.procurementMinQty > 0 ? p.procurementMinQty : 1)}
                                          title="Decrease quantity"
                                        >
                                          −
                                        </button>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={p.quantity}
                                          onChange={(e) => {
                                            const raw = e.target.value;
                                            if (raw === '' || /^\d*$/.test(raw)) {
                                              const val = parseInt(raw, 10) || 1;
                                              const floor = p.procurementMinQty && p.procurementMinQty > 0 ? p.procurementMinQty : 1;
                                              const finalVal = Math.max(floor, val);
                                              setSelectedProducts((prev) => {
                                                const copy = [...prev];
                                                copy[idx] = { ...copy[idx], quantity: finalVal };
                                                return copy;
                                              });
                                            }
                                          }}
                                          className="w-10 min-w-9 p-0.5 rounded-none text-xs text-center font-medium overflow-hidden text-ellipsis h-6 focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedProducts((prev) => {
                                              const copy = [...prev];
                                              copy[idx] = { ...copy[idx], quantity: p.quantity + 1 };
                                              return copy;
                                            });
                                          }}
                                          className="w-5 h-5 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-600 text-xs font-bold transition-all duration-150 ease-in-out"
                                          title="Increase quantity"
                                        >
                                          +
                                        </button>
                                      </div>
                                      {p.procurementMinQty != null && p.procurementMinQty > 0 && (
                                        <div className="text-[9px] text-gray-500 mt-1 text-center">
                                          Min (PD): <span className="font-bold">{p.procurementMinQty}</span>
                                        </div>
                                      )}
                                    </td>

                                    <td className="border border-gray-300 p-0.5">
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={rawInputValues[`${p.uid}-price`] ?? (p.price > 0 ? p.price.toFixed(2) : '')}
                                        readOnly={false}
                                        onChange={(e) => {
                                          const inputVal = e.target.value;
                                          const raw = inputVal.replace(/,/g, '');
                                          // Allow: empty, digits, one decimal point with up to 2 digits, or just a decimal point
                                          if (raw === '' || raw === '.' || /^\d+\.?$/.test(raw) || /^\d+\.\d{0,2}$/.test(raw) || /^\d+\.\d{0,2}$/.test(raw)) {
                                            setRawInputValues(prev => ({ ...prev, [`${p.uid}-price`]: inputVal }));
                                            const val = raw === '' || raw === '.' ? 0 : parseFloat(raw) || 0;
                                            const minPrice = p.procurementLockedPrice ? (p.originalPrice ?? 0) : 0;
                                            const finalVal = Math.max(minPrice, val);
                                            setSelectedProducts((prev) => {
                                              const copy = [...prev];
                                              copy[idx] = { ...copy[idx], price: finalVal };
                                              return copy;
                                            });
                                          }
                                        }}
                                        onBlur={() => {
                                          setRawInputValues(prev => {
                                            const copy = { ...prev };
                                            delete copy[`${p.uid}-price`];
                                            return copy;
                                          });
                                        }}
                                        className={`w-full min-w-[70px] p-1 rounded-none text-xs text-right font-medium overflow-hidden text-ellipsis h-6 focus:outline-none ${p.procurementLockedPrice ? "bg-gray-50 font-bold" : ""}`}
                                      />
                                      {p.procurementLockedPrice && (
                                        <div className="text-[9px] text-gray-500 mt-1">
                                          Final selling price (locked at ₱{(p.originalPrice ?? 0).toLocaleString(undefined,{ minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                        </div>
                                      )}
                                    </td>

                                    {showDiscountColumns && (
                                      <td className="border border-gray-300 p-0.5">
                                        {isDiscounted ? (
                                          <>
                                            <div className="flex items-center gap-0.5 justify-center mb-0.5">
                                              {[5, 10, 15, 20].map((preset) => (
                                                <button
                                                  key={preset}
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedProducts((prev) => {
                                                      const copy = [...prev];
                                                      const price = copy[idx].price;
                                                      copy[idx] = {
                                                        ...copy[idx],
                                                        discount: preset,
                                                        discountAmount: parseFloat(((price * preset) / 100).toFixed(4)),
                                                      };
                                                      return copy;
                                                    });
                                                  }}
                                                  className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-all duration-150 ease-in-out ${
                                                    rowDiscountPct === preset
                                                      ? 'bg-linear-to-r from-blue-600 to-blue-700 text-white'
                                                      : 'bg-white border border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700'
                                                  }`}
                                                  title={`Apply ${preset}% discount`}
                                                >
                                                  {preset}%
                                                </button>
                                              ))}
                                            </div>
                                            <div className="flex items-center gap-1 justify-center">
                                              <div className="relative">
                                                <Input
                                                  type="text"
                                                  inputMode="decimal"
                                                  value={rawInputValues[`${p.uid}-discount`] ?? (rowDiscountPct > 0 ? rowDiscountPct.toString() : '')}
                                                  onChange={(e) => {
                                                    const val = e.target.value;
                                                    // Allow: empty, digits, one decimal point with up to 2 digits, or just a decimal point
                                                    if (val === '' || val === '.' || /^\d+\.?$/.test(val) || /^\d+\.\d{0,2}$/.test(val)) {
                                                      setRawInputValues(prev => ({ ...prev, [`${p.uid}-discount`]: val }));
                                                      const pct = Math.min(100, Math.max(0, parseFloat(val) || 0));
                                                      setSelectedProducts((prev) => {
                                                        const copy = [...prev];
                                                        const price = copy[idx].price;
                                                        copy[idx] = {
                                                          ...copy[idx],
                                                          discount: pct,
                                                          discountAmount: parseFloat(((price * pct) / 100).toFixed(4)),
                                                        };
                                                        return copy;
                                                      });
                                                    }
                                                  }}
                                                  onBlur={() => {
                                                    setRawInputValues(prev => {
                                                      const copy = { ...prev };
                                                      delete copy[`${p.uid}-discount`];
                                                      return copy;
                                                    });
                                                  }}
                                                  className="w-14 p-0.5 pr-4 rounded-none text-xs text-center font-medium overflow-hidden border-gray-300 h-6 focus:outline-none"
                                                  placeholder="%"
                                                />
                                                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-500 font-bold">%</span>
                                              </div>
                                              <span className="text-[8px] text-gray-400">|</span>
                                              <div className="relative">
                                                <Input
                                                  type="text"
                                                  inputMode="decimal"
                                                  value={rawInputValues[`${p.uid}-discountAmt`] ?? (unitDiscountAmt > 0 ? unitDiscountAmt.toFixed(2) : '')}
                                                  onChange={(e) => {
                                                    const inputVal = e.target.value;
                                                    const raw = inputVal.replace(/,/g, '');
                                                    // Allow: empty, digits, one decimal point with up to 2 digits, or just a decimal point
                                                    if (raw === '' || raw === '.' || /^\d+\.?$/.test(raw) || /^\d+\.\d{0,2}$/.test(raw)) {
                                                      setRawInputValues(prev => ({ ...prev, [`${p.uid}-discountAmt`]: inputVal }));
                                                      const amt = raw === '' || raw === '.' ? 0 : Math.max(0, parseFloat(raw) || 0);
                                                      setSelectedProducts((prev) => {
                                                        const copy = [...prev];
                                                        const price = copy[idx].price;
                                                        const newPct = price > 0 ? parseFloat(((amt / price) * 100).toFixed(4)) : 0;
                                                        copy[idx] = {
                                                          ...copy[idx],
                                                          discountAmount: amt,
                                                          discount: Math.min(100, newPct),
                                                        };
                                                        return copy;
                                                      });
                                                    }
                                                  }}
                                                  onBlur={() => {
                                                    setRawInputValues(prev => {
                                                      const copy = { ...prev };
                                                      delete copy[`${p.uid}-discountAmt`];
                                                      return copy;
                                                    });
                                                  }}
                                                  className="w-16 p-0.5 pr-4 rounded-none text-xs text-center font-medium overflow-hidden border-gray-300 h-6 focus:outline-none"
                                                  placeholder="₱"
                                                />
                                                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-500 font-bold">₱</span>
                                              </div>
                                            </div>
                                            <div className="text-[8px] text-gray-400 text-center opacity-0">spacer</div>
                                          </>
                                        ) : (
                                          <span className="text-gray-300 text-center block text-xs">—</span>
                                        )}
                                      </td>
                                    )}

                                    {/* Net Unit Price — editable, changing this syncs discount */}
                                    <td className="border border-gray-300 p-0.5 bg-blue-50/30">
                                      {isDiscounted ? (
                                        <>
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={rawInputValues[`${p.uid}-net`] ?? (discountedUnitPrice > 0 ? discountedUnitPrice.toFixed(2) : '')}
                                            onChange={(e) => {
                                              const inputVal = e.target.value;
                                              const raw = inputVal.replace(/,/g, '');
                                              // Allow empty, digits, one decimal point, or just a decimal point
                                              if (raw === '' || raw === '.' || /^\d+\.?$/.test(raw) || /^\d+\.\d{0,2}$/.test(raw)) {
                                                setRawInputValues(prev => ({ ...prev, [`${p.uid}-net`]: inputVal }));
                                                const newNetPrice = Math.max(0, parseFloat(raw) || 0);
                                                setSelectedProducts((prev) => {
                                                  const copy = [...prev];
                                                  const unitPrice = copy[idx].price;
                                                  if (unitPrice > 0 && newNetPrice < unitPrice) {
                                                    const discountAmt = unitPrice - newNetPrice;
                                                    const discountPct = (discountAmt / unitPrice) * 100;
                                                    copy[idx] = {
                                                      ...copy[idx],
                                                      isDiscounted: true,
                                                      discountAmount: parseFloat(discountAmt.toFixed(4)),
                                                      discount: parseFloat(Math.min(100, Math.max(0, discountPct)).toFixed(4)),
                                                    };
                                                  } else if (newNetPrice >= unitPrice) {
                                                    copy[idx] = {
                                                      ...copy[idx],
                                                      isDiscounted: false,
                                                      discountAmount: 0,
                                                      discount: 0,
                                                    };
                                                  }
                                                  return copy;
                                                });
                                              }
                                            }}
                                            onBlur={() => {
                                              setRawInputValues(prev => {
                                                const copy = { ...prev };
                                                delete copy[`${p.uid}-net`];
                                                return copy;
                                              });
                                            }}
                                            className="w-full min-w-[60px] p-1 rounded-none text-xs text-right font-bold text-blue-700 overflow-hidden text-ellipsis h-6 focus:outline-none"
                                            placeholder="₱"
                                          />
                                          <div className="text-[8px] text-blue-600 mt-0.5 text-center">
                                            {rowDiscountPct.toFixed(2)}% off
                                          </div>
                                        </>
                                      ) : (
                                        <span className="text-gray-300 text-center block text-xs">—</span>
                                      )}
                                    </td>

                                    {/* Profit Margin Columns — INTERNAL ONLY */}
                                    {showProfitMargins && (
                                      <>
                                        <td className="border border-gray-300 p-0.5 bg-green-50/30">
                                          <div className="text-center">
                                            <span className="text-[10px] font-medium text-gray-600">
                                              ₱{(p.regPrice || p.originalPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="border border-gray-300 p-0.5 bg-green-50/30">
                                          {(() => {
                                            const cost = p.regPrice || p.originalPrice || 0;
                                            const sellingPrice = discountedUnitPrice;
                                            const margin = sellingPrice > 0 ? ((sellingPrice - cost) / sellingPrice) * 100 : 0;
                                            const isNegative = margin < 0;
                                            return (
                                              <div className="text-center">
                                                <span className={`text-[10px] font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                                                  {margin.toFixed(1)}%
                                                </span>
                                                {isNegative && (
                                                  <span className="block text-[8px] text-red-500">⚠️ Loss</span>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </td>
                                      </>
                                    )}
                                    {/* Total Amount — editable, changing this back-calculates discount */}
                                    <td className="border border-gray-300 p-0.5">
                                      <div className="flex flex-col gap-0.5">
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          value={rawInputValues[`${p.uid}-total`] ?? (totalAfterDiscount > 0 ? totalAfterDiscount.toFixed(2) : '')}
                                          onChange={(e) => {
                                            const inputVal = e.target.value;
                                            const raw = inputVal.replace(/,/g, '');
                                            // Allow empty, digits, one decimal point, or just a decimal point
                                            if (raw === '' || raw === '.' || /^\d+\.?$/.test(raw) || /^\d+\.\d{0,2}$/.test(raw)) {
                                              setRawInputValues(prev => ({ ...prev, [`${p.uid}-total`]: inputVal }));
                                              const newTotal = Math.max(0, parseFloat(raw) || 0);
                                              setSelectedProducts((prev) => {
                                                const copy = [...prev];
                                                const price = copy[idx].price;
                                                const qty = copy[idx].quantity;
                                                const gross = price * qty;
                                                if (gross > 0 && newTotal <= gross && qty > 0) {
                                                  const totalDiscAmt = gross - newTotal;
                                                  const unitDiscAmt = totalDiscAmt / qty;
                                                  const newPct = price > 0 ? (unitDiscAmt / price) * 100 : 0;
                                                  copy[idx] = {
                                                    ...copy[idx],
                                                    isDiscounted: true,
                                                    discountAmount: parseFloat(unitDiscAmt.toFixed(4)),
                                                    discount: parseFloat(Math.min(100, Math.max(0, newPct)).toFixed(4)),
                                                  };
                                                } else if (newTotal > gross && qty > 0) {
                                                  // Total exceeds gross — increase unit price to match desired total
                                                  const newUnitPrice = newTotal / qty;
                                                  copy[idx] = {
                                                    ...copy[idx],
                                                    price: parseFloat(newUnitPrice.toFixed(4)),
                                                    // Keep discount enabled but zeroed (price already accounts for special rate)
                                                    isDiscounted: false,
                                                    discount: 0,
                                                    discountAmount: 0,
                                                  };
                                                }
                                                return copy;
                                              });
                                            }
                                          }}
                                          onBlur={() => {
                                            setRawInputValues(prev => {
                                              const copy = { ...prev };
                                              delete copy[`${p.uid}-total`];
                                              return copy;
                                            });
                                          }}
                                          className="w-full min-w-[60px] p-1 rounded-none text-xs font-bold text-right overflow-hidden text-ellipsis h-6 focus:outline-none"
                                          placeholder="₱"
                                        />
                                        <div className="flex flex-col items-end gap-0.5">
                                          {isDiscounted && unitDiscountAmt > 0 && !p.hideDiscountInPreview && (
                                            <span className="text-[8px] text-green-600 font-semibold whitespace-nowrap">
                                              save ₱{(unitDiscountAmt * p.quantity).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </span>
                                          )}
                                          {p.hideDiscountInPreview && isDiscounted && (
                                            <span className="text-[8px] text-blue-600 font-semibold italic whitespace-nowrap">
                                              Special Price
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    <td className="border border-gray-300 p-1">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => toggleRow(p.uid)}
                                          className="flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-150 ease-in-out"
                                          title={expandedRows[p.uid] ? "Hide details" : "View details"}
                                        >
                                          {expandedRows[p.uid] ? (
                                            <EyeOff className="w-3.5 h-3.5 text-gray-600" />
                                          ) : (
                                            <Eye className="w-3.5 h-3.5 text-gray-600" />
                                          )}
                                          <span className="hidden sm:inline text-gray-700">{expandedRows[p.uid] ? "Hide" : "View"}</span>
                                        </button>
                                        <button
                                          type="button"
                                          className="flex items-center justify-center p-1 border border-red-200 bg-white hover:bg-red-50 hover:border-red-300 transition-all duration-150 ease-in-out"
                                          title="Delete product"
                                          onClick={() => {
                                            if (p.cloudinaryPublicId) {
                                              deleteCloudinaryImage(p.cloudinaryPublicId);
                                            }
                                            setSelectedProducts((prev) =>
                                              prev.filter((item) => item.uid !== p.uid)
                                            );
                                            setVisibleDescriptions((prev) => {
                                              const copy = { ...prev };
                                              delete copy[p.uid];
                                              return copy;
                                            });
                                          }}
                                        >
                                          <Trash className="w-3.5 h-3.5 text-red-500" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr className="even:bg-[#F9FAFA]">
                                      <td
                                        colSpan={(() => {
                                          // Calculate colspan for expanded row (all columns)
                                          let colspan = 12; // base: drag(1) + #(1) + disc(1) + promo(1) + hide(1) + display(1) + product(1) + qty(1) + unit(1) + net(1) + total(1) + act(1)
                                          if (bulkMode) colspan += 1;
                                          if (showProfitMargins && showMarginAlerts) colspan += 1;
                                          if (showDiscountColumns) colspan += 1;
                                          if (showProfitMargins) colspan += 2;
                                          return colspan;
                                        })()}
                                        className="border border-gray-300 p-4 align-top"
                                      >
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                          <div>
                                            <label className="block text-xs font-bold mb-2 uppercase tracking-wide text-gray-500">Technical Description:</label>
                                            <div
                                              className="w-full max-h-60 overflow-auto border border-gray-200 rounded-sm bg-white p-3 text-xs leading-relaxed"
                                              dangerouslySetInnerHTML={{
                                                __html:
                                                  p.description ||
                                                  '<span class="text-gray-400 italic">No specifications provided.</span>',
                                              }}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-bold mb-2 uppercase tracking-wide text-gray-500">Item Remarks:</label>
                                            <Textarea
                                              value={p.itemRemarks || ""}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedProducts((prev) => {
                                                  const copy = [...prev];
                                                  copy[idx] = { ...copy[idx], itemRemarks: val };
                                                  return copy;
                                                });
                                              }}
                                              placeholder="Enter any remarks here..."
                                              rows={6}
                                              className="capitalize rounded-sm text-xs w-full p-2 border-gray-200"
                                            />
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
                              {/* Empty cells for: drag, bulk, #, disc, promo, hide, display, alert, product */}
                              <td className="border border-gray-300 p-1"></td>
                              {bulkMode && <td className="border border-gray-300 p-1"></td>}
                              <td className="border border-gray-300 p-1"></td>
                              <td className="border border-gray-300 p-1"></td>
                              <td className="border border-gray-300 p-1"></td>
                              <td className="border border-gray-300 p-1"></td>
                              <td className="border border-gray-300 p-1"></td>
                              {showProfitMargins && showMarginAlerts && <td className="border border-gray-300 p-1"></td>}
                              <td className="border border-gray-300 p-1"></td>
                              {/* Data cells */}
                              <td className="border border-gray-300 p-2 text-center font-black">
                                {selectedProducts.reduce((acc, p) => acc + p.quantity, 0)}
                              </td>
                              <td className="border border-gray-300 p-2 text-center font-black">
                                {selectedProducts.reduce((acc, p) => acc + p.price, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </td>
                              {showDiscountColumns && (
                                <td className="border border-gray-300 p-2 text-center hidden sm:table-cell text-gray-500">
                                  -₱{selectedProducts.reduce((acc, p) => {
                                    const discount = p.isDiscounted ? p.discount ?? 0 : 0;
                                    const unitDiscountAmount = (p.price * discount) / 100;
                                    return acc + (unitDiscountAmount * p.quantity);
                                  }, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </td>
                              )}
                              {/* NET column - sum of net unit prices */}
                              <td className="border border-gray-300 p-2 text-center font-black text-blue-700">
                                {selectedProducts.reduce((acc, p) => {
                                  const discount = p.isDiscounted ? p.discount ?? 0 : 0;
                                  const unitDiscountAmount = p.discountAmount != null && p.discountAmount > 0
                                    ? p.discountAmount
                                    : (p.price * discount) / 100;
                                  const netUnitPrice = p.price - unitDiscountAmount;
                                  return acc + netUnitPrice;
                                }, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </td>
                              {showProfitMargins && (
                                <>
                                  <td className="border border-gray-300 p-2 text-center font-black text-[#121212]">
                                    ₱{selectedProducts.reduce((acc, p) => {
                                      const discount = p.isDiscounted ? p.discount ?? 0 : 0;
                                      const unitDiscountAmount = (p.price * discount) / 100;
                                      const netUnitPrice = p.price - unitDiscountAmount;
                                      return acc + (netUnitPrice * p.quantity);
                                    }, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                  </td>
                                  <td className="border border-gray-300 p-1"></td>
                                </>
                              )}
                              {/* TOTAL column - sum of total amounts */}
                              <td className="border border-gray-300 p-2 text-center font-black text-[#121212]">
                                ₱{selectedProducts.reduce((acc, p) => {
                                  const discount = p.isDiscounted ? p.discount ?? 0 : 0;
                                  const unitDiscountAmount = p.discountAmount != null && p.discountAmount > 0
                                    ? p.discountAmount
                                    : (p.price * discount) / 100;
                                  const netUnitPrice = p.price - unitDiscountAmount;
                                  return acc + (netUnitPrice * p.quantity);
                                }, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </td>
                            </tr>

                            {/* Delivery & Restocking Fee Row — desktop only inside table */}
                            <tr className="hidden sm:table-row bg-gray-50">
                              {/* Empty cells for all columns except Total */}
                              <td className="border border-gray-300 p-1"></td>
                              {bulkMode && <td className="border border-gray-300 p-1"></td>}
                              <td className="border border-gray-300 p-1"></td>
                              <td className="border border-gray-300 p-1"></td>
                              <td className="border border-gray-300 p-1"></td>
                              <td className="border border-gray-300 p-1"></td>
                              <td className="border border-gray-300 p-1"></td>
                              {showProfitMargins && showMarginAlerts && <td className="border border-gray-300 p-1"></td>}
                              <td className="border border-gray-300 p-1"></td>
                              <td className="border border-gray-300 p-1"></td>
                              <td className="border border-gray-300 p-1"></td>
                              {showDiscountColumns && (
                                <td className="border border-gray-300 p-1 hidden sm:table-cell"></td>
                              )}
                              <td className="border border-gray-300 p-1"></td>
                              {showProfitMargins && (
                                <>
                                  <td className="border border-gray-300 p-1"></td>
                                  <td className="border border-gray-300 p-1"></td>
                                </>
                              )}
                              <td colSpan={3} className="border border-gray-300 p-1">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs whitespace-nowrap font-bold">Delivery Fee:</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      className="w-24 text-center border border-gray-300 rounded-none px-1.5 py-0.5 text-xs font-medium"
                                      placeholder="0.00"
                                      value={deliveryFee}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/,/g, '');
                                        if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
                                          setDeliveryFee(raw);
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs whitespace-nowrap font-bold">Restocking Fee:</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      className="w-24 text-center border border-gray-300 rounded-none px-1.5 py-0.5 text-xs font-medium"
                                      placeholder="0.00"
                                      value={restockingFee}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/,/g, '');
                                        if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
                                          setRestockingFee(raw);
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Delivery & Restocking Fee — mobile only, below table */}
                    <div className="sm:hidden border border-gray-200 bg-gray-50 p-3 mt-1">
                      <div className="flex items-center justify-between py-1.5 border-b border-gray-200">
                        <span className="text-xs font-bold uppercase text-gray-600">Delivery Fee</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-28 text-right border border-gray-300 rounded-none px-2 py-1 text-xs bg-white font-medium"
                          placeholder="0.00"
                          value={deliveryFee}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, '');
                            if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
                              setDeliveryFee(raw);
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-xs font-bold uppercase text-gray-600">Restocking Fee</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-28 text-right border border-gray-300 rounded-none px-2 py-1 text-xs bg-white font-medium"
                          placeholder="0.00"
                          value={restockingFee}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, '');
                            if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
                              setRestockingFee(raw);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>{/* end BODY */}

          {/* Note bar - compact */}
          <div className="text-[10px] text-red-500 text-center italic px-3 py-1.5 bg-red-50 border-t border-red-200 shrink-0">
            ⚠️ Quotation Number only appears on the final downloaded quotation.
          </div>

          <DialogFooter className="flex flex-col gap-2 pl-8 pr-5 py-3 sm:pl-10 sm:pr-6 border-t border-gray-200 shrink-0 sm:flex-row sm:items-center sm:justify-between">
            {/* Mobile total — hidden on desktop (shown in header instead) */}
            {selectedProducts.length > 0 && (
              <div className="flex items-center justify-between lg:hidden">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">Total:</span>
                <span className="text-lg font-black text-[#121212] tabular-nums">
                  PHP {Number(quotationAmount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 w-full lg:w-auto lg:ml-auto">
              {selectedProducts.length > 0 && (
                <Button
                  className="flex-1 lg:flex-none bg-[#121212] hover:bg-black text-white flex gap-2 items-center rounded-lg h-10 px-6 shadow-md"
                  onClick={() => setIsPreviewOpen(true)}
                  title={hideDiscountInPreview ? "Preview hides discount columns (SRP only)" : showDiscountColumns ? "Preview with discount columns" : "Preview clean format (no discounts)"}
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Review Quotation</span>
                  {showDiscountColumns && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded ml-1 ${hideDiscountInPreview ? 'bg-purple-500/80' : 'bg-white/20'}`}>
                      {hideDiscountInPreview ? 'SRP Only' : 'Full Detail'}
                    </span>
                  )}
                </Button>
              )}
              <Button
                className="flex-1 lg:flex-none rounded-lg h-10 px-6 border-2"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                <XCircle className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={itemCodeDropDialogOpen}
        onOpenChange={(isOpen) => {
          setItemCodeDropDialogOpen(isOpen);
          if (!isOpen) {
            setPendingDropProduct(null);
          }
        }}
      >
        <DialogContent className="max-w-md w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-black text-sm uppercase tracking-wider">
              Select Item Code
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Choose which item code will be used in quotation for{" "}
              <span className="font-semibold text-gray-700">{pendingDropProduct?.title || "this product"}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-1.5">
            {(pendingDropProduct?.itemCodeVariants || []).map((variant, index) => (
              <button
                key={`drop-variant-${variant.label}-${variant.code}-${index}`}
                type="button"
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left hover:bg-blue-100 transition-colors"
                onClick={() => {
                  if (!pendingDropProduct) return;
                  addSearchResultProduct(
                    pendingDropProduct,
                    variant.code,
                    `Add product (${variant.code})`
                  );
                  closeItemCodeDropDialog();
                }}
              >
                <span className="text-[10px] font-black uppercase tracking-wide text-blue-800">
                  {variant.label}
                </span>
                <span className="text-[11px] font-semibold text-blue-700 truncate">
                  {variant.code}
                </span>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeItemCodeDropDialog}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PREVIEW QUOTATION MODAL */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-[#F9FAFA] shadow-2xl"
          style={{ maxWidth: "950px", width: "100vw" }}
        >
          <DialogTitle className="sr-only">Quotation Preview</DialogTitle>
          {(() => {
            const [zoom, setZoom] = useState(100);
            const [isFullscreen, setIsFullscreen] = useState(false);

            const handleZoomIn = () => setZoom((z) => Math.min(z + 10, 150));
            const handleZoomOut = () => setZoom((z) => Math.max(z - 10, 50));
            const handleFitToWidth = () => setZoom(100);

            const handlePrint = () => {
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(document.getElementById('quotation-preview-content')?.innerHTML || '');
                printWindow.document.close();
                printWindow.print();
              }
            };

            return (
              <div className="flex flex-col bg-white min-h-full font-sans text-[#121212]">
                {/* TOOLBAR */}
                <div className="sticky top-0 z-50 bg-[#121212] text-white px-4 py-3 flex items-center justify-between border-b border-gray-700">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold uppercase tracking-wider">Quotation Preview</span>
                    <div className="h-4 w-px bg-gray-600"></div>
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleZoomOut}
                        className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                        title="Zoom Out"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="text-xs font-mono w-12 text-center">{zoom}%</span>
                      <button
                        onClick={handleZoomIn}
                        className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                        title="Zoom In"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <button
                        onClick={handleFitToWidth}
                        className="ml-2 px-2 py-1 text-xs hover:bg-gray-700 rounded transition-colors"
                        title="Fit to Width"
                      >
                        Fit
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Action Buttons - Planner Preview: No PDF/Print (only in Revised Quotation) */}
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setIsPreviewOpen(false)}
                      className="p-1.5 hover:bg-red-600/80 rounded transition-colors ml-2"
                      title="Close"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Preview Content with Zoom */}
                <div
                  id="quotation-preview-content"
                  className="flex-1 overflow-auto bg-gray-100 p-4"
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center',
                    width: `${100 / (zoom / 100)}%`,
                    margin: '0 auto'
                  }}
                >
                  <div className="flex flex-col bg-white min-h-full font-sans text-[#121212] shadow-lg">

                {/* CORPORATE BRANDING HEADER */}
                <div className="w-full flex justify-center py-5 border-b border-gray-100 bg-white">
                  <div className="w-full max-w-[900px] h-[110px] relative flex items-center justify-center overflow-hidden">
                    <img
                      key={quotationType}
                      src={headerImagePath}
                      alt={`${quotationType} Header`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                      <div class="w-full h-full bg-[#121212] flex flex-col items-center justify-center text-white">
                        <span class="font-black text-2xl tracking-[0.2em] uppercase">${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</span>
                        <span class="text-[10px] tracking-[0.5em] font-light opacity-70">OFFICIAL QUOTATION PROTOCOL</span>
                      </div>
                    `;
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="px-6 py-5 space-y-1">
                  {/* REFERENCE & DATE SECTION */}
                  <div className="text-right text-[11px] font-medium uppercase space-y-1">
                    <p className="flex justify-end gap-2">
                      <span className="font-black text-[#121212]">Reference No:</span>
                      <span className="text-gray-600">{payload.referenceNo}</span>
                    </p>
                    <p className="flex justify-end gap-2">
                      <span className="font-black text-[#121212]">Date:</span>
                      <span className="text-gray-600">{payload.date}</span>
                    </p>
                  </div>

                  {/* CLIENT INFORMATION GRID */}
                  <div className="mt-5 border-l border-r border-black uppercase">
                    {[
                      { label: "COMPANY NAME", value: payload.companyName, borderTop: true },
                      { label: "ADDRESS", value: payload.address },
                      { label: "TEL NO", value: payload.telNo },
                      { label: "EMAIL ADDRESS", value: payload.email, borderBottom: true },
                      { label: "ATTENTION", value: payload.attention },
                      { label: "SUBJECT", value: payload.subject, borderBottom: true },
                    ].map((info, i) => (
                      <div
                        key={i}
                        className={`grid grid-cols-6 py-1 px-4 items-center min-h-[30px]
                    ${info.borderTop ? 'border-t border-black' : ''} 
                    ${info.borderBottom ? 'border-b border-black' : ''}
                  `}
                      >
                        <span className="col-span-1 font-black text-[10px] text-[#121212]">{info.label}:</span>
                        <span className="col-span-5 text-[11px] font-bold text-gray-700 pl-4">{info.value || "---"}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] italic mt-5 text-gray-500 font-medium">
                    We are pleased to offer you the following products for consideration:
                  </p>

                  {/* ITEM SPECIFICATION TABLE */}
                  <div className="border border-black overflow-hidden shadow-sm">
                    <table className="w-full text-[12px] border-collapse">
                      <thead>
                        <tr className="bg-[#F9FAFA] border-b border-black font-black uppercase text-[#121212]">
                          <th className="p-3 border-r border-black w-16 text-center">ITEM NO</th>
                          <th className="p-3 border-r border-black w-16 text-center">QTY</th>
                          <th className="p-3 border-r border-black w-32 text-center">REFERENCE PHOTO</th>
                          <th className="p-3 border-r border-black text-left">PRODUCT DESCRIPTION</th>
                          <th className={`p-3 border-r border-black text-center ${showDiscountColumns && !hideDiscountInPreview ? "w-20" : "w-28"}`}>
                            {hideDiscountInPreview ? 'SRP' : 'UNIT PRICE'}
                          </th>
                          {showDiscountColumns && !hideDiscountInPreview && (
                            <>
                              <th className="p-3 border-r border-black w-20 text-center">DISC/UNIT</th>
                              <th className="p-3 border-r border-black w-28 text-center">DISCOUNTED PRICE</th>
                            </>
                          )}
                          <th className={`p-3 text-center ${showDiscountColumns && !hideDiscountInPreview ? "w-24" : "w-28"}`}>TOTAL AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black">
                        {payload.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 text-center border-r border-black align-top font-bold text-gray-400 capitalize"><span className="font-bold text-black">{item.itemNo}.</span></td>
                            <td className="p-4 text-center border-r border-black align-top font-black text-[#121212]">{item.qty}</td>
                            <td className="p-3 border-r border-black align-top bg-white">
                              {item.photo ? (
                                <img src={item.photo} className="w-24 h-24 object-contain mx-auto mix-blend-multiply" alt="sku-ref" />
                              ) : (
                                <div className="w-24 h-24 bg-gray-50 flex items-center justify-center text-[8px] text-gray-300 italic">No Image</div>
                              )}
                            </td>
                            <td className="p-4 border-r border-black align-top">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="font-black text-[#121212] text-xs uppercase">{item.title}</p>
                                {item.isSpf1 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-600 text-white shrink-0">
                                    SPF
                                  </span>
                                )}
                                {item.isPromo && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-yellow-400 text-yellow-900 shrink-0">
                                    🏷️ PROMO
                                  </span>
                                )}
                                {item.displayMode && item.displayMode !== 'transparent' && (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0 ${
                                    item.displayMode === 'request' ? 'bg-gray-600 text-white' :
                                    item.displayMode === 'bundle' ? 'bg-purple-600 text-white' :
                                    item.displayMode === 'net_only' ? 'bg-blue-600 text-white' :
                                    item.displayMode === 'value_add' ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'
                                  }`}>
                                    {item.displayMode === 'request' ? 'ON REQUEST' :
                                     item.displayMode === 'bundle' ? 'PACKAGE' :
                                     item.displayMode === 'net_only' ? 'NET PRICE' :
                                     item.displayMode === 'value_add' ? 'YOU SAVE' : item.displayMode}
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-blue-600 font-bold mb-1 tracking-tighter">{item.sku}</p>
                              {/* Regular Price in Preview */}
                              {typeof item.regPrice === "number" && item.regPrice > 0 && (
                                <div className="mb-2 flex items-center gap-1.5">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Reg Price:</span>
                                  <span className="text-[9px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded">
                                    ₱{item.regPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              )}
                              {item.isSpf1 && item.procurementLeadTime && (
                                <div className="mb-2 flex items-center gap-1.5">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Lead Time:</span>
                                  <span className="text-[9px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                                    {item.procurementLeadTime}
                                  </span>
                                </div>
                              )}
                              <div
                                className="text-[10px] text-gray-500 leading-relaxed prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: item.description }}
                              />
                              {item.itemRemarks && <span className="bg-orange-400 mt-2 p-1 capitalize text-red-800 inline-block">{item.itemRemarks}</span>}
                            </td>
                            <td className={`p-4 text-right border-r border-black align-top font-medium w-28 ${
                              (item.displayMode === 'request' || item.displayMode === 'net_only' || item.displayMode === 'bundle') ? 'bg-gray-50' : ''
                            }`}>
                              {(() => {
                                const mode = item.displayMode || 'transparent';
                                if (mode === 'request') {
                                  return <span className="text-[10px] text-gray-500 italic">Upon request</span>;
                                }
                                if (mode === 'net_only' || mode === 'bundle') {
                                  return <span className="text-[10px] text-gray-400">—</span>;
                                }
                                // When hideDiscountInPreview, show discounted amount as SRP
                                if (hideDiscountInPreview) {
                                  return `₱${item.discountedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                                }
                                return `₱${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                              })()}
                            </td>
                            {showDiscountColumns && !hideDiscountInPreview && (
                              <>
                                {/* Discount amount in peso per unit — accounting standard */}
                                <td className={`p-4 text-right border-r border-black align-top w-20 ${
                                  item.displayMode === 'request' || item.displayMode === 'net_only' || item.displayMode === 'bundle' ? 'bg-gray-50' : ''
                                }`}>
                                  {item.displayMode === 'request' || item.displayMode === 'net_only' || item.displayMode === 'bundle' ? (
                                    <span className="text-[10px] text-gray-400">—</span>
                                  ) : item.discountAmount > 0 && !item.hideDiscountInPreview ? (
                                    <div>
                                      <div className="font-bold text-red-600">
                                        -₱{item.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </div>
                                      <div className="text-[9px] text-gray-400">
                                        ({item.discount.toFixed(2)}%)
                                      </div>
                                    </div>
                                  ) : item.hideDiscountInPreview && item.discountAmount > 0 ? (
                                    <span className="text-[9px] text-blue-600 italic">Special Price</span>
                                  ) : (
                                    <span className="text-[10px] text-gray-400">—</span>
                                  )}
                                </td>
                                {/* Net unit price after discount */}
                                <td className={`p-4 text-right border-r border-black align-top w-28 ${item.displayMode === 'request' ? 'bg-gray-50' : ''}`}>
                                  {item.displayMode === 'request' ? (
                                    <span className="text-[10px] text-gray-400">—</span>
                                  ) : (
                                    <div className="font-medium">
                                      ₱{item.discountedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                  )}
                                  {item.discountAmount > 0 && !item.hideDiscountInPreview && item.displayMode !== 'net_only' && item.displayMode !== 'bundle' && (
                                    <div className="text-[9px] text-gray-400 mt-0.5">net/unit</div>
                                  )}
                                </td>
                              </>
                            )}
                            <td className={`p-4 text-right font-black align-top text-[#121212] w-28 ${item.displayMode === 'request' ? 'bg-gray-50' : ''}`}>
                              {(() => {
                                const mode = item.displayMode || 'transparent';
                                if (mode === 'request') {
                                  return <span className="text-[11px] text-gray-600 italic">Price on request</span>;
                                }
                                if (mode === 'bundle') {
                                  return (
                                    <div>
                                      <div className="font-medium text-[#121212]">
                                        ₱{item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </div>
                                      <div className="text-[8px] text-purple-600 mt-0.5">Package Price</div>
                                    </div>
                                  );
                                }
                                if (mode === 'value_add' && item.totalDiscountAmount > 0) {
                                  return (
                                    <div>
                                      <div className="font-medium text-[#121212]">
                                        ₱{item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </div>
                                      <div className="text-[8px] text-green-600 mt-0.5 font-bold">
                                        YOU SAVE ₱{item.totalDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                  );
                                }
                                return `₱${item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                              })()}
                            </td>
                          </tr>
                        ))}

                        {/* SUMMARY BAR */}
                        {/* <tr className="border-t-2 border-black bg-gray-200 text-gray-900 h-[45px]">
                          <td colSpan={2} className="border-r border-gray-400"></td>

                          <td className="px-4 border-r border-gray-400 font-bold text-red-600 italic text-[14px] uppercase">
                            Tax Type:
                          </td>

                          <td className="px-4 border-r border-gray-400">
                            <div className="flex gap-4 text-[12px] font-bold uppercase tracking-tight">
                              <span className={payload.vatTypeLabel === "VAT Inc" ? "text-gray-900" : "text-gray-400"}>
                                {payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
                              </span>

                              <span className={payload.vatTypeLabel === "VAT Exe" ? "text-gray-900" : "text-gray-400"}>
                                {payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
                              </span>

                              <span className={payload.vatTypeLabel === "Zero-Rated" ? "text-gray-900" : "text-gray-400"}>
                                {payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated
                              </span>
                            </div>
                          </td>

                          <td className="px-4 text-right border-r border-gray-400 font-bold text-[10px] uppercase text-gray-700">
                            Delivery Fee:
                          </td>

                          <td className="px-4 text-right font-black text-lg text-gray-900">
                            ₱{payload.deliveryFee}
                          </td>
                        </tr> */}

                        {/* <tr className="border-t-2 border-black bg-gray-200 text-gray-900 h-[45px]">
                          <td colSpan={4} className="border-r border-gray-400"></td>

                          <td className="px-4 text-right border-r border-gray-400 font-bold text-[10px] uppercase text-gray-700">
                            Grand Total:
                          </td>

                          <td className="px-4 text-right font-black text-lg text-green-700">
                            ₱{payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr> */}

                        {/* <tr className="border-t-2 border-black bg-gray-200 text-gray-900 h-[45px]">
                          <td colSpan={4} className="border-r border-gray-400"></td>
                          <td colSpan={2}>
                            <tr>
                              <td className="px-4 text-right border-r border-gray-400 font-bold text-[10px] uppercase text-gray-700">
                                Grand Total:
                              </td>
                              <td className="px-4 text-right font-black text-lg text-green-700">
                                ₱{payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-4 text-right border-r border-gray-400 font-bold text-[10px] uppercase text-gray-700">
                                Grand Total:
                              </td>
                              <td className="px-4 text-right font-black text-lg text-green-700">
                                ₱{payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </td>
                       

                        </tr> */}

                        {/* --- DETAILED SUMMARY BREAKDOWN --- */}
                        <tr className="border-t-2 border-black bg-white text-gray-900">
                          <td colSpan={4} className="border-r-2 border-black p-4 align-top">
                            <div className="flex flex-col gap-4 h-full pt-2">
                              <div className="flex items-center gap-6">
                                <span className="font-bold text-red-600 italic text-[14px] uppercase whitespace-nowrap tracking-tighter">
                                  Tax Type:
                                </span>
                                <div className="flex gap-4 text-[11px] font-black uppercase tracking-tight">
                                  <span className={payload.vatTypeLabel === "VAT Inc" ? "text-gray-900" : "text-gray-400"}>
                                    {payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
                                  </span>
                                  <span className={payload.vatTypeLabel === "VAT Exe" ? "text-gray-900" : "text-gray-400"}>
                                    {payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
                                  </span>
                                  <span className={payload.vatTypeLabel === "Zero-Rated" ? "text-gray-900" : "text-gray-400"}>
                                    {payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated
                                  </span>
                                </div>
                              </div>

                              {payload.whtType !== "none" && (
                                <div className="flex items-center gap-6 border-t border-gray-100 pt-2">
                                  <span className="font-bold text-blue-600 italic text-[12px] uppercase whitespace-nowrap tracking-tighter">
                                    Withholding:
                                  </span>
                                  <span className="text-[10px] font-black uppercase text-blue-800">
                                    ● {payload.whtLabel} (Applied to Net of VAT)
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td colSpan={4} className="p-0">
                            <table className="w-full border-collapse">
                              <tbody className="text-[10px]">

                                {/* Row 1: Gross Sales (only shown when Show Discount Row is checked) */}
                                {showSummaryDiscounts && payload.items.some(i => i.discountAmount > 0) && (
                                  <tr className="border-b border-gray-100">
                                    <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black w-[55%] text-[9px] text-gray-500">
                                      Gross Sales (Before Discount)
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                      ₱{(payload.items.reduce((a, i) => a + i.unitPrice * i.qty, 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                )}

                                {/* Row 2: Total Discount (only if any discount exists AND showSummaryDiscounts is true) */}
                                {showSummaryDiscounts && payload.items.some(i => i.discountAmount > 0) && (
                                  <tr className="border-b border-gray-100">
                                    <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-[9px] text-red-500">
                                      Less: Trade Discount
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-black text-red-600">
                                      -₱{(payload.items.reduce((a, i) => a + (i.totalDiscountAmount || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                )}

                                {/* Row 3: Net Sales */}
                                <tr className="border-b border-gray-100">
                                  <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black w-[55%] text-[9px] text-gray-500">
                                    Net Sales {payload.vatTypeLabel === "VAT Inc" ? "(VAT Inclusive)" : "(Non-VAT)"}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                    ₱{(payload.totalGross || payload.totalPrice - payload.deliveryFee - (Number(restockingFee) || 0)).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>

                                {/* Row 2: Delivery */}
                                <tr className="border-b border-gray-100">
                                  <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-[9px] text-gray-500">
                                    Delivery Charge
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                    ₱{Number(payload.deliveryFee).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>

                                {/* Row 3: Restocking Fee */}
                                <tr className="border-b-2 border-black">
                                  <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-[9px] text-gray-500">
                                    Restocking Fee
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                    ₱{(restockingFee || 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>

                                {/* Row 4: Total Invoice Amount */}
                                <tr className="bg-gray-50 border-b border-black">
                                  <td className="px-3 py-2 text-right font-black uppercase border-r border-black text-[10px]">
                                    Total Invoice Amount
                                  </td>
                                  <td className="px-3 py-2 text-right font-black text-[13px] text-blue-900">
                                    ₱{payload.totalPrice.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>

                                {/* VAT & WHT Logic */}
                                {payload.vatTypeLabel === "VAT Inc" ? (
                                  <>
                                    <tr className="border-b border-gray-100">
                                      <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">
                                        Less: VAT (12%)
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-bold text-gray-400">
                                        ₱{(payload.totalPrice * (12 / 112)).toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </td>
                                    </tr>

                                    <tr className={payload.whtType !== "none" ? "border-b border-gray-100" : "border-b-2 border-black"}>
                                      <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">
                                        Net of VAT (Tax Base)
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-bold text-gray-400">
                                        ₱{(payload.totalPrice / 1.12).toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </td>
                                    </tr>

                                    {payload.whtType !== "none" && (
                                      <tr className="border-b-2 border-black bg-blue-50/50">
                                        <td className="px-3 py-2 text-right font-black uppercase border-r-2 border-black text-blue-700 text-[8px]">
                                          LESS: {payload.whtLabel}
                                        </td>
                                        <td className="px-3 py-2 text-right font-black text-blue-700">
                                          - ₱{payload.whtAmount.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                          })}
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                ) : (
                                  <tr className="border-b-2 border-black">
                                    <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">
                                      Tax Status
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-bold text-gray-400 italic">
                                      {payload.vatTypeLabel === "VAT Exe" ? "Exempted" : "Zero-Rated"}
                                    </td>
                                  </tr>
                                )}

                                {/* Final Total */}
                                <tr className="bg-black text-white">
                                  <td className="px-3 py-3 text-right font-black uppercase border-r border-white/20 text-[10px] tracking-tight">
                                    {payload.whtType !== "none" ? "Net Amount to Collect" : "Total Amount Due"}
                                  </td>
                                  <td className="px-3 py-3 text-right font-black text-[16px]">
                                    ₱{payload.netAmountToCollect.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>

                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 1. PRODUCT VARIANCE FOOTNOTE */}
                  <div className="mt-4 text-[10px] font-black uppercase tracking-tight border-b border-black pb-1">
                    *PHOTO MAY VARY FROM ACTUAL UNIT
                  </div>

                  {/* 2. LOGISTICS & NOTES GRID */}
                  <div className="mt-4 border border-black text-[9.5px] leading-tight">
                    <div className="grid grid-cols-6 border-b border-black">
                      <div className="col-span-1 p-2 bg-yellow-400 font-black border-r border-black">Included:</div>
                      <div className="col-span-5 p-2 bg-yellow-100">
                        <p>Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p>
                        <p>Orders outside Metro Manila Free delivery is available for a minimum sales transaction of ₱10,000 in Rizal, ₱15,000 in Bulacan and Cavite, and ₱25,000 in Laguna, Pampanga, and Batangas.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-6 border-b border-black">
                      <div className="col-span-1 p-2 bg-yellow-400 font-black border-r border-black">Excluded:</div>
                      <div className="col-span-5 p-2 bg-yellow-100">
                        <p>All lamp poles are subject to a delivery charge.</p>
                        <p>Installation and all hardware/accessories not indicated above.</p>
                        <p>Freight charges, arrastre, and other processing fees.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-6 bg-yellow-50">
                      <div className="col-span-1 p-2 font-black border-r border-black">Notes:</div>
                      <div className="col-span-5 p-2 italic">
                        <p>Deliveries are up to the vehicle unloading point only.</p>
                        <p>Additional shipping fee applies for other areas not mentioned above.</p>
                        <p>Subject to confirmation upon getting the actual weight and dimensions of the items.</p>
                        <span className="font-black underline block mt-1 text-red-600">In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. EXTENDED TERMS & CONDITIONS */}
                  <div className="mt-6 border-t-2 border-black pt-2">
                    <h3 className="bg-[#121212] text-white px-3 py-1 text-[10px] font-black inline-block mb-4 uppercase">Terms and Conditions</h3>

                    <div className="grid grid-cols-12 gap-y-4 text-[9px]">
                      <div className="col-span-2 font-black uppercase">Availability:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p>*5-7 days if on stock upon receipt of approved PO.</p>
                        <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment. Barring any delay in shipping and customs clearance beyond Disruptive's control.</p>
                        <p>*In the event of a conflict or inconsistency in estimated days under Availability and another estimate indicated elsewhere in this quotation, the latter will prevail.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">Warranty:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
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

                      <div className="col-span-2 font-black uppercase">SO Validity:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100">
                        <p>Sales order has <span className="text-red-600 font-black italic">validity period of 14 working days</span>. (excluding holidays and Sundays) from the date of issuance. Any sales order not confirmed and no verified payment within this <span className="text-red-600 font-black">14-day period will be automatically cancelled</span>.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">Storage:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p>Orders with confirmation/verified payment but undelivered after 14 working days (excluding holidays and Sundays starting from picking date) due to clients’ request or shortcomings will be charged a storage fee of 10% of the value of the orders per month <span className="text-red-600 font-black"> (10% / 30 days =  0.33% per day)</span>.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">Return:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p><span className="text-red-600 font-black"><u>7 days return policy - </u></span>if the product received is defective, damaged, or incomplete. This must be communicated to Disruptive, and Disruptive has duly acknowledged communication as received within a maximum of 7 days to qualify for replacement.</p>
                      </div>

                      {/* <div className="col-span-2 font-black uppercase">Bank Details:</div> */}
                      <div className="col-span-2 font-black uppercase">Payment:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 ">
                        <p><span className="text-red-600 font-black">For Cash on Delivery</span></p>
                        <p><strong>NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery. Exceeding 10,000 pesos should be transacted through bank deposit or mobile electronic transactions.</strong></p>
                        <p>For special items,  Seventy Percent (70%) down payment, 30% upon delivery.</p>
                        <p className="mt-5"><b>BANK DETAILS</b></p>
                        <p className="mb-5"><strong>Payee to: <b>{isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</b></strong></p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-black">BANK: METROBANK</p>
                            <p>Account Name: {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</p>
                            <p>Account Number: {isEcoshift ? '243-7-243805100' : '243-7-24354164-2'}</p>
                          </div>
                          <div>
                            <p className="font-black">BANK: BDO</p>
                            <p>Account Name: {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</p>
                            <p>Account Number: {isEcoshift ? '0021-8801-7271' : '0021-8801-9258'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 font-black uppercase">DELIVERY:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p>Delivery/Pick up is subject to confirmation.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">Validity:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100">
                        <p className="text-red-600 font-black underline">Thirty (30) calendar days from the date of this offer.</p>
                        <p>In the event of changes in prevailing market conditions, duties, taxes, and all other importation charges, quoted prices are subject to change.</p>
                      </div>

                      <div className="col-span-2 font-black uppercase">CANCELLATION:</div>
                      <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                        <p>1. Above quoted items are non-cancellable.</p>
                        <p>2. If the customer cancels the order under any circumstances, the client shall be responsible for 100% cost incurred by Disruptive, including freight and delivery charges.</p>
                        <p>3. Downpayment for items not in stock/indent and order/special items are non-refundable and will be forfeited if the order is canceled.</p>
                        <p>4. COD transaction payments should be ready upon delivery. If the payment is not ready within seven (7) days from the date of order, the transaction is automatically canceled.</p>
                        <p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p>
                      </div>
                    </div>
                  </div>

                  {/* 4. OFFICIAL SIGNATURE HIERARCHY */}
                  <div className="mt-12 pt-4 border-t-4 border-blue-700 pb-20">
                    <p className="text-[9px] mb-8 font-medium">
                      Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance.
                      Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.
                    </p>

                    <div className="grid grid-cols-2 gap-x-20 gap-y-12">
                      {/* Left Side: Internal Team */}
                      <div className="space-y-10">
                        <div>
                          <p className="italic text-[10px] font-black mb-10">{isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</p>
                          <img src={payload.signature || ""} alt="Signature" className="w-34 h-10 object-contain" />
                          <p className="text-[11px] font-black uppercase mt-1">{payload.salesRepresentative}</p>
                          <div className="border-b border-black w-64"></div>
                          <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales Representative</p>
                          <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.salescontact || "N/A"}</p>
                          <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.salesemail || "N/A"}</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Approved By:</p>
                          <p className="text-[11px] font-black uppercase mt-1">{payload.salestsmname}</p>
                          <div className="border-b border-black w-64"></div>
                          <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">SALES MANAGER</p>
                          <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.tsmDetails?.contact || "N/A"}</p>
                          <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.tsmDetails?.email || "N/A"}</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Noted By:</p>
                          <p className="text-[11px] font-black uppercase mt-1">{payload.salesmanagername}</p>
                          <div className="border-b border-black w-64"></div>
                          <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales-B2B</p>
                          {/* <p className="text-[9px] font-black uppercase tracking-tighter">SALES HEAD</p> */}
                        </div>
                      </div>

                      {/* Right Side: Client Side */}
                      <div className="space-y-10 flex flex-col items-end">
                        <div className="w-64">

                          <div className="border-b border-black w-64 mt-19"></div>
                          <p className="text-[9px] text-center font-bold text-gray-500 mt-1 uppercase tracking-widest">Company Authorized Representative</p>
                          <p className="text-[9px] text-center font-bold text-gray-500 uppercase tracking-widest">(PLEASE SIGN OVER PRINTED NAME)</p>
                        </div>

                        <div className="w-64">
                          <div className="border-b border-black w-64 mt-20"></div>
                          <p className="text-[9px] text-center font-bold text-gray-500 mt-1 uppercase tracking-widest">Payment Release Date</p>
                        </div>

                        <div className="w-64">
                          <div className="border-b border-black w-64 mt-25"></div>
                          <p className="text-[9px] text-center font-bold text-gray-500 mt-1 uppercase tracking-widest">Position in the Company</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS BAR */}
                <div className="p-8 bg-white border-t border-gray-100 flex justify-between items-center sticky bottom-0 z-50">
                  <Button
                    variant="outline"
                    onClick={() => setIsPreviewOpen(false)}
                    className="rounded-none border-2 border-[#121212] font-black uppercase text-[10px] px-8 h-12 hover:bg-gray-50 transition-all"
                  >
                    Back to Editor
                  </Button>

                  <div className="flex gap-4 items-center">
                    <Button
                      onClick={() => { handleDownloadQuotation(); setIsPreviewOpen(false); }}
                      className="bg-[#121212] hover:bg-black rounded-full px-10 h-12 text-white font-black uppercase text-[11px] flex gap-3 items-center shadow-2xl hover:scale-[1.02] transition-all"
                      hidden={true}
                    >
                      <Download className="w-4 h-4 text-blue-400" />
                      Generate Official (.xlsx)
                    </Button>
                    <Button
                      onClick={handleDownloadQuotationPDF}
                      className="bg-[#121212] text-white px-10 h-12 rounded-full font-black uppercase shadow-xl hover:scale-105 transition-transform"
                      hidden={true}
                    >
                      Confirm & Generate PDF
                    </Button>
                  </div>
                </div>
              </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* IMAGE PREVIEW DIALOG */}
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="max-w-[800px] w-[95vw] p-0 border-none bg-black/90 shadow-2xl">
          <DialogHeader className="p-4">
            <DialogTitle className="text-white text-sm font-bold uppercase tracking-wider">Image Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            <img
              src={previewImageUrl}
              alt="Preview"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/Taskflow.png";
              }}
            />
          </div>
          <DialogFooter className="p-4 bg-black/90">
            <Button
              onClick={() => setImagePreviewOpen(false)}
              className="rounded-none bg-white text-black hover:bg-gray-200 font-bold"
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TEMPLATES MODAL */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-[500px] w-[95vw] p-0 border-none shadow-2xl">
          <DialogHeader className="p-4 bg-linear-to-r from-purple-600 to-blue-600">
            <DialogTitle className="text-white text-sm font-black uppercase tracking-widest">Quote Templates</DialogTitle>
          </DialogHeader>
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {/* Save Current Template */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-700 mb-2">Save Current Quote as Template</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name (e.g., Standard LED Package)"
                  className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5"
                />
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={!templateName.trim()}
                  className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
              <p className="text-[9px] text-gray-400 mt-1">Saves all current products and settings</p>
            </div>

            {/* Load Template */}
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-700 mb-2">Load Saved Template</h4>
              {savedTemplates.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No templates saved yet</p>
              ) : (
                <div className="space-y-2">
                  {savedTemplates.map((template, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded hover:border-purple-300 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-gray-800">{template.name}</p>
                        <p className="text-[9px] text-gray-400">{template.products.length} products</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => loadTemplate(template)}
                          className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => setSavedTemplates(prev => prev.filter((_, i) => i !== idx))}
                          className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded hover:bg-red-200"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-gray-200">
            <Button
              onClick={() => setShowTemplateModal(false)}
              className="rounded-none bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMATION DIALOG FOR IMPORTANT TOGGLES */}
      <Dialog open={confirmDialog?.isOpen || false} onOpenChange={(open) => {
        if (!open) {
          confirmDialog?.onCancel();
          setConfirmDialog(null);
        }
      }}>
        <DialogContent className="max-w-md w-[95vw] p-0 border-none shadow-2xl bg-white">
          {/* Header */}
          <DialogHeader className="bg-linear-to-r from-blue-600 to-blue-700 p-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <DialogTitle className="text-white font-bold text-sm uppercase tracking-wider">
                {confirmDialog?.title}
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              {confirmDialog?.description}
            </p>

            {/* Example Box */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-[11px] font-bold text-yellow-700 uppercase tracking-wider">Example</span>
              </div>
              
              {/* Show Discount Columns Example - WITH discount columns */}
              {confirmDialog?.title?.includes('Discount Columns') && (
                <div className="overflow-hidden rounded border border-yellow-200">
                  <table className="w-full text-[9px] border-collapse">
                    <thead>
                      <tr className="bg-yellow-100 text-yellow-800 border-b border-yellow-300">
                        <th className="px-1 py-1 text-center font-bold">ITEM<br/>NO</th>
                        <th className="px-1 py-1 text-center font-bold">QTY</th>
                        <th className="px-1 py-1 text-center font-bold">REFERENCE<br/>PHOTO</th>
                        <th className="px-1 py-1 text-left font-bold">PRODUCT<br/>DESCRIPTION</th>
                        <th className="px-1 py-1 text-right font-bold">UNIT<br/>PRICE</th>
                        <th className="px-1 py-1 text-right font-bold text-green-600">DISC/<br/>UNIT</th>
                        <th className="px-1 py-1 text-right font-bold">NET UNIT<br/>PRICE</th>
                        <th className="px-1 py-1 text-right font-bold">TOTAL<br/>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white text-yellow-900 border-b border-yellow-100">
                        <td className="px-1 py-1 text-center">1.</td>
                        <td className="px-1 py-1 text-center">1</td>
                        <td className="px-1 py-1 text-center text-gray-400">[IMG]</td>
                        <td className="px-1 py-1">
                          <div className="font-bold">BOLLARD FIXTURE E27</div>
                          <div className="text-[7px] text-gray-500">BLD80CM02</div>
                        </td>
                        <td className="px-1 py-1 text-right">₱500.00</td>
                        <td className="px-1 py-1 text-right text-green-600 font-bold">20%</td>
                        <td className="px-1 py-1 text-right font-bold">₱400.00</td>
                        <td className="px-1 py-1 text-right font-bold">₱400.00</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="bg-yellow-50 p-1.5 text-[8px] text-yellow-700 italic border-t border-yellow-200">
                    Client sees: DISC/UNIT and NET UNIT PRICE columns with discount details
                  </div>
                </div>
              )}
              
              {/* SRP Only PDF Example - NO discount columns */}
              {confirmDialog?.title?.includes('SRP Only') && (
                <div className="overflow-hidden rounded border border-yellow-200">
                  <table className="w-full text-[9px] border-collapse">
                    <thead>
                      <tr className="bg-yellow-100 text-yellow-800 border-b border-yellow-300">
                        <th className="px-1 py-1 text-center font-bold">ITEM<br/>NO</th>
                        <th className="px-1 py-1 text-center font-bold">QTY</th>
                        <th className="px-1 py-1 text-center font-bold">REFERENCE<br/>PHOTO</th>
                        <th className="px-1 py-1 text-left font-bold">PRODUCT<br/>DESCRIPTION</th>
                        <th className="px-1 py-1 text-right font-bold">UNIT<br/>PRICE</th>
                        <th className="px-1 py-1 text-right font-bold">TOTAL<br/>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white text-yellow-900 border-b border-yellow-100">
                        <td className="px-1 py-1 text-center">1.</td>
                        <td className="px-1 py-1 text-center">1</td>
                        <td className="px-1 py-1 text-center text-gray-400">[IMG]</td>
                        <td className="px-1 py-1">
                          <div className="font-bold">BOLLARD FIXTURE E27</div>
                          <div className="text-[7px] text-gray-500">BLD80CM02</div>
                        </td>
                        <td className="px-1 py-1 text-right font-bold">₱500.00</td>
                        <td className="px-1 py-1 text-right font-bold">₱500.00</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="bg-yellow-50 p-1.5 text-[8px] text-yellow-700 italic border-t border-yellow-200">
                    Client sees: Clean SRP pricing without discount columns. Hidden discount: 20%
                  </div>
                </div>
              )}
              
              {/* Display Mode Examples */}
              {confirmDialog?.title?.includes('Display Mode') && (
                <>
                  {/* Full Display Example */}
                  {confirmDialog?.title?.includes('Full') && (
                    <div className="overflow-hidden rounded border border-purple-200">
                      <table className="w-full text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-purple-100 text-purple-800 border-b border-purple-300">
                            <th className="px-1 py-1 text-left font-bold">PRODUCT</th>
                            <th className="px-1 py-1 text-right font-bold">UNIT PRICE</th>
                            <th className="px-1 py-1 text-right font-bold text-green-600">DISCOUNT</th>
                            <th className="px-1 py-1 text-right font-bold">NET PRICE</th>
                            <th className="px-1 py-1 text-right font-bold">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white text-purple-900 border-b border-purple-100">
                            <td className="px-1 py-1 font-medium">BOLLARD FIXTURE E27</td>
                            <td className="px-1 py-1 text-right">₱500.00</td>
                            <td className="px-1 py-1 text-right text-green-600 font-bold">20%</td>
                            <td className="px-1 py-1 text-right font-bold">₱400.00</td>
                            <td className="px-1 py-1 text-right font-bold">₱400.00</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="bg-purple-50 p-1.5 text-[8px] text-purple-700 italic border-t border-purple-200">
                        Client sees: All pricing details with discount breakdown
                      </div>
                    </div>
                  )}
                  
                  {/* Net Only Example */}
                  {confirmDialog?.title?.includes('Net Only') && (
                    <div className="overflow-hidden rounded border border-purple-200">
                      <table className="w-full text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-purple-100 text-purple-800 border-b border-purple-300">
                            <th className="px-1 py-1 text-left font-bold">PRODUCT</th>
                            <th className="px-1 py-1 text-right font-bold">NET PRICE</th>
                            <th className="px-1 py-1 text-right font-bold">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white text-purple-900 border-b border-purple-100">
                            <td className="px-1 py-1 font-medium">BOLLARD FIXTURE E27</td>
                            <td className="px-1 py-1 text-right font-bold">₱400.00</td>
                            <td className="px-1 py-1 text-right font-bold">₱400.00</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="bg-purple-50 p-1.5 text-[8px] text-purple-700 italic border-t border-purple-200">
                        Client sees: Only final net price, unit price hidden
                      </div>
                    </div>
                  )}
                  
                  {/* Show Savings Example */}
                  {confirmDialog?.title?.includes('Savings') && (
                    <div className="overflow-hidden rounded border border-purple-200">
                      <div className="bg-green-100 px-2 py-1 text-[9px] font-bold text-green-800 border-b border-green-300">
                        💰 YOU SAVE: ₱100.00 per item
                      </div>
                      <table className="w-full text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-purple-100 text-purple-800 border-b border-purple-300">
                            <th className="px-1 py-1 text-left font-bold">PRODUCT</th>
                            <th className="px-1 py-1 text-right font-bold">UNIT PRICE</th>
                            <th className="px-1 py-1 text-right font-bold">NET PRICE</th>
                            <th className="px-1 py-1 text-right font-bold">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white text-purple-900 border-b border-purple-100">
                            <td className="px-1 py-1 font-medium">BOLLARD FIXTURE E27</td>
                            <td className="px-1 py-1 text-right line-through text-gray-400">₱500.00</td>
                            <td className="px-1 py-1 text-right font-bold text-green-600">₱400.00</td>
                            <td className="px-1 py-1 text-right font-bold">₱400.00</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="bg-purple-50 p-1.5 text-[8px] text-purple-700 italic border-t border-purple-200">
                        Client sees: Savings highlighted with strikethrough and "You Save" banner
                      </div>
                    </div>
                  )}
                  
                  {/* Bundle Example */}
                  {confirmDialog?.title?.includes('Bundle') && (
                    <div className="overflow-hidden rounded border border-purple-200">
                      <div className="bg-purple-100 px-2 py-1 text-[9px] font-bold text-purple-800 border-b border-purple-300">
                        📦 BUNDLE PACKAGE DEAL
                      </div>
                      <table className="w-full text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-purple-100 text-purple-800 border-b border-purple-300">
                            <th className="px-1 py-1 text-left font-bold">PACKAGE ITEMS</th>
                            <th className="px-1 py-1 text-right font-bold">BUNDLE PRICE</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white text-purple-900 border-b border-purple-100">
                            <td className="px-1 py-1">
                              <div className="font-medium">BOLLARD FIXTURE E27</div>
                              <div className="text-[7px] text-gray-500">Qty: 1 | Part of bundle</div>
                            </td>
                            <td className="px-1 py-1 text-right font-bold">₱400.00</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="bg-purple-50 p-1.5 text-[8px] text-purple-700 italic border-t border-purple-200">
                        Client sees: Emphasis on package/bundle pricing rather than individual items
                      </div>
                    </div>
                  )}
                  
                  {/* On Request Example */}
                  {confirmDialog?.title?.includes('Request') && (
                    <div className="overflow-hidden rounded border border-purple-200">
                      <table className="w-full text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-purple-100 text-purple-800 border-b border-purple-300">
                            <th className="px-1 py-1 text-left font-bold">PRODUCT</th>
                            <th className="px-1 py-1 text-right font-bold">UNIT PRICE</th>
                            <th className="px-1 py-1 text-right font-bold">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white text-purple-900 border-b border-purple-100">
                            <td className="px-1 py-1 font-medium">BOLLARD FIXTURE E27</td>
                            <td className="px-1 py-1 text-right font-italic text-gray-500">Upon Request</td>
                            <td className="px-1 py-1 text-right font-italic text-gray-500">Upon Request</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="bg-purple-50 p-1.5 text-[8px] text-purple-700 italic border-t border-purple-200">
                        Client sees: "Price Upon Request" instead of actual pricing
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Show/Hide Discount Row Examples */}
              {confirmDialog?.title?.includes('Discount Row') && (
                <div className="overflow-hidden rounded border border-yellow-200">
                  <div className="bg-yellow-100 px-2 py-1 text-[9px] font-bold text-yellow-800 uppercase border-b border-yellow-300">
                    Summary Breakdown
                  </div>
                  <table className="w-full text-[9px] border-collapse">
                    <tbody>
                      {/* When SHOWING (ENABLING) - Include discount row */}
                      {confirmDialog?.title?.toLowerCase().includes('show') && (
                        <>
                          <tr className="bg-white text-yellow-900 border-b border-yellow-100">
                            <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[8px]">GROSS SALES (BEFORE DISCOUNT)</td>
                            <td className="px-2 py-1 text-right font-bold">₱5,000.00</td>
                          </tr>
                          <tr className="bg-red-50 text-red-600 border-b border-yellow-100">
                            <td className="px-2 py-1 text-right font-bold uppercase text-[8px]">LESS: TRADE DISCOUNT (20%)</td>
                            <td className="px-2 py-1 text-right font-bold">-₱1,000.00</td>
                          </tr>
                          <tr className="bg-white text-yellow-900 border-b border-yellow-100">
                            <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[8px]">NET SALES (VAT INCLUSIVE)</td>
                            <td className="px-2 py-1 text-right font-bold">₱4,000.00</td>
                          </tr>
                        </>
                      )}
                      {/* When HIDING (DISABLING) - Skip from Gross to Net directly */}
                      {confirmDialog?.title?.toLowerCase().includes('hide') && (
                        <tr className="bg-white text-yellow-900 border-b border-yellow-100">
                          <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[8px]">NET SALES (VAT INCLUSIVE)</td>
                          <td className="px-2 py-1 text-right font-bold">₱4,000.00</td>
                        </tr>
                      )}
                      <tr className="bg-white text-yellow-900 border-b border-yellow-100">
                        <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[8px]">DELIVERY CHARGE</td>
                        <td className="px-2 py-1 text-right font-bold">₱0.00</td>
                      </tr>
                      <tr className="bg-white text-yellow-900 border-b-2 border-yellow-200">
                        <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[8px]">RESTOCKING FEE</td>
                        <td className="px-2 py-1 text-right font-bold">₱0.00</td>
                      </tr>
                      <tr className="bg-yellow-50 text-yellow-900 border-b border-yellow-200">
                        <td className="px-2 py-1 text-right font-black uppercase text-[10px]">TOTAL INVOICE AMOUNT</td>
                        <td className="px-2 py-1 text-right font-black text-blue-900">₱4,000.00</td>
                      </tr>
                      <tr className="bg-gray-900 text-white">
                        <td className="px-2 py-1.5 text-right font-black uppercase text-[9px]">TOTAL AMOUNT DUE</td>
                        <td className="px-2 py-1.5 text-right font-black text-[11px]">₱4,000.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* VAT Example - Matches Review UI Format */}
              {(confirmDialog?.title?.toLowerCase().includes('vat') || confirmDialog?.title?.toLowerCase().includes('zero') || confirmDialog?.title?.toLowerCase().includes('rated')) && (
                <div className="overflow-hidden rounded border border-yellow-200">
                  {/* Tax Type Row - Like Review */}
                  <div className="bg-white border-b border-yellow-200 p-2">
                    <div className="flex items-center gap-2 text-[9px]">
                      <span className="font-bold text-red-600 italic uppercase">Tax Type:</span>
                      <div className="flex gap-2 font-black uppercase">
                        <span className={confirmDialog?.title?.toLowerCase().includes('inclusive') ? "text-gray-900" : "text-gray-300"}>
                          {confirmDialog?.title?.toLowerCase().includes('inclusive') ? "●" : "○"} VAT INC
                        </span>
                        <span className={confirmDialog?.title?.toLowerCase().includes('exempt') ? "text-gray-900" : "text-gray-300"}>
                          {confirmDialog?.title?.toLowerCase().includes('exempt') ? "●" : "○"} VAT EXE
                        </span>
                        <span className={(confirmDialog?.title?.toLowerCase().includes('zero') || confirmDialog?.title?.toLowerCase().includes('rated')) ? "text-gray-900" : "text-gray-300"}>
                          {(confirmDialog?.title?.toLowerCase().includes('zero') || confirmDialog?.title?.toLowerCase().includes('rated')) ? "●" : "○"} ZERO-RATED
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Summary Table - Like Review */}
                  <table className="w-full text-[10px] border-collapse">
                    <tbody>
                      <tr className="bg-white text-yellow-900 border-b border-yellow-100">
                        <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[8px]">Net Sales {confirmDialog?.title?.toLowerCase().includes('inclusive') ? "(VAT Inclusive)" : "(Non-VAT)"}</td>
                        <td className="px-2 py-1 text-right font-bold">₱100,000.00</td>
                      </tr>
                      <tr className="bg-white text-yellow-900 border-b border-yellow-100">
                        <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[8px]">Delivery Charge</td>
                        <td className="px-2 py-1 text-right font-bold">₱0.00</td>
                      </tr>
                      <tr className="bg-white text-yellow-900 border-b-2 border-yellow-200">
                        <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[8px]">Restocking Fee</td>
                        <td className="px-2 py-1 text-right font-bold">₱0.00</td>
                      </tr>
                      <tr className="bg-yellow-50 text-yellow-900 border-b border-yellow-200">
                        <td className="px-2 py-1 text-right font-black uppercase text-[10px]">Total Invoice Amount</td>
                        <td className="px-2 py-1 text-right font-black text-blue-900">₱100,000.00</td>
                      </tr>
                      {/* VAT Breakdown - Only for VAT Inc */}
                      {confirmDialog?.title?.toLowerCase().includes('inclusive') && (
                        <>
                          <tr className="bg-white text-yellow-900 border-b border-yellow-100">
                            <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[7px]">Less: VAT (12%)</td>
                            <td className="px-2 py-1 text-right font-bold text-gray-400">₱10,714.29</td>
                          </tr>
                          <tr className="bg-white text-yellow-900 border-b-2 border-yellow-200">
                            <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[7px]">Net of VAT (Tax Base)</td>
                            <td className="px-2 py-1 text-right font-bold text-gray-400">₱89,285.71</td>
                          </tr>
                        </>
                      )}
                      {/* Non-VAT Status */}
                      {(confirmDialog?.title?.toLowerCase().includes('exempt') || confirmDialog?.title?.toLowerCase().includes('zero') || confirmDialog?.title?.toLowerCase().includes('rated')) && (
                        <tr className="bg-white text-yellow-900 border-b-2 border-yellow-200">
                          <td className="px-2 py-1 text-right font-bold uppercase text-gray-400 text-[7px]">Tax Status</td>
                          <td className="px-2 py-1 text-right font-bold text-gray-400 italic">
                            {confirmDialog?.title?.toLowerCase().includes('exempt') ? "VAT Exempt" : "Zero-Rated"}
                          </td>
                        </tr>
                      )}
                      {/* Final Total */}
                      <tr className="bg-gray-900 text-white">
                        <td className="px-2 py-1.5 text-right font-black uppercase text-[9px]">Total Amount Due</td>
                        <td className="px-2 py-1.5 text-right font-black text-[11px]">₱100,000.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* EWT Example - Matches Review Format */}
              {confirmDialog?.title?.includes('EWT') && (
                <div className="overflow-hidden rounded border border-yellow-200">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-yellow-100 text-yellow-800">
                        <th className="px-2 py-1 text-left font-bold">Description</th>
                        <th className="px-2 py-1 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white text-yellow-900">
                        <td className="px-2 py-1">Net of VAT (Tax Base)</td>
                        <td className="px-2 py-1 text-right">₱89,285.71</td>
                      </tr>
                      {confirmDialog?.title?.includes('1%') && (
                        <tr className="bg-blue-50 text-blue-800">
                          <td className="px-2 py-1 font-bold">Less: EWT 1% (Goods)</td>
                          <td className="px-2 py-1 text-right font-bold">− ₱892.86</td>
                        </tr>
                      )}
                      {confirmDialog?.title?.includes('2%') && (
                        <tr className="bg-blue-50 text-blue-800">
                          <td className="px-2 py-1 font-bold">Less: EWT 2% (Services)</td>
                          <td className="px-2 py-1 text-right font-bold">− ₱1,785.71</td>
                        </tr>
                      )}
                      <tr className="bg-gray-900 text-white">
                        <td className="px-2 py-1 font-bold">
                          {confirmDialog?.title?.includes('None') ? 'Total Amount Due' : 'Net Amount to Collect'}
                        </td>
                        <td className="px-2 py-1 text-right font-bold">
                          {confirmDialog?.title?.includes('None') ? '₱100,000' : 
                           confirmDialog?.title?.includes('1%') ? '₱98,214.29' : '₱97,321.43'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Fallback - Show generic example text if no specific pattern matched but example exists */}
              {confirmDialog?.example && 
               !confirmDialog?.title?.includes('Discount Columns') &&
               !confirmDialog?.title?.includes('Full Detail') &&
               !confirmDialog?.title?.includes('SRP Only') &&
               !confirmDialog?.title?.includes('Discount Row') &&
               !confirmDialog?.title?.includes('Display Mode') &&
               !confirmDialog?.title?.includes('VAT') &&
               !confirmDialog?.title?.includes('EWT') && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-[11px] text-gray-700 font-mono leading-snug">{confirmDialog?.example}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
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

    </>
  );
}
