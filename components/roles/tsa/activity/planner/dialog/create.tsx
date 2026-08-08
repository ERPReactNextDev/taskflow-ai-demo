"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, } from "@/components/ui/sheet";
import { sileo } from "sileo";
import { Plus, ArrowRight, User, Users } from "lucide-react";

import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

// Dialogs and Sheets
import { CancelDialog } from "./cancel";
import { OutboundSheet } from "./sheet/outbound";
import { InboundSheet } from "./sheet/inbound";
import { ViberRepliesSheet } from "./sheet/viber-replies";
import { FBMarketplaceSheet } from "./sheet/fb-marketplace";
import { QuotationSheet } from "./sheet/quotation";
import { SOSheet } from "./sheet/so";
import { DRSheet } from "./sheet/dr";

interface Activity {
    id?: string;
    type_client: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    email_address: string;
    address: string;
    activity_reference_number: string;
    account_reference_number: string;
    ticket_reference_number: string;
    type_activity: string;
    status: string;
    date_created: string;
    date_updated: string;

    target_quota?: string;
    referenceid: string;

    // Signatories
    contact: string;
    email: string;
    signature: string | null;
    tsmname: string;
    managername: string;
    tsm: string;
    manager: string;
    agent_name: string;

    // optional outbound fields
    source: string;
    callback?: string;
    call_status: string;
    call_type: string;

    // quotation fields
    product_category?: string;
    product_quantity?: string;
    product_amount?: string;
    product_description?: string;
    product_photo?: string;
    product_sku?: string;
    product_title?: string;
    discounted_priced?: string;
    discounted_amount?: string;
    product_is_promo?: string;
    product_is_hidden?: string;
    product_display_mode?: string;
    vat_type: string;
    delivery_fee: string;
    delivery_address?: string;
    restocking_fee?: string;
    wht_type?: string;
    quotation_subject?: string;
    item_remarks?: string;

    project_type?: string;
    project_name?: string;
    quotation_number?: string;
    quotation_amount?: string;
    quotation_type?: string;
    quotation_status?: string;

    // sales order fields
    so_number?: string;
    so_amount?: string;
    si_date?: string;
    so_status?: string;
    payment_status?: string;
    po_number?: string;
    mode?: string;
    so_type?: string;
    invoice_type?: string;
    withholding_agent?: string;
    sales_group?: string;
    industry?: string;
    conforme?: string;
    payment_terms?: string;
    delivery_date?: string;
    io_dept?: string;
    tpc_ref?: string;
    tpc_amount?: string;
    tpc_type?: string;
    discount_flag?: string;
    freight_flag?: string;
    inland_flag?: string;
    restocking_flag?: string;

    actual_sales?: string;
    dr_number?: string;

    date_followup?: string;
    remarks: string;
    tsm_approved_status?: string;
    // CSR
    agent: string;
    start_date?: string;
    end_date?: string;

    // Quotation display configuration
    hide_discount_in_preview?: boolean;
    show_discount_columns?: boolean;
    show_summary_discounts?: boolean;
    show_profit_margins?: boolean;
    margin_alert_threshold?: number;
    show_margin_alerts?: boolean;
    product_view_mode?: string;
    visible_columns?: any;
}

interface SupervisorDetails {
    firstname: string | null;
    lastname: string | null;
    email: string | null;
    profilePicture: string | null;
    signatureImage: string | null;
    contact: string | null;
}

interface CreateActivityDialogProps {
    onCreated: (newActivity: Activity) => void;
    referenceid: string;
    firstname: string;
    lastname: string;
    email: string;
    contact: string;
    tsm: string;
    manager: string;
    target_quota?: string;
    type_client: string;
    contact_number: string;
    email_address: string;
    contact_person: string;
    address: string;
    company_name: string;
    tsmname: string;
    managername: string;
    ticket_reference_number: string;
    agent: string;
    activityReferenceNumber?: string;
    accountReferenceNumber?: string;
    managerDetails: SupervisorDetails | null;
    tsmDetails: SupervisorDetails | null;
    signature: string | null;
    // ── Email prefill (optional) ───────────────────────────────────────────
    // When set, the dialog opens pre-configured for Quotation Preparation
    // and the activity will be linked back to the originating email.
    emailPrefill?: {
        source_email_message_id: string;
        source_email_subject: string;
        source_email_from: string;
        /** Auto-open the sheet immediately on mount */
        autoOpen?: boolean;
    };
}

function SpinnerEmpty({ onCancel }: { onCancel?: () => void }) {
    return (
        <Empty className="w-full">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Spinner />
                </EmptyMedia>
                <EmptyTitle>Processing your request</EmptyTitle>
                <EmptyDescription>
                    Please wait while we process your request. Do not refresh the page.
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button variant="outline" size="sm" onClick={onCancel}>
                    Cancel
                </Button>
            </EmptyContent>
        </Empty>
    );
}

export function CreateActivityDialog({
    onCreated,
    referenceid,
    firstname,
    lastname,
    email,
    contact,
    target_quota,
    ticket_reference_number,
    agent,
    tsm,
    manager,
    type_client,
    contact_number,
    company_name,
    contact_person,
    email_address,
    address,
    tsmname,
    managername,
    activityReferenceNumber,
    accountReferenceNumber,
    managerDetails,
    tsmDetails,
    signature,
    emailPrefill,

}: CreateActivityDialogProps) {
    const STORAGE_KEY = `create-activity-${company_name}-${referenceid}`;
    
    const saveStateToLocalStorage = useCallback((state: any) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error("Failed to save state to localStorage:", e);
        }
    }, [STORAGE_KEY]);

    const clearLocalStorage = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error("Failed to clear localStorage:", e);
        }
    }, [STORAGE_KEY]);

    const [sheetOpen, setSheetOpen] = useState(false);
    // Confirmation dialog state
    const [showConfirmCancel, setShowConfirmCancel] = useState(false);
    // STEPPER
    const [step, setStep] = useState(1);
    // Email tracking — saved to activity table when present
    const [sourceEmailMessageId, setSourceEmailMessageId] = useState(emailPrefill?.source_email_message_id ?? "");
    // FORM STATES (all required except callback)
    const [activityRef, setActivityRef] = useState(activityReferenceNumber || "");
    const [accountRef, setAccountRef] = useState(accountReferenceNumber || "");
    const [typeClient, setTypeClient] = useState(type_client || "");
    const [typeActivity, setTypeActivity] = useState("");
    const [source, setSource] = useState("");
    const [callback, setCallback] = useState(""); // optional
    const [callStatus, setCallStatus] = useState("");
    const [callType, setCallType] = useState("");

    const [productCat, setProductCat] = useState("");
    const [productAmount, setProductAmount] = useState("");
    const [productQuantity, setProductQuantity] = useState("");
    const [productDescription, setProductDescription] = useState("");
    const [productPhoto, setProductPhoto] = useState("");
    const [productSku, setProductSku] = useState("");
    const [productTitle, setProductTitle] = useState("");
    const [productDiscountedPrice, setProductDiscountedPrice] = useState("");
    const [productDiscountedAmount, setProductDiscountedAmount] = useState("");
    const [productIsPromo, setProductIsPromo] = useState("");
    const [productIsHidden, setProductIsHidden] = useState("");
    const [productRowDisplayMode, setProductRowDisplayMode] = useState("");
    const [vatType, setVatType] = useState("");
    const [deliveryFee, setDeliveryFee] = useState("");
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [restockingFee, setRestockingFee] = useState("");
    const [whtType, setWhtType] = useState("none");
    const [itemRemarks, setItemRemarks] = useState("");

    const [projectType, setProjectType] = useState("");
    const [projectName, setProjectName] = useState("");
    const [quotationNumber, setQuotationNumber] = useState("");
    const [quotationAmount, setQuotationAmount] = useState("");
    const [quotationType, setQuotationType] = useState("");
    const [quotationStatus, setQuotationStatus] = useState("");
    const [tsmApprovalStatus, setTsmApprovalStatus] = useState("");

    const [soNumber, setSoNumber] = useState("");
    const [soAmount, setSoAmount] = useState("");
    const [soStatus, setSoStatus] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");
    const [siDate, setSiDate] = useState("");
    const [poNumber, setPoNumber] = useState("");
    const [mode, setMode] = useState("");
    const [soType, setSoType] = useState("");
    const [invoiceType, setInvoiceType] = useState("");
    const [withholdingAgent, setWithholdingAgent] = useState("");
    const [salesGroup, setSalesGroup] = useState("");
    const [industry, setIndustry] = useState("");
    const [conforme, setConforme] = useState("");
    const [ioDept, setIoDept] = useState("");
    const [tpcRef, setTpcRef] = useState("");
    const [tpcAmount, setTpcAmount] = useState("");
    const [tpcType, setTpcType] = useState("");
    const [discountFlag, setDiscountFlag] = useState("");
    const [freightFlag, setFreightFlag] = useState("");
    const [inlandFlag, setInlandFlag] = useState("");
    const [restockingFlag, setRestockingFlag] = useState("");

    const [drNumber, setDrNumber] = useState("");
    const [siAmount, setSiAmount] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");

    const [followUpDate, setFollowUpDate] = useState("");
    const [status, setStatus] = useState("");
    const [remarks, setRemarks] = useState("");
    const [startDate, setStartDate] = useState("");
    const [dateCreated, setDateCreated] = useState("");

    const [tsmState, setTSMState] = useState(tsm || "");

    const [loading, setLoading] = useState(false);
    const [elapsedTime, setElapsedTime] = useState("");
    const [showExportNotification, setShowExportNotification] = React.useState(false);

    const [selectedContactPerson, setSelectedContactPerson] = useState(contact_person);
    const [selectedContactNumber, setSelectedContactNumber] = useState(contact_number);
    const [selectedEmailAddress, setSelectedEmailAddress] = useState(email_address);

    // Editable contact details (modified in quotation sheet)
    const [editableContactPerson, setEditableContactPerson] = useState(contact_person);
    const [editableContactNumber, setEditableContactNumber] = useState(contact_number);
    const [editableEmailAddress, setEditableEmailAddress] = useState(email_address);
    const [showContactDialog, setShowContactDialog] = useState(false); // <-- dito

    const [quotationSubject, setQuotationSubject] = useState("For Quotation");

    // Quotation display configuration state
    const [hideDiscountInPreview, setHideDiscountInPreview] = useState(false);
    const [showDiscountColumns, setShowDiscountColumns] = useState(false);
    const [showSummaryDiscounts, setShowSummaryDiscounts] = useState(false);
    const [showProfitMargins, setShowProfitMargins] = useState(false);
    const [marginAlertThreshold, setMarginAlertThreshold] = useState(0);
    const [showMarginAlerts, setShowMarginAlerts] = useState(false);
    const [productViewMode, setProductViewMode] = useState('list');
    const [visibleColumns, setVisibleColumns] = useState(null);

    // Restore state from localStorage on mount
    useEffect(() => {
        try {
            const savedState = localStorage.getItem(STORAGE_KEY);
            if (savedState) {
                const parsed = JSON.parse(savedState);
                
                setSheetOpen(parsed.sheetOpen ?? false);
                setStep(parsed.step ?? 1);
                setActivityRef(parsed.activityRef ?? activityReferenceNumber ?? "");
                setAccountRef(parsed.accountRef ?? accountReferenceNumber ?? "");
                setTypeClient(parsed.typeClient ?? type_client ?? "");
                setTypeActivity(parsed.typeActivity ?? "");
                setSource(parsed.source ?? "");
                setCallback(parsed.callback ?? "");
                setCallStatus(parsed.callStatus ?? "");
                setCallType(parsed.callType ?? "");
                setProductCat(parsed.productCat ?? "");
                setProductAmount(parsed.productAmount ?? "");
                setProductQuantity(parsed.productQuantity ?? "");
                setProductDescription(parsed.productDescription ?? "");
                setProductPhoto(parsed.productPhoto ?? "");
                setProductSku(parsed.productSku ?? "");
                setProductTitle(parsed.productTitle ?? "");
                setProductDiscountedPrice(parsed.productDiscountedPrice ?? "");
                setProductDiscountedAmount(parsed.productDiscountedAmount ?? "");
                setProductIsPromo(parsed.productIsPromo ?? "");
                setProductIsHidden(parsed.productIsHidden ?? "");
                setProductRowDisplayMode(parsed.productRowDisplayMode ?? "");
                setVatType(parsed.vatType ?? "");
                setDeliveryFee(parsed.deliveryFee ?? "");
                setDeliveryAddress(parsed.deliveryAddress ?? "");
                setRestockingFee(parsed.restockingFee ?? "");
                setWhtType(parsed.whtType ?? "none");
                setItemRemarks(parsed.itemRemarks ?? "");
                setProjectType(parsed.projectType ?? "");
                setProjectName(parsed.projectName ?? "");
                setQuotationNumber(parsed.quotationNumber ?? "");
                setQuotationAmount(parsed.quotationAmount ?? "");
                setQuotationType(parsed.quotationType ?? "");
                setQuotationStatus(parsed.quotationStatus ?? "");
                setTsmApprovalStatus(parsed.tsmApprovalStatus ?? "");
                setSoNumber(parsed.soNumber ?? "");
                setSoAmount(parsed.soAmount ?? "");
                setSoStatus(parsed.soStatus ?? "");
                setPaymentStatus(parsed.paymentStatus ?? "");
                setSiDate(parsed.siDate ?? "");
                setPoNumber(parsed.poNumber ?? "");
                setMode(parsed.mode ?? "");
                setSoType(parsed.soType ?? "");
                setInvoiceType(parsed.invoiceType ?? "");
                setWithholdingAgent(parsed.withholdingAgent ?? "");
                setSalesGroup(parsed.salesGroup ?? "");
                setIndustry(parsed.industry ?? "");
                setConforme(parsed.conforme ?? "");
                setIoDept(parsed.ioDept ?? "");
                setTpcRef(parsed.tpcRef ?? "");
                setTpcAmount(parsed.tpcAmount ?? "");
                setTpcType(parsed.tpcType ?? "");
                setDiscountFlag(parsed.discountFlag ?? "");
                setFreightFlag(parsed.freightFlag ?? "");
                setInlandFlag(parsed.inlandFlag ?? "");
                setRestockingFlag(parsed.restockingFlag ?? "");
                setDrNumber(parsed.drNumber ?? "");
                setSiAmount(parsed.siAmount ?? "");
                setPaymentTerms(parsed.paymentTerms ?? "");
                setDeliveryDate(parsed.deliveryDate ?? "");
                setFollowUpDate(parsed.followUpDate ?? "");
                setStatus(parsed.status ?? "");
                setRemarks(parsed.remarks ?? "");
                setStartDate(parsed.startDate ?? "");
                setDateCreated(parsed.dateCreated ?? "");
                setTSMState(parsed.tsmState ?? tsm ?? "");
                setSelectedContactPerson(parsed.selectedContactPerson ?? contact_person);
                setSelectedContactNumber(parsed.selectedContactNumber ?? contact_number);
                setSelectedEmailAddress(parsed.selectedEmailAddress ?? email_address);
                setEditableContactPerson(parsed.editableContactPerson ?? contact_person);
                setEditableContactNumber(parsed.editableContactNumber ?? contact_number);
                setEditableEmailAddress(parsed.editableEmailAddress ?? email_address);
                setQuotationSubject(parsed.quotationSubject ?? "For Quotation");
                setHideDiscountInPreview(parsed.hideDiscountInPreview ?? false);
                setShowDiscountColumns(parsed.showDiscountColumns ?? false);
                setShowSummaryDiscounts(parsed.showSummaryDiscounts ?? false);
                setShowProfitMargins(parsed.showProfitMargins ?? false);
                setMarginAlertThreshold(parsed.marginAlertThreshold ?? 0);
                setShowMarginAlerts(parsed.showMarginAlerts ?? false);
                setProductViewMode(parsed.productViewMode ?? 'list');
                setVisibleColumns(parsed.visibleColumns ?? null);
            }
        } catch (e) {
            console.error("Failed to restore state from localStorage:", e);
        }
    }, [STORAGE_KEY, activityReferenceNumber, accountReferenceNumber, type_client, contact_person, contact_number, email_address, tsm]);

    // Save state to localStorage whenever any state changes
    useEffect(() => {
        if (sheetOpen) {
            saveStateToLocalStorage({
                sheetOpen,
                step,
                activityRef,
                accountRef,
                typeClient,
                typeActivity,
                source,
                callback,
                callStatus,
                callType,
                productCat,
                productAmount,
                productQuantity,
                productDescription,
                productPhoto,
                productSku,
                productTitle,
                productDiscountedPrice,
                productDiscountedAmount,
                productIsPromo,
                productIsHidden,
                productRowDisplayMode,
                vatType,
                deliveryFee,
                deliveryAddress,
                restockingFee,
                whtType,
                itemRemarks,
                projectType,
                projectName,
                quotationNumber,
                quotationAmount,
                quotationType,
                quotationStatus,
                tsmApprovalStatus,
                soNumber,
                soAmount,
                soStatus,
                paymentStatus,
                siDate,
                poNumber,
                mode,
                soType,
                invoiceType,
                withholdingAgent,
                salesGroup,
                industry,
                conforme,
                ioDept,
                tpcRef,
                tpcAmount,
                tpcType,
                discountFlag,
                freightFlag,
                inlandFlag,
                restockingFlag,
                drNumber,
                siAmount,
                paymentTerms,
                deliveryDate,
                followUpDate,
                status,
                remarks,
                startDate,
                dateCreated,
                tsmState,
                selectedContactPerson,
                selectedContactNumber,
                selectedEmailAddress,
                editableContactPerson,
                editableContactNumber,
                editableEmailAddress,
                quotationSubject,
                hideDiscountInPreview,
                showDiscountColumns,
                showSummaryDiscounts,
                showProfitMargins,
                marginAlertThreshold,
                showMarginAlerts,
                productViewMode,
                visibleColumns,
            });
        }
    }, [
        sheetOpen,
        step,
        activityRef,
        accountRef,
        typeClient,
        typeActivity,
        source,
        callback,
        callStatus,
        callType,
        productCat,
        productAmount,
        productQuantity,
        productDescription,
        productPhoto,
        productSku,
        productTitle,
        productDiscountedPrice,
        productDiscountedAmount,
        productIsPromo,
        productIsHidden,
        productRowDisplayMode,
        vatType,
        deliveryFee,
        deliveryAddress,
        restockingFee,
        whtType,
        itemRemarks,
        projectType,
        projectName,
        quotationNumber,
        quotationAmount,
        quotationType,
        quotationStatus,
        tsmApprovalStatus,
        soNumber,
        soAmount,
        soStatus,
        paymentStatus,
        siDate,
        poNumber,
        mode,
        soType,
        invoiceType,
        withholdingAgent,
        salesGroup,
        industry,
        conforme,
        ioDept,
        tpcRef,
        tpcAmount,
        tpcType,
        discountFlag,
        freightFlag,
        inlandFlag,
        restockingFlag,
        drNumber,
        siAmount,
        paymentTerms,
        deliveryDate,
        followUpDate,
        status,
        remarks,
        startDate,
        dateCreated,
        tsmState,
        selectedContactPerson,
        selectedContactNumber,
        selectedEmailAddress,
        editableContactPerson,
        editableContactNumber,
        editableEmailAddress,
        quotationSubject,
        hideDiscountInPreview,
        showDiscountColumns,
        showSummaryDiscounts,
        showProfitMargins,
        marginAlertThreshold,
        showMarginAlerts,
        productViewMode,
        visibleColumns,
        saveStateToLocalStorage,
    ]);

    // AUTO SET DATE CREATED
    useEffect(() => {
        setDateCreated(new Date().toISOString());
    }, []);

    // ── Email prefill: auto-open sheet + pre-select Quotation Preparation ──
    useEffect(() => {
        if (!emailPrefill) return;
        // Keep source_email_message_id in sync if the prop changes
        setSourceEmailMessageId(emailPrefill.source_email_message_id);
        if (emailPrefill.autoOpen && !sheetOpen) {
            setActivityRef(activityReferenceNumber || "");
            setAccountRef(accountReferenceNumber || "");
            setTypeActivity("Quotation Preparation");
            setStartDate(new Date().toISOString());
            // Pre-fill initial_notes with email subject / from
            if (!remarks) {
                setRemarks(
                    `Created from email:\nSubject: ${emailPrefill.source_email_subject}\nFrom: ${emailPrefill.source_email_from}`
                );
            }
            setSheetOpen(true);
        }
    // Only run once when emailPrefill is first set
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [emailPrefill?.source_email_message_id, emailPrefill?.autoOpen]);

    const initialState = {
        activityRef: activityReferenceNumber || "",
        accountRef: accountReferenceNumber || "",
        source: "",
        callback: "",
        callStatus: "",
        callType: "",
        productCat: "",
        productQuantity: "",
        productAmount: "",
        productDescription: "",
        productPhoto: "",
        productSku: "",
        productTitle: "",
        projectType: "",
        projectName: "",
        quotationNumber: "",
        quotationAmount: "",
        quotationType: "",
        quotationStatus: "",
        tsmApprovalStatus: "",
        itemRemarks: "",
        soNumber: "",
        soAmount: "",
        siDate: "",
        followUpDate: "",
        status: "",
        remarks: "",
        startDate: "",
        dateCreated: new Date().toISOString(),
    };

    function resetForm() {
        clearLocalStorage();
        setActivityRef(initialState.activityRef);
        setAccountRef(initialState.accountRef);
        setSource(initialState.source);
        setCallback(initialState.callback);
        setCallStatus(initialState.callStatus);
        setCallType(initialState.callType);
        setProductCat(initialState.productCat);
        setProductQuantity(initialState.productQuantity);
        setProductAmount(initialState.productAmount);
        setProductDescription(initialState.productDescription);
        setProductPhoto(initialState.productPhoto);
        setProductSku(initialState.productSku);
        setProductTitle(initialState.productTitle);
        setItemRemarks(initialState.itemRemarks);
        setProjectType(initialState.projectType);
        setProjectName(initialState.projectName);
        setQuotationNumber(initialState.quotationNumber);
        setQuotationAmount(initialState.quotationAmount);
        setQuotationType(initialState.quotationType);
        setQuotationStatus(initialState.quotationStatus);
        setTsmApprovalStatus(initialState.tsmApprovalStatus)
        setSoNumber(initialState.soNumber);
        setSoAmount(initialState.soAmount);
        setSiDate(initialState.siDate);
        setFollowUpDate(initialState.followUpDate);
        setStatus(initialState.status);
        setRemarks(initialState.remarks);
        setStartDate(initialState.startDate);
        setDateCreated(initialState.dateCreated);
    }

    useEffect(() => {
        // Set initial created date on open
        if (sheetOpen) {
            setDateCreated(new Date().toISOString());
        }
    }, [sheetOpen]);

    function timeAgo(dateString: string) {
        const now = new Date();
        const past = new Date(dateString);
        const diff = Math.floor((now.getTime() - past.getTime()) / 1000); // seconds

        if (diff < 60) return `${diff} sec${diff !== 1 ? 's' : ''} ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)} min${Math.floor(diff / 60) !== 1 ? 's' : ''} ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hr${Math.floor(diff / 3600) !== 1 ? 's' : ''} ago`;
        return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) !== 1 ? 's' : ''} ago`;
    }

    useEffect(() => {
        if (!startDate) {
            setElapsedTime("");
            return;
        }

        // update elapsed time every second
        const interval = setInterval(() => {
            setElapsedTime(timeAgo(startDate));
        }, 1000);

        // update immediately on mount
        setElapsedTime(timeAgo(startDate));

        return () => clearInterval(interval);
    }, [startDate]);

    const validateStep = (currentStep: number) => {
        switch (currentStep) {
            case 1:
                if (!typeActivity.trim()) {
                    sileo.warning({
                        title: "Warning",
                        description: "Please select Activity Type.",
                        duration: 4000,
                        position: "top-right",
                        fill: "black",
                        styles: {
                            title: "text-white!",
                            description: "text-white",
                        },
                    });
                    return false;
                }
                return true;

            case 2:
                // Source required if Outbound Calls (quotation also requires source)
                if (typeActivity === "Outbound Calls" && !source.trim()) {
                    sileo.warning({
                        title: "Warning",
                        description: "Please select Source.",
                        duration: 4000,
                        position: "top-right",
                        fill: "black",
                        styles: {
                            title: "text-white!",
                            description: "text-white",
                        },
                    });
                    return false;
                }
                return true;

            case 3:
                // Call Status required if Outbound Calls
                if (typeActivity === "Outbound Calls" && !callStatus.trim()) {
                    sileo.warning({
                        title: "Warning",
                        description: "Please select Call Status.",
                        duration: 4000,
                        position: "top-right",
                        fill: "black",
                        styles: {
                            title: "text-white!",
                            description: "text-white",
                        },
                    });
                    return false;
                }
                return true;

            default:
                return true;
        }
    };

    const handleBack = () => setStep((prev) => (prev > 1 ? prev - 1 : prev));

    const handleNext = () => {
        if (validateStep(step)) {
            setStep((prev) => prev + 1);
        }
    };

    // Set export in progress
    localStorage.setItem('exportInProgress', 'true');

    // Clear kapag done
    localStorage.removeItem('exportInProgress');

    // Sa component mount (useEffect)
    useEffect(() => {
        const inProgress = localStorage.getItem('exportInProgress');
        if (inProgress === 'true') {
            setShowExportNotification(true);
            // Simulate progress resume or start counting from 0 again
        }
    }, []);

    const handleSave = async () => {
        clearLocalStorage();
        setLoading(true);

        const agent_name = `${firstname ?? ""} ${lastname ?? ""}`.trim();

        // Auto-generate activity reference number if not set
        // (happens when creating a brand-new activity from the email flow)
        let resolvedActivityRef = activityRef;
        if (!resolvedActivityRef) {
            const words = (company_name || "XX").trim().split(" ");
            const f = words[0]?.charAt(0).toUpperCase() ?? "X";
            const l = words[words.length - 1]?.charAt(0).toUpperCase() ?? "X";
            resolvedActivityRef = `${f}${l}-NCR-${String(Date.now()).slice(-10)}`;
            setActivityRef(resolvedActivityRef);
        }

        // Debug logging
        console.log("[Create] Product flags before save:", {
            productIsPromo,
            productIsHidden,
            productRowDisplayMode,
        });

        const newActivity: Activity = {
            activity_reference_number: resolvedActivityRef,
            account_reference_number: accountRef,
            type_client,
            company_name,
            contact_person: editableContactPerson || selectedContactPerson, // <-- uses edited value
            contact_number: editableContactNumber || selectedContactNumber, // <-- uses edited value
            email_address: editableEmailAddress || selectedEmailAddress, // <-- uses edited value
            address,
            date_created: dateCreated,
            date_updated: new Date().toISOString(),
            status,
            type_activity: typeActivity,
            target_quota,
            referenceid,
            // Signatories
            contact,
            email,
            signature,
            tsmname,
            managername,
            agent_name,

            tsm,
            manager,
            ticket_reference_number,
            agent,
            source,
            call_status: callStatus,
            call_type: callType,

            product_category: productCat || undefined,
            product_quantity: productQuantity || undefined,
            product_amount: productAmount || undefined,
            product_description: productDescription || undefined,
            product_photo: productPhoto || undefined,
            product_sku: productSku || undefined,
            product_title: productTitle || undefined,
            discounted_priced: productDiscountedPrice || undefined,
            discounted_amount: productDiscountedAmount || undefined,
            product_is_promo: productIsPromo || undefined,
            product_is_hidden: productIsHidden || undefined,
            product_display_mode: productRowDisplayMode || undefined,
            vat_type: vatType,
            delivery_fee: deliveryFee,
            restocking_fee: restockingFee,
            wht_type: whtType,
            quotation_subject: quotationSubject,
            item_remarks: itemRemarks || undefined,

            // Quotation display configuration
            hide_discount_in_preview: hideDiscountInPreview,
            show_discount_columns: showDiscountColumns,
            show_summary_discounts: showSummaryDiscounts,
            show_profit_margins: showProfitMargins,
            margin_alert_threshold: marginAlertThreshold,
            show_margin_alerts: showMarginAlerts,
            product_view_mode: productViewMode,
            visible_columns: visibleColumns,

            project_type: projectType || undefined,
            project_name: projectName || undefined,
            quotation_number: quotationNumber || undefined,
            quotation_amount: quotationAmount || undefined,
            quotation_type: quotationType || undefined,
            //quotation_status: quotationStatus || undefined,

            so_number: soNumber || undefined,
            so_amount: soAmount || undefined,
            si_date: siDate || undefined,
            so_status: soStatus || undefined,
            payment_status: paymentStatus || undefined,

            dr_number: drNumber || undefined,
            actual_sales: siAmount || undefined,
            payment_terms: paymentTerms || undefined,
            delivery_date: deliveryDate || undefined,

            date_followup: followUpDate || undefined,
            remarks,
            tsm_approved_status: tsmApprovalStatus || undefined,
            start_date: startDate,
            end_date: new Date().toISOString(),
        };

        try {
            // Save activity
            const res = await fetch("/api/act-save-activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newActivity),
            });

            const result = await res.json();

            if (!res.ok) {
                sileo.error({
                    title: "Failed",
                    description: "Failed to save activity.",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
                setLoading(false);
                return;
            }

            // Prepare scheduled_date for update status API
            const scheduled_date = followUpDate || null;

            // Update status AND scheduled_date if available
            // Include all activity data for new activity creation (Cluster/OB Calls flow)
            const statusPayload = {
                activity_reference_number: resolvedActivityRef,
                status,
                scheduled_date,
                // Additional fields for new activity creation
                referenceid: referenceid || newActivity.referenceid,
                tsm: tsm || newActivity.tsm,
                manager: manager || newActivity.manager,
                // Note: target_quota not sent to activity table (only history)
                account_reference_number: accountReferenceNumber || newActivity.account_reference_number,
                ticket_reference_number: ticket_reference_number || newActivity.ticket_reference_number,
                type_client: type_client || newActivity.type_client,
                company_name: company_name || newActivity.company_name,
                contact_person: contact_person || newActivity.contact_person,
                contact_number: contact_number || newActivity.contact_number,
                email_address: email_address || newActivity.email_address,
                address: address || newActivity.address,
                agent: agent || newActivity.agent,
                is_new_activity: true,
                // Email bridge — write to activity table when originating from email
                ...(sourceEmailMessageId ? { source_email_message_id: sourceEmailMessageId } : {}),
            };
            console.log("Status API Payload:", statusPayload);

            const statusRes = await fetch("/api/act-edit-status-activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(statusPayload),
            });

            const statusResult = await statusRes.json();

            if (!statusRes.ok) {
                const errorMsg = statusResult.error || "Failed to update activity status.";
                console.error("Status API Error:", statusResult);
                sileo.error({
                    title: "Failed",
                    description: errorMsg,
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });

                setLoading(false);
                return;
            }

            onCreated(newActivity);

            // Success save + status update toast
            sileo.success({
                title: "Success",
                description: "Activity created and status updated successfully!",
                duration: 4000,
                position: "top-right",
                fill: "black",
                styles: {
                    title: "text-white!",
                    description: "text-white",
                },
            });
            resetForm();
            setStep(1);
            setSheetOpen(false);

            window.location.reload();

        } catch (error) {
            sileo.error({
                title: "Failed",
                description: "Server error. Please try again.",
                duration: 4000,
                position: "top-right",
                fill: "black",
                styles: {
                    title: "text-white!",
                    description: "text-white",
                },
            });
        } finally {
            setLoading(false);
        }
    };

    // Handle sheet open/close
    const onSheetOpenChange = (open: boolean) => {
        if (!open) {
            // User trying to close - show confirmation dialog
            setShowConfirmCancel(true);
            // Don't update sheetOpen yet, let user confirm first
        } else {
            setSheetOpen(true);
        }
    };

    // Force close sheet (for emergencies when it gets stuck)
    const forceCloseSheet = () => {
        setShowConfirmCancel(false);
        setSheetOpen(false);
        resetForm();
    };

    // Handle user confirmed cancel
    const confirmCancel = () => {
        resetForm();
        setStep(1); // Reset step to 1
        setShowConfirmCancel(false);
        setSheetOpen(false);
    };

    // Handle user canceled cancel (keep sheet open)
    const cancelCancel = () => {
        setShowConfirmCancel(false);
        setSheetOpen(true);
    };

    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const contactPersons = (contact_person || "").split(",").map(c => c.trim());
    const contactNumbers = (contact_number || "").split(",").map(c => c.trim());
    const emailAddresses = (email_address || "").split(",").map(e => e.trim());

    return (
        <>
            <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
                <DialogContent style={{ width: "500px", height: "auto" }} className="rounded-none">
                    <DialogHeader>
                        <DialogTitle>Confirm Contact</DialogTitle>
                    </DialogHeader>

                    <div className="p-4 space-y-4">
                        <p>Select a contact to use:</p>

                        {/* Contact List as Cards */}
                        <div className="grid grid-cols-1 gap-3">
                            {contactPersons.map((person, idx) => {
                                const number = contactNumbers[idx] || "";
                                const email = emailAddresses[idx] || "";
                                const isSelected = selectedContacts.includes(person);

                                return (
                                    <div
                                        key={person}
                                        onClick={() => setSelectedContacts([person])} // always single
                                        className={`border rounded-lg p-3 cursor-pointer transition-shadow flex items-center space-x-3
                ${isSelected ? "border-blue-500 bg-blue-50 shadow-md" : "border-gray-200 hover:shadow-sm"}
              `}
                                    >
                                        <User className="w-6 h-6 text-gray-500" />
                                        <div className="flex flex-col">
                                            <p className="font-semibold">{person}</p>
                                            <p className="text-sm text-gray-600">{number}</p>
                                            <p className="text-sm text-gray-500">{email}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <DialogFooter className="mt-4 flex justify-end space-x-2">
                        <Button
                            variant="outline"
                            className="rounded-none p-6"
                            onClick={() => setShowContactDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (selectedContacts.length === 0) {
                                    sileo.warning({
                                        title: "Warning",
                                        description: "Please select a contact.",
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

                                const selectedPerson = selectedContacts[0];
                                const idx = contactPersons.indexOf(selectedPerson);
                                const selectedNumber = contactNumbers[idx] || "";
                                const selectedEmail = emailAddresses[idx] || "";

                                setSelectedContactPerson(selectedPerson);
                                setSelectedContactNumber(selectedNumber);
                                setSelectedEmailAddress(selectedEmail);

                                setShowContactDialog(false);
                                handleNext(); // move to next step
                            }}
                            className="rounded-none p-6"
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        className="cursor-pointer rounded-none"
                        onClick={() => {
                            setActivityRef(activityReferenceNumber || "");
                            setAccountRef(accountReferenceNumber || "");
                            // If coming from email, pre-select Quotation Preparation
                            if (emailPrefill) {
                                setTypeActivity("Quotation Preparation");
                                setStartDate(new Date().toISOString());
                                if (!remarks) {
                                    setRemarks(
                                        `Created from email:\nSubject: ${emailPrefill.source_email_subject}\nFrom: ${emailPrefill.source_email_from}`
                                    );
                                }
                            }
                            setSheetOpen(true);
                        }}                    >
                        <Plus /> Create
                    </Button>
                </SheetTrigger>

                <SheetContent side="right" className="w-full sm:w-[600px] overflow-auto custom-scrollbar">
                    <SheetHeader>
                        <SheetTitle>Create New Activity for <br />{company_name}</SheetTitle>
                        <SheetDescription>
                            {emailPrefill
                                ? `From email: "${emailPrefill.source_email_subject}"`
                                : "Fill out the steps to create a new activity."
                            }
                        </SheetDescription>
                        {startDate && (
                            <div className="fixed bottom-20 right-100 z-50 bg-black/30 text-white rounded-xs px-4 py-4 font-mono font-semibold text-lg select-none flex items-center space-x-2 cursor-default min-w-[120px] justify-center">
                                <span className="tracking-wide">{elapsedTime}</span>
                            </div>
                        )}
                    </SheetHeader>
                    {loading ? (
                        <SpinnerEmpty
                            onCancel={() => {
                                setLoading(false);
                                setSheetOpen(false);
                            }}
                        />
                    ) : (
                        <div className="p-4 grid gap-6">
                            {/* STEP 1 */}
                            {step === 1 && (
                                <div>
                                    <h2 className="text-sm font-semibold mb-3"> Step 1 — Type of Activity</h2>
                                    <FieldGroup>
                                        <FieldSet>
                                            <FieldLabel>Select Activity Type</FieldLabel>
                                            <RadioGroup
                                                value={typeActivity}
                                                onValueChange={(value) => {
                                                    setTypeActivity(value);
                                                    setStartDate(new Date().toISOString());
                                                }}
                                            >
                                                {[
                                                    {
                                                        value: "Outbound Calls",
                                                        title: "Outbound Calls",
                                                        desc:
                                                            "Make outgoing calls to clients for updates, touchbase, or follow-ups.",
                                                    },
                                                    {
                                                        value: "Inbound Calls",
                                                        title: "Inbound Calls",
                                                        desc:
                                                            "Handle incoming calls from clients requesting assistance or information.",
                                                    },
                                                    {
                                                        value: "Quotation Preparation",
                                                        title: "Quotation Preparation",
                                                        desc:
                                                            "Prepare and submit quotations for clients including pricing and project details.",
                                                    },
                                                    {
                                                        value: "Sales Order Preparation",
                                                        title: "Sales Order Preparation",
                                                        desc:
                                                            "Prepare and submit sales orders for clients including pricing and project details.",
                                                    },
                                                    {
                                                        value: "Delivered / Closed Transaction",
                                                        title: "Delivered / Closed Transaction",
                                                        desc:
                                                            "Handle completed transactions including delivery confirmation, closing documentation, and final client coordination.",
                                                    },
                                                    {
                                                        value: "Viber Replies / Messages",
                                                        title: "Viber Replies / Messages",
                                                        desc:
                                                            "Handle Viber replies and messages from clients.",
                                                    },
                                                ].map((item) => (
                                                    <FieldLabel key={item.value}>
                                                        <Field orientation="horizontal">
                                                            <FieldContent>
                                                                <FieldTitle>{item.title}</FieldTitle>
                                                                <FieldDescription>{item.desc}</FieldDescription>

                                                                {typeActivity === item.value && (
                                                                    <div className="mt-4 flex">
                                                                        <Button
                                                                            className="rounded-none"
                                                                            onClick={() => {
                                                                                const showDialogFor = [
                                                                                    "Outbound Calls",
                                                                                    "Inbound Calls",
                                                                                    "Quotation Preparation",
                                                                                    "Viber Replies / Messages",
                                                                                ];

                                                                                if (showDialogFor.includes(item.value)) {
                                                                                    setShowContactDialog(true);
                                                                                } else {
                                                                                    handleNext(); // go to next step directly for other activity types
                                                                                }
                                                                            }}
                                                                        >
                                                                            Next <ArrowRight />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </FieldContent>
                                                            <RadioGroupItem value={item.value} />
                                                        </Field>
                                                    </FieldLabel>
                                                ))}
                                            </RadioGroup>
                                        </FieldSet>
                                    </FieldGroup>
                                </div>
                            )}

                            {typeActivity === "Outbound Calls" && (
                                <OutboundSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    contact_number={selectedContactNumber}
                                    setContactNumber={setSelectedContactNumber}
                                    callStatus={callStatus}
                                    setCallStatus={setCallStatus}
                                    callType={callType}
                                    setCallType={setCallType}
                                    followUpDate={followUpDate}
                                    setFollowUpDate={setFollowUpDate}
                                    status={status}
                                    setStatus={setStatus}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    typeClient={typeClient}
                                    setTypeClient={setTypeClient}
                                    loading={loading}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}
                                />
                            )}

                            {typeActivity === "Inbound Calls" && (
                                <InboundSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    callType={callType}
                                    setCallType={setCallType}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}

                                    typeClient={typeClient}
                                    setTypeClient={setTypeClient}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}
                                />
                            )}

                            {typeActivity === "Quotation Preparation" && (
                                <QuotationSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    productCat={productCat}
                                    setProductCat={setProductCat}
                                    productQuantity={productQuantity}
                                    setProductQuantity={setProductQuantity}
                                    productAmount={productAmount}
                                    setProductAmount={setProductAmount}
                                    productDescription={productDescription}
                                    setProductDescription={setProductDescription}
                                    productPhoto={productPhoto}
                                    setProductPhoto={setProductPhoto}
                                    productSku={productSku}
                                    setProductSku={setProductSku}
                                    productTitle={productTitle}
                                    setProductTitle={setProductTitle}
                                    productDiscountedPrice={productDiscountedPrice}
                                    setProductDiscountedPrice={setProductDiscountedPrice}
                                    productDiscountedAmount={productDiscountedAmount}
                                    setProductDiscountedAmount={setProductDiscountedAmount}
                                    productIsPromo={productIsPromo}
                                    setProductIsPromo={setProductIsPromo}
                                    productIsHidden={productIsHidden}
                                    setProductIsHidden={setProductIsHidden}
                                    productRowDisplayMode={productRowDisplayMode}
                                    setProductRowDisplayMode={setProductRowDisplayMode}
                                    projectType={projectType}
                                    setProjectType={setProjectType}
                                    projectName={projectName}
                                    setProjectName={setProjectName}
                                    quotationNumber={quotationNumber}
                                    setQuotationNumber={setQuotationNumber}
                                    quotationAmount={quotationAmount}
                                    setQuotationAmount={setQuotationAmount}
                                    quotationType={quotationType}
                                    setQuotationType={setQuotationType}
                                    //quotationStatus={quotationStatus}
                                    //setQuotationStatus={setQuotationStatus}
                                    tsmApprovalStatus={tsmApprovalStatus}
                                    setTsmApprovalStatus={setTsmApprovalStatus}
                                    callType={callType}
                                    setCallType={setCallType}
                                    followUpDate={followUpDate}
                                    setFollowUpDate={setFollowUpDate}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}
                                    vatType={vatType}
                                    setVatType={setVatType}
                                    deliveryFee={deliveryFee}
                                    setDeliveryFee={setDeliveryFee}
                                    deliveryAddress={deliveryAddress}
                                    setDeliveryAddress={setDeliveryAddress}
                                    restockingFee={restockingFee}
                                    setRestockingFee={setRestockingFee}
                                    itemRemarks={itemRemarks}
                                    setItemRemarks={setItemRemarks}
                                    typeClient={typeClient}
                                    setTypeClient={setTypeClient}
                                    tsm={tsm}
                                    setTSM={setTSMState}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}

                                    // The props you want to pass down:
                                    firstname={firstname}
                                    lastname={lastname}
                                    email={email}
                                    contact={contact}
                                    tsmname={tsmname}
                                    managername={managername}
                                    company_name={company_name}
                                    address={address}
                                    email_address={selectedEmailAddress}
                                    contact_number={selectedContactNumber}
                                    contact_person={selectedContactPerson}
                                    setContactPerson={setEditableContactPerson}
                                    setContactNumber={setEditableContactNumber}
                                    setEmailAddress={setEditableEmailAddress}
                                    availableContacts={contactPersons.map((person, idx) => ({
                                        name: person,
                                        contact_number: contactNumbers[idx] || "",
                                        email_address: emailAddresses[idx] || ""
                                    }))}
                                    managerDetails={managerDetails ?? null}
                                    tsmDetails={tsmDetails ?? null}
                                    signature={signature}
                                    whtType={whtType}
                                    setWhtType={setWhtType}

                                    quotationSubject={quotationSubject}
                                    setQuotationSubject={setQuotationSubject}

                                    referenceid={referenceid}

                                    // Quotation display configuration
                                    hideDiscountInPreview={hideDiscountInPreview}
                                    setHideDiscountInPreview={setHideDiscountInPreview}
                                    showDiscountColumns={showDiscountColumns}
                                    setShowDiscountColumns={setShowDiscountColumns}
                                    showSummaryDiscounts={showSummaryDiscounts}
                                    setShowSummaryDiscounts={setShowSummaryDiscounts}
                                    showProfitMargins={showProfitMargins}
                                    setShowProfitMargins={setShowProfitMargins}
                                    marginAlertThreshold={marginAlertThreshold}
                                    setMarginAlertThreshold={setMarginAlertThreshold}
                                    showMarginAlerts={showMarginAlerts}
                                    setShowMarginAlerts={setShowMarginAlerts}
                                    productViewMode={productViewMode}
                                    setProductViewMode={setProductViewMode}
                                    visibleColumns={visibleColumns}
                                    setVisibleColumns={setVisibleColumns}
                                />
                            )}

                            {typeActivity === "Sales Order Preparation" && (
                                <SOSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    soAmount={soAmount}
                                    setSoAmount={setSoAmount}
                                    callType={callType}
                                    setCallType={setCallType}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}
                                    soStatus={soStatus}
                                    setSoStatus={setSoStatus}
                                    paymentStatus={paymentStatus}
                                    setPaymentStatus={setPaymentStatus}
                                    typeClient={typeClient}
                                    setTypeClient={setTypeClient}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}

                                    // Quotation data
                                    quotationNumber={quotationNumber}
                                    quotationAmount={quotationAmount}
                                    productCat={productCat}
                                    productQuantity={productQuantity}
                                    productSku={productSku}
                                    productTitle={productTitle}
                                    productDescription={productDescription}
                                    productPhoto={productPhoto}
                                    productDiscountedPrice={productDiscountedPrice}
                                    productDiscountedAmount={productDiscountedAmount}
                                    productIsPromo={productIsPromo}
                                    vatType={vatType}
                                    deliveryFee={deliveryFee}
                                    deliveryAddress={deliveryAddress}
                                    restockingFee={restockingFee}
                                    whtType={whtType}
                                    quotationSubject={quotationSubject}
                                    itemRemarks={itemRemarks}
                                    projectType={projectType}
                                    projectName={projectName}

                                    // Client details
                                    company_name={company_name}
                                    address={address}
                                    contact_person={contact_person}
                                    contact_number={contact_number}
                                    email_address={email_address}

                                    // Enhanced SO features
                                    soRevisions={[]}
                                    quotationType={quotationType}
                                />
                            )}

                            {typeActivity === "Delivered / Closed Transaction" && (
                                <DRSheet
                                    step={step}
                                    setStep={setStep}
                                    drNumber={drNumber}
                                    setDrNumber={setDrNumber}
                                    soNumber={soNumber}
                                    setSoNumber={setSoNumber}
                                    siAmount={siAmount}
                                    setSiAmount={setSiAmount}
                                    siDate={siDate}
                                    setSiDate={setSiDate}
                                    paymentTerms={paymentTerms}
                                    setPaymentTerms={setPaymentTerms}
                                    deliveryDate={deliveryDate}
                                    setDeliveryDate={setDeliveryDate}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}
                                />
                            )}

                            {
                                (
                                    typeActivity === "Viber Replies / Messages" ||
                                    typeActivity === "Admin - Supplier Accreditation" ||
                                    typeActivity === "Admin - Credit Terms Application" ||
                                    typeActivity === "Accounting Concerns" ||
                                    typeActivity === "After Sales Refunds" ||
                                    typeActivity === "After Sales Repair / Replacement" ||
                                    typeActivity === "Bidding Preparations" ||
                                    typeActivity === "Customer Orders" ||
                                    typeActivity === "Customer Inquiry Sales" ||
                                    typeActivity === "Delivery Concern" ||
                                    typeActivity === "Follow Up" ||
                                    typeActivity === "Sample Requests" ||
                                    typeActivity === "Site Visits / Demos" ||
                                    typeActivity === "Technical Concerns"
                                ) && (
                                    <ViberRepliesSheet
                                        step={step}
                                        setStep={setStep}
                                        source={source}
                                        setSource={setSource}
                                        remarks={remarks}
                                        setRemarks={setRemarks}
                                        status={status}
                                        setStatus={setStatus}
                                        typeClient={typeClient}
                                        setTypeClient={setTypeClient}
                                        handleBack={handleBack}
                                        handleNext={handleNext}
                                        handleSave={handleSave}
                                    />
                                )
                            }

                            {typeActivity === "FB Marketplace Replies / Messages" && (
                                <FBMarketplaceSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    callType={callType}
                                    setCallType={setCallType}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}

                                    typeClient={typeClient}
                                    setTypeClient={setTypeClient}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}
                                />
                            )}

                        </div>
                    )}

                    {/* Confirmation Dialog with Escape key handling */}
                    <Dialog open={showConfirmCancel} onOpenChange={(open) => {
                        if (!open) cancelCancel();
                    }}>
                        <DialogContent className="rounded-none" onEscapeKeyDown={(e) => {
                            e.preventDefault();
                            cancelCancel();
                        }}>
                            <DialogHeader>
                                <DialogTitle>Discard Changes?</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-gray-600">
                                You have unsaved changes. Are you sure you want to close and discard them?
                            </p>
                            <DialogFooter className="mt-4 flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    className="rounded-none"
                                    onClick={cancelCancel}
                                >
                                    Continue Editing
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="rounded-none"
                                    onClick={confirmCancel}
                                >
                                    Discard & Close
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Emergency close button if sheet gets stuck */}
                    <button
                        onClick={forceCloseSheet}
                        className="fixed top-2 right-2 z-[9999] p-2 bg-red-500 text-white text-xs opacity-0 hover:opacity-100 transition-opacity"
                        aria-label="Emergency close"
                    >
                        Force Close
                    </button>

                </SheetContent>
            </Sheet>
        </>
    );
}
