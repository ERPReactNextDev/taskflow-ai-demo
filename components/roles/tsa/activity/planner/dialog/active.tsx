"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertCircleIcon,
  PlusIcon,
  MinusIcon,
  CheckCircle2Icon,
  Loader2,
  XIcon,
  User,
  MapPin,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { sileo } from "sileo";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// ─── Constants ────────────────────────────────────────────────────────────────
const INDUSTRY_OPTIONS = [
  "Technology / Manufacturing / Telco / Data Center / Agriculture",
  "Healthcare / Education - Private",
  "Construction / Real Estate",
  "Energy / Mining",
  "Finance / Commercial / Hospitality / Retail",
  "Government / LGU",
  "Government / Infra",
  "End user",
  "Trading / Individual-Reseller / Dealer / Influencer",
  "Distributor",
  "Transportation"
] as const;

const TYPECLIENT_OPTIONS = [
  { value: "Top 50",     description: "Top 50 key accounts with highest revenue potential." },
  { value: "Next 30",    description: "Next tier of 30 accounts for growth development." },
  { value: "Balance 20", description: "Remaining 20 accounts in the portfolio." },
  { value: "TSA Client", description: "Account managed directly by a Territory Sales Associate." },
  { value: "New Client", description: "Client is new and receiving assistance for the first time." },
] as const;

const TOTAL_STEPS = 3;

const STEPS = [
  {
    label: "User Information",
    description: "Company & contact details",
    icon: User,
  },
  {
    label: "Address",
    description: "Location & delivery info",
    icon: MapPin,
  },
  {
    label: "Classification",
    description: "Type, industry & status",
    icon: Tag,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanCompanyName(name: string): string {
  if (!name) return "";
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\d+$/, "")
    .trim();
}

// Lightweight version for on-keypress — keeps trailing space so user can type next word
function sanitizeCompanyNameTyping(name: string): string {
  if (!name) return "";
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ""); // allow only letters, digits, spaces
}

function isValidEmail(email: string): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  if (["none", "n/a", "na"].includes(lower)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

function normalizePHNumber(number: string): string {
  if (!number) return "";
  let n = number.replace(/\D/g, "");
  if (n.startsWith("63")) n = "0" + n.slice(2);
  if (n.length === 10 && n.startsWith("9")) n = "0" + n;
  return n;
}

/** Format PH mobile → 0900-000-0000 (strict 11 digits) */
function formatPH(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
}

/** Format TIN → 000-000-000-000 */
function formatTIN(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Format landline → (02) 8123-4567 or (043) 123-4567 */
function formatLandline(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  const areaCodeLen = digits.startsWith("2") ? 2 : 3;
  if (digits.length <= areaCodeLen) return `(${digits}`;
  const areaCode = digits.slice(0, areaCodeLen);
  const rest = digits.slice(areaCodeLen);
  if (rest.length <= 4) return `(${areaCode}) ${rest}`;
  return `(${areaCode}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

/** Format international → +63 917 123 4567 */
function formatIntl(val: string): string {
  // Strip everything except digits and leading +
  let clean = val.replace(/[^0-9+]/g, "");
  if (clean.indexOf("+") > 0) clean = "+" + clean.replace(/\+/g, "");
  const digits = clean.replace(/\D/g, "");
  if (digits.length < 2) return clean;
  const country = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 0) return `+${country}`;
  if (rest.length <= 3) return `+${country} ${rest}`;
  if (rest.length <= 6) return `+${country} ${rest.slice(0, 3)} ${rest.slice(3)}`;
  if (rest.length <= 10) return `+${country} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  return `+${country} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 10)} ${rest.slice(10)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountFormData {
  id?: string;
  company_name: string;
  contact_person: string[];
  contact_number: string[];
  email_address: string[];
  address: string;
  region: string;
  status: string;
  delivery_address: string;
  type_client: string;
  industry: string;
  date_created?: string;
  company_group: string;
  tin_number?: string;
  reason: string;
}

interface Agent {
  referenceid: string;
  firstname: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
}

interface AccountDialogProps {
  mode: "create" | "edit";
  userDetails: UserDetails;
  initialData?: Partial<AccountFormData>;
  onSaveAction: (data: AccountFormData & UserDetails) => void;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

interface DuplicateCompany {
  company_name: string;
  owner_referenceid: string;
  owner_firstname?: string;
  contact_person: string[];
  contact_number: string[];
}

// ─── Default form values ──────────────────────────────────────────────────────
const DEFAULT_FORM: AccountFormData = {
  company_name: "",
  contact_person: [""],
  contact_number: [""],
  email_address: [""],
  address: "",
  region: "",
  status: "For Approval of TSM",
  delivery_address: "",
  type_client: "New Client",
  industry: "",
  company_group: "",
  tin_number: "",
  reason: "",
};

// ─── Component ────────────────────────────────────────────────────────────────
export function AccountDialog({
  mode,
  initialData,
  userDetails,
  onSaveAction,
  open,
  onOpenChangeAction,
}: AccountDialogProps) {

  const [formData, setFormData] = useState<AccountFormData>({
    ...DEFAULT_FORM,
    ...initialData,
  });

  const updateField = <K extends keyof AccountFormData>(
    key: K,
    value: AccountFormData[K],
  ) => setFormData((prev) => ({ ...prev, [key]: value }));

  const [step, setStep] = useState(0);


  const [regions, setRegions] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [companyError, setCompanyError] = useState("");
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCompany[]>([]);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [showAllDuplicates, setShowAllDuplicates] = useState(false);

  const [companySuggestions, setCompanySuggestions] = useState<DuplicateCompany[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const submitLock = useRef(false);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setFormData({ ...DEFAULT_FORM, ...initialData });
      setStep(0);
      setCompanyError("");
      setDuplicateInfo([]);
      setShowAllDuplicates(false);
      setCompanySuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  }, [open, initialData]);

  useEffect(() => {
    fetch("https://psgc.gitlab.io/api/regions")
      .then((res) => res.json())
      .then((data) => setRegions(data.map((r: any) => r.name)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch("/api/fetch-all-user-transfer")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch agents");
        return res.json();
      })
      .then((data) =>
        setAgents(
          data.map((a: any) => ({
            referenceid: a.ReferenceID,
            firstname: `${a.Firstname} ${a.Lastname}`.trim(),
          })),
        ),
      )
      .catch(console.error);
  }, [userDetails.referenceid]);



  useEffect(() => {
    if (mode === "edit") {
      setCompanyError("");
      setDuplicateInfo([]);
      setCompanySuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(() => {
      const name = (formData.company_name || "").trim();

      if (!name || name.length < 2) {
        setCompanyError(name.length > 0 ? "Company Name must be at least 3 characters." : "");
        setDuplicateInfo([]);
        setCompanySuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const cleaned = cleanCompanyName(name);
      if (["NONE", "OTHER"].includes(cleaned)) {
        setCompanyError("Company Name Invalid.");
        setDuplicateInfo([]);
        setCompanySuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsCheckingDuplicate(true);
      const controller = new AbortController();

      fetch(
        `/api/com-check-duplicate-account?company_name=${encodeURIComponent(cleaned)}`,
        { signal: controller.signal },
      )
        .then((res) => {
          if (!res.ok) throw new Error("Failed to check duplicates");
          return res.json() as Promise<{ exists: boolean; companies: DuplicateCompany[] }>;
        })
        .then(({ exists, companies }) => {
          const enriched = companies.map((company) => ({
            ...company,
            owner_firstname:
              agents.find((a) => a.referenceid === company.owner_referenceid)
                ?.firstname ?? company.owner_referenceid,
          }));

          if (exists && companies.length > 0) {
            setDuplicateInfo(enriched);
            setCompanySuggestions(enriched);
            setShowSuggestions(true);
          } else {
            setDuplicateInfo([]);
            setCompanySuggestions([]);
            setShowSuggestions(false);
          }
          setCompanyError("");
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setCompanyError("Failed to validate company name.");
            setDuplicateInfo([]);
            setCompanySuggestions([]);
            setShowSuggestions(false);
          }
        })
        .finally(() => setIsCheckingDuplicate(false));

      return () => controller.abort();
    }, 350);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [formData.company_name, mode, agents]);

  useEffect(() => {
    if (!duplicateInfo.length) {
      setCompanyError("");
      return;
    }

    const blocked = duplicateInfo.some((dup) => {
      const personMatch = (dup.contact_person || []).some((cp) =>
        formData.contact_person.some(
          (fcp) => (fcp || "").trim().toUpperCase() === (cp || "").trim().toUpperCase(),
        ),
      );
      const numberMatch = (dup.contact_number || []).some((cn) =>
        formData.contact_number.some(
          (fcn) => normalizePHNumber(fcn || "") === normalizePHNumber(cn || ""),
        ),
      );
      return personMatch || numberMatch;
    });

    if (blocked) {
      const dup = duplicateInfo.find((d) => {
        const personMatch = (d.contact_person || []).some((cp) =>
          formData.contact_person.some(
            (fcp) => (fcp || "").trim().toUpperCase() === (cp || "").trim().toUpperCase(),
          ),
        );
        const numberMatch = (d.contact_number || []).some((cn) =>
          formData.contact_number.some(
            (fcn) => normalizePHNumber(fcn || "") === normalizePHNumber(cn || ""),
          ),
        );
        return personMatch || numberMatch;
      });
      setCompanyError(
        `Duplicate contact person or number detected for company "${dup?.company_name}".`,
      );
    } else {
      setCompanyError("");
    }
  }, [formData.contact_person, formData.contact_number, duplicateInfo]);

  const canProceedToNext = (): boolean => {
    switch (step) {
      case 0:
        return (
          (formData.company_name || "").trim().length >= 3 &&
          formData.contact_person.length > 0 &&
          formData.contact_person.every((v) => (v || "").trim() !== "") &&
          formData.contact_number.length > 0 &&
          formData.contact_number.every((v) => (v || "").trim() !== "") &&
          !companyError &&
          formData.email_address.length > 0 &&
          formData.email_address.every((em) => (em || "").trim() !== "" && isValidEmail(em || ""))
        );
      case 1:
        return (
          (formData.address || "").trim() !== "" &&
          (formData.delivery_address?.length ?? 0) > 0 &&
          formData.region !== ""
        );
      case 2:
        return (
          formData.type_client !== "" &&
          formData.industry !== "" &&
          formData.status !== "" &&
          (formData.reason || "").trim() !== ""
        );
      default:
        return false;
    }
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep < step) {
      setStep(targetStep);
    } else if (targetStep === step + 1 && canProceedToNext()) {
      setStep(targetStep);
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1 && canProceedToNext()) setStep((s) => s + 1);
  };
  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;

    if (companyError) {
      sileo.error({
        title: "Failed",
        description: companyError,
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      submitLock.current = false;
      return;
    }

    for (const em of formData.email_address) {
      if (!isValidEmail(em || "")) {
        sileo.error({
          title: "Invalid Email",
          description: `Invalid email address: ${em}`,
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        submitLock.current = false;
        return;
      }
    }

    const cleanData = {
      ...formData,
      company_name: cleanCompanyName(formData.company_name || ""),
      contact_person: (formData.contact_person || []).map((v) => (v || "").trim()).filter(Boolean),
      contact_number: (formData.contact_number || []).map((v) => (v || "").trim()).filter(Boolean),
      email_address: (formData.email_address || []).map((v) => (v || "").trim()).filter(Boolean),
      address: (formData.address || "").toUpperCase(),
      delivery_address: (formData.delivery_address || "").toUpperCase(),
      referenceid: userDetails.referenceid,
      tsm: userDetails.tsm,
      manager: userDetails.manager,
      // status is always "For Approval" on both create and edit
      status: "For Approval of TSM",
    };

    try {
      await onSaveAction(cleanData);
      sileo.success({
        title: "Success",
        description: "Saved successfully!",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      onOpenChangeAction(false);
      setTimeout(() => {
        submitLock.current = false;
        window.location.reload();
      }, 500);
    } catch {
      sileo.error({
        title: "Failed",
        description: "Save failed. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      submitLock.current = false;
    }
  };

  // ── Step content ────────────────────────────────────────────────────────────
  const renderStepContent = () => {
    switch (step) {
      // ── Step 0: User Information ────────────────────────────────────────────
      case 0:
        return (
          <div className="space-y-6">
            {/* Company Name */}
            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">Company Name</FieldLabel>
                <FieldDescription className="text-xs">
                  Enter the official registered name of the company.
                </FieldDescription>
              </FieldContent>
              <div className="relative mt-1.5">
                <Input
                  ref={companyInputRef}
                  required
                  value={formData.company_name}
                  onChange={(e) => {
                    updateField("company_name", sanitizeCompanyNameTyping(e.target.value));
                    setActiveSuggestionIndex(-1);
                  }}
                  onFocus={() => {
                    if (companySuggestions.length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => {
                    updateField("company_name", cleanCompanyName(formData.company_name));
                    setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  onKeyDown={(e) => {
                    if (!showSuggestions || companySuggestions.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveSuggestionIndex((i) => Math.min(i + 1, companySuggestions.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveSuggestionIndex((i) => Math.max(i - 1, 0));
                    } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
                      e.preventDefault();
                      const selected = companySuggestions[activeSuggestionIndex];
                      updateField("company_name", selected.company_name);
                      setShowSuggestions(false);
                      setActiveSuggestionIndex(-1);
                    } else if (e.key === "Escape") {
                      setShowSuggestions(false);
                      setActiveSuggestionIndex(-1);
                    }
                  }}
                  placeholder="Company Name"
                  className="uppercase rounded-none"
                  autoComplete="off"
                />
                {showSuggestions && companySuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-y-auto"
                  >
                    {companySuggestions.map((s, idx) => (
                      <button
                        key={s.owner_referenceid + s.company_name}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-yellow-50 transition-colors ${idx === activeSuggestionIndex ? "bg-yellow-100" : ""}`}
                        onMouseDown={() => {
                          updateField("company_name", s.company_name);
                          setShowSuggestions(false);
                          setActiveSuggestionIndex(-1);
                        }}
                      >
                        <span className="font-medium uppercase truncate">{s.company_name}</span>
                        <span className="text-xs text-gray-400 shrink-0 capitalize">
                          {s.owner_firstname ?? s.owner_referenceid}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isCheckingDuplicate && (
                <Alert className="mt-2">
                  <Loader2 className="animate-spin" />
                  <AlertTitle>Checking duplicates...</AlertTitle>
                </Alert>
              )}

              {duplicateInfo.length > 0 && (
                <>
                  {(showAllDuplicates ? duplicateInfo : duplicateInfo.slice(0, 2)).map((dup) => (
                    <Alert
                      key={dup.owner_referenceid + dup.company_name}
                      variant={companyError ? "destructive" : "default"}
                      className={`mt-2 ${!companyError ? "bg-yellow-100 text-yellow-800" : ""}`}
                    >
                      <AlertCircleIcon className={`mr-2 h-5 w-5 ${companyError ? "text-red-500" : "text-yellow-500"}`} />
                      <div>
                        <AlertTitle className="font-bold">
                          {companyError ? companyError : "Already Taken By"}
                        </AlertTitle>
                        <AlertDescription className="flex items-center gap-2">
                          <strong className="text-[10px]">{dup.company_name}</strong>
                          <span>—</span>
                          <span className="capitalize text-[10px]">{dup.owner_firstname}</span>
                        </AlertDescription>
                      </div>
                    </Alert>
                  ))}
                  {duplicateInfo.length > 2 && (
                    <button
                      type="button"
                      className="mt-2 text-blue-600 hover:underline text-xs"
                      onClick={() => setShowAllDuplicates((p) => !p)}
                    >
                      {showAllDuplicates ? "View Less" : `View More (${duplicateInfo.length - 2} more)`}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* TIN Number */}
            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">TIN Number</FieldLabel>
                <FieldDescription className="text-xs">
                  Enter the Tax Identification Number (optional). Format: 000-000-000-000
                </FieldDescription>
              </FieldContent>
              <Input
                value={formData.tin_number || ""}
                onChange={(e) => {
                  updateField("tin_number", formatTIN(e.target.value));
                }}
                placeholder="000-000-000-000"
                className="rounded-none mt-1.5"
                maxLength={15}
                inputMode="numeric"
              />
            </div>

            {/* Contact Person(s) */}
            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">Contact Person(s)</FieldLabel>
                <FieldDescription className="text-xs">
                  Enter the full name(s) of the primary contact person(s).
                </FieldDescription>
              </FieldContent>
              <div className="mt-1.5 space-y-2">
                {formData.contact_person.map((val, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={val}
                      onChange={(e) => {
                        const copy = [...formData.contact_person];
                        copy[i] = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "");
                        updateField("contact_person", copy);
                      }}
                      onBlur={() => {
                        const copy = [...formData.contact_person];
                        copy[i] = copy[i].replace(/\s+/g, " ").trim();
                        updateField("contact_person", copy);
                      }}
                      placeholder="Contact Person"
                      className="uppercase rounded-none flex-1"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="rounded-none shrink-0"
                      disabled={formData.contact_person.length === 1}
                      onClick={() => {
                        const copy = [...formData.contact_person];
                        copy.splice(i, 1);
                        updateField("contact_person", copy);
                      }}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      className="rounded-none shrink-0"
                      onClick={() => updateField("contact_person", [...formData.contact_person, ""])}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Number(s) */}
            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">Contact Number(s)</FieldLabel>
                <FieldDescription className="text-xs">
                  Enter the phone number(s) of the primary contact person(s).
                </FieldDescription>
              </FieldContent>
              <div className="mt-1.5 space-y-3">
                {formData.contact_number.map((cn, i) => {
                  const isIntl = cn.startsWith("+");
                  const digits = cn.replace(/\D/g, "");
                  // Landline: starts with 0 but NOT 09; must have at least 2 digits
                  const isLandline = !isIntl && digits.startsWith("0") && !digits.startsWith("09") && digits.length >= 2;
                  const isMobile = !isIntl && !isLandline && !cn.startsWith("#");
                  const isCustom = cn.startsWith("#");

                  // Display value — always re-formatted from raw digits stored in state
                  let displayVal = cn;
                  if (isCustom) displayVal = cn.slice(1);
                  else if (isIntl) displayVal = formatIntl(cn);
                  else if (isLandline) displayVal = formatLandline(digits);
                  else displayVal = formatPH(digits);

                  // Validation flags
                  const mobileInvalid = isMobile && digits.length > 0 && digits.length !== 11;
                  const landlineInvalid = isLandline && digits.length > 0 && (digits.length < 9 || digits.length > 10);
                  const intlInvalid = isIntl && cn.replace(/\s+/g, "").length > 1 && !/^\+\d{7,15}$/.test(cn.replace(/\s+/g, ""));

                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Select
                          value={isCustom ? "custom" : isIntl ? "intl" : isLandline ? "landline" : "local"}
                          onValueChange={(v) => {
                            const copy = [...formData.contact_number];
                            const currentDigits = cn.replace(/\D/g, "");
                            if (v === "local") {
                              // Convert to mobile — seed with 09 if empty
                              const base = currentDigits.startsWith("63")
                                ? "0" + currentDigits.slice(2)
                                : currentDigits.startsWith("0") ? currentDigits : "09";
                              copy[i] = base.slice(0, 11);
                            } else if (v === "intl") {
                              copy[i] = currentDigits.startsWith("0")
                                ? `+63${currentDigits.slice(1)}`
                                : currentDigits.startsWith("63") ? "+" + currentDigits : "+63";
                            } else if (v === "landline") {
                              copy[i] = currentDigits.startsWith("09")
                                ? "02"
                                : currentDigits.startsWith("0")
                                ? currentDigits.slice(0, 10)
                                : "02";
                            } else if (v === "custom") {
                              copy[i] = "#" + (cn.startsWith("#") ? cn.slice(1) : cn);
                            }
                            updateField("contact_number", copy);
                          }}
                        >
                          <SelectTrigger className="w-[105px] rounded-none shrink-0 text-xs">
                            {isCustom ? "Custom" : isIntl ? "Intl" : isLandline ? "Landline" : "Phil"}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="local">Phil (Mobile)</SelectItem>
                            <SelectItem value="landline">Landline</SelectItem>
                            <SelectItem value="intl">International</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          value={displayVal}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const copy = [...formData.contact_number];
                            if (isCustom) {
                              copy[i] = "#" + raw;
                            } else if (isIntl) {
                              // Preserve + prefix; store as +digits
                              const digitsOnly = raw.replace(/\D/g, "");
                              copy[i] = "+" + digitsOnly;
                            } else {
                              // Store raw digits only for local/landline
                              copy[i] = raw.replace(/\D/g, "").slice(0, isLandline ? 10 : 11);
                            }
                            updateField("contact_number", copy);
                          }}
                          placeholder={
                            isCustom ? "Any format (e.g. ext. 123)"
                            : isIntl ? "+63 917 123 4567"
                            : isLandline ? "(02) 8123-4567"
                            : "0900-000-0000"
                          }
                          className={`rounded-none flex-1 ${mobileInvalid || landlineInvalid || intlInvalid ? "border-red-400" : ""}`}
                          inputMode={isCustom ? "text" : "numeric"}
                          maxLength={isCustom ? undefined : isIntl ? 20 : isLandline ? 14 : 13}
                        />

                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="rounded-none shrink-0"
                          disabled={formData.contact_number.length === 1}
                          onClick={() => {
                            const copy = [...formData.contact_number];
                            copy.splice(i, 1);
                            updateField("contact_number", copy);
                          }}
                        >
                          <MinusIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          className="rounded-none shrink-0"
                          onClick={() => updateField("contact_number", [...formData.contact_number, ""])}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </Button>
                      </div>

                      {mobileInvalid && (
                        <p className="text-red-500 text-xs">PH mobile numbers must be exactly 11 digits (e.g. 0917-123-4567).</p>
                      )}
                      {landlineInvalid && (
                        <p className="text-red-500 text-xs">Landline must be 9–10 digits including area code (e.g. (02) 8123-4567).</p>
                      )}
                      {intlInvalid && (
                        <p className="text-red-500 text-xs">Invalid international number. Format: +[country code] [number].</p>
                      )}
                      {isCustom && (
                        <p className="text-blue-500 text-xs">Custom format — no validation applied.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Email Address(es) */}
            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">Email Address(es)</FieldLabel>
                <FieldDescription className="text-xs">
                  Enter the email address(es) of the primary contact person(s).
                </FieldDescription>
              </FieldContent>
              <div className="mt-1.5 space-y-2">
                {formData.email_address.map((em, i) => {
                  const emailError = em && !isValidEmail(em) ? "Invalid email format" : "";
                  return (
                    <div key={i}>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          value={em}
                          onChange={(e) => {
                            const copy = [...formData.email_address];
                            copy[i] = e.target.value;
                            updateField("email_address", copy);
                          }}
                          placeholder="Email Address"
                          className={`rounded-none flex-1 ${emailError ? "border-red-500" : ""}`}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="rounded-none shrink-0"
                          disabled={formData.email_address.length === 1}
                          onClick={() => {
                            const copy = [...formData.email_address];
                            copy.splice(i, 1);
                            updateField("email_address", copy);
                          }}
                        >
                          <MinusIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          className="rounded-none shrink-0"
                          onClick={() => updateField("email_address", [...formData.email_address, ""])}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      // ── Step 1: Address ─────────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">Region</FieldLabel>
                <FieldDescription className="text-xs">Select the region for the company address.</FieldDescription>
              </FieldContent>
              <Select
                value={formData.region || ""}
                onValueChange={(val) => updateField("region", val)}
              >
                <SelectTrigger className="w-full rounded-none mt-1.5">
                  <span>{formData.region || "Select Region"}</span>
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">Address</FieldLabel>
                <FieldDescription className="text-xs">
                  Enter the complete physical address of the company.
                </FieldDescription>
              </FieldContent>
              <Textarea
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value.toUpperCase())}
                placeholder="ADDRESS"
                className="rounded-none mt-1.5 uppercase"
                rows={3}
              />
            </div>

            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">Delivery Address</FieldLabel>
                <FieldDescription className="text-xs">
                  Provide the full address where goods/services should be delivered.
                </FieldDescription>
              </FieldContent>
              <Textarea
                value={formData.delivery_address}
                onChange={(e) => updateField("delivery_address", e.target.value.toUpperCase())}
                placeholder="DELIVERY ADDRESS"
                className="rounded-none mt-1.5 uppercase"
                rows={3}
              />
            </div>
          </div>
        );

      // ── Step 2: Classification ──────────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-6">
            {/* Type Client */}
            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">Type Client</FieldLabel>
                <FieldDescription className="text-xs">Select the type of client for this company.</FieldDescription>
              </FieldContent>
              <div className="mt-1.5">
                <RadioGroup
                  value={formData.type_client}
                  onValueChange={(val) => updateField("type_client", val)}
                  className="grid grid-cols-2 gap-2"
                >
                  {TYPECLIENT_OPTIONS.map((tc) => (
                    <FieldLabel key={tc.value}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>{tc.value}</FieldTitle>
                          <FieldDescription>{tc.description}</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem value={tc.value} />
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </div>
            </div>

            {/* Industry */}
            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">Industry</FieldLabel>
                <FieldDescription className="text-xs">
                  Select the industry sector related to this company.
                </FieldDescription>
              </FieldContent>
              <div className="mt-1.5">
                <Select
                  value={formData.industry}
                  onValueChange={(val) => updateField("industry", val)}
                >
                  <SelectTrigger className="w-full rounded-none">
                    <span>{formData.industry || "Select Industry"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((ind) => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

              {/* Status — always "For Approval" on create, read-only indicator */}
            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">Status</FieldLabel>
                <FieldDescription className="text-xs">
                  New accounts are automatically set to <strong>For Approval</strong> and must be validated by an admin before activation.
                </FieldDescription>
              </FieldContent>
              <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-sm">
                <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-amber-700">For Approval of TSM (Territory Sales Manager)</span>
                <span className="text-[10px] text-amber-500 ml-auto">Pending admin review</span>
              </div>
            </div>

            {/* Reason */}
            <div>
              <FieldContent>
                <FieldLabel className="font-semibold text-sm">
                  Reason / Remarks <span className="text-red-500">*</span>
                </FieldLabel>
                <FieldDescription className="text-xs">
                  Provide the reason for {mode === "edit" ? "updating" : "creating"} this account. This is required.
                </FieldDescription>
              </FieldContent>
              <Textarea
                value={formData.reason}
                onChange={(e) => updateField("reason", e.target.value)}
                placeholder="Enter reason..."
                className={`rounded-none mt-1.5 ${(formData.reason || "").trim() === "" ? "border-red-300 focus-visible:ring-red-400" : ""}`}
                rows={4}
              />
              {(formData.reason || "").trim() === "" && (
                <p className="text-red-500 text-xs mt-1">Reason is required.</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-base font-bold leading-tight">
            {mode === "edit" ? "Edit Account" : "Create New Account"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {STEPS[step].description}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-none"
          onClick={() => onOpenChangeAction(false)}
        >
          <XIcon className="h-5 w-5" />
        </Button>
      </div>

      {/* ── Main body: left stepper + right form ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left stepper sidebar ── */}
        <div className="w-56 shrink-0 border-r bg-gray-50 flex flex-col py-6 px-4 gap-1">
          {STEPS.map((s, i) => {
            const isCompleted = i < step;
            const isCurrent = i === step;
            const isClickable = i < step || (i === step + 1 && canProceedToNext());
            const Icon = s.icon;

            return (
              <button
                key={i}
                type="button"
                disabled={!isClickable && !isCurrent && i > step}
                onClick={() => handleStepClick(i)}
                className={`
                  w-full text-left flex items-start gap-3 px-3 py-3 rounded-md transition-all
                  ${isCurrent
                    ? "bg-white border border-gray-200 shadow-sm"
                    : isCompleted
                      ? "hover:bg-white/70 cursor-pointer"
                      : isClickable
                        ? "hover:bg-white/70 cursor-pointer"
                        : "opacity-40 cursor-not-allowed"
                  }
                `}
              >
                <div
                  className={`
                    shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5
                    ${isCompleted
                      ? "bg-black text-white"
                      : isCurrent
                        ? "bg-black text-white"
                        : "bg-gray-200 text-gray-500"
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle2Icon className="h-4 w-4" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div>
                  <p className={`text-xs font-semibold leading-tight ${isCurrent ? "text-black" : isCompleted ? "text-gray-700" : "text-gray-400"}`}>
                    {s.label}
                  </p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${isCurrent ? "text-gray-500" : "text-gray-400"}`}>
                    {s.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Right: scrollable form ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full px-8 py-8">
            <div className="mb-6">
              <h2 className="text-sm font-bold text-gray-900">{STEPS[step].label}</h2>
              <div className="h-0.5 w-8 bg-black mt-1.5" />
            </div>
            {renderStepContent()}
          </div>
        </div>
      </div>

      {/* ── Navigation footer ── */}
      <div className="shrink-0 border-t px-6 py-4 bg-white">
        <div className="mx-auto w-full max-w-xl flex gap-3">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
            type="button"
            className="rounded-none flex-1 py-5 font-semibold text-sm"
          >
            Back
          </Button>

          {step === TOTAL_STEPS - 1 ? (
            <Button
              onClick={handleSubmit}
              type="button"
              disabled={!canProceedToNext()}
              className="rounded-none flex-1 py-5 font-semibold text-sm"
            >
              <CheckCircle2Icon className="h-4 w-4 mr-2" />
              {mode === "edit" ? "Save Changes" : "Create Account"}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceedToNext()}
              type="button"
              className="rounded-none flex-1 py-5 font-semibold text-sm"
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}