"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

type Item = {
    itemNo: number | string;
    qty: number | string;
    photo?: string;
    title: string;
    sku: string;
    product_description: string;
    unitPrice: number;
    discount?: number;
    discountAmount?: number;        // Per-unit peso discount amount
    discountedAmount?: number;      // Net unit price after discount
    totalAmount: number;
    remarks: string;
    /** True when this item originates from an SPF 1 (procurement-approved) record */
    isSpf1?: boolean;
    /** Lead time string from procurement */
    procurementLeadTime?: string;
    /** True when this item is marked as PROMO — shows yellow badge */
    isPromo?: boolean;
    /** Per-item flag: hide discount details for this specific item */
    hideDiscountInPreview?: boolean;
    /** Per-item display mode */
    displayMode?: 'transparent' | 'net_only' | 'value_add' | 'bundle' | 'request';
};

type Payload = {
    referenceNo: string;
    version?: string;
    date: string;
    companyName: string;
    address: string;
    telNo: string;
    email: string;
    attention: string;
    subject: string;
    salesRepresentative: string;
    salescontact: string;
    salesemail: string;
    salestsmname?: string;
    salesmanagername: string;
    salestsmcontact?: string;
    salestsmemail?: string;
    items: Item[];
    totalPrice: number;
    vatType?: string | null;
    deliveryFee?: string | number;
    restockingFee?: number;
    whtType?: string;
    whtLabel?: string;
    whtAmount?: number;
    netAmountToCollect?: number;
    salesManagerContact?: string;
    salesManagerEmail?: string;

    // Signatories
    agentSignature?: string | null;
    agentContactNumber?: string | null;
    agentEmailAddress?: string | null;
    TsmSignature?: string | null;
    TsmEmailAddress?: string | null;
    TsmContactNumber?: string | null;
    ManagerSignature?: string | null;
    ManagerContactNumber?: string | null;
    ManagerEmailAddress?: string | null;
};

type PreviewProps = {
    payload: Payload;
    quotationType: string;
    setIsPreviewOpen: (open: boolean) => void;
    hideDiscountInPreview?: boolean;
    showDiscountColumns?: boolean;
    showSummaryDiscounts?: boolean;
    showProfitMargins?: boolean;
    marginAlertThreshold?: number;
    showMarginAlerts?: boolean;
    productViewMode?: string;
    visibleColumns?: any;
    approvedStatus?: string;
    hasChanges?: boolean;
};

export const Preview: React.FC<PreviewProps> = ({
    payload,
    quotationType,
    setIsPreviewOpen,
    hideDiscountInPreview = false,
    showDiscountColumns = false,
    showSummaryDiscounts = false,
    approvedStatus,
    hasChanges = false,
}) => {
    // Check if quotation is approved (show PDF/Print buttons only when approved)
    // Also check for unsaved changes - hide PDF download if there are changes
    const isApproved = (approvedStatus === "Approved" || approvedStatus === "Approved By Sales Head" || approvedStatus === "APPROVED" || approvedStatus === "Approved By Manager") && !hasChanges;
    const isEcoshift = quotationType === "Ecoshift Corporation" || (payload.referenceNo || "").startsWith("EC");
    const headerImagePath = isEcoshift
        ? "/ecoshift-banner.png"
        : "/disruptive-banner.png";

    // ── Computed totals (use actual line item totals, not payload.totalPrice which may be stale) ──
    // Calculate gross total first (unitPrice * qty)
    const grossTotal = (payload.items || []).reduce((acc, item) => acc + ((Number(item.qty) || 0) * (item.unitPrice || 0)), 0);
    // Net Sales is the sum of rounded line item totals to avoid floating point butal
    const netSales = parseFloat((payload.items || []).reduce((acc, item) => acc + (item.totalAmount || 0), 0).toFixed(2));
    // Trade Discount is the difference between gross and net
    const tradeDiscount = parseFloat((grossTotal - netSales).toFixed(2));
    const totalInvoiceAmount = parseFloat((netSales + (Number(payload.deliveryFee) || 0) + (Number(payload.restockingFee) || 0)).toFixed(2));

    // Round components to 2 decimal places to ensure summary adds up exactly
    const vatAmount = parseFloat((totalInvoiceAmount * (12 / 112)).toFixed(2));
    const netOfVat  = parseFloat((totalInvoiceAmount / 1.12).toFixed(2));
    const whtAmount = payload.whtType !== "none" ? parseFloat((netOfVat * (payload.whtType === "wht_1" ? 0.01 : 0.02)).toFixed(2)) : 0;
    // VAT-inclusive: client pays net-of-VAT (VAT is separated out), then less WHT if any.
    // Non-VAT / zero-rated: client pays the full invoice amount, less WHT if any.
    const baseAmountDue = payload.vatType === "vat_inc" ? netOfVat : totalInvoiceAmount;
    const finalAmountDue = parseFloat((baseAmountDue - whtAmount).toFixed(2));

    // ── QR Code Security ──────────────────────────────────────────────────────
    const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

    // ── Toast Notification ───────────────────────────────────────────────────
    const [toast, setToast] = React.useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    // ── SO Preparation Helper ──────────────────────────────────────────────────
    const [soHelperOpen, setSoHelperOpen] = React.useState(false);
    const [selectedItems, setSelectedItems] = React.useState<Set<number>>(new Set());

    // ── Image Preview ─────────────────────────────────────────────────────────
    const [imagePreviewOpen, setImagePreviewOpen] = React.useState(false);
    const [previewImageUrl, setPreviewImageUrl] = React.useState<string | null>(null);
    const [previewImageTitle, setPreviewImageTitle] = React.useState<string>("");

    const toggleItemSelection = (idx: number) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setSelectedItems(newSet);
    };

    const selectAllItems = () => {
        if (selectedItems.size === payload.items.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(payload.items.map((_, i) => i)));
        }
    };

    const generateSOFormat = (format: 'excel' | 'tab' | 'list') => {
        const itemsToCopy = payload.items.filter((_, i) => selectedItems.has(i));
        if (itemsToCopy.length === 0) {
            showToast('Please select items first', 'error');
            return;
        }

        let text = '';
        if (format === 'excel') {
            text = 'Item Code\tProduct Description\tQty\tUnit Price\tTotal\n';
            text += itemsToCopy.map(item => 
                `${item.sku}\t${item.title} - ${item.product_description?.replace(/<[^>]*>/g, '').substring(0, 100) || ''}\t${item.qty}\t${item.unitPrice}\t${(item.totalAmount !== undefined ? Number(item.totalAmount) : Number(item.qty) * item.unitPrice)}`
            ).join('\n');
        } else if (format === 'tab') {
            text = itemsToCopy.map(item => 
                `${item.sku}\t${item.title}\t${item.qty}\t${item.unitPrice}`
            ).join('\n');
        } else {
            text = itemsToCopy.map((item, i) => 
                `${i + 1}. ${item.sku} - ${item.title} (Qty: ${item.qty})`
            ).join('\n');
        }

        navigator.clipboard.writeText(text).then(() => {
            showToast(`Copied ${itemsToCopy.length} items for SO (Format: ${format.toUpperCase()})`, 'success');
        }).catch(() => {
            showToast('Failed to copy', 'error');
        });
    };

    React.useEffect(() => {
        const generateQr = async () => {
            try {
                const QRCode = await import("qrcode");

                // Security Token Generation (must match verify page logic)
                const SECURITY_SALT = "TF-SECURE-2024-DS-EC";
                const generateToken = (ref: string, total: string) => {
                    const raw = `${ref}|${total}|${SECURITY_SALT}`;
                    let hash = 0;
                    for (let i = 0; i <raw.length; i++) {
                        const chr = raw.charCodeAt(i);
                        hash = (hash << 5) - hash + chr;
                        hash |= 0;
                    }
                    return Math.abs(hash).toString(36).toUpperCase();
                };

                const totalStr = payload.totalPrice.toFixed(2);
                const token = generateToken(payload.referenceNo, totalStr);

                const verificationUrl = `${window.location.origin}/verify-quotation?ref=${encodeURIComponent(payload.referenceNo)}&total=${totalStr}&v=${token}`;

                const dataUrl = await QRCode.toDataURL(verificationUrl, {
                    width: 128,
                    margin: 1,
                    color: { dark: "#121212", light: "#ffffff" },
                    errorCorrectionLevel: "H", // High error correction for better reliability
                });
                setQrDataUrl(dataUrl);
            } catch (err) {
                console.error("QR Generation failed", err);
            }
        };
        generateQr();
    }, [payload, isEcoshift]);

    // ── Security helpers ──────────────────────────────────────────────────────
    const securityTimestamp = new Date().toISOString();
    const companyLabel = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";
    const watermarkText = `${companyLabel} · OFFICIAL QUOTATION · ${payload.referenceNo}`;

    // PDF Download handler
    const handleDownloadPDF = () => {
        window.print();
    };

    return (
        <div className="flex flex-col bg-white min-h-full font-sans text-[#121212]" style={{ position: "relative" }}>
            {/* ── HEADER TOOLBAR WITH PDF/PRINT (Only when approved) ───────────────── */}
            {isApproved && (
                <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-wider">QUOTATION PREVIEW</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleDownloadPDF}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2-4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Print
                        </button>
                    </div>
                </div>
            )}

            {/* ── WARNING BANNER (When there are unsaved changes) ───────────────── */}
            {hasChanges && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center sticky top-0 z-50">
                    <div className="flex items-center gap-2 text-amber-800">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-xs font-semibold">
                            You have unsaved changes. PDF download is disabled until you save.
                        </span>
                    </div>
                </div>
            )}

            {/* ── DIAGONAL WATERMARK OVERLAY ─────────────────────────────────────── */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 10,
                    overflow: "hidden",
                }}
            >
                <svg
                    width="100%"
                    height="100%"
                    style={{ position: "absolute", inset: 0 }}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <pattern
                            id="wm-pattern"
                            x="0"
                            y="0"
                            width="800"
                            height="150"
                            patternUnits="userSpaceOnUse"
                            patternTransform="rotate(-25)"
                        >
                            <text
                                x="0"
                                y="40"
                                fontFamily="Arial, sans-serif"
                                fontSize="9"
                                fontWeight="bold"
                                fill="#121212"
                                fillOpacity="0.06"
                                letterSpacing="1"
                            >
                                {watermarkText}
                            </text>
                            <text
                                x="400"
                                y="115"
                                fontFamily="Arial, sans-serif"
                                fontSize="9"
                                fontWeight="bold"
                                fill="#121212"
                                fillOpacity="0.06"
                                letterSpacing="1"
                            >
                                {watermarkText}
                            </text>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#wm-pattern)" />
                </svg>
            </div>

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

            <div className="px-12 py-8 space-y-1">
                {/* REFERENCE & DATE SECTION */}
                <div className="text-right text-[11px] font-medium uppercase space-y-1">
                    <p className="flex justify-end gap-2">
                        <span className="font-black text-[#121212]">Reference No:</span>
                        <span className="text-gray-600">
                            {payload.referenceNo}
                            {payload.version && (() => {
                                // Extract revision number from version string
                                const match = payload.version.match(/-(\d+)-/);
                                const revNum = match ? match[1] : null;
                                return revNum ? ` (Rev ${revNum})` : ` (${payload.version})`;
                            })()}
                        </span>
                    </p>
                    <p className="flex justify-end gap-2">
                        <span className="font-black text-[#121212]">Date:</span>
                        <span className="text-gray-600">{payload.date}</span>
                    </p>
                </div>

                {/* CLIENT INFORMATION GRID */}
                <div className="mt-5 border-l border-r border-black">
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
                    <table className="w-full text-[10px] border-collapse">
                        <thead>
                            <tr className="bg-[#F9FAFA] border-b border-black font-black uppercase text-[#121212]">
                                <th className="p-3 border-r border-black w-16 text-center">ITEM NO</th>
                                <th className="p-3 border-r border-black w-16 text-center">QTY</th>
                                <th className="p-3 border-r border-black w-32 text-center">REFERENCE PHOTO</th>
                                <th className="p-3 border-r border-black text-left">PRODUCT DESCRIPTION</th>
                                <th className={`p-3 border-r border-black w-20 text-center`}>
                                    {hideDiscountInPreview ? 'SRP' : 'UNIT PRICE'}
                                </th>
                                {!hideDiscountInPreview && showDiscountColumns && (
                                    <>
                                        <th className="p-3 border-r border-black w-14 text-center">DISC/UNIT</th>
                                        <th className="p-3 border-r border-black w-20 text-center">DISCOUNTED PRICE</th>
                                    </>
                                )}
                                <th className={`p-3 text-center ${hideDiscountInPreview ? 'w-24' : 'w-20'}`}>TOTAL AMOUNT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black">
                            {payload.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 text-center border-r border-black align-top font-bold text-gray-400">{item.itemNo}</td>
                                    <td className="p-4 text-center border-r border-black align-top font-black text-[#121212]">{item.qty}</td>
                                    <td className="p-3 border-r border-black align-top bg-white">
                                        {item.photo ? (
                                            <img 
                                                src={item.photo} 
                                                className="w-24 h-24 object-contain mx-auto mix-blend-multiply cursor-pointer hover:opacity-80 transition-opacity border border-gray-200 rounded" 
                                                alt="sku-ref"
                                                onClick={() => {
                                                    setPreviewImageUrl(item.photo || null);
                                                    setPreviewImageTitle(item.title);
                                                    setImagePreviewOpen(true);
                                                }}
                                                title="Click to preview image"
                                            />
                                        ) : (
                                            <div className="w-24 h-24 bg-gray-50 flex items-center justify-center text-[8px] text-gray-300 italic border border-gray-200 rounded">No Image</div>
                                        )}
                                    </td>
                                    <td className="p-4 border-r border-black align-top">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-black text-[#121212] text-xs uppercase">{item.title}</p>
                                            {item.isPromo && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-yellow-400 text-yellow-900 shrink-0 animate-pulse">
                                                    PROMO
                                                </span>
                                            )}
                                            {item.isSpf1 && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-600 text-white shrink-0">
                                                    SPF
                                                </span>
                                            )}
                                            {/* Copy Button for Product Description & Item Code */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const cleanDescription = item.product_description?.replace(/<[^>]*>/g, '').trim() || '';
                                                    const textToCopy = `Item Code: ${item.sku}\nProduct Name: ${item.title}\nProduct Description: ${cleanDescription}\nQty: ${item.qty}\nUnit Price: ₱${item.unitPrice.toLocaleString()}`;
                                                    navigator.clipboard.writeText(textToCopy).then(() => {
                                                        showToast('✓ Item details copied for SO preparation!', 'success');
                                                    }).catch(() => {
                                                        showToast('✗ Failed to copy to clipboard', 'error');
                                                    });
                                                }}
                                                className="ml-2 p-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                                                title="Copy Item Code & Product Description"
                                            >
                                                <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                        <p className="text-[9px] text-blue-600 font-bold mb-3 tracking-tighter">{item.sku}</p>
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
                                            dangerouslySetInnerHTML={{ __html: item.product_description }}
                                        />
                                        <span className="bg-orange-400 mt-2 p-1 capitalize text-red-800">{item.remarks}</span>
                                    </td>
                                    <td className={`p-4 text-right border-r border-black align-top font-medium w-28 ${
                                        (item.displayMode === 'request' || item.displayMode === 'net_only' || item.displayMode === 'bundle') ? 'bg-gray-50' : ''
                                    }`}>
                                        {(() => {
                                            const mode = item.displayMode || 'transparent';
                                            if (mode === 'request') return <span className="text-[10px] text-gray-500 italic">Upon request</span>;
                                            if (mode === 'net_only' || mode === 'bundle') return <span className="text-[10px] text-gray-400">—</span>;
                                            // Global hideDiscountInPreview OR per-item flag: show net price as SRP
                                            const effectiveHide = hideDiscountInPreview || item.hideDiscountInPreview;
                                            if (effectiveHide) {
                                                const displayPrice = item.discountedAmount != null && item.discountedAmount > 0
                                                    ? item.discountedAmount
                                                    : item.unitPrice;
                                                return <span>₱{Number(displayPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
                                            }
                                            return <span>₱{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
                                        })()}
                                    </td>
                                    {!hideDiscountInPreview && showDiscountColumns && !item.hideDiscountInPreview && (
                                        <>
                                            <td className={`p-4 text-right border-r border-black align-top w-20 ${
                                                item.displayMode === 'request' || item.displayMode === 'net_only' || item.displayMode === 'bundle' ? 'bg-gray-50' : ''
                                            }`}>
                                                {(() => {
                                                    const mode = item.displayMode || 'transparent';
                                                    if (mode === 'request' || mode === 'net_only' || mode === 'bundle') return <span className="text-[10px] text-gray-400">—</span>;

                                                    // discountAmount is already per-unit (stored as per-unit in the data)
                                                    const perUnitDiscount = item.discountAmount || 0;

                                                    if (perUnitDiscount > 0) {
                                                        return (
                                                            <div>
                                                                <div className="font-bold text-red-600 text-[10px]">
                                                                    −₱{perUnitDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </div>
                                                                {item.discount != null && item.discount > 0 && (
                                                                    <div className="text-[9px] text-gray-400">
                                                                        ({item.discount.toFixed(2)}%)
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    } else if (item.discount && item.discount > 0) {
                                                        return <span className="font-bold text-red-600 text-[10px]">{item.discount.toFixed(2)}%</span>;
                                                    }
                                                    return <span className="text-gray-300 text-[10px]">—</span>;
                                                })()}
                                            </td>
                                            <td className={`p-4 text-right border-r border-black align-top w-28 font-medium ${
                                                item.displayMode === 'request' || item.displayMode === 'net_only' || item.displayMode === 'bundle' ? 'bg-gray-50' : ''
                                            }`}>
                                                {(() => {
                                                    const mode = item.displayMode || 'transparent';
                                                    if (mode === 'request' || mode === 'net_only' || mode === 'bundle') return <span className="text-[10px] text-gray-400">—</span>;

                                                    // discountAmount is already per-unit
                                                    const perUnitDiscount = item.discountAmount || 0;
                                                    const netUnitPrice = item.unitPrice - perUnitDiscount;

                                                    return <span>₱{netUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
                                                })()}
                                            </td>
                                        </>
                                    )}
                                    {/* When showDiscountColumns is on but per-item hide is on — show placeholder cells to keep alignment */}
                                    {!hideDiscountInPreview && showDiscountColumns && item.hideDiscountInPreview && (
                                        <>
                                            <td className="p-4 border-r border-black align-top bg-gray-50/50">
                                                <span className="text-[8px] text-blue-400 italic">hidden</span>
                                            </td>
                                            <td className="p-4 border-r border-black align-top bg-gray-50/50">
                                                <span className="text-[8px] text-blue-400 italic">hidden</span>
                                            </td>
                                        </>
                                    )}
                                    <td className="p-4 text-right font-black align-top text-[#121212]">
                                        {item.displayMode === 'request' ? (
                                            <span className="text-[10px] text-gray-500 italic">Upon request</span>
                                        ) : (
                                            <>
                                                ₱{(item.totalAmount !== undefined ? Number(item.totalAmount) : Number(item.qty) * Number(item.unitPrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                {item.displayMode === 'value_add' && item.discountAmount != null && item.discountAmount > 0 && (
                                                    <div className="text-[8px] text-green-600 font-semibold mt-0.5 text-right">
                                                        save ₱{(item.discountAmount * Number(item.qty)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {/* SUMMARY BAR */}
                            <tr className="border-t-2 border-black bg-white text-gray-900">
                                {/* Left: Tax Type + WHT */}
                                <td colSpan={4} className="border-r-2 border-black p-3 align-top">
                                    <div className="flex flex-col gap-2">
                                        {/* VAT Type */}
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-red-600 italic text-[11px] uppercase whitespace-nowrap">Tax Type:</span>
                                            <div className="flex gap-3 text-[10px] font-black uppercase">
                                                {["vat_inc", "vat_exe", "zero_rated"].map((v) => (
                                                    <span key={v} className={payload.vatType === v ? "text-gray-900" : "text-gray-300"}>
                                                        {payload.vatType === v ? "●" : "○"} {v === "vat_inc" ? "VAT Inc" : v === "vat_exe" ? "VAT Exe" : "Zero-Rated"}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {/* EWT */}
                                        {payload.whtType && payload.whtType !== "none" && (
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-blue-600 italic text-[10px] uppercase whitespace-nowrap">Withholding:</span>
                                                <span className="text-[10px] font-black uppercase text-blue-800">● {payload.whtLabel}</span>
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td colSpan={hideDiscountInPreview ? 2 : (showDiscountColumns ? 4 : 2)} className="p-0 align-top">
                                    <table className="w-full border-collapse text-[10px]">
                                        <tbody>

                                            {/* Row 1: Gross Sales (only shown when Show Discount Row is checked) */}
                                            {showSummaryDiscounts && payload.items.some((i: any) => i.discountAmount > 0) && (
                                                <tr className="border-b border-gray-100">
                                                    <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black w-[55%] text-[9px] text-gray-500">
                                                        Gross Sales (Before Discount)
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                                        ₱{(payload.items.reduce((a: number, i: any) => a + (i.unitPrice || 0) * (i.qty || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Row 2: Total Discount (only if any discount exists AND showSummaryDiscounts is true) */}
                                            {showSummaryDiscounts && payload.items.some((i: any) => i.discountAmount > 0) && (
                                                <tr className="border-b border-gray-100">
                                                    <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-[9px] text-red-500">
                                                        Less: Trade Discount
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-black text-red-600">
                                                        -₱{(payload.items.reduce((a: number, i: any) => a + ((i.discountAmount || 0) * (i.qty || 0)), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Row 3: Net Sales */}
                                            <tr className="border-b border-gray-100">
                                                <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black w-[55%] text-[9px] text-gray-500">
                                                    Net Sales {payload.vatType === "vat_inc" ? "(VAT Inclusive)" : "(Non-VAT)"}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                                    ₱{netSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                            {/* Row 4: Delivery */}
                                            <tr className="border-b border-gray-100">
                                                <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-[9px] text-gray-500">
                                                    Delivery Charge
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                                    ₱{(Number(payload.deliveryFee) || 0)
                                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                            {/* Row 5: Restocking Fee */}
                                            <tr className="border-b-2 border-black">
                                                <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-[9px] text-gray-500">
                                                    Restocking Fee
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-black text-gray-900">
                                                    ₱{(Number(payload.restockingFee) || 0)
                                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                            <tr className="bg-gray-50 border-b border-black">
                                                <td className="px-3 py-2 text-right font-black uppercase border-r-2 border-black text-[10px]">
                                                    Total Invoice Amount
                                                </td>
                                                <td className="px-3 py-2 text-right font-black text-[13px] text-blue-900 tabular-nums">
                                                    ₱{totalInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                            {payload.vatType === "vat_inc" && (
                                                <>
                                                    <tr className="border-b border-gray-100">
                                                        <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-500 text-[8px]">
                                                            Less: VAT (12%)
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-bold text-gray-500 tabular-nums">
                                                            ₱{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>

                                                    <tr className={payload.whtType && payload.whtType !== "none"
                                                        ? "border-b border-gray-100"
                                                        : "border-b-2 border-black"}>
                                                        <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-500 text-[8px]">
                                                            Net of VAT (Tax Base)
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-bold text-gray-500 tabular-nums">
                                                            ₱{netOfVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>

                                                    {payload.whtType && payload.whtType !== "none" && (
                                                        <tr className="border-b-2 border-black bg-blue-50">
                                                            <td className="px-3 py-2 text-right font-black uppercase border-r-2 border-black text-blue-700 text-[8px]">
                                                                Less: {payload.whtLabel}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-black text-blue-700 tabular-nums">
                                                                − ₱{whtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            )}

                                            {/* Final Total */}
                                            <tr className="bg-gray-900 text-white">
                                                <td className="px-3 py-3 text-right font-black uppercase border-r border-gray-700 text-[10px] tracking-tight">
                                                    {payload.whtType && payload.whtType !== "none"
                                                        ? "Net Amount to Collect"
                                                        : "Total Amount Due"}
                                                </td>
                                                <td className="px-3 py-3 text-right font-black text-[15px] tabular-nums">
                                                    ₱{finalAmountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                            <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment. Barring any delay in shipping and customs clearance beyond {isEcoshift ? "Ecoshift's" : "Disruptive's"} control.</p>
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
                            <p><span className="text-red-600 font-black"><u>7 days return policy - </u></span>if the product received is defective, damaged, or incomplete. This must be communicated to {isEcoshift ? "Ecoshift" : "Disruptive"}, and {isEcoshift ? "Ecoshift" : "Disruptive"} has duly acknowledged communication as received within a maximum of 7 days to qualify for replacement.</p>
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
                            <p className="text-red-600 font-black underline">Thirty(30) calendar days from the date of this offer</p>
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
                                {payload.agentSignature ? (
                                    <div className="relative inline-block">
                                        <img
                                            src={payload.agentSignature}
                                            alt="Agent Signature"
                                            className="w-40 h-20 object-contain flex align-items center justify-center mb-2 border-none"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-[10px] font-black text-[#121212] opacity-[0.03] rotate-[-15deg] uppercase tracking-[0.5em]">
                                                Official Verified
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[9px] text-gray-500 italic mb-2">No signature available</p>
                                )}
                                <p className="text-[11px] font-black uppercase mt-1">{payload.salesRepresentative}</p>
                                <div className="border-b border-black w-64"></div>
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales Representative</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.agentContactNumber || "N/A"}</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.agentEmailAddress || "N/A"}</p>
                            </div>

                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Approved By:</p>
                                {payload.TsmSignature ? (
                                    <div className="relative inline-block">
                                        <img
                                            src={payload.TsmSignature}
                                            alt="Agent Signature"
                                            className="w-40 h-20 object-contain flex align-items center justify-center mb-2 border-none"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-[10px] font-black text-[#121212] opacity-[0.03] rotate-[-15deg] uppercase tracking-[0.5em]">
                                                Official Verified
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[9px] text-gray-500 italic mb-2">No signature available</p>
                                )}
                                <p className="text-[11px] font-black uppercase mt-1">{payload.salestsmname || "—"}</p>
                                <div className="border-b border-black w-64"></div>
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Territory Sales Manager</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.TsmContactNumber || "N/A"}</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.TsmEmailAddress || "N/A"}</p>
                            </div>

                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Noted By:</p>
                                {payload.ManagerSignature ? (
                                    <div className="relative inline-block">
                                        <img
                                            src={payload.ManagerSignature}
                                            alt="Agent Signature"
                                            className="w-40 h-20 object-contain flex align-items center justify-center mb-2 border-none"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-[10px] font-black text-[#121212] opacity-[0.03] rotate-[-15deg] uppercase tracking-[0.5em]">
                                                Official Verified
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[9px] text-gray-500 italic mb-2">No signature available</p>
                                )}
                                <p className="text-[11px] font-black uppercase mt-1">{payload.salesmanagername || "—"}</p>
                                <div className="border-b border-black w-64"></div>
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales-B2B</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.ManagerContactNumber || "N/A"}</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.ManagerEmailAddress || "N/A"}</p>
                                {/* <p className="text-[9px] font-black uppercase tracking-tighter">SALES HEAD</p> */}
                            </div>
                        </div>

                        {/* Right Side: Client Side */}
                        <div className="space-y-10 flex flex-col items-end">
                            {/* Company Authorized Representative */}
                            <div className="w-64 text-center">
                                <p className="text-[10px] font-black uppercase mb-1">{payload.attention || "—"}</p>
                                <div className="border-b border-black w-64" />
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest leading-none">
                                    Company Authorized Representative
                                </p>
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                                    (PLEASE SIGN OVER PRINTED NAME)
                                </p>
                            </div>

                            {/* Payment Release Date */}
                            <div className="w-64 text-center">
                                <div className="border-b border-black w-64 mt-12" />
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">
                                    Payment Release Date
                                </p>
                            </div>

                            {/* Position in the Company */}
                            <div className="w-64 text-center">
                                <div className="border-b border-black w-64 mt-12" />
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">
                                    Position in the Company
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── DOCUMENT SECURITY MICRO-FOOTER ───────────────────────────────────── */}
            <div className="mx-12 mb-8 border-t border-dashed border-gray-300 pt-3 flex items-center justify-between gap-4">
                <div className="flex flex-col">
                    <p className="text-[8px] text-gray-400 font-medium leading-relaxed">
                        Document ID: <span className="font-black text-gray-500">{payload.referenceNo}</span>
                        &nbsp;·&nbsp; Issued: {securityTimestamp}
                        &nbsp;·&nbsp; {companyLabel}
                    </p>
                    <p className="text-[8px] text-gray-400 italic shrink-0 mt-1">
                        This document is only valid when downloaded from Taskflow.
                    </p>
                </div>

                {qrDataUrl && (
                    <div className="flex flex-col items-center">
                        <img src={qrDataUrl} alt="Verification QR" className="w-20 h-20 opacity-80 mix-blend-multiply" />
                        <span className="text-[6px] font-black text-gray-300 uppercase tracking-widest mt-1">Verify Authenticity</span>
                    </div>
                )}
            </div>

            {/* ACTION BUTTONS BAR */}
            <div className="p-8 bg-white border-t border-gray-100 flex justify-between items-center sticky bottom-0 z-50">
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setIsPreviewOpen(false)}
                        className="rounded-none border-2 border-[#121212] font-black uppercase text-[10px] px-8 h-12 hover:bg-gray-50 transition-all"
                    >
                        Back to Editor
                    </Button>
                    
                    {/* SO Helper Button */}
                    <Button
                        variant="outline"
                        onClick={() => setSoHelperOpen(true)}
                        className="rounded-none border-2 border-blue-600 text-blue-600 font-black uppercase text-[10px] px-6 h-12 hover:bg-blue-50 transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        SO Helper
                    </Button>
                </div>
            </div>

            {/* ── MODERN TOAST NOTIFICATION ──────────────────────────────────────── */}
            {toast.show && (
                <div className={`fixed top-6 right-6 z-[100] transform transition-all duration-300 ${toast.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
                    <div className={`flex items-center gap-3 px-5 py-4 rounded-lg shadow-2xl border ${
                        toast.type === 'success' 
                            ? 'bg-green-50 border-green-200 text-green-800' 
                            : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            toast.type === 'success' 
                                ? 'bg-green-100' 
                                : 'bg-red-100'
                        }`}>
                            {toast.type === 'success' ? (
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <p className="font-semibold text-sm">{toast.type === 'success' ? 'Success' : 'Error'}</p>
                            <p className="text-sm">{toast.message}</p>
                        </div>
                        <button 
                            onClick={() => setToast(prev => ({ ...prev, show: false }))}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* ── SO PREPARATION HELPER DRAWER ─────────────────────────────────────── */}
            {soHelperOpen && (
                <div className="fixed inset-0 z-[60] flex">
                    {/* Backdrop */}
                    <div 
                        className="flex-1 bg-black/30 backdrop-blur-sm"
                        onClick={() => setSoHelperOpen(false)}
                    />
                    
                    {/* Drawer */}
                    <div className="w-[480px] bg-white shadow-2xl flex flex-col h-full animate-slideInRight">
                        {/* Header */}
                        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-lg">SO Preparation Helper</h2>
                                    <p className="text-blue-100 text-xs">Quickly copy items for Sales Order creation</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSoHelperOpen(false)}
                                className="text-white/70 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-5">
                            {/* Actions Bar */}
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                                <button
                                    onClick={selectAllItems}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    {selectedItems.size === payload.items.length ? 'Deselect All' : 'Select All'}
                                </button>
                                <span className="text-sm text-gray-500">
                                    {selectedItems.size} of {payload.items.length} selected
                                </span>
                            </div>

                            {/* Items List */}
                            <div className="space-y-2 mb-6">
                                {payload.items.map((item, idx) => (
                                    <div 
                                        key={idx}
                                        onClick={() => toggleItemSelection(idx)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                            selectedItems.has(idx) 
                                                ? 'border-blue-500 bg-blue-50' 
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                selectedItems.has(idx) 
                                                    ? 'bg-blue-600 border-blue-600' 
                                                    : 'border-gray-300'
                                            }`}>
                                                {selectedItems.has(idx) && (
                                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-gray-900 truncate">{item.title}</p>
                                                <p className="text-xs text-blue-600 font-mono">{item.sku}</p>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    <span>Qty: {item.qty}</span>
                                                    <span>₱{item.unitPrice.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Copy Format Options */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm font-semibold text-gray-700 mb-3">Copy Format for SO</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => generateSOFormat('excel')}
                                        disabled={selectedItems.size === 0}
                                        className="p-3 bg-white border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <svg className="w-6 h-6 mx-auto mb-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="text-xs font-medium text-gray-700">Excel</span>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Tab-separated</p>
                                    </button>
                                    <button
                                        onClick={() => generateSOFormat('tab')}
                                        disabled={selectedItems.size === 0}
                                        className="p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <svg className="w-6 h-6 mx-auto mb-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                        <span className="text-xs font-medium text-gray-700">Simple</span>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Tab-delimited</p>
                                    </button>
                                    <button
                                        onClick={() => generateSOFormat('list')}
                                        disabled={selectedItems.size === 0}
                                        className="p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <svg className="w-6 h-6 mx-auto mb-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                        <span className="text-xs font-medium text-gray-700">List</span>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Numbered items</p>
                                    </button>
                                </div>
                            </div>

                            {/* Quick Tips */}
                            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-xs text-yellow-800">
                                        <span className="font-semibold">Pro Tip:</span> Use Excel format to paste directly into spreadsheets. Simple format works best for SAP or internal systems.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Animation Styles */}
            <style jsx>{`
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
                .animate-slideInRight {
                    animation: slideInRight 0.3s ease-out;
                }
            `}</style>

            {/* ── IMAGE PREVIEW DIALOG ─────────────────────────────────────────────── */}
            {imagePreviewOpen && previewImageUrl && (
                <div 
                    className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
                    onClick={() => setImagePreviewOpen(false)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
                        <button
                            onClick={() => setImagePreviewOpen(false)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <img
                            src={previewImageUrl}
                            alt={previewImageTitle}
                            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl bg-white"
                        />
                        <p className="text-white mt-4 text-sm font-medium">{previewImageTitle}</p>
                    </div>
                </div>
            )}
        </div>
    );
};