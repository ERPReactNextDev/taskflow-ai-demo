"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Preview } from "../dialog/preview";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, XIcon, FileText, Loader2, History } from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CompletedItem {
    id: number;
    start_date?: string;
    end_date?: string;
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
    tsm_approved_status?: string;
    discounted_priced?: string;
    discounted_amount?: string;
}

interface ProductItem {
    description: string;
    skus: any;
    title: string;
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
    procurementMinQty?: number;
    procurementLeadTime?: string;
    procurementLockedPrice?: boolean;
    cloudinaryPublicId?: string;
}

interface TaskListEditDialogProps {
    item: CompletedItem;
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
    tsmname?: string;
    tsmemail?: string;
    tsmcontact?: string;
    managername?: string;
    deliveryFee?: string;
    restockingFee?: string;
    whtType?: string;
    quotationSubject?: string;

    // Signatories
    agentName?: string;
    agentSignature?: string;
    agentContactNumber?: string;
    agentEmailAddress?: string;
    tsmName?: string;
    tsmSignature?: string;
    tsmContactNumber?: string;
    tsmEmailAddress?: string;
    managerName?: string;
    managerSignature?: string;
    managerContactNumber?: string;
    managerEmailAddress?: string;

    signature?: string;
    email?: string;
    contact?: string;
    vatType?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function splitAndTrim(value?: string): string[] {
    if (!value) return [];
    return value.split(",").map((v) => v.trim());
}

function splitDescription(value?: string): string[] {
    if (!value) return [];
    return value.split("||").map((v) => v.trim());
}

function formatDuration(start?: string, end?: string) {
    if (!start || !end) return "-";
    const s = new Date(start),
        e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return "-";
    let diff = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
    const h = Math.floor(diff / 3600);
    diff %= 3600;
    const m = Math.floor(diff / 60);
    const sec = diff % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (sec > 0 || parts.length === 0) parts.push(`${sec}s`);
    return parts.join(" ");
}

// ─── Component ─────────────────────────────────────────────────────────────────

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
    deliveryFee,
    restockingFee,
    whtType,
    quotationSubject,
    agentName,
    agentSignature,
    agentContactNumber,
    agentEmailAddress,
    tsmName,
    tsmSignature,
    tsmContactNumber,
    tsmEmailAddress,
    managerName,
    managerSignature,
    managerContactNumber,
    managerEmailAddress,
    signature,
    vatType,
}: TaskListEditDialogProps) {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [checkedRows, setCheckedRows] = useState<Record<number, boolean>>({});
    const [discount] = useState(0);
    const initialVatType: "vat_inc" | "vat_exe" | "zero_rated" =
        vatType === "vat_inc" || vatType === "vat_exe" || vatType === "zero_rated"
            ? vatType
            : "zero_rated";
    const [vatTypeState] = React.useState<"vat_inc" | "vat_exe" | "zero_rated">(initialVatType);
    const [deliveryFeeState] = useState<string>(deliveryFee ?? "");
    const [restockingFeeState] = useState<string>(restockingFee ?? "");
    const [whtTypeState] = useState<string>(whtType ?? "none");
    const [quotationAmount, setQuotationAmount] = useState<number>(0);

    const [isDeclineOpen, setIsDeclineOpen] = useState(false);
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const [tsmRemarks, setTsmRemarks] = useState("");
    const [statusDialogTitle, setStatusDialogTitle] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<"Approved" | "Endorsed to Sales Head" | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [revisedQuotations, setRevisedQuotations] = useState<any[]>([]);
    const [selectedRevisedQuotation, setSelectedRevisedQuotation] = useState<any | null>(null);
    const [viewingCurrent, setViewingCurrent] = useState(true);

    // Derived company info
    const company_name = company?.company_name || "";
    const contact_number = company?.contact_number || "";
    const address = company?.address || "";
    const email_address = company?.email_address || "";
    const contact_person = company?.contact_person || "";
    const quotation_type = item.quotation_type;
    const quotationNumber = item.quotation_number || "";
    const isEcoshift = quotation_type === "Ecoshift Corporation";
    const headerImagePath = isEcoshift ? "/ecoshift-banner.png" : "/disruptive-banner.png";

    // ─── Fetch Revised Quotations History ───────────────────────────────────
    useEffect(() => {
        if (!item.quotation_number) return;
        const fetchRevised = async () => {
            const { data, error } = await supabase
                .from("revised_quotations")
                .select("*")
                .eq("quotation_number", item.quotation_number)
                .order("id", { ascending: false });
            if (!error) setRevisedQuotations(data || []);
        };
        fetchRevised();
    }, [item.quotation_number]);

    // ─── Build payload from revision ─────────────────────────────────────────
    const getRevisionPayload = (revision: any) => {
        const salesRepresentativeName = `${firstname ?? ""} ${lastname ?? ""}`.trim();
        const emailUsername = email?.split("@")[0] ?? "";
        let emailDomain = "";
        if (revision.quotation_type === "Disruptive Solutions Inc") emailDomain = "disruptivesolutionsinc.com";
        else if (revision.quotation_type === "Ecoshift Corporation") emailDomain = "ecoshiftcorp.com";
        else emailDomain = email?.split("@")[1] ?? "";
        const salesemail = emailUsername && emailDomain ? `${emailUsername}@${emailDomain}` : "";

        const quantities = revision.product_quantity?.split(",").map((v: string) => v.trim()) || [];
        const amounts = revision.product_amount?.split(",").map((v: string) => v.trim()) || [];
        const titles = revision.product_title?.split(",").map((v: string) => v.trim()) || [];
        const descriptions = revision.product_description?.split("||").map((v: string) => v.trim()) || [];
        const photos = revision.product_photo?.split(",").map((v: string) => v.trim()) || [];
        const skus = revision.product_sku?.split(",").map((v: string) => v.trim()) || [];
        const remarks = revision.item_remarks?.split(",").map((v: string) => v.trim()) || [];
        const discountPercents = revision.discounted_priced?.split(",").map((v: string) => parseFloat(v.trim()) || 0) || [];

        const maxLen = Math.max(quantities.length, amounts.length, titles.length, 1);
        const items = Array.from({ length: maxLen }, (_, i) => {
            const qty = parseFloat(quantities[i] ?? "0") || 0;
            const unitPrice = parseFloat(amounts[i] ?? "0") || 0;
            const discountPct = discountPercents[i] ?? 0;
            const isDiscounted = discountPct > 0;
            const unitDiscountAmount = isDiscounted ? (unitPrice * discountPct) / 100 : 0;
            const discountedAmount = unitPrice - unitDiscountAmount; // Unit price after discount (NET UNIT PRICE)
            const totalAmount = discountedAmount * qty; // Total after discount
            return {
                itemNo: i + 1,
                qty,
                photo: photos[i] ?? "",
                title: titles[i] ?? "",
                sku: skus[i] ?? "",
                remarks: remarks[i] ?? "",
                product_description: descriptions[i] ?? "",
                unitPrice,
                discount: discountPct,
                discountedAmount,
                totalAmount,
            };
        });

        const deliveryFeeNum = parseFloat(revision.delivery_fee) || 0;
        const restockingFeeNum = parseFloat(revision.restocking_fee) || 0;
        const whtType = revision.quotation_vatable ?? "none";
        const vatType = revision.vat_type ?? "zero_rated";
        const whtLabel = whtType === "wht_1" ? "EWT 1% (Goods)" : whtType === "wht_2" ? "EWT 2% (Services)" : "None";

        // Compute totals the same way preview.tsx does, using the items themselves
        const grossTotal = items.reduce((acc, item) => acc + ((Number(item.qty) || 0) * (item.unitPrice || 0)), 0);
        const netSales = parseFloat(items.reduce((acc, item) => acc + (item.totalAmount || 0), 0).toFixed(2));
        const totalInvoiceAmount = parseFloat((netSales + deliveryFeeNum + restockingFeeNum).toFixed(2));
        
        let vatAmount, netOfVat, whtAmount, finalAmountDue;
        if (vatType === "zero_rated") {
            vatAmount = 0;
            netOfVat = totalInvoiceAmount;
            whtAmount = 0;
            finalAmountDue = totalInvoiceAmount;
        } else {
            vatAmount = parseFloat((totalInvoiceAmount * (12 / 112)).toFixed(2));
            netOfVat = parseFloat((totalInvoiceAmount / 1.12).toFixed(2));
            whtAmount = whtType !== "none" ? parseFloat((netOfVat * (whtType === "wht_1" ? 0.01 : 0.02)).toFixed(2)) : 0;
            finalAmountDue = vatType === "vat_exe"
                ? parseFloat((netOfVat - whtAmount).toFixed(2))
                : parseFloat((totalInvoiceAmount - whtAmount).toFixed(2));
        }

        return {
            referenceNo: revision.quotation_number || revision.version || "DRAFT-XXXX",
            date: revision.start_date ? new Date(revision.start_date).toLocaleDateString() : new Date().toLocaleDateString(),
            companyName: revision.company_name || company_name,
            address: revision.address || address,
            telNo: revision.contact_number || contact_number,
            email: revision.email_address || email_address,
            attention: revision.contact_person || contact_person,
            subject: revision.quotation_subject || "For Quotation",
            items,
            vatTypeLabel: vatType === "vat_inc" ? "VAT Inc" : vatType === "vat_exe" ? "VAT Exe" : "Zero-Rated",
            totalPrice: totalInvoiceAmount,
            deliveryFee: revision.delivery_fee ?? "",
            vatType,
            restockingFee: restockingFeeNum,
            whtType,
            whtLabel,
            whtBase: netOfVat,
            whtAmount: Number(whtAmount),
            netAmountToCollect: Number(finalAmountDue),
            salesRepresentative: salesRepresentativeName,
            salesemail,
            salescontact: contact ?? "",
            salestsmname: tsmname ?? "",
            salestsmemail: tsmemail ?? "",
            salestsmcontact: tsmcontact ?? "",
            agentName: agentName ?? null,
            agentSignature: agentSignature ?? "",
            agentContactNumber: agentContactNumber ?? null,
            agentEmailAddress: agentEmailAddress ?? null,
            tsmName: tsmName ?? null,
            managerName: managerName || managername || null,
            signature: tsmSignature ?? signature ?? null,
            tsmemail: tsmEmailAddress ?? tsmemail ?? email ?? null,
            tsmcontact: tsmContactNumber ?? tsmcontact ?? contact ?? null,
        };
    };

    // ─── Payload builder ──────────────────────────────────────────────────────
    const getQuotationPayload = () => {
        const salesRepresentativeName = `${firstname ?? ""} ${lastname ?? ""}`.trim();
        const emailUsername = email?.split("@")[0] ?? "";
        let emailDomain = "";
        if (quotation_type === "Disruptive Solutions Inc") emailDomain = "disruptivesolutionsinc.com";
        else if (quotation_type === "Ecoshift Corporation") emailDomain = "ecoshiftcorp.com";
        else emailDomain = email?.split("@")[1] ?? "";
        const salesemail = emailUsername && emailDomain ? `${emailUsername}@${emailDomain}` : "";

        const items = products.map((p, index) => {
            const qty = parseFloat(p.product_quantity ?? "0") || 0;
            const unitPrice = parseFloat(p.product_amount ?? "0") || 0;
            const isDiscounted = checkedRows[index] ?? false;
            const rowDiscount = isDiscounted ? (p.discount ?? (vatTypeState === "vat_exe" ? 12 : 0)) : 0;
            const unitDiscountAmount = isDiscounted && rowDiscount > 0 ? (unitPrice * rowDiscount) / 100 : 0;
            const discountedAmount = unitPrice - unitDiscountAmount; // Unit price after discount (NET UNIT PRICE)
            const totalAmount = discountedAmount * qty; // Total after discount
            return {
                itemNo: index + 1,
                qty,
                photo: p.product_photo ?? "",
                title: p.product_title ?? "",
                sku: p.product_sku ?? "",
                remarks: p.item_remarks ?? "",
                product_description: p.description?.trim() ? p.description : p.product_description || "",
                unitPrice,
                discount: rowDiscount,
                discountedAmount,
                totalAmount,
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
            };
        });

        const deliveryFeeNum = parseFloat(deliveryFeeState) || 0;
        const restockingFeeNum = parseFloat(restockingFeeState) || 0;
        
        // Compute totals the same way preview.tsx does
        const grossTotal = items.reduce((acc, item) => acc + ((Number(item.qty) || 0) * (item.unitPrice || 0)), 0);
        const netSales = parseFloat(items.reduce((acc, item) => acc + (item.totalAmount || 0), 0).toFixed(2));
        const totalInvoiceAmount = parseFloat((netSales + deliveryFeeNum + restockingFeeNum).toFixed(2));
        
        let vatAmount, netOfVat, whtAmount, finalAmountDue;
        if (vatTypeState === "zero_rated") {
            vatAmount = 0;
            netOfVat = totalInvoiceAmount;
            whtAmount = 0;
            finalAmountDue = totalInvoiceAmount;
        } else {
            vatAmount = parseFloat((totalInvoiceAmount * (12 / 112)).toFixed(2));
            netOfVat = parseFloat((totalInvoiceAmount / 1.12).toFixed(2));
            whtAmount = whtTypeState !== "none" ? parseFloat((netOfVat * (whtTypeState === "wht_1" ? 0.01 : 0.02)).toFixed(2)) : 0;
            finalAmountDue = vatTypeState === "vat_exe"
                ? parseFloat((netOfVat - whtAmount).toFixed(2))
                : parseFloat((totalInvoiceAmount - whtAmount).toFixed(2));
        }

        return {
            referenceNo: quotationNumber || "DRAFT-XXXX",
            date: new Date().toLocaleDateString(),
            companyName: company_name,
            address,
            telNo: contact_number,
            email: email_address,
            attention: contact_person,
            subject: quotationSubject || "For Quotation",
            items,
            vatTypeLabel: vatTypeState === "vat_inc" ? "VAT Inc" : vatTypeState === "vat_exe" ? "VAT Exe" : "Zero-Rated",
            totalPrice: totalInvoiceAmount,
            deliveryFee: deliveryFeeState ?? "",
            vatType: vatTypeState ?? null,
            restockingFee: restockingFeeNum,
            whtType: whtTypeState ?? "none",
            whtLabel: whtTypeState === "wht_1" ? "EWT 1% (Goods)" : whtTypeState === "wht_2" ? "EWT 2% (Services)" : "None",
            whtBase: netOfVat,
            whtAmount: Number(whtAmount),
            netAmountToCollect: Number(finalAmountDue),
            salesRepresentative: salesRepresentativeName,
            salesemail,
            salescontact: contact ?? "",
            salestsmname: tsmname ?? "",
            salestsmemail: tsmemail ?? "",
            salestsmcontact: tsmcontact ?? "",
            agentName: agentName ?? null,
            agentSignature: agentSignature ?? "",
            agentContactNumber: agentContactNumber ?? null,
            agentEmailAddress: agentEmailAddress ?? null,
            tsmName: tsmName ?? null,
            managerName: managerName || managername || null,
            signature:
                item.tsm_approved_status === "Approved" ||
                    item.tsm_approved_status === "Approved By Sales Head"
                    ? (tsmSignature ?? signature ?? null)
                    : null,
            tsmemail: tsmEmailAddress ?? tsmemail ?? email ?? null,
            tsmcontact: tsmContactNumber ?? tsmcontact ?? contact ?? null,
        };
    };

    const payload = getQuotationPayload();
    const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        const generateQr = async () => {
            try {
                const QRCode = await import("qrcode");

                // Security Token Generation (must match verify page logic)
                const SECURITY_SALT = "TF-SECURE-2024-DS-EC";
                const generateToken = (ref: string, total: string) => {
                    const raw = `${ref}|${total}|${SECURITY_SALT}`;
                    let hash = 0;
                    for (let i = 0; i < raw.length; i++) {
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

    const companyLabel = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";

    const securityTimestamp = new Date().toISOString();
    const watermarkText = `${companyLabel} · OFFICIAL QUOTATION · ${quotationNumber}`;

    // ─── Initialize products ──────────────────────────────────────────────────
    useEffect(() => {
        const quantities = splitAndTrim(item.product_quantity);
        const amounts = splitAndTrim(item.product_amount);
        const titles = splitAndTrim(item.product_title);
        const descriptions = splitDescription(item.product_description);
        const photos = splitAndTrim(item.product_photo);
        const skus = splitAndTrim(item.product_sku);
        const remarks = splitAndTrim(item.item_remarks);
        const discountedPrices = splitAndTrim(item.discounted_priced);

        const maxLen = Math.max(
            quantities.length, amounts.length, titles.length,
            descriptions.length, photos.length, skus.length, remarks.length,
            discountedPrices.length, 1
        );

        const newCheckedRows: Record<number, boolean> = {};
        const arr: ProductItem[] = Array.from({ length: maxLen }, (_, i) => {
            const discountValue = parseFloat(discountedPrices[i] ?? "0") || 0;
            const isDiscounted = discountValue > 0;
            if (isDiscounted) {
                newCheckedRows[i] = true;
            }
            return {
                product_quantity: quantities[i] ?? "",
                product_amount: amounts[i] ?? "",
                product_title: titles[i] ?? "",
                product_description: descriptions[i] ?? "",
                product_photo: photos[i] ?? "",
                product_sku: skus[i] ?? "",
                item_remarks: remarks[i] ?? "",
                quantity: parseFloat(quantities[i] ?? "0") || 0,
                description: descriptions[i] ?? "",
                skus: skus[i] ? [skus[i]] : undefined,
                title: titles[i] ?? "",
                images: photos[i] ? [{ src: photos[i] }] : undefined,
                isDiscounted: isDiscounted,
                discount: discountValue,
                price: parseFloat(amounts[i] ?? "0") || 0,
            };
        });

        setProducts(arr);
        setCheckedRows(newCheckedRows);
    }, [item]);

    // ─── Compute total ────────────────────────────────────────────────────────
    useEffect(() => {
        let total = 0;
        products.forEach((p, idx) => {
            const qty = parseFloat(p.product_quantity ?? "0") || 0;
            const amt = parseFloat(p.product_amount ?? "0") || 0;
            const isChecked = checkedRows[idx] ?? false;
            const rowDiscount = isChecked
                ? (p.discount ?? (vatTypeState === "vat_exe" ? 12 : 0))
                : 0;
            const unitDiscountAmount = (amt * rowDiscount) / 100;
            const netUnitPrice = amt - unitDiscountAmount;
            const lineTotal = netUnitPrice * qty;
            total += lineTotal;
        });
        // Round to 2 decimal places to prevent floating-point precision issues
        setQuotationAmount(Math.round(total * 100) / 100);
    }, [products, checkedRows, vatTypeState]);

    // ─── PDF Security helpers ─────────────────────────────────────────────────

    /** Security token — same algorithm as verify page */
    const generateSecurityToken = (referenceNo: string, total: string): string => {
        const SECURITY_SALT = "TF-SECURE-2024-DS-EC";
        const raw = `${referenceNo}|${total}|${SECURITY_SALT}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            const chr = raw.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0;
        }
        return Math.abs(hash).toString(36).toUpperCase();
    };

    /** Generate QR code as base64 PNG */
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

    /** Diagonal watermark stamped across the page */
    const stampPdfWatermark = (
        pdf: any,
        referenceNo: string,
        pdfWidth: number,
        pdfHeight: number,
    ) => {
        pdf.saveGraphicsState();
        const gState = new (pdf as any).GState({ opacity: 0.06 });
        pdf.setGState(gState);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(18, 18, 18);
        const line = `${companyLabel}  ·  OFFICIAL QUOTATION  ·  ${referenceNo}`;
        const stepX = 800;
        const stepY = 75;
        const angle = 25;
        let rowIdx = 0;
        for (let y = -400; y < pdfHeight + 400; y += stepY) {
            const offset = rowIdx % 2 === 0 ? 0 : 400;
            for (let x = -1000 + offset; x < pdfWidth + 1000; x += stepX) {
                pdf.text(line, x, y, { angle });
            }
            rowIdx++;
        }
        pdf.restoreGraphicsState();
    };

    /** Security footer strip at bottom of each page */
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
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.line(20, footerY - 4, pdfWidth - 20, footerY - 4);

        if (qrDataUrl) {
            pdf.addImage(qrDataUrl, "PNG", pdfWidth - 60, footerY - 22, 40, 40);
        }

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.setTextColor(130, 130, 130);
        pdf.text(`REF: ${referenceNo}`, 20, footerY + 4);
        pdf.text(`ISSUED: ${issuedAt}`, 20, footerY + 12);
        pdf.text(`This document is only valid when downloaded from Taskflow.`, 20, footerY + 20);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Page ${pageNum} of ${totalPages}`, pdfWidth / 2, footerY + 14, { align: "center" });
    };

    // ─── PDF Download ─────────────────────────────────────────────────────────
    const DownloadPDF = async () => {
        if (typeof window === "undefined") return;

        const PRIMARY_CHARCOAL = "#121212";
        const OFF_WHITE = "#F9FAFA";
        const payload = getQuotationPayload();

        try {
            const { default: jsPDF } = await import("jspdf");
            const { default: html2canvas } = await import("html2canvas");

            // ── Security artefacts ────────────────────────────────────────────────
            const issuedAt = new Date().toISOString();
            const totalStr = payload.totalPrice.toFixed(2);
            const token = generateSecurityToken(payload.referenceNo, totalStr);
            const verificationUrl = `${window.location.origin}/verify-quotation?ref=${encodeURIComponent(payload.referenceNo)}&total=${totalStr}&v=${token}`;
            const qrDataUrl = await generateQrDataUrl(verificationUrl);

            const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [612, 936] });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const BOTTOM_MARGIN = 50;

            const iframe = document.createElement("iframe");
            Object.assign(iframe.style, { position: "fixed", right: "1000%", width: "816px", visibility: "hidden" });
            document.body.appendChild(iframe);
            const iframeDoc = iframe.contentWindow?.document;
            if (!iframeDoc) throw new Error("Initialization Failed");

            iframeDoc.open();
            iframeDoc.write(`
        <html><head><style>
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: white; width: 816px; color: ${PRIMARY_CHARCOAL}; overflow: hidden; }
        .header-img { width: 100%; display: block; }
        .content-area { padding: 0px 60px; }
        .client-grid { border-left: 1.5px solid black; border-right: 1.5px solid black; }
        .grid-row { display: flex; align-items: center; min-height: 20px; padding: 2px 15px; }
        .border-t { border-top: 1.5px solid black; }
        .border-b { border-bottom: 1.5px solid black; padding-bottom: 10px; }
        .label { width: 140px; font-weight: 900; font-size: 10px; }
        .value { flex-grow: 1; font-size: 10px; font-weight: bold; color: #374151; padding-left: 15px; text-transform: uppercase; }
        .intro-text { font-size: 10px; font-style: italic; color: #6b7280; font-weight: 500; padding: 5px 0; }
        .table-container { border: 1.5px solid black; border-bottom: none; }
        .main-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .main-table thead tr { background: ${OFF_WHITE}; }
        .main-table th { padding: 5px 8px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; border-right: 1px solid black; }
        .main-table td { padding: 15px 10px; vertical-align: top; border-right: 1px solid black; border-bottom: 1px solid black; font-size: 10px; }
        .main-table td:last-child, .main-table th:last-child { border-right: none; }
        .item-no { color: #9ca3af; font-weight: bold; text-align: center; }
        .qty-col { font-weight: 900; text-align: center; }
        .ref-photo { mix-blend-mode: multiply; width: 96px; height: 96px; object-fit: contain; display: block; margin: 0 auto; }
        .product-title { font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 4px; }
        .sku-text { color: #2563eb; font-weight: bold; font-size: 9px; margin-bottom: 10px; }
        .desc-text { width: 100%; font-size: 9px; color: #000; line-height: 1.2; }
        .desc-remarks { background-color: #f97316; padding: 0.25rem; text-transform: uppercase; color: #801313; font-weight: bold; }
        .variance-footnote { margin-top: 15px; font-size: 10px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid black; padding-bottom: 4px; }
        .logistics-container { margin-top: 15px; border: 1px solid black; font-size: 9.5px; }
        .logistics-row { display: flex; border-bottom: 1px solid black; }
        .logistics-row:last-child { border-bottom: none; }
        .logistics-label { width: 100px; padding: 8px; font-weight: 900; border-right: 1px solid black; flex-shrink: 0; }
        .logistics-value { padding: 8px; flex-grow: 1; }
        .bg-yellow-header { background-color: #facc15; }
        .bg-yellow-content { background-color: #fef9c3; }
        .bg-yellow-note { background-color: #fefce8; }
        .text-red-strong { color: #dc2626; font-weight: 900; display: block; margin-top: 4px; }
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
        .sum-divider td { border-bottom: 2px solid black; }
        .sum-total-lbl { text-align: right; font-weight: 900; text-transform: uppercase; font-size: 9px; border-right: 2px solid black; background: #f3f4f6; padding: 5px 10px; white-space: nowrap; }
        .sum-total-val { text-align: right; font-weight: 900; color: #1e3a8a; font-size: 12px; background: #f3f4f6; padding: 5px 10px; white-space: nowrap; min-width: 90px; }
        .sum-gray-lbl { text-align: right; font-weight: 600; text-transform: uppercase; font-size: 7px; border-right: 2px solid black; color: #9ca3af; padding: 3px 10px; white-space: nowrap; }
        .sum-gray-val { text-align: right; font-weight: 600; color: #9ca3af; font-size: 8px; padding: 3px 10px; white-space: nowrap; }
        .sum-ewt-lbl { text-align: right; font-weight: 900; text-transform: uppercase; font-size: 7px; border-right: 2px solid black; color: #1d4ed8; background: #eff6ff; padding: 4px 10px; white-space: nowrap; }
        .sum-ewt-val { text-align: right; font-weight: 900; color: #1d4ed8; background: #eff6ff; font-size: 8.5px; padding: 4px 10px; white-space: nowrap; }
        .sum-final-row { background: ${PRIMARY_CHARCOAL}; }
        .sum-final-lbl { text-align: right; font-weight: 900; text-transform: uppercase; font-size: 8.5px; border-right: 1px solid #374151; color: white; padding: 7px 10px; white-space: nowrap; }
        .sum-final-val { text-align: right; font-weight: 900; font-size: 14px; color: white; padding: 7px 10px; white-space: nowrap; }
        .terms-section { margin-top: 25px; border-top: 2.5px solid black; padding-top: 10px; }
        .terms-header { background: ${PRIMARY_CHARCOAL}; color: white; padding: 4px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
        .terms-grid { display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 9px; line-height: 1.4; }
        .terms-label { font-weight: 900; text-transform: uppercase; padding: 4px 0; }
        .terms-val { padding: 0 4px; }
        .terms-highlight { background-color: #fef9c3; }
        .bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .sig-hierarchy { margin-top: 20px; padding-top: 16px; border-top: 4px solid #1d4ed8; padding-bottom: 10px; }
        .sig-message { font-size: 9px; margin-bottom: 15px; font-weight: 500; line-height: 1.4; }
        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .sig-side-internal { display: flex; flex-direction: column; gap: 10px; }
        .sig-side-client { display: flex; flex-direction: column; align-items: flex-end; gap: 40px; }
        .sig-line { border-bottom: 1px solid black; width: 256px; }
        .sig-sub-label { font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
        </style></head><body></body></html>
      `);
            iframeDoc.close();

            const renderBlock = async (html: string) => {
                iframeDoc.body.innerHTML = html;
                const images = iframeDoc.querySelectorAll("img");
                await Promise.all(
                    Array.from(images).map((img) => {
                        if (img.complete) return Promise.resolve();
                        return new Promise((res) => { img.onload = res; img.onerror = res; });
                    })
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

            const finalizeCurrentPage = () => {
                stampPdfWatermark(pdf, payload.referenceNo, pdfWidth, pdfHeight);
            };

            const initiateNewPage = async () => {
                const banner = await renderBlock(`
          <div style="width:100%; display:block;">
            <img src="${headerImagePath}" class="header-img" style="width:100%; display:block; object-fit:contain;" />
            <div style="width:100%; text-align:right; font-weight:900; font-size:10px; margin-top:2px; padding-bottom:5px; line-height:1.2; box-sizing:border-box; padding-right:60px;">
              REFERENCE NO: ${payload.referenceNo}<br/>DATE: ${payload.date}
            </div>
          </div>`);
                pdf.addImage(banner.img, "JPEG", 0, 0, pdfWidth, banner.h);
                return banner.h;
            };

            currentY = await initiateNewPage();

            // Client info
            const clientBlock = await renderBlock(`
        <div class="content-area" style="padding-top:5;">
          <div class="client-grid">
            <div class="grid-row border-t"><div class="label">COMPANY NAME:</div><div class="value">${payload.companyName}</div></div>
            <div class="grid-row"><div class="label">ADDRESS:</div><div class="value">${payload.address}</div></div>
            <div class="grid-row"><div class="label">TEL NO:</div><div class="value">${payload.telNo}</div></div>
            <div class="grid-row border-b"><div class="label">EMAIL ADDRESS:</div><div class="value">${payload.email}</div></div>
            <div class="grid-row"><div class="label">ATTENTION:</div><div class="value">${payload.attention}</div></div>
            <div class="grid-row border-b"><div class="label">SUBJECT:</div><div class="value">${payload.subject}</div></div>
          </div>
          <p class="intro-text">We are pleased to offer you the following products for consideration:</p>
        </div>`);
        pdf.addImage(clientBlock.img, "JPEG", 0, currentY, pdfWidth, clientBlock.h);
        currentY += clientBlock.h;

        // Table header
        const headerBlock = await renderBlock(`
        <div class="content-area">
          <div class="table-container" style="border-bottom: 1.5px solid black;">
            <table class="main-table"><thead><tr>
              <th style="width:40px;">ITEM NO</th><th style="width:40px;">QTY</th>
              <th style="width:100px;">REFERENCE PHOTO</th><th style="width:180px;">PRODUCT DESCRIPTION</th>
              <th style="width:70px; text-align:right;">UNIT PRICE</th><th style="width:50px; text-align:center;">DISC</th>
              <th style="width:70px; text-align:right;">DISCOUNTED PRICE</th><th style="width:80px; text-align:right;">TOTAL AMOUNT</th>
            </tr></thead></table>
          </div>
        </div>`);
        pdf.addImage(headerBlock.img, "JPEG", 0, currentY, pdfWidth, headerBlock.h);
        currentY += 28;

        // Item rows
        for (const [index, rowItem] of payload.items.entries()) {
            const discountDisplay = rowItem.discount && rowItem.discount > 0 
                ? `<span style="color:#dc2626; font-weight:900;">${rowItem.discount}%</span>` 
                : `<span style="color:#9ca3af;">—</span>`;
            const netUnitPrice = rowItem.discountedAmount && rowItem.discount && rowItem.discount > 0
                ? rowItem.discountedAmount
                : rowItem.unitPrice;
            const rowBlock = await renderBlock(`
          <div class="content-area">
            <table class="main-table" style="border: 1.5px solid black; border-top: none;"><tr>
              <td style="width:40px;" class="item-no">${index + 1}</td>
              <td style="width:40px;" class="qty-col">${rowItem.qty}</td>
              <td style="width:100px;"><img src="${rowItem.photo}" class="ref-photo"></td>
              <td style="width:180px;">
                <div class="product-title" style="font-size:7px;">${rowItem.title}</div>
                <div class="sku-text">${rowItem.sku}</div>
                <div class="desc-text">${rowItem.product_description}<span class="desc-remarks">${rowItem.remarks}</span></div>
              </td>
              <td style="width:70px; text-align:right;">₱${rowItem.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="width:50px; text-align:center;">${discountDisplay}</td>
              <td style="width:70px; text-align:right;">₱${netUnitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="width:80px; text-align:right; font-weight:900;">₱${rowItem.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr></table>
          </div>`);

            if (currentY + rowBlock.h > pdfHeight - BOTTOM_MARGIN) {
                finalizeCurrentPage();
                pdf.addPage([612, 936]);
                pageCount++;
                currentY = await initiateNewPage();
                pdf.addImage(headerBlock.img, "JPEG", 0, currentY, pdfWidth, headerBlock.h);
                currentY += 28;
                    pageCount++;
                    currentY = await initiateNewPage();
                    pdf.addImage(headerBlock.img, "JPEG", 0, currentY, pdfWidth, headerBlock.h);
                    currentY += 28;
                }
                pdf.addImage(rowBlock.img, "JPEG", 0, currentY, pdfWidth, rowBlock.h);
                currentY += rowBlock.h;
            }

            const _deliveryNum = parseFloat(String(payload.deliveryFee)) || 0;
            const _restockingNum = payload.restockingFee || 0;
            const _netSales = payload.totalPrice - _deliveryNum - _restockingNum;
            const _vatBreak = payload.vatTypeLabel === "VAT Inc"
                ? `<tr><td class="sum-gray-lbl">Less: VAT (12)</td><td class="sum-gray-val">₱${(payload.totalPrice * (12 / 112)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr><tr${payload.whtType && payload.whtType !== "none" ? "" : " class='sum-divider'"}><td class="sum-gray-lbl">Net of VAT (Tax Base)</td><td class="sum-gray-val">₱${(payload.totalPrice / 1.12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>${payload.whtType && payload.whtType !== "none" ? `<tr class="sum-divider"><td class="sum-ewt-lbl">Less: ${payload.whtLabel}</td><td class="sum-ewt-val">− ₱${(payload.whtAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>` : ""}`
                : `<tr class="sum-divider"><td class="sum-gray-lbl">Tax Status</td><td class="sum-gray-val" style="font-style:italic;">${payload.vatTypeLabel === "VAT Exe" ? "VAT Exempt" : "Zero-Rated"}</td></tr>`;
            const _whtBadge = payload.whtType && payload.whtType !== "none"
                ? `<div class="summary-wht">● ${payload.whtLabel} — on Net of VAT</div>` : "";
            const _finalLbl = payload.whtType && payload.whtType !== "none" ? "Net Amount to Collect" : "Total Amount Due";
            const _finalAmt = (payload.netAmountToCollect ?? payload.totalPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            // Footer totals
            const footerBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0; padding-bottom:0;">
          <div class="table-container" style="border-bottom:2px solid black;">
            <div class="summary-wrap">
              <div class="summary-left">
                <div class="summary-tax-title">Tax Type:</div>
                <div class="tax-options">
                  <span class="${payload.vatTypeLabel === "VAT Inc" ? "tax-active" : "tax-inactive"}">${payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc</span>
                  <span class="${payload.vatTypeLabel === "VAT Exe" ? "tax-active" : "tax-inactive"}">${payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe</span>
                  <span class="${payload.vatTypeLabel === "Zero-Rated" ? "tax-active" : "tax-inactive"}">${payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated</span>
                </div>
                ${_whtBadge}
              </div>
              <div class="summary-right">
                <table class="sum-tbl">
                  <tr>
                    <td class="sum-lbl">Net Sales ${payload.vatTypeLabel === "VAT Inc" ? "(VAT Inc)" : "(Non-VAT)"}</td>
                    <td class="sum-val">₱${_netSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td class="sum-lbl">Delivery Charge</td>
                    <td class="sum-val">₱${_deliveryNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr class="sum-divider">
                    <td class="sum-lbl">Restocking Fee</td>
                    <td class="sum-val">₱${_restockingNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td class="sum-total-lbl">Total Invoice Amount</td>
                    <td class="sum-total-val">₱${payload.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
        </div>`);
            if (currentY + footerBlock.h > pdfHeight - BOTTOM_MARGIN) {
                finalizeCurrentPage();
                pdf.addPage([612, 936]);
                pageCount++;
                currentY = await initiateNewPage();
            }
            pdf.addImage(footerBlock.img, "JPEG", 0, currentY, pdfWidth, footerBlock.h);
            currentY += footerBlock.h;

            // Logistics
            const logisticsBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0;">
          <div class="variance-footnote">*PHOTO MAY VARY FROM ACTUAL UNIT</div>
          <div class="logistics-container">
            <div class="logistics-row">
              <div class="logistics-label bg-yellow-header">Included:</div>
              <div class="logistics-value bg-yellow-content">
                <p>Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p>
                <p>Orders outside Metro Manila: Free delivery available for minimum ₱10,000 in Rizal, ₱15,000 in Bulacan and Cavite, ₱25,000 in Laguna, Pampanga, and Batangas.</p>
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
                                        <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment. Barring any delay in shipping and customs clearance beyond Disruptive's control.</p>
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
                <p>Sales order has <span className="text-red-600 font-black italic">validity period of 14 working days</span>. (excluding holidays and Sundays) from the date of issuance. Any sales order not confirmed and no verified payment within this <span className="text-red-600 font-black">14-day period will be automatically cancelled</span>.</p>
              </div>
              <div class="terms-label">Storage:</div>
              <div class="terms-val terms-highlight">
                <p>Orders with confirmation/verified payment but undelivered after 14 working days (excluding holidays and Sundays starting from picking date) due to clients’ request or shortcomings will be charged a storage fee of 10% of the value of the orders per month <span className="text-red-600 font-black"> (10% / 30 days =  0.33% per day)</span>.</p>
              </div>
              <div class="terms-label">Return:</div>
              <div class="terms-val terms-highlight">
                <p><span className="text-red-600 font-black"><u>7 days return policy - </u></span>if the product received is defective, damaged, or incomplete. This must be communicated to Disruptive, and Disruptive has duly acknowledged communication as received within a maximum of 7 days to qualify for replacement.</p>
              </div>
            </div>
          </div>
        </div>`);
            if (currentY + logisticsBlock.h > pdfHeight - BOTTOM_MARGIN) {
                finalizeCurrentPage();
                pdf.addPage([612, 936]);
                pageCount++;
                currentY = await initiateNewPage();
            }
            pdf.addImage(logisticsBlock.img, "JPEG", 0, currentY, pdfWidth, logisticsBlock.h);
            currentY += logisticsBlock.h;

            // Terms + Signatures
            const termsAndSigBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0;">
          <div class="terms-grid">
            <div class="terms-label">Payment:</div>
            <div class="terms-val">
              <p><strong style="color:red;">For Cash on Delivery</strong></p>
              <p><strong>NOTE: Orders below ₱10,000 can be paid in cash.</strong></p>
              <p><strong>BANK DETAILS — Payee to: ${companyLabel}</strong></p>
              <div class="bank-grid">
                <div><strong>METROBANK</strong><br/>Acct: ${isEcoshift ? "243-7-243805100" : "243-7-24354164-2"}</div>
                <div><strong>BDO</strong><br/>Acct: ${isEcoshift ? "0021-8801-7271" : "0021-8801-9258"}</div>
              </div>
            </div>
            <div class="terms-label">Validity:</div>
            <div class="terms-val"><p><b style="color:red;"><u>Thirty (30) calendar days from the date of this offer.</u></b></p></div>
            <div class="terms-label">Cancellation:</div>
            <div class="terms-val terms-highlight">
              <p>1. Above quoted items are non-cancellable.</p>
              <p>2. Downpayment for indent/special items are non-refundable.</p>
              <p>3. Special Projects (SPF) cancellations subject to 100% charge.</p>
            </div>
          </div>
          <div class="sig-hierarchy">
            <p class="sig-message">Thank you for allowing us to service your requirements. Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.</p>
            <div class="sig-grid">
              <div class="sig-side-internal">
                <div style="position:relative;">
                  <p style="font-style:italic; font-size:10px; font-weight:900; margin-bottom:25px;">${isEcoshift ? "Ecoshift Corporation" : "Disruptive Solutions Inc"}</p>
                  <img src="${payload.agentSignature || ""}" style="position:absolute; top:40px; left:0; width:125px; height:auto; object-fit:contain; z-index:9999;"/>
                  <p style="font-size:10px; font-weight:900; text-transform:uppercase; margin-top:50px;">${payload.agentName || payload.salesRepresentative}</p>
                  <div class="sig-line"></div>
                  <p class="sig-sub-label">Sales Representative</p>
                  <p style="font-size:10px; font-style:italic;">Mobile: ${payload.agentContactNumber || "N/A"}</p>
                  <p style="font-size:10px; font-style:italic;">Email: ${payload.agentEmailAddress || "N/A"}</p>
                </div>
                <div style="position:relative;">
                  <p style="font-size:9px; font-weight:900; text-transform:uppercase; color:#9ca3af; margin-bottom:25px;">Approved By:</p>
                  <img src="${payload.signature || ""}" style="position:absolute; top:40px; left:0; width:125px; height:auto; object-fit:contain; z-index:9999;"/>
                  <p style="font-size:10px; font-weight:900; text-transform:uppercase; margin-top:50px;">${payload.tsmName || payload.salestsmname}</p>
                  <div class="sig-line"></div>
                  <p class="sig-sub-label">Sales Manager</p>
                  <p style="font-size:10px; font-style:italic;">Mobile: ${payload.tsmcontact || "N/A"}</p>
                  <p style="font-size:10px; font-style:italic;">Email: ${payload.tsmemail || "N/A"}</p>
                </div>
                <div>
                  <p style="font-size:9px; font-weight:900; text-transform:uppercase; color:#9ca3af; margin-bottom:25px;">Noted By:</p>
                  <p style="font-size:10px; font-weight:900; text-transform:uppercase;">${payload.managerName}</p>
                  <div class="sig-line"></div>
                  <p class="sig-sub-label">Sales-B2B</p>
                </div>
              </div>
              <div class="sig-side-client">
                <div><div class="sig-line" style="margin-top:73px;"></div><p style="font-size:9px; text-align:center; font-weight:900; margin-top:4px; text-transform:uppercase;">Company Authorized Representative</p></div>
                <div style="width:256px;"><div class="sig-line" style="margin-top:68px;"></div><p style="font-size:9px; text-align:center; font-weight:900; margin-top:4px; text-transform:uppercase;">Payment Release Date</p></div>
                <div style="width:256px;"><div class="sig-line" style="margin-top:68px;"></div><p style="font-size:9px; text-align:center; font-weight:900; margin-top:4px; text-transform:uppercase;">Position in the Company</p></div>
              </div>
            </div>
          </div>
        </div>`);
            if (currentY + termsAndSigBlock.h > pdfHeight - BOTTOM_MARGIN) {
                finalizeCurrentPage();
                pdf.addPage([612, 936]);
                pageCount++;
                currentY = await initiateNewPage();
            }
            pdf.addImage(termsAndSigBlock.img, "JPEG", 0, currentY, pdfWidth, termsAndSigBlock.h);

            // ── Stamp watermark + security footer on ALL pages ────────────────────
            const totalPages = pageCount;
            for (let p = 1; p <= totalPages; p++) {
                pdf.setPage(p);
                if (p === totalPages) {
                    stampPdfWatermark(pdf, payload.referenceNo, pdfWidth, pdfHeight);
                }
                stampPdfSecurityFooter(pdf, qrDataUrl, payload.referenceNo, issuedAt, p, totalPages, pdfWidth, pdfHeight);
            }

            pdf.save(`QUOTATION_${payload.referenceNo}.pdf`);
            document.body.removeChild(iframe);
        } catch (error) {
            console.error("PDF Export Error:", error);
        }
    };

    // ─── Status update ────────────────────────────────────────────────────────
    const openStatusDialog = (status: "Approved" | "Endorsed to Sales Head") => {
        setSelectedStatus(status);
        setTsmRemarks("");
        setStatusDialogTitle(status === "Approved" ? "Approve Quotation" : "Endorse to Sales Head");
        setIsStatusDialogOpen(true);
    };

    const handleUpdateStatus = async (
        status: "Approved" | "Decline" | "Endorsed to Sales Head",
        remarks?: string
    ) => {
        if (!item.quotation_number) { alert("Missing quotation number"); return; }
        setIsUpdating(true);
        try {
            const res = await fetch("/api/activity/tsm/quotation/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quotation_number: item.quotation_number,
                    tsm_approved_status: status,
                    tsm_remarks: remarks ?? null,
                    tsm_approval_date: new Date().toISOString(),
                    contact,
                    email,
                    signature: status === "Approved" ? (signature ?? agentSignature) : null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Update failed");
            alert(`Quotation ${status} successfully`);
            onSave();
        } catch (err: any) {
            console.error(err);
            alert(err.message || "Something went wrong");
        } finally {
            setIsUpdating(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <>
            {/* Main dialog */}
            <Dialog open onOpenChange={onClose}>
                <DialogContent
                    className="max-w-[1400px] w-[95vw] max-h-[90vh] p-0 border-none bg-white shadow-2xl flex flex-col"
                    style={{ maxWidth: "1400px", width: "100vw" }}
                >
                    <DialogHeader className="px-5 pt-4 pb-0 border-b border-gray-100">
                        <DialogTitle className="text-sm font-black uppercase tracking-tight text-gray-800">
                            Quotation Review
                        </DialogTitle>
                        <DialogDescription className="text-[11px] text-gray-400 pb-3">
                            {quotationNumber} · {company_name}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Two-column layout: Left Preview, Right Revisions */}
                    <div className="flex-1 grid grid-cols-[1fr_380px] overflow-hidden">
                        {/* Left: Preview */}
                        <div className="overflow-auto p-3 border-r border-gray-200">
                            <Preview
                                payload={viewingCurrent ? getQuotationPayload() : selectedRevisedQuotation ? getRevisionPayload(selectedRevisedQuotation) : getQuotationPayload()}
                                quotationType={quotation_type}
                                setIsPreviewOpen={() => { }}
                            />

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
                        </div>

                        {/* Right: Revisions Panel */}
                        <div className="bg-gray-50 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-200 bg-white">
                                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-gray-800">
                                    <History className="w-4 h-4" />
                                    Revision History
                                    <span className="bg-[#121212] text-white text-[10px] font-black px-2 py-0.5 rounded-full ml-auto">
                                        {revisedQuotations.length}
                                    </span>
                                </h3>
                            </div>
                            <div className="flex-1 overflow-auto p-3">
                                {/* Current/Latest Button */}
                                <div
                                    onClick={() => { setViewingCurrent(true); setSelectedRevisedQuotation(null); }}
                                    className={`mb-3 border rounded-sm p-3 cursor-pointer transition hover:shadow-md ${viewingCurrent ? "bg-[#121212] text-white border-[#121212]" : "bg-white border-gray-300"}`}
                                >
                                    <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${viewingCurrent ? "bg-emerald-400" : "bg-emerald-500"}`}></span>
                                        CURRENT / LATEST
                                    </div>
                                    <div className={`text-xs ${viewingCurrent ? "text-gray-300" : "text-gray-500"}`}>
                                        <div>Quotation: {item.quotation_number}</div>
                                        <div>Amount: ₱{payload.netAmountToCollect.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                </div>

                                {revisedQuotations.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic text-center py-4">No revised quotations found.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {revisedQuotations.map((q) => (
                                            <div
                                                key={q.id}
                                                onClick={() => { setViewingCurrent(false); setSelectedRevisedQuotation(q); }}
                                                className={`border rounded-sm p-3 text-xs cursor-pointer transition hover:shadow-md ${!viewingCurrent && selectedRevisedQuotation?.id === q.id ? "bg-gray-100 border-[#121212]" : "bg-white border-gray-300"}`}
                                            >
                                                <div className="font-semibold text-sm mb-1 text-gray-800">{q.version || "N/A"}</div>
                                                <div className="text-gray-600 space-y-0.5">
                                                    <div><span className="font-bold">Product:</span> {q.product_title?.split(",")[0] || "N/A"}</div>
                                                    <div><span className="font-bold">Amount:</span> ₱{parseFloat(q.quotation_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    <div className="text-gray-400 text-[10px] mt-1 flex items-center gap-2">
                                                        <span>Modified: {q.end_date ? (() => {
                                                            const d = new Date(q.end_date + 'Z');
                                                            return d.toLocaleString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric',
                                                                hour: 'numeric',
                                                                minute: '2-digit',
                                                                hour12: true,
                                                                timeZone: 'Asia/Manila'
                                                            });
                                                        })() : 'N/A'}</span>
                                                    
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action footer */}
                    <DialogFooter className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-3 bg-gray-50">
                        
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
