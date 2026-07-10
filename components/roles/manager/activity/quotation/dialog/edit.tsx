"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Preview } from "./preview";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, XIcon, FileText, History } from "lucide-react";
import { supabase } from "@/utils/supabase";

interface Completed {
    id: number;
    start_date?: string;
    end_date?: string;
    product_quantity?: string;
    product_amount?: string;
    product_description?: string;
    product_photo?: string;
    product_title?: string;
    product_sku?: string;
    quotation_number?: string;
    quotation_amount?: number | string;
    quotation_type: string;
    version?: string;
    // Submit to API
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
    item_remarks?: string;
    restocking_fee?: string;
    quotation_vatable?: string;
    quotation_subject?: string;
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
    vatType?: string;

    signature?: string;
    email?: string;
    contact?: string;
}

function splitAndTrim(value?: string): string[] {
    if (!value) return [];
    return value.split(",").map((v) => v.trim());
}

function splitDescription(value?: string): string[] {
    if (!value) return [];
    return value.split("||").map((v) => v.trim());
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
    deliveryFee,
    restockingFee,
    whtType,
    quotationSubject,

    // Signatories
    agentName,
    agentSignature,
    agentContactNumber,
    agentEmailAddress,
    tsmName,
    tsmSignature,
    tsmContactNumber,
    tsmEmailAddress,
    managerName,

    // Sales Head Signature
    signature,
    vatType,
}: TaskListEditDialogProps) {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [previewStates, setPreviewStates] = useState<boolean[]>([]);
    const [quotationAmount, setQuotationAmount] = useState<number>(0);

    const [checkedRows, setCheckedRows] = useState<Record<number, boolean>>({});
    const [discount] = useState(0);
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
    // Confirmation dialog state

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isDeclineOpen, setIsDeclineOpen] = useState(false);
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const [tsmRemarks, setTsmRemarks] = useState("");
    const [statusDialogTitle, setStatusDialogTitle] = useState("");
    const [statusDialogMessage, setStatusDialogMessage] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<"Approved By Sales Head" | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [revisedQuotations, setRevisedQuotations] = useState<any[]>([]);
    const [selectedRevisedQuotation, setSelectedRevisedQuotation] = useState<any | null>(null);
    const [viewingCurrent, setViewingCurrent] = useState(true);


    // These can be from props or item or company info
    const company_name = company?.company_name || "";
    const contact_number = company?.contact_number || "";
    const quotation_type = item.quotation_type;
    const quotationNumber = item.quotation_number || "";
    const address = company?.address || ""; // add if available
    const email_address = company?.email_address || ""; // add if available
    const contact_person = company?.contact_person || ""; // add if available

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
            salesmanagername: managername ?? "",
            agentName: agentName ?? null,
            agentSignature: agentSignature ?? null,
            agentContactNumber: agentContactNumber ?? null,
            agentEmailAddress: agentEmailAddress ?? null,
            tsmName: tsmName ?? null,
            tsmSignature: tsmSignature ?? null,
            tsmContactNumber: tsmContactNumber ?? null,
            tsmEmailAddress: tsmEmailAddress ?? null,
            managerName: managerName ?? null,
            signature: signature ?? null,
            salesheademail: email ?? null,
            salesheadcontact: contact ?? null,
        };
    };

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
            quantities.length,
            amounts.length,
            titles.length,
            descriptions.length,
            photos.length,
            skus.length,
            remarks.length,
            discountedPrices.length,
            1 // ensure at least one empty row if all empty
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

    // ✅ Update the quotationAmount calculation to use per-row discount
    useEffect(() => {
        let total = 0;
        products.forEach((p, idx) => {
            const qty = parseFloat(p.product_quantity ?? "0") || 0;
            const amt = parseFloat(p.product_amount ?? "0") || 0;
            const baseAmount = qty * amt;
            const isChecked = checkedRows[idx] ?? false;
            const rowDiscount = isChecked
                ? (p.discount ?? (vatTypeState === "vat_exe" ? 12 : 0))
                : 0;
            const discountedAmount = (baseAmount * rowDiscount) / 100;
            const lineTotal = baseAmount - discountedAmount;
            total += lineTotal;
        });

        // NOTE: deliveryFee is shown separately in the PDF/preview, NOT added here
        // to avoid double-counting (the payload passes it as a separate field).
        setQuotationAmount(total);
    }, [products, checkedRows, vatTypeState]);

    // Download handler with your given logic integrated
    const getQuotationPayload = () => {
        const salesRepresentativeName = `${firstname ?? ""} ${lastname ?? ""}`.trim();
        const emailUsername = email?.split("@")[0] ?? "";

        let emailDomain = "";
        if (quotation_type === "Disruptive Solutions Inc") {
            emailDomain = "disruptivesolutionsinc.com";
        } else if (quotation_type === "Ecoshift Corporation") {
            emailDomain = "ecoshiftcorp.com";
        } else {
            emailDomain = email?.split("@")[1] ?? "";
        }

        const salesemail = emailUsername && emailDomain ? `${emailUsername}@${emailDomain}` : "";

        const items = products.map((p: ProductItem, index: number) => {
            // Use the 'product_xxx' fields which are updated by handleProductChange
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
                itemRemarks: p.item_remarks ?? "",
                product_description:
                    p.description?.trim() ? p.description : p.product_description || "",
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
            referenceNo: quotationNumber ?? "DRAFT-XXXX",
            date: new Date().toLocaleDateString(),
            companyName: company_name ?? "",
            address: address ?? "",
            telNo: contact_number ?? "",
            email: email_address ?? "",
            attention: contact_person ?? "",
            subject: quotationSubjectState || "For Quotation",
            items,
            vatTypeLabel:
                vatTypeState === "vat_inc"
                    ? "VAT Inc"
                    : vatTypeState === "vat_exe"
                        ? "VAT Exe"
                        : "Zero-Rated",
            totalPrice: totalInvoiceAmount,
            deliveryFee: deliveryFeeState ?? "",
            vatType: vatTypeState ?? null,
            restockingFee: parseFloat(restockingFeeState) || 0,
            whtType: whtTypeState ?? "none",
            whtLabel:
                whtTypeState === "wht_1" ? "EWT 1% (Goods)" :
                    whtTypeState === "wht_2" ? "EWT 2% (Services)" : "None",
            whtBase: netOfVat,
            whtAmount: Number(whtAmount),
            netAmountToCollect: Number(finalAmountDue),
            salesRepresentative: salesRepresentativeName,
            salesemail,
            salescontact: contact ?? "",
            salestsmname: tsmname ?? "",
            salestsmemail: tsmemail ?? "",
            salestsmcontact: tsmcontact ?? "",
            salesmanagername: managername ?? "",
            // Signatories
            // Agent
            agentName: agentName ?? null,
            agentSignature: agentSignature ?? null,
            agentContactNumber: agentContactNumber ?? null,
            agentEmailAddress: agentEmailAddress ?? null,
            // TSM
            tsmName: tsmName ?? null,
            tsmSignature: tsmSignature ?? null,
            tsmContactNumber: tsmContactNumber ?? null,
            tsmEmailAddress: tsmEmailAddress ?? null,

            // Personal Signatories
            managerName: managerName ?? null,
            signature: signature ?? null,
            salesheademail: email ?? null,
            salesheadcontact: contact ?? null,
        };
    };

    const DownloadPDF = async () => {
        if (typeof window === "undefined") return;

        const PRIMARY_CHARCOAL = "#121212";
        const OFF_WHITE = "#F9FAFA";
        const isEcoshift = quotation_type === "Ecoshift Corporation";
        const headerImagePath = isEcoshift ? "/ecoshift-banner.png" : "/disruptive-banner.png";
        const payload = getQuotationPayload();

        try {
            const { default: jsPDF } = await import("jspdf");
            const { default: html2canvas } = await import("html2canvas");

            const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [612, 936] });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

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
        .summary-bar { background-color: #e5e7eb; height: 35px; }
        .summary-bar td { border: none; vertical-align: middle; padding: 0 15px; }
        .tax-label { color: #e60b0d; font-style: italic; font-weight: 900; font-size: 22px; text-transform: uppercase; }
        .tax-options { display: flex; gap: 15px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .tax-active { color: black; }
        .tax-inactive { color: #a0a5b3; }
        .grand-total-label { text-align: left; font-weight: 500; font-size: 8px; text-transform: uppercase; white-space: nowrap; color: black; }
        .grand-total-value { text-align: right; font-weight: 900; color: #058236; }
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
                        return new Promise((res) => {
                            img.onload = res;
                            img.onerror = res;
                        });
                    })
                );
                const canvas = await html2canvas(iframeDoc.body, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: "#ffffff",
                    logging: false,
                });
                return {
                    img: canvas.toDataURL("image/jpeg", 1.0),
                    h: (canvas.height * pdfWidth) / canvas.width,
                };
            };

            let currentY = 0;
            let pageCount = 1;

            const drawPageNumber = (n: number) => {
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(8);
                pdf.setTextColor(150);
                pdf.text(`Page ${n}`, pdfWidth - 60, pdfHeight - 20);
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
                drawPageNumber(pageCount);
                return banner.h;
            };

            currentY = await initiateNewPage();

            // Client info block
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
              <th style="width:120px;">REFERENCE PHOTO</th><th style="width:200px;">PRODUCT DESCRIPTION</th>
              <th style="width:80px; text-align:right;">UNIT PRICE</th><th style="width:80px; text-align:right;">TOTAL AMOUNT</th>
            </tr></thead></table>
          </div>
        </div>`);
            pdf.addImage(headerBlock.img, "JPEG", 0, currentY, pdfWidth, headerBlock.h);
            currentY += 28;

            // Item rows
            for (const [index, rowItem] of payload.items.entries()) {
                const rowBlock = await renderBlock(`
          <div class="content-area">
            <table class="main-table" style="border: 1.5px solid black; border-top: none;"><tr>
              <td style="width:40px;" class="item-no">${index + 1}</td>
              <td style="width:40px;" class="qty-col">${rowItem.qty}</td>
              <td style="width:120px;"><img src="${rowItem.photo}" class="ref-photo"></td>
              <td style="width:200px;">
                <div class="product-title" style="font-size:7px;">${rowItem.title}</div>
                <div class="sku-text">${rowItem.sku}</div>
                <div class="desc-text">${rowItem.product_description} <span class="desc-remarks">${rowItem.remarks}</span></div>
              </td>
              <td style="width:80px; text-align:right;">₱${rowItem.unitPrice.toLocaleString()}</td>
              <td style="width:80px; text-align:right; font-weight:900;">₱${rowItem.totalAmount.toLocaleString()}</td>
            </tr></table>
          </div>`);

                if (currentY + rowBlock.h > pdfHeight - 50) {
                    pdf.addPage([612, 936]);
                    pageCount++;
                    currentY = await initiateNewPage();
                    pdf.addImage(headerBlock.img, "JPEG", 0, currentY, pdfWidth, headerBlock.h);
                    currentY += 28;
                }
                pdf.addImage(rowBlock.img, "JPEG", 0, currentY, pdfWidth, rowBlock.h);
                currentY += rowBlock.h;
            }

            // Footer totals
            const footerBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0; padding-bottom:0;">
          <div class="table-container">
            <table class="main-table">
              <tr class="summary-bar">
                <td colspan="1"></td>
                <td class="tax-label" style="font-size:12px; text-align:left; width:150px;">Tax Type:</td>
                <td style="width:300px;">
                  <div class="tax-options" style="margin-left:50px;">
                    <span class="${payload.vatTypeLabel === "VAT Inc" ? "tax-active" : "tax-inactive"}">${payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc</span>
                    <span class="${payload.vatTypeLabel === "VAT Exe" ? "tax-active" : "tax-inactive"}">${payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe</span>
                    <span class="${payload.vatTypeLabel === "Zero-Rated" ? "tax-active" : "tax-inactive"}">${payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated</span>
                  </div>
                </td>
                <td style="width:70px; border-left:1px solid black; font-size:9px;" class="grand-total-label">Delivery Fee:</td>
                <td style="width:130px; font-size:15px;" class="grand-total-value">₱${payload.deliveryFee}</td>
              </tr>
              <tr class="summary-bar" style="border-bottom:1px solid black; border-top:1px solid black;">
                <td colspan="3"></td>
                <td style="width:70px; border-left:1px solid black; font-size:9px;" class="grand-total-label">Grand Total:</td>
                <td style="width:130px; font-size:15px;" class="grand-total-value">₱${payload.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </div>
        </div>`);
            if (currentY + footerBlock.h > pdfHeight) {
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
                <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO &amp; down payment.</p>
                <p>*In the event of a conflict or inconsistency in estimated days, the latter will prevail.</p>
              </div>
              <div class="terms-label">Warranty:</div>
              <div class="terms-val terms-highlight">
                <p>One (1) year from the time of delivery for all busted lights except the damaged fixture.</p>
                <p>Warranty VOID if: tampered, altered, misused, damaged by liquids, or product is phased out.</p>
                <p>*Shipping costs for warranty claims are for customers' account.</p>
              </div>
              <div class="terms-label">SO Validity:</div>
              <div class="terms-val">
                <p>Sales order has <b style="color:red;">validity period of 14 working days.</b> Any sales order not confirmed within this period will be automatically cancelled.</p>
              </div>
              <div class="terms-label">Storage:</div>
              <div class="terms-val terms-highlight">
                <p>Undelivered confirmed orders after 14 working days charged 10% storage fee per month <b style="color:red;">(0.33% per day).</b></p>
              </div>
              <div class="terms-label">Return:</div>
              <div class="terms-val terms-highlight">
                <p><b style="color:red;"><u>7 days return policy</u></b> — for defective, damaged, or incomplete products communicated within 7 days.</p>
              </div>
            </div>
          </div>
        </div>`);
            if (currentY + logisticsBlock.h > pdfHeight) {
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
              <p><strong style="color:red;">Cash on Delivery (COD)</strong></p>
              <p><strong>NOTE: Orders below ₱10,000 can be paid in cash. Above ₱10,000 via bank deposit or e-payment.</strong></p>
              <p>For special items: 70% down payment, 30% upon delivery.</p>
              <br/><p><strong>BANK DETAILS — Payee to: ${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."}</strong></p>
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
              <p>2. Client responsible for 100% cost if cancelled.</p>
              <p>3. Downpayment for indent/special items are non-refundable.</p>
              <p>4. COD payment must be ready within 7 days or order is auto-cancelled.</p>
              <p>5. Special Projects (SPF) cancellations subject to 100% charge.</p>
            </div>
          </div>
          <div class="sig-hierarchy">
            <p class="sig-message">Thank you for allowing us to service your requirements. Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.</p>
            <div class="sig-grid">
              <div class="sig-side-internal">
                <div style="position:relative;">
                  <p style="font-style:italic; font-size:10px; font-weight:900; margin-bottom:25px;">${isEcoshift ? "Ecoshift Corporation" : "Disruptive Solutions Inc"}</p>
                  <img src="${payload.agentSignature || ""}" style="position:absolute; top:40px; left:0; width:125px; height:auto; object-fit:contain; z-index:9999;"/>
                  <p style="font-size:10px; font-weight:900; text-transform:uppercase; margin-top:50px;">${payload.agentName}</p>
                  <div class="sig-line"></div>
                  <p class="sig-sub-label">Sales Representative</p>
                  <p style="font-size:10px; font-style:italic;">Mobile: ${payload.agentContactNumber || "N/A"}</p>
                  <p style="font-size:10px; font-style:italic;">Email: ${payload.agentEmailAddress || "N/A"}</p>
                </div>
                <div style="position:relative;">
                  <p style="font-size:9px; font-weight:900; text-transform:uppercase; color:#9ca3af; margin-bottom:25px;">Approved By:</p>
                  <img src="${payload.signature || ""}" style="position:absolute; top:40px; left:0; width:125px; height:auto; object-fit:contain; z-index:9999;"/>
                  <p style="font-size:10px; font-weight:900; text-transform:uppercase; margin-top:50px;">${payload.tsmName}</p>
                  <div class="sig-line"></div>
                  <p class="sig-sub-label">SALES MANAGER</p>
                  <p style="font-size:10px; font-style:italic;">Mobile: ${payload.tsmContactNumber || "N/A"}</p>
                  <p style="font-size:10px; font-style:italic;">Email: ${payload.tsmEmailAddress || "N/A"}</p>
                </div>
                <div>
                  <p style="font-size:9px; font-weight:900; text-transform:uppercase; color:#9ca3af; margin-bottom:25px;">Noted By:</p>
                  <p style="font-size:10px; font-weight:900; text-transform:uppercase;">${payload.salesmanagername}</p>
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
            if (currentY + termsAndSigBlock.h > pdfHeight) {
                pdf.addPage([612, 936]);
                pageCount++;
                currentY = await initiateNewPage();
            }
            pdf.addImage(termsAndSigBlock.img, "JPEG", 0, currentY, pdfWidth, termsAndSigBlock.h);

            pdf.save(`QUOTATION_${payload.referenceNo}.pdf`);
            document.body.removeChild(iframe);
        } catch (error) {
            console.error("PDF Export Error:", error);
        }
    };

    // Open dialog para sa Approved / Endorsed
    const openStatusDialog = (status: "Approved By Sales Head") => {
        setSelectedStatus(status);
        setTsmRemarks(""); // Reset remarks sa dialog

        const now = new Date().toISOString();

        setStatusDialogTitle(`Quotation ${status}`); // Fixed title
        setStatusDialogMessage(`${status} on ${now}`);
        setIsStatusDialogOpen(true);
    };

    // Updated handleUpdateStatus
    const handleUpdateStatus = async (
        status: "Approved By Sales Head" | "Decline By Sales Head",
        remarks?: string
    ) => {
        if (!item.quotation_number) {
            alert("Missing activity reference number");
            return;
        }

        const approvalDate = new Date().toISOString();

        setIsUpdating(true);
        try {
            const res = await fetch("/api/activity/manager/quotation/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quotation_number: item.quotation_number,
                    tsm_approved_status: status,
                    manager_remarks: remarks ?? null,
                    manager_approval_date: approvalDate,
                    contact,
                    email,
                    signature: signature ?? agentSignature,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Update failed");

            alert(`Quotation ${status} successfully`);
            onClose();
        } catch (err: any) {
            console.error(err);
            alert(err.message || "Something went wrong");
        } finally {
            setIsUpdating(false);
        }
    };

    const payload = getQuotationPayload();

    return (
        <>
            <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
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
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isUpdating}
                            className="rounded-none p-6"
                        >
                            <XIcon className="w-4 h-4 mr-2" /> Close
                        </Button>
                        <Button
                            onClick={() => openStatusDialog("Approved By Sales Head")}
                            disabled={isUpdating}
                            className="rounded-none p-6 bg-green-600"
                        >
                            <Check /> Approve
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => setIsDeclineOpen(true)}
                            disabled={isUpdating}
                            className="rounded-none p-6"
                        >
                            <XIcon /> Decline
                        </Button>
                        <Button
                            type="button"
                            onClick={DownloadPDF}
                            className="rounded-xs p-6 bg-blue-600"
                        >
                            <FileText />
                            PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeclineOpen} onOpenChange={setIsDeclineOpen}>
                <DialogContent className="max-w-md rounded-none">
                    <DialogHeader>
                        <DialogTitle>Decline Quotation</DialogTitle>
                        <DialogDescription>Provide a reason for declining this quotation.</DialogDescription>
                    </DialogHeader>

                    <textarea
                        value={tsmRemarks}
                        onChange={(e) => setTsmRemarks(e.target.value)}
                        placeholder="Enter reason for decline..."
                        className="w-full min-h-[120px] border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                    />

                    <DialogFooter className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsDeclineOpen(false)} className="rounded-none p-6">
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!tsmRemarks.trim() || isUpdating}
                            onClick={() => {
                                handleUpdateStatus("Decline By Sales Head", tsmRemarks);
                                setIsDeclineOpen(false);
                            }}
                            className="rounded-none p-6"
                        >
                            Confirm Decline
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approve / Endorse Dialog */}
            <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                <DialogContent className="max-w-md rounded-none">
                    <DialogHeader>
                        <DialogTitle>{statusDialogTitle}</DialogTitle>
                        <DialogDescription>
                        </DialogDescription>
                    </DialogHeader>

                    <textarea
                        value={tsmRemarks}
                        onChange={(e) => setTsmRemarks(e.target.value)}
                        placeholder="Enter remarks..."
                        className="w-full min-h-[100px] border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mt-2"
                    />

                    <DialogFooter className="flex justify-end gap-3 mt-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsStatusDialogOpen(false)}
                            className="rounded-none p-6"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                handleUpdateStatus(selectedStatus!, tsmRemarks);
                                setIsStatusDialogOpen(false);
                            }}
                            className="rounded-none p-6"
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}