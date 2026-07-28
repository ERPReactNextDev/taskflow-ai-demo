"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, Package, DollarSign, Settings2, Layers, ArrowRight, Plus, Trash2, Check, ImageIcon, Lock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import imageCompression from "browser-image-compression";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpfCreationData {
    id: number;
    spf_number: string;
    referenceid: string;
    tsm: string;
    manager: string;
    status: string;
    company_name: string;
    supplier_brand: string;
    contact_name: string;
    contact_number: string;
    item_code: string;
    product_offer_image: string;
    product_offer_qty: string;
    product_offer_technical_specification: string;
    product_offer_unit_cost: string;
    product_offer_packaging_details: string;
    product_offer_factory_address: string;
    product_offer_port_of_discharge: string;
    product_offer_subtotal: string;
    product_offer_pcs_per_carton: string;
    final_selling_cost: string;
    final_unit_cost: string;
    final_subtotal: string;
    proj_lead_time: string;
    price_validity: string;
    tds: string;
    dimensional_drawing: string;
    illuminance_drawing: string;
    original_technical_specification: string;
    product_reference_id: string;
    date_created: string;
    date_updated: string;
    spf_creation_start_time: string;
    spf_creation_end_time: string;
}

interface SpfRequestData {
    spf_number: string;
    customer_name: string;
    contact_person: string;
    contact_number: string;
    registered_address: string;
    delivery_address: string;
    billing_address: string;
    collection_address: string;
    tin_no: string;
    payment_terms: string;
    warranty: string;
    delivery_date: string;
    special_instructions: string;
    sales_person: string;
    prepared_by: string;
    item_description: string;
    item_photo: string;
    item_qty: string;
}

interface ItemRow {
    item_photo: string;
    item_description: string;
    item_qty: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    spf_number: string | null;
    /**
     * Current spf_request.status of the record the revision is being
     * requested for. Per business rule:
     *   - status === "Approved by Sales Head"  -> Request Revision allowed
     *   - status !== "Approved by Sales Head"  -> Request Revision blocked
     * This is enforced again here (in addition to the disabled state on the
     * trigger button in the parent table) as a guard against stale rows or
     * race conditions where the status changed after the row was rendered.
     */
    status?: string | null;
    onRequestRevision: (spf_number: string, revision_type: string, revision_remarks: string, editedData?: any) => Promise<void>;
    onSuccessClose?: () => void;
}

type RevisionStep = "select-type" | "edit-form" | "add-remarks";

const REVISION_ELIGIBLE_STATUS = "Approved by Sales Head";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseRowData = (value: string | null): string[] => {
    if (!value) return [];
    return value.split("|ROW|").map(s => s.trim());
};

const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-2 py-2 border-b border-gray-200 mb-3">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">
            {title}
        </span>
    </div>
);

const DisplayField = ({ label, value }: { label: string, value: string }) => (
    <div className="mb-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase">{label}:</span>
        <p className="text-xs text-gray-800 mt-0.5">{value || "—"}</p>
    </div>
);

// ─── Field + SectionLabel (stable, defined outside component) ─────────────────

const Field = ({ label, children, required, className = "" }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) => (
    <div className={`flex flex-col gap-2 ${className}`}>
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
            {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {children}
    </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">{children}</p>
);

// ─── FIX: Step1Form extracted outside RevisionDialog to prevent focus loss ────
// REASON: When renderStep1 was an inline function inside the component, every
// keystroke caused a re-render which redefined the function, making React think
// the Input elements were brand-new components → unmount + remount → cursor lost.
// By defining it here as a stable named component, React reuses the same element
// across renders and focus is preserved.

interface Step1FormProps {
    formData: any;
    setField: (key: string, value: string) => void;
    editable: boolean;
}

const Step1Form = React.memo(({ formData, setField, editable }: Step1FormProps) => {
    const fields = [
        { label: "Customer Name", key: "customer_name", required: true },
        { label: "Contact Person", key: "contact_person" },
        { label: "Contact Number", key: "contact_number" },
        { label: "Registered Address", key: "registered_address" },
        { label: "Delivery Address", key: "delivery_address" },
        { label: "Billing Address", key: "billing_address" },
        { label: "Collection Address", key: "collection_address" },
        { label: "TIN Number", key: "tin_no" },
    ];
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fields.map(({ label, key, required }) => (
                    <Field key={key} label={label} required={required}>
                        <Input
                            className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
                            placeholder={label}
                            value={formData?.[key] || ""}
                            onChange={(e) => setField(key, e.target.value)}
                            disabled={!editable}
                        />
                    </Field>
                ))}
            </div>
        </div>
    );
});
Step1Form.displayName = "Step1Form";

// ─── FIX: Step2Form extracted outside RevisionDialog to prevent focus loss ────

interface Step2FormProps {
    formData: any;
    setField: (key: string, value: string) => void;
    editable: boolean;
}

const Step2Form = React.memo(({ formData, setField, editable }: Step2FormProps) => (
    <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Payment Terms">
                <select
                    className="h-9 text-sm border border-gray-300 rounded-sm px-3 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    value={formData?.payment_terms || ""}
                    onChange={(e) => setField("payment_terms", e.target.value)}
                    disabled={!editable}
                >
                    <option value="">Select…</option>
                    {["COD", "Check", "Cash", "Bank Deposit", "GCash", "Terms"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </Field>
            <Field label="Warranty">
                <Input
                    className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
                    placeholder="e.g., 1 year"
                    value={formData?.warranty || ""}
                    onChange={(e) => setField("warranty", e.target.value)}
                    disabled={!editable}
                />
            </Field>
        </div>
        <Field label="Delivery Date">
            <Input
                type="date"
                className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
                value={formData?.delivery_date || ""}
                onChange={(e) => setField("delivery_date", e.target.value)}
                disabled={!editable}
            />
        </Field>
        <Field label="Special Instructions">
            <Textarea
                className="rounded-sm text-sm resize-none border-gray-300 focus:border-gray-400 focus:ring-0"
                placeholder="Any special instructions..."
                value={formData?.special_instructions || ""}
                onChange={(e) => setField("special_instructions", e.target.value)}
                rows={4}
                disabled={!editable}
            />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Sales Person">
                <Input
                    className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
                    placeholder="Name"
                    value={formData?.sales_person || ""}
                    onChange={(e) => setField("sales_person", e.target.value)}
                    disabled={!editable}
                />
            </Field>
            <Field label="Prepared By">
                <Input
                    className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
                    placeholder="Name"
                    value={formData?.prepared_by || ""}
                    onChange={(e) => setField("prepared_by", e.target.value)}
                    disabled={!editable}
                />
            </Field>
        </div>
    </div>
));
Step2Form.displayName = "Step2Form";

// ─── Component ────────────────────────────────────────────────────────────────

const revisionTypes = [
    {
        id: "Price Update",
        title: "Price Update",
        description: "Update only the unit cost for existing products",
        icon: DollarSign,
        color: "green",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        hoverBorder: "hover:border-green-400",
        iconBg: "bg-green-100",
        iconColor: "text-green-600",
        buttonBg: "bg-green-600 hover:bg-green-700"
    },
    {
        id: "Change Item Specs & Qty",
        title: "Change Item Specs & Qty",
        description: "Revise technical specifications and quantity. Quantity cannot be reduced below original.",
        icon: Settings2,
        color: "blue",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        hoverBorder: "hover:border-blue-400",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        buttonBg: "bg-blue-600 hover:bg-blue-700"
    },
    {
        id: "Both",
        title: "Both",
        description: "Update both price and specifications with full edit access",
        icon: Layers,
        color: "orange",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
        hoverBorder: "hover:border-orange-400",
        iconBg: "bg-orange-100",
        iconColor: "text-orange-600",
        buttonBg: "bg-orange-600 hover:bg-orange-700"
    }
];

const STEPS = [
    { id: 1, name: "Customer Info", key: "customer" },
    { id: 2, name: "Order Terms", key: "terms" },
    { id: 3, name: "Items", key: "items" },
];

export function RevisionDialog({ open, onClose, spf_number, status, onRequestRevision, onSuccessClose }: Props) {
    const [data, setData] = useState<SpfCreationData | null>(null);
    const [requestData, setRequestData] = useState<SpfRequestData | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<RevisionStep>("select-type");
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [remarks, setRemarks] = useState("");
    const [formStep, setFormStep] = useState(1);
    const [items, setItems] = useState<ItemRow[]>([]);
    const [formData, setFormData] = useState<any>({});
    const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);

    // ─── Eligibility guard ──────────────────────────────────────────────────
    // Business rule (spf_request.status):
    //   status !== "Approved by Sales Head" -> Edit enabled / Request Revision disabled
    //   status === "Approved by Sales Head" -> Edit disabled / Request Revision enabled
    // The trigger button in the parent table already respects this, but we
    // re-check here in case the dialog is opened with a stale/mismatched status.
    const isRevisionEligible = status == null || status === REVISION_ELIGIBLE_STATUS;

    useEffect(() => {
        if (!open || !spf_number) {
            setData(null);
            setRequestData(null);
            setError(null);
            return;
        }

        if (!isRevisionEligible) {
            setData(null);
            setRequestData(null);
            setError(
                `This SPF cannot be revised right now. Current status is "${status}". ` +
                `Only SPFs with status "${REVISION_ELIGIBLE_STATUS}" are eligible for a revision request.`
            );
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                                // Try to fetch creation data, but don't fail if it doesn't exist
                let referenceid =
                    typeof window !== "undefined"
                        ? sessionStorage.getItem("tsa_referenceid") || ""
                        : "";
                const creationRes = await fetch(`/api/activity/tsa/spf/fetch-creation?spf_number=${encodeURIComponent(spf_number)}`);
                if (creationRes.ok) {
                    const creationJson = await creationRes.json();
                    setData(creationJson.data);
                    referenceid = creationJson.data?.referenceid || '';
                }

                // If no referenceid from creation, fetch directly from spf_request to get it
                if (!referenceid) {
                    const directRes = await fetch(`/api/activity/tsa/spf/fetch-by-spf-number?spf_number=${encodeURIComponent(spf_number)}`);
                    if (directRes.ok) {
                        const directJson = await directRes.json();
                        if (directJson.data) {
                            referenceid = directJson.data.referenceid || '';
                            // Set the request data directly
                            setRequestData(directJson.data);
                            setFormData(directJson.data);

                            const descs = (directJson.data.item_description || "").split(",").map((s: string) => s.trim());
                            const photos = (directJson.data.item_photo || "").split(",").map((s: string) => s.trim());
                            const qtys = (directJson.data.item_qty || "").split(",").map((s: string) => s.trim());
                            const maxLen = Math.max(descs.filter(Boolean).length, photos.filter(Boolean).length);
                            setItems(maxLen > 0 ? Array.from({ length: maxLen }, (_, i) => ({
                                item_description: descs[i] || "",
                                item_photo: photos[i] || "",
                                item_qty: qtys[i] || ""
                            })) : []);
                            setLoading(false);
                            return;
                        }
                    }
                }

                // Fetch request data using referenceid
                const requestRes = await fetch(`/api/activity/tsa/spf/fetch?spf_number=${encodeURIComponent(spf_number)}&referenceid=${referenceid}`);
                if (requestRes.ok) {
                    const requestJson = await requestRes.json();
                    if (requestJson.activities && requestJson.activities.length > 0) {
                        const spfData = requestJson.activities[0];
                        setRequestData(spfData);
                        setFormData(spfData);

                        const descs = (spfData.item_description || "").split(",").map((s: string) => s.trim());
                        const photos = (spfData.item_photo || "").split(",").map((s: string) => s.trim());
                        const qtys = (spfData.item_qty || "").split(",").map((s: string) => s.trim());
                        const maxLen = Math.max(descs.filter(Boolean).length, photos.filter(Boolean).length);
                        setItems(maxLen > 0 ? Array.from({ length: maxLen }, (_, i) => ({
                            item_description: descs[i] || "",
                            item_photo: photos[i] || "",
                            item_qty: qtys[i] || ""
                        })) : []);
                    }
                } else {
                    throw new Error("Failed to fetch request data");
                }
            } catch (err: any) {
                setError(err.message || "Failed to load data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [open, spf_number, isRevisionEligible, status]);

    useEffect(() => {
        if (!open) {
            setStep("select-type");
            setSelectedType(null);
            setRemarks("");
            setError(null);
            setFormStep(1);
            setFormData({});
            setItems([]);
        }
    }, [open]);

    const handleTypeSelect = (typeId: string) => {
        setSelectedType(typeId);
        setStep("edit-form");
    };

    const handleContinueToRemarks = () => {
        setStep("add-remarks");
    };

    const handleBack = () => {
        if (step === "edit-form") {
            if (formStep > 1) {
                setFormStep(formStep - 1);
            } else {
                setStep("select-type");
                setSelectedType(null);
            }
        } else if (step === "add-remarks") {
            setStep("edit-form");
        }
    };

    const handleFormNext = () => {
        if (formStep < STEPS.length) {
            setFormStep(formStep + 1);
        } else {
            handleContinueToRemarks();
        }
    };

    const handleSave = async () => {
        if (!spf_number || !selectedType) return;
        if (!isRevisionEligible) {
            setError(
                `This SPF cannot be revised right now. Current status is "${status}". ` +
                `Only SPFs with status "${REVISION_ELIGIBLE_STATUS}" are eligible for a revision request.`
            );
            return;
        }
        setSaving(true);
        try {
            const editedData = {
                ...formData,
                item_description: items.map((it) => it.item_description).join(","),
                item_photo: items.map((it) => it.item_photo).join(","),
                item_qty: items.map((it) => it.item_qty).join(","),
            };
            await onRequestRevision(spf_number, selectedType, remarks, editedData);
            onClose();
            setShowSuccessDialog(true);
        } catch (err: any) {
            setError(err.message || "Failed to request revision");
        } finally {
            setSaving(false);
        }
    };

    // ─── FIX: setField is stable via useCallback (no dependencies that change) ──
    // This ensures Step1Form and Step2Form don't re-render unnecessarily,
    // which would still cause focus loss even with extracted components.
    const setField = useCallback(
        (key: string, value: string) => setFormData((prev: any) => ({ ...prev, [key]: value })),
        []
    );

    const addItem = () => setItems((prev) => [...prev, { item_photo: "", item_description: "", item_qty: "" }]);
    const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
    const updateItemDesc = (i: number, val: string) =>
        setItems((prev) => { const next = [...prev]; next[i] = { ...next[i], item_description: val.replace(/,/g, "") }; return next; });
    const updateItemQty = (i: number, val: string) =>
        setItems((prev) => { const next = [...prev]; next[i] = { ...next[i], item_qty: val.replace(/,/g, "") }; return next; });

    const handleUpload = async (file: File, index: number) => {
        setUploadingIdx(index);
        try {
            const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true });
            const form = new FormData();
            form.append("file", compressed);
            form.append("upload_preset", "Xchire");
            form.append("folder", "spf_items");
            const res = await fetch("https://api.cloudinary.com/v1_1/dhczsyzcz/auto/upload", { method: "POST", body: form });
            if (!res.ok) throw new Error("Upload failed");
            const json = await res.json();
            if (!json.secure_url) throw new Error("No URL returned");
            setItems((prev) => { const next = [...prev]; next[index] = { ...next[index], item_photo: json.secure_url }; return next; });
        } catch (err) {
            console.error("Upload error:", err);
            alert("Failed to upload image. Please try again.");
        } finally {
            setUploadingIdx(null);
        }
    };

    // ─── isFieldEditable stays inside component (needs selectedType from state) ─

    const isFieldEditable = (fieldCategory: string) => {
        if (!selectedType) return false;
        if (fieldCategory === "items") return true;
        if (selectedType === "Both") return true;
        return false;
    };

    // ─── renderStep3 stays inside component (needs items, handlers, uploadingIdx) ─

    const renderStep3 = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <SectionLabel>Items</SectionLabel>
                <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600 hover:text-gray-900 transition-all border border-gray-300 px-3 py-2 hover:bg-gray-50"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-300 text-gray-400 gap-2 rounded-sm">
                        <ImageIcon className="w-8 h-8 opacity-40" />
                        <p className="text-sm">No items added yet</p>
                        <p className="text-xs text-gray-400">Click "Add Item" to get started</p>
                    </div>
                )}
                {items.map((row, i) => (
                    <div key={i} className="border border-gray-200 rounded-sm overflow-hidden hover:border-gray-300 transition-colors">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Item {i + 1}</span>
                            <button
                                type="button"
                                onClick={() => removeItem(i)}
                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-sm"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <Field label="Reference Photo" required>
                                <div>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        className="rounded-sm h-9 text-xs border-gray-300 file:mr-3 file:py-1 file:px-3 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file, i); e.target.value = ""; }}
                                        disabled={uploadingIdx === i || !isFieldEditable("items")}
                                    />
                                    {uploadingIdx === i && <div className="flex items-center gap-2 text-xs text-gray-500 mt-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading image…</div>}
                                    {row.item_photo && uploadingIdx !== i && (
                                        <div className="mt-3 flex items-center gap-3">
                                            <div className="border border-gray-200 rounded-sm p-1 bg-gray-50"><img src={row.item_photo} alt={`Item ${i + 1}`} className="w-24 h-24 object-contain" /></div>
                                            <button
                                                type="button"
                                                onClick={() => setItems((prev) => { const next = [...prev]; next[i] = { ...next[i], item_photo: "" }; return next; })}
                                                className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                                                disabled={!isFieldEditable("items")}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </Field>
                            <Field label="Item Quantity" required>
                                <Input
                                    type="number"
                                    className="rounded-sm h-9 text-sm border-gray-300 focus:border-gray-400 focus:ring-0"
                                    placeholder="Enter quantity..."
                                    value={row.item_qty}
                                    onChange={(e) => updateItemQty(i, e.target.value)}
                                    disabled={!isFieldEditable("items")}
                                />
                            </Field>
                            <Field label="Description" required>
                                <Textarea
                                    className="rounded-sm text-sm resize-none border-gray-300 focus:border-gray-400 focus:ring-0"
                                    placeholder="Describe the item in detail..."
                                    value={row.item_description}
                                    onChange={(e) => updateItemDesc(i, e.target.value)}
                                    rows={4}
                                    disabled={!isFieldEditable("items")}
                                />
                            </Field>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderProductItems = () => {
        if (!data) return null;

        const images = parseRowData(data?.product_offer_image || "");
        const qtys = parseRowData(data?.product_offer_qty || "");
        const specs = parseRowData(data?.product_offer_technical_specification || "");
        const unitCosts = parseRowData(data?.product_offer_unit_cost || "");
        const subtotals = parseRowData(data?.product_offer_subtotal || "");
        const packagings = parseRowData(data?.product_offer_packaging_details || "");
        const factoryAddresses = parseRowData(data?.product_offer_factory_address || "");
        const ports = parseRowData(data?.product_offer_port_of_discharge || "");
        const pcsPerCartons = parseRowData(data?.product_offer_pcs_per_carton || "");
        const companies = parseRowData(data?.company_name || "");
        const brands = parseRowData(data?.supplier_brand || "");
        const contactNames = parseRowData(data?.contact_name || "");
        const contactNumbers = parseRowData(data?.contact_number || "");
        const finalSellingCosts = parseRowData(data?.final_selling_cost || "");
        const finalUnitCosts = parseRowData(data?.final_unit_cost || "");
        const finalSubtotals = parseRowData(data?.final_subtotal || "");
        const leadTimes = parseRowData(data?.proj_lead_time || "");
        const itemCodes = parseRowData(data?.item_code || "");
        const priceValidities = parseRowData(data?.price_validity || "");
        const tdss = parseRowData(data?.tds || "");
        const dimDrawings = parseRowData(data?.dimensional_drawing || "");
        const illumDrawings = parseRowData(data?.illuminance_drawing || "");
        const origSpecs = parseRowData(data?.original_technical_specification || "");
        const prodRefIds = parseRowData(data?.product_reference_id || "");

        const itemCount = Math.max(
            images.length, qtys.length, specs.length, itemCodes.length,
            companies.length, brands.length
        ) || 1;

        return Array.from({ length: itemCount }, (_, i) => (
            <div key={i} className="border border-gray-200 p-3 mb-3 bg-gray-50/50">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2 pb-1 border-b border-gray-200">
                    Item {i + 1}
                </div>

                {images[i] && images[i] !== "-" && (
                    <div className="mb-3">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Product Image:</span>
                        <img
                            src={images[i]}
                            alt={`Product ${i + 1}`}
                            className="mt-1 max-w-[200px] max-h-[150px] object-contain border border-gray-200"
                        />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                    <DisplayField label="Item Code" value={itemCodes[i]} />
                    <DisplayField label="Qty" value={qtys[i]} />
                    <DisplayField label="Price Validity" value={priceValidities[i]} />
                    <DisplayField label="TDS" value={tdss[i]} />
                    <DisplayField label="Packaging" value={packagings[i]} />
                    <DisplayField label="Port of Discharge" value={ports[i]} />
                </div>

                {specs[i] && specs[i] !== "-" && (
                    <div className="mt-3 p-2 bg-white border border-gray-200">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Technical Specification:</span>
                        <pre className="text-[10px] text-gray-700 mt-1 whitespace-pre-wrap font-mono">
                            {specs[i].replace(/\|\|/g, "\n").replace(/;;/g, "\n  • ")}
                        </pre>
                    </div>
                )}

                {origSpecs[i] && origSpecs[i] !== "-" && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-100">
                        <span className="text-[10px] font-bold text-blue-600 uppercase">Original Tech Spec:</span>
                        <pre className="text-[10px] text-blue-800 mt-1 whitespace-pre-wrap font-mono">
                            {origSpecs[i].replace(/\|\|/g, "\n").replace(/;;/g, "\n  • ")}
                        </pre>
                    </div>
                )}

                {(dimDrawings[i] && dimDrawings[i] !== "-") || (illumDrawings[i] && illumDrawings[i] !== "-") ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {dimDrawings[i] && dimDrawings[i] !== "-" && (
                            <a href={dimDrawings[i]} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-600 hover:underline">
                                📐 Dimensional Drawing
                            </a>
                        )}
                        {illumDrawings[i] && illumDrawings[i] !== "-" && (
                            <a href={illumDrawings[i]} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-600 hover:underline">
                                💡 Illuminance Drawing
                            </a>
                        )}
                    </div>
                ) : null}

                {prodRefIds[i] && prodRefIds[i] !== "-" && (
                    <div className="mt-2 text-[10px] text-gray-500">
                        Product Ref ID: {prodRefIds[i]}
                    </div>
                )}
            </div>
        ));
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden rounded-none">
                <div className="bg-amber-600 px-5 py-4">
                    <DialogTitle className="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Request Revision
                    </DialogTitle>
                    <p className="text-amber-100 text-[11px] mt-0.5">
                        {spf_number ? `SPF: ${spf_number}` : ""}
                    </p>
                </div>

                <ScrollArea className="max-h-[60vh]">
                    <div className="px-5 py-4">
                        {loading && (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-5 h-5 animate-spin mr-2 text-gray-400" />
                                <span className="text-xs text-gray-500">Loading...</span>
                            </div>
                        )}

                        {!isRevisionEligible && !loading && (
                            <div className="flex flex-col items-center justify-center text-center py-14 gap-3">
                                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                                    <Lock className="w-5 h-5 text-red-500" />
                                </div>
                                <p className="text-xs font-black uppercase tracking-widest text-gray-800">
                                    Not Eligible for Revision
                                </p>
                                <p className="text-xs text-gray-500 max-w-sm">
                                    Current status is <span className="font-bold text-gray-700">"{status}"</span>.
                                    Revision requests are only available once an SPF's status is{" "}
                                    <span className="font-bold text-gray-700">"{REVISION_ELIGIBLE_STATUS}"</span>.
                                </p>
                            </div>
                        )}

                        {error && !loading && isRevisionEligible && (
                            <div className="bg-red-50 border border-red-200 p-4 rounded-none">
                                <p className="text-xs text-red-600">{error}</p>
                            </div>
                        )}

                        {/* STEP 1: Select Revision Typeas */}
                        {step === "select-type" && !loading && isRevisionEligible && !error && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <RefreshCw className="w-4 h-4 text-amber-600" />
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-800">
                                        Select Revision Type — {spf_number}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {revisionTypes.map((type) => (
                                        <div
                                            key={type.id}
                                            className={`flex items-center justify-between p-4 border-2 ${type.borderColor} ${type.bgColor} ${type.hoverBorder} transition-all cursor-pointer`}
                                            onClick={() => handleTypeSelect(type.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 ${type.iconBg} flex items-center justify-center shrink-0`}>
                                                    <type.icon className={`w-6 h-6 ${type.iconColor}`} />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-800">{type.title}</h4>
                                                    <p className="text-[11px] text-gray-500 mt-0.5">{type.description}</p>
                                                </div>
                                            </div>
                                            <button
                                                className={`px-4 py-2 text-xs font-bold text-white ${type.buttonBg} flex items-center gap-1`}
                                                onClick={() => handleTypeSelect(type.id)}
                                            >
                                                Select <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <p className="text-[10px] text-gray-400 mt-4">
                                    Choose the appropriate revision type based on what needs to be updated. This cannot be changed after selection.
                                </p>
                            </div>
                        )}

                        {/* STEP 2: Edit Form */}
                        {step === "edit-form" && !loading && isRevisionEligible && !error && requestData && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-gray-600" />
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-800">
                                            Edit SPF Request
                                        </span>
                                    </div>
                                    <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 font-semibold">
                                        {selectedType}
                                    </span>
                                </div>

                                {/* Stepper Header */}
                                <div className="bg-white border-b border-gray-200">
                                    <div className="flex items-center justify-between px-6 py-5">
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Edit SPF Request</h2>
                                            <p className="text-xs text-gray-500 font-mono mt-1">{spf_number}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {STEPS.map((s, idx) => (
                                                <React.Fragment key={s.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => idx < formStep && setFormStep(s.id)}
                                                        className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all ${formStep === s.id ? "bg-gray-900 text-white" : formStep > s.id ? "bg-emerald-500 text-white cursor-pointer" : "bg-gray-200 text-gray-600"}`}
                                                    >
                                                        {formStep > s.id ? <Check className="w-4 h-4" /> : s.id}
                                                    </button>
                                                    {idx < STEPS.length - 1 && <div className={`w-8 h-0.5 transition-colors ${formStep > s.id ? "bg-emerald-500" : "bg-gray-200"}`} />}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="px-6 py-2 bg-gray-50 border-t border-gray-100">
                                        <p className="text-sm font-semibold text-gray-700">Step {formStep} of {STEPS.length}: {STEPS[formStep - 1].name}</p>
                                    </div>
                                </div>

                                {/* Step Content */}
                                {/* FIX: Step1Form and Step2Form are now stable components, not inline functions */}
                                <div className="px-6 py-6 min-h-[400px] max-h-[calc(60vh-200px)] overflow-y-auto">
                                    {formStep === 1 && (
                                        <Step1Form
                                            formData={formData}
                                            setField={setField}
                                            editable={isFieldEditable("customer")}
                                        />
                                    )}
                                    {formStep === 2 && (
                                        <Step2Form
                                            formData={formData}
                                            setField={setField}
                                            editable={isFieldEditable("terms")}
                                        />
                                    )}
                                    {formStep === 3 && renderStep3()}
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Add Remarks */}
                        {step === "add-remarks" && !loading && isRevisionEligible && !error && requestData && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4 text-amber-600" />
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-800">
                                            Add Revision Remarks
                                        </span>
                                    </div>
                                    <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 font-semibold">
                                        {selectedType}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                        Remarks / Reason for Revision <span className="text-red-500">*</span>
                                    </label>
                                    <Textarea
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        placeholder="Enter detailed remarks about the revision request..."
                                        className="min-h-[120px] rounded-none text-xs resize-none"
                                    />
                                    <p className="text-[10px] text-gray-400">
                                        Please provide specific details about what needs to be revised.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!loading && isRevisionEligible && !error && !data && step !== "select-type" && (
                            <div className="text-center py-10 text-gray-400">
                                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">No creation data available</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="px-5 py-4 border-t border-gray-200 bg-gray-50">
                    <Button
                        variant="outline"
                        onClick={step === "select-type" ? onClose : handleBack}
                        disabled={saving}
                        className="rounded-none h-9 text-xs uppercase font-bold tracking-wider"
                    >
                        {step === "select-type" ? "Cancel" : step === "edit-form" && formStep > 1 ? "← Previous" : "Back"}
                    </Button>

                    {step === "edit-form" && isRevisionEligible && requestData && (
                        <Button
                            onClick={handleFormNext}
                            disabled={saving || uploadingIdx !== null}
                            className="rounded-none h-9 text-xs uppercase font-black tracking-wider bg-gray-900 hover:bg-gray-800 text-white"
                        >
                            {formStep < STEPS.length ? <>Next →</> : <>Continue <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></>}
                        </Button>
                    )}

                    {step === "add-remarks" && isRevisionEligible && (
                        <Button
                            onClick={handleSave}
                            disabled={saving || !remarks.trim()}
                            className="rounded-none h-9 text-xs uppercase font-black tracking-wider bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {saving ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Saving...</>
                            ) : (
                                <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Request Revision</>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Success Dialog */}
        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center">Revision Requested</DialogTitle>
                </DialogHeader>
                <div className="text-center py-6">
                    <RefreshCw className="w-12 h-12 mx-auto mb-4 text-amber-600" />
                    <p className="text-sm text-gray-700">
                        Revision is Being Processed by PD...
                    </p>
                </div>
                <DialogFooter className="justify-center">
                    <Button
                        onClick={() => {
                            setShowSuccessDialog(false);
                            onSuccessClose?.();
                        }}
                        className="rounded-none h-9 text-xs uppercase font-black tracking-wider bg-gray-900 hover:bg-gray-800 text-white"
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}