"use client";

import React from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Item = {
    itemNo: number | string;
    qty: number | string;
    photo?: string;
    title: string;
    sku: string;
    product_description: string;
    unitPrice: number;
    totalAmount: number;
    remarks: string;
    discount?: number;
    discountedAmount?: number;
};

type Payload = {
    referenceNo: string;
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
    vatTypeLabel: string;
    vatType: string;
    deliveryFee: string;
    restockingFee?: number;
    whtType?: string;
    whtLabel?: string;
    whtAmount?: number;
    netAmountToCollect?: number;
    salesManagerContact?: string;
    salesManagerEmail?: string;

    // Signatories
    agentName?: string | null;
    agentSignature?: string | null;
    agentContactNumber?: string | null;
    agentEmailAddress?: string | null;
    tsmName?: string | null;
    tsmSignature?: string | null;
    tsmContactNumber?: string | null;
    tsmEmailAddress?: string | null;
    managerName?: string | null;

    signature?: string | null;
    salesheademail?: string | null;
    salesheadcontact?: string | null;

};

type PreviewProps = {
    payload: Payload;
    quotationType: string;
    setIsPreviewOpen: (open: boolean) => void;
};

export const Preview: React.FC<PreviewProps> = ({ payload, quotationType }) => {
    const isEcoshift = quotationType === "Ecoshift Corporation";
    const headerImagePath = isEcoshift ? "/ecoshift-banner.png" : "/disruptive-banner.png";
    const companyName = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";

    // Calculate totals based on items, like in TSM preview.tsx
    const grossTotal = payload.items.reduce((acc, item) => acc + ((Number(item.qty) || 0) * (item.unitPrice || 0)), 0);
    const netSales = parseFloat(payload.items.reduce((acc, item) => acc + (item.totalAmount || 0), 0).toFixed(2));
    const deliveryFeeNum = Number(payload.deliveryFee) || 0;
    const restockingFeeNum = payload.restockingFee || 0;
    const totalInvoiceAmount = parseFloat((netSales + deliveryFeeNum + restockingFeeNum).toFixed(2));
    
    let vatAmount, netOfVat, whtAmount, finalAmountDue;
    if (payload.vatType === "zero_rated") {
        vatAmount = 0;
        netOfVat = totalInvoiceAmount;
        whtAmount = 0;
        finalAmountDue = totalInvoiceAmount;
    } else {
        vatAmount = parseFloat((totalInvoiceAmount * (12 / 112)).toFixed(2));
        netOfVat = parseFloat((totalInvoiceAmount / 1.12).toFixed(2));
        whtAmount = payload.whtType && payload.whtType !== "none" ? parseFloat((netOfVat * (payload.whtType === "wht_1" ? 0.01 : 0.02)).toFixed(2)) : 0;
        finalAmountDue = payload.vatType === "vat_exe"
            ? parseFloat((netOfVat - whtAmount).toFixed(2))
            : parseFloat((totalInvoiceAmount - whtAmount).toFixed(2));
    }

    return (
        <div className="flex flex-col bg-white min-h-full font-sans text-[#121212] text-[11px]">

            {/* ── HEADER ─────────────────────────────────────────────────────── */}
            <div className="w-full border-b border-gray-100">
                <div className="w-full h-[100px] relative overflow-hidden">
                    <img
                        key={quotationType}
                        src={headerImagePath}
                        alt={`${quotationType} Header`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const p = e.currentTarget.parentElement;
                            if (p) {
                                p.innerHTML = `<div class="w-full h-full bg-[#121212] flex flex-col items-center justify-center text-white">
                  <span class="font-black text-xl tracking-[0.2em] uppercase">${companyName}</span>
                  <span class="text-[9px] tracking-[0.5em] font-light opacity-60">OFFICIAL QUOTATION</span>
                </div>`;
                            }
                        }}
                    />
                </div>
            </div>

            <div className="px-10 py-6 space-y-5">

                {/* ── REFERENCE & DATE ─────────────────────────────────────────── */}
                <div className="text-right space-y-0.5">
                    {[
                        { label: "Reference No", value: payload.referenceNo },
                        { label: "Date", value: payload.date },
                    ].map(({ label, value }) => (
                        <p key={label} className="flex justify-end gap-2 text-[10px]">
                            <span className="font-black text-gray-800 uppercase">{label}:</span>
                            <span className="text-gray-500">{value}</span>
                        </p>
                    ))}
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

                <p className="text-[10px] italic text-gray-400 font-medium">
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
                                <th className="p-3 border-r border-black w-24 text-right">UNIT PRICE</th>
                                <th className="p-3 border-r border-black w-16 text-center">DISC</th>
                                <th className="p-3 border-r border-black w-24 text-right">NET UNIT PRICE</th>
                                <th className="p-3 w-24 text-right">TOTAL AMOUNT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black">
                            {payload.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 text-center border-r border-black align-top font-bold text-gray-400">{item.itemNo}</td>
                                    <td className="p-4 text-center border-r border-black align-top font-black text-[#121212]">{item.qty}</td>
                                    <td className="p-3 border-r border-black align-top bg-white">
                                        {item.photo ? (
                                            <img src={item.photo} className="w-24 h-24 object-contain mx-auto mix-blend-multiply" alt="sku-ref" />
                                        ) : (
                                            <div className="w-24 h-24 bg-gray-50 flex items-center justify-center text-[8px] text-gray-300 italic">No Image</div>
                                        )}
                                    </td>
                                    <td className="p-4 border-r border-black align-top">
                                        <p className="font-black text-[#121212] text-xs uppercase mb-1">{item.title}</p>
                                        <p className="text-[9px] text-blue-600 font-bold mb-3 tracking-tighter">{item.sku}</p>
                                        <div
                                            className="text-[10px] text-gray-500 leading-relaxed prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: item.product_description }}
                                        />
                                        <span className="bg-orange-400 mt-2 p-1 capitalize text-red-800">{item.remarks}</span>
                                    </td>
                                    <td className="p-4 text-right border-r border-black align-top font-medium">
                                        ₱{item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-center border-r border-black align-top">
                                        {item.discount && item.discount > 0 ? (
                                            <span className="text-[10px] font-black text-red-600">
                                                ₱{((item.unitPrice * item.discount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-gray-300">—</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right border-r border-black align-top">
                                        {item.discount && item.discount > 0 ? (
                                            <span className="text-[10px] font-medium text-red-600">
                                                ₱{item.discountedAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-medium">₱{item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right font-black align-top text-[#121212]">
                                        ₱{item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                                {/* Right: Fee Breakdown */}
                                <td colSpan={4} className="p-0 align-top">
                                    <table className="w-full border-collapse text-[10px]">
                                        <tbody>
                                            {/* Net Sales */}
                                            <tr className="border-b border-gray-100">
                                                <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[9px]">
                                                    Net Sales {payload.vatType === "vat_inc" ? "(VAT Inc)" : ""}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-black tabular-nums">
                                                    ₱{netSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                            {/* Delivery Fee */}
                                            <tr className="border-b border-gray-100">
                                                <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[9px]">Delivery Charge</td>
                                                <td className="px-3 py-1.5 text-right font-black tabular-nums">
                                                    ₱{deliveryFeeNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                            {/* Restocking Fee */}
                                            <tr className="border-b-2 border-black">
                                                <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[9px]">Restocking Fee</td>
                                                <td className="px-3 py-1.5 text-right font-black tabular-nums">
                                                    ₱{restockingFeeNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                            {/* Total Invoice */}
                                            <tr className="bg-gray-50 border-b border-black">
                                                <td className="px-3 py-2 text-right font-black uppercase border-r-2 border-black text-[10px]">Total Invoice Amount</td>
                                                <td className="px-3 py-2 text-right font-black text-[13px] text-blue-900 tabular-nums">
                                                    ₱{totalInvoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                            {/* VAT breakdown if vat_inc */}
                                            {payload.vatType === "vat_inc" && (
                                                <>
                                                    <tr className="border-b border-gray-100">
                                                        <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">Less: VAT (12/112)</td>
                                                        <td className="px-3 py-1.5 text-right font-bold text-gray-400 tabular-nums">
                                                            ₱{vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                    <tr className={payload.whtType && payload.whtType !== "none" ? "border-b border-gray-100" : "border-b-2 border-black"}>
                                                        <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">Net of VAT (Tax Base)</td>
                                                        <td className="px-3 py-1.5 text-right font-bold text-gray-400 tabular-nums">
                                                            ₱{netOfVat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                    {payload.whtType && payload.whtType !== "none" && (
                                                        <tr className="border-b-2 border-black bg-blue-50">
                                                            <td className="px-3 py-2 text-right font-black uppercase border-r-2 border-black text-blue-700 text-[8px]">
                                                                Less: {payload.whtLabel}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-black text-blue-700 tabular-nums">
                                                                − ₱{whtAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            )}
                                            {payload.vatType !== "vat_inc" && (
                                                <tr className="border-b-2 border-black">
                                                    <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">Tax Status</td>
                                                    <td className="px-3 py-1.5 text-right font-bold text-gray-400 italic">
                                                        {payload.vatType === "vat_exe" ? "VAT Exempt" : "Zero-Rated"}
                                                    </td>
                                                </tr>
                                            )}
                                            {/* Net Amount to Collect */}
                                            <tr className="bg-gray-900 text-white">
                                                <td className="px-3 py-3 text-right font-black uppercase border-r border-gray-700 text-[10px] tracking-tight">
                                                    {payload.whtType && payload.whtType !== "none" ? "Net Amount to Collect" : "Total Amount Due"}
                                                </td>
                                                <td className="px-3 py-3 text-right font-black text-[15px] tabular-nums">
                                                    ₱{finalAmountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ── FOOTNOTE ─────────────────────────────────────────────────── */}
                <p className="text-[9px] font-black uppercase tracking-tight border-b border-black pb-1 mt-3">
                    *PHOTO MAY VARY FROM ACTUAL UNIT
                </p>

                {/* ── LOGISTICS ─────────────────────────────────────────────────── */}
                <div className="border border-black text-[9px] leading-snug">
                    {[
                        {
                            label: "Included:",
                            content: (
                                <>
                                    <p>Orders within Metro Manila: Free delivery for minimum ₱5,000.</p>
                                    <p className="mt-1">Outside Metro Manila: Free delivery from ₱10,000 (Rizal), ₱15,000 (Bulacan/Cavite), ₱25,000 (Laguna/Pampanga/Batangas).</p>
                                </>
                            ),
                            yellow: true,
                        },
                        {
                            label: "Excluded:",
                            content: (
                                <>
                                    <p>All lamp poles subject to delivery charge.</p>
                                    <p>Installation and hardware/accessories not indicated above.</p>
                                    <p>Freight charges, arrastre, and processing fees.</p>
                                </>
                            ),
                            yellow: true,
                        },
                        {
                            label: "Notes:",
                            content: (
                                <>
                                    <p className="italic">Deliveries are up to the vehicle unloading point only.</p>
                                    <p className="italic">Additional shipping fee applies for other areas.</p>
                                    <p className="italic">Subject to confirmation upon getting actual weight/dimensions.</p>
                                    <p className="font-black text-red-600 underline mt-1">
                                        In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.
                                    </p>
                                </>
                            ),
                            yellow: false,
                        },
                    ].map(({ label, content, yellow }, i, arr) => (
                        <div
                            key={label}
                            className={`flex ${i < arr.length - 1 ? "border-b border-black" : ""}`}
                        >
                            <div className={`w-24 shrink-0 p-2 font-black border-r border-black ${yellow ? "bg-yellow-400" : ""}`}>
                                {label}
                            </div>
                            <div className={`flex-1 p-2 ${yellow ? "bg-yellow-100" : "bg-yellow-50"}`}>
                                {content}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── TERMS & CONDITIONS ───────────────────────────────────────── */}
                <div className="border-t-2 border-black pt-3">
                    <span className="bg-gray-900 text-white px-3 py-1 text-[9px] font-black inline-block mb-4 uppercase tracking-wider">
                        Terms and Conditions
                    </span>

                    <div className="grid grid-cols-12 gap-y-3 text-[9px] leading-snug">
                        {[
                            {
                                label: "Availability",
                                content: (
                                    <div className="bg-yellow-50 p-2">
                                        <p>*5-7 days if on stock upon receipt of approved PO.</p>
                                        <p>*Indent orders: 45-60 days upon receipt of approved PO & down payment.</p>
                                        <p>*In conflict of estimates, the latter will prevail.</p>
                                    </div>
                                ),
                            },
                            {
                                label: "Warranty",
                                content: (
                                    <div className="bg-yellow-50 p-2">
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
                                ),
                            },
                            {
                                label: "SO Validity",
                                content: (
                                    <p>
                                        Sales order valid for <span className="text-red-600 font-black">14 working days</span> from issuance.
                                        Unconfirmed orders within this period are <span className="text-red-600 font-black">automatically cancelled</span>.
                                    </p>
                                ),
                            },
                            {
                                label: "Storage",
                                content: (
                                    <div className="bg-yellow-50 p-2">
                                        <p>
                                            Undelivered confirmed orders after 14 working days charged
                                            <span className="text-red-600 font-black"> 10% storage fee/month (0.33%/day)</span>.
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                label: "Return",
                                content: (
                                    <div className="bg-yellow-50 p-2">
                                        <p>
                                            <span className="text-red-600 font-black underline">7-day return policy</span> for defective, damaged, or incomplete products —
                                            must be communicated within 7 days.
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                label: "Payment",
                                content: (
                                    <div className="p-2">
                                        <p><span className="text-red-600 font-black">For Cash on Delivery</span></p>
                                        <p className="font-semibold mt-1">
                                            Orders below ₱10,000: cash on delivery accepted. Above ₱10,000: bank deposit or e-payment required.
                                        </p>
                                        <p className="mt-1">For special items: 70% down payment, 30% upon delivery.</p>
                                        <p className="font-black mt-3">BANK DETAILS — Payee: {companyName}</p>
                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                            <div>
                                                <p className="font-black">METROBANK</p>
                                                <p>Account Name: {companyName}</p>
                                                <p>Account No: {isEcoshift ? "243-7-243805100" : "243-7-24354164-2"}</p>
                                            </div>
                                            <div>
                                                <p className="font-black">BDO</p>
                                                <p>Account Name: {companyName}</p>
                                                <p>Account No: {isEcoshift ? "0021-8801-7271" : "0021-8801-9258"}</p>
                                            </div>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                label: "Delivery",
                                content: (
                                    <div className="bg-yellow-50 p-2">
                                        <p>Delivery/Pick up is subject to confirmation.</p>
                                    </div>
                                ),
                            },
                            {
                                label: "Validity",
                                content: (
                                    <p>
                                        <span className="text-red-600 font-black underline">Thirty (30) calendar days from the date of this offer.</span> from the date of this offer.
                                        Quoted prices subject to change with market conditions.
                                    </p>
                                ),
                            },
                            {
                                label: "Cancellation",
                                content: (
                                    <div className="bg-yellow-50 p-2 space-y-0.5">
                                        <p>1. Quoted items are non-cancellable.</p>
                                        <p>2. Client responsible for 100% of costs incurred if cancelled.</p>
                                        <p>3. Downpayment for indent/special items is non-refundable.</p>
                                        <p>4. COD payment must be ready within 7 days or order is auto-cancelled.</p>
                                        <p>5. Special Projects (SPF) cancellations subject to 100% charge.</p>
                                    </div>
                                ),
                            },
                        ].map(({ label, content }) => (
                            <React.Fragment key={label}>
                                <div className="col-span-2 font-black uppercase pt-1">{label}:</div>
                                <div className="col-span-10 pl-3 border-l border-gray-100">{content}</div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* ── SIGNATURE HIERARCHY ───────────────────────────────────────── */}
                <div className="mt-10 pt-4 border-t-4 border-blue-700 pb-16">
                    <p className="text-[9px] mb-8 text-gray-600 leading-relaxed font-medium">
                        Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance.
                        Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.
                    </p>

                    <div className="grid grid-cols-2 gap-x-16 gap-y-10">
                        {/* Left: Internal */}
                        <div className="space-y-10">
                            {/* Sales Rep */}
                            <div>
                                <p className="italic text-[10px] font-black mb-8">
                                    {isEcoshift ? "Ecoshift Corporation" : "Disruptive Solutions Inc"}
                                </p>
                                {payload.agentSignature ? (
                                    <img
                                        src={payload.agentSignature}
                                        alt="Agent Signature"
                                        className="h-14 object-contain mb-1"
                                    />
                                ) : (
                                    <div className="h-14 flex items-end">
                                        <p className="text-[9px] text-gray-300 italic">No signature on file</p>
                                    </div>
                                )}
                                <p className="text-[10px] font-black uppercase mt-1">{payload.agentName || "—"}</p>
                                <div className="border-b border-black w-56 mt-0.5" />
                                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Sales Representative</p>
                                <p className="text-[9px] text-gray-400 italic">Mobile: {payload.agentContactNumber || "N/A"}</p>
                                <p className="text-[9px] text-gray-400 italic">Email: {payload.agentEmailAddress || "N/A"}</p>
                            </div>

                            {/* Approver */}
                            <div>
                                <p className="text-[9px] font-black uppercase text-gray-400 mb-8">Approved By:</p>
                                {payload.tsmSignature ? (
                                    <img
                                        src={payload.tsmSignature}
                                        alt="TSM Signature"
                                        className="h-14 object-contain mb-1"
                                    />
                                ) : (
                                    <div className="h-14 flex items-end">
                                        <p className="text-[9px] text-gray-300 italic">No signature on file</p>
                                    </div>
                                )}
                                <p className="text-[10px] font-black uppercase mt-1">{payload.tsmName || "—"}</p>
                                <div className="border-b border-black w-56 mt-0.5" />
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">TERRITORY SALES MANAGER</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.tsmContactNumber || "N/A"}</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.tsmEmailAddress || "N/A"}</p>
                            </div>

                            {/* Noted By */}
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Noted By:</p>
                                {payload.signature ? (
                                    <img
                                        src={payload.signature}
                                        alt="Agent Signature"
                                        className="w-40 h-20 object-contain flex align-items center justify-center mb-2 border-none"
                                    />
                                ) : (
                                    <p className="text-[9px] text-gray-500 italic mb-2">No signature available</p>
                                )}
                                <p className="text-[11px] font-black uppercase mt-1">{payload.managerName}</p>
                                <div className="border-b border-black w-64"></div>
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales-B2B</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.salesheadcontact || "N/A"}</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.salesheademail || "N/A"}</p>
                            </div>
                        </div>

                        {/* Right: Client */}
                        <div className="flex flex-col items-end gap-10">
                            {[
                                "Company Authorized Representative\n(PLEASE SIGN OVER PRINTED NAME)",
                                "Payment Release Date",
                                "Position in the Company",
                            ].map((label) => (
                                <div key={label} className="w-60">
                                    <div className="border-b border-black w-60 mt-16" />
                                    {label.split("\n").map((line, i) => (
                                        <p
                                            key={i}
                                            className="text-[8px] text-center font-bold text-gray-400 mt-1 uppercase tracking-widest"
                                        >
                                            {line}
                                        </p>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};