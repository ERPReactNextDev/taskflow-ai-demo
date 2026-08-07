"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { GlobalTopBar } from "@/components/global-top-bar";
import { HeadphonesIcon, Send, MessageSquare, BookOpen, AlertCircle, ChevronRight, Loader2, ChevronDown, RefreshCw, ArrowLeft, Paperclip, FileText, X } from "lucide-react";
import KB, { getKnowledge } from "@/components/support/knowledge-base";
import { supabase } from "@/utils/supabase";
import { QAViewer } from "@/components/support/qa-viewer";

const TICKET_SUBJECTS: Record<string, string[]> = {
  "Taskflow": [
    "Add/Request Item Code",
    "Update Item Code",
    "NO / Wrong Specs on Item Code",
    "Client Request for Transfer / Approval",
    "Client Request for Deletion / Inactive",
    "Client Duplication",
    "Client Not Assigned ID of TSM / Manager",
    "Client Wrong Company Name",
    "Client Missing / Not Found",
    "Account Creation",
    "Account Locked",
    "Reset Password / Unable to Login",
    "Unable to Access / Load",
    "Account Change Target Quota",
    "Account Request for Tag Resignation",
    "Account Request for Training Assistance",
    "Quotation Creation - Problem / Error / Page Break / Price not Tally / Wrong Computation",
    "Quotation Number Generation Error",
    "Quotation Approval / Pending Not Showing",
    "PDF Download Issue",
    "E-Signature Problem / Overlap",
    "Unable to Save / Delete / Edit Data / Bug",
    "Activity Duplication",
    "Activity Request for Deletion",
    "SO Amount not Showing",
    "Reports Not Tally",
    "CSR Endorsement Issue / Not Working",
    "Slow Loading / Glitch",
    "Domain IP Whitelist Request (OB TSA/TSM/Manager)",
    "Request / Remove Function",
  ],
  "Email": [
    "Unable / Not Working to Send Email",
    "Unable / Not Working to Received Email",
    "Unable / Not Working to Login",
    "Inbox not Showing",
    "Email Bounce Back",
    "Storage Full",
    "Request for Setup Assistance",
    "Request for Signature Setup / Update",
    "Sync to Mobile",
    "External Access Setup",
    "Account Creation for New Hire (Onboarding)",
    "Request for Reset Password",
    "Phishing / Spam Concern",
    "Restrict Resigned Employee Access",
    "IP Whitelist Request",
  ],
  "Network": [
    "No Internet Connection",
    "Internet Unstable / Slow",
    "Wifi Access Request",
    "Wifi Unable to Connect",
    "Router not Working",
    "ISP LOS Indicator",
    "LAN Cable Installation",
    "Network Device Reboot",
    "Internet Connection Restored",
  ],
  "Device Printer": [
    "Unable to Print",
    "Paper Jam",
    "Defective Feeder",
    "Ink Waste Pad Full",
    "Slow Printing",
    "Color / Alignment Issue",
    "Setup / Add to Device",
    "Asset Deployment",
    "Hardware Replacement",
  ],
  "Device Laptop": [
    "Lagging / Slow",
    "Hang / Freeze",
    "Overheat",
    "Configuration",
    "Deployment",
    "Retrieval",
    "Replacement Request",
    "Defective Charger",
  ],
  "Device Desktop": [
    "Unit no Power",
  ],
};

const CATEGORY_LABELS = Object.keys(TICKET_SUBJECTS);

type ChatStep =
  | "idle"
  | "ask_subject"
  | "show_qa"
  | "ask_name"
  | "ask_department"
  | "ask_mode"
  | "ask_group"
  | "ask_remarks"
  | "confirm"
  | "submitting"
  | "done";

type CenterMode = "chat" | "viewing";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
}

interface TicketDraft {
  ticket_subject: string;
  requestor_name: string;
  requestor_id:   string;
  department:     string;
  mode:           string;
  group_services: string;
  remarks:        string;
}

interface MyTicket {
  ticket_id: string;
  ticket_subject: string;
  status: string;
  date_created: string;
  technician_name?: string | null;
  processed_by?: string | null;
  unseen_count?: number;
}

interface ConversationMessage {
  id?: string | number;
  sender: "bot" | "user";
  message: string;
  date_created?: string | null;
  is_seen?: boolean;
  file_url?: string | null;
  file_type?: "image" | "pdf" | null;
  file_name?: string | null;
}

const FAQ_ITEMS = [
  { q: "How do I reset my password?",         category: "Account",    subject: "Reset Password / Unable to Login" },
  { q: "How do I add a new company account?", category: "Accounts",   subject: null },
  { q: "Why is my activity not syncing?",     category: "Activities", subject: "Slow Loading / Glitch" },
  { q: "How do I export reports?",            category: "Reports",    subject: null },
  { q: "How do I request an SPF?",            category: "SPF",        subject: null },
];

const QUICK_LINKS = [
  { label: "Account Management Guide",  icon: BookOpen,       subject: "Unable to Access / Load",   action: "guide_accounts"  },
  { label: "Activity Logging Tutorial", icon: BookOpen,       subject: "Activity Duplication",       action: "guide_activity"  },
  { label: "Report a Bug",              icon: AlertCircle,    subject: null,                         action: "report_bug"      },
  { label: "Request a Feature",         icon: MessageSquare,  subject: null,                         action: "request_feature" },
];

function botMsg(text: string, id?: string): Message {
  return { id: id ?? Date.now().toString() + Math.random(), sender: "bot", text };
}
function userMsg(text: string, id?: string): Message {
  return { id: id ?? Date.now().toString() + Math.random(), sender: "user", text };
}

const STEP_PROMPTS: Record<ChatStep, string> = {
  idle:            "",
  ask_subject:     "Please select the category and subject for your ticket:",
  show_qa:         "",
  ask_name:        "What is your name?",
  ask_department:  "What department are you from?",
  ask_mode:        "What mode is this ticket? (e.g. Incident, Request, Question)",
  ask_group:       "What group/service does this concern? (e.g. IT, HR, Billing)",
  ask_remarks:     "Any additional remarks or details? (type 'none' to skip)",
  confirm:         "",
  submitting:      "",
  done:            "",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Pending":  "bg-amber-100 text-amber-700 border-amber-200",
    "Open":     "bg-blue-100 text-blue-700 border-blue-200",
    "Resolved": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Closed":   "bg-gray-100 text-gray-500 border-gray-200",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span className={`inline-block text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${cls}`}>
      {status}
    </span>
  );
}

function SubjectPicker({ onSelect }: { onSelect: (subject: string) => void }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  return (
    <div className="w-full max-w-sm space-y-2">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 block mb-1">
          Category
        </label>
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 pr-8 focus:outline-none focus:border-indigo-400 cursor-pointer"
          >
            <option value="">— Select category —</option>
            {CATEGORY_LABELS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>
      {selectedCategory && (
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 block mb-1">
            Subject
          </label>
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
            {TICKET_SUBJECTS[selectedCategory].map((subject) => (
              <button
                key={subject}
                onClick={() => onSelect(`[${selectedCategory}] ${subject}`)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-700 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
              >
                {subject}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SupportContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const [messages, setMessages] = useState<Message[]>(() => {
    const m1 = botMsg("👋 Hi! I'm Taskflow Support. How can I help you today?");
    const m2 = botMsg("Click **Create a Ticket** to submit a support request, or browse the FAQ on the left.");
    return [m1, m2];
  });
  const [input, setInput]   = useState("");
  const [step, setStep]     = useState<ChatStep>("idle");
  const [draft, setDraft]   = useState<TicketDraft>({
    ticket_subject: "", requestor_name: "", requestor_id: "",
    department: "Sales", mode: "Request", group_services: "System and Website Services", remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [qaEntry, setQaEntry] = useState<ReturnType<typeof getKnowledge>>(null);
  const [userName, setUserName] = useState<string>("");
  const [referenceId, setReferenceId] = useState<string>("");
  const [myTickets, setMyTickets] = useState<MyTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [centerMode, setCenterMode] = useState<CenterMode>("chat");
  const [viewingTicket, setViewingTicket] = useState<MyTicket | null>(null);
  const [viewingConversation, setViewingConversation] = useState<ConversationMessage[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingMessages = useRef<Set<string>>(new Set());
  const sessionId = useRef<string>(`session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const bottomRef = useRef<HTMLDivElement>(null);
  const convBottomRef = useRef<HTMLDivElement>(null);
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);

  // Init notification sound
  useEffect(() => {
    notifAudioRef.current = new Audio("/musics/notif-sound.mp3");
    notifAudioRef.current.volume = 0.6;
  }, []);

  const playNotif = () => {
    try { notifAudioRef.current?.play(); } catch {}
  };

  // Realtime: listen for new bot messages across all user tickets → badge + sound
  useEffect(() => {
    if (!myTickets.length) return;
    const ticketIds = myTickets.map((t) => t.ticket_id);

    const channel = supabase
      .channel("user_ticket_notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "ticket_conversations",
      }, (payload) => {
        const msg = payload.new as ConversationMessage & { ticket_id: string };
        if (!msg || msg.sender === "user") return;
        if (!ticketIds.includes(msg.ticket_id)) return;

        // Only notify if not currently viewing that ticket
        const isViewingThisTicket =
          centerMode === "viewing" && viewingTicket?.ticket_id === msg.ticket_id;

        if (!isViewingThisTicket) {
          // Bump unseen_count on the ticket card
          setMyTickets((prev) =>
            prev.map((t) =>
              t.ticket_id === msg.ticket_id
                ? { ...t, unseen_count: (t.unseen_count ?? 0) + 1 }
                : t
            )
          );
          playNotif();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTickets.map((t) => t.ticket_id).join(","), centerMode, viewingTicket?.ticket_id]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        const full = `${data.Firstname ?? ""} ${data.Lastname ?? ""}`.trim();
        if (full) {
          setUserName(full);
          const refId = data.ReferenceID ?? userId;
          setReferenceId(refId);
          setDraft((d) => ({ ...d, requestor_name: full, requestor_id: refId }));
        }
      })
      .catch(() => {});
  }, [userId]);

  const fetchMyTickets = async () => {
    if (!referenceId) return;
    setLoadingTickets(true);
    try {
      const res = await fetch(`/api/support/my-tickets?requestor_id=${encodeURIComponent(referenceId)}`);
      const data = await res.json();
      setMyTickets(res.ok && Array.isArray(data.tickets) ? data.tickets : []);
    } catch {
      setMyTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    fetchMyTickets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceId]);

  const openTicket = async (ticket: MyTicket) => {
    setViewingTicket(ticket);
    setCenterMode("viewing");
    setLoadingConversation(true);
    setViewingConversation([]);
    try {
      const res = await fetch(`/api/support/ticket-conversation?ticket_id=${encodeURIComponent(ticket.ticket_id)}`);
      const data = await res.json();
      if (res.ok) {
        if (data.ticket) setViewingTicket((prev) => prev ? { ...prev, ...data.ticket } : data.ticket);
        setViewingConversation(Array.isArray(data.conversations) ? data.conversations : []);
      } else {
        setViewingConversation([]);
      }
    } catch {
      setViewingConversation([]);
    } finally {
      setLoadingConversation(false);
    }

    // Mark all bot messages as seen for this ticket
    fetch("/api/support/mark-seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket_id: ticket.ticket_id }),
    }).catch(() => {});

    // Clear local unseen badge
    setMyTickets((prev) =>
      prev.map((t) =>
        t.ticket_id === ticket.ticket_id ? { ...t, unseen_count: 0 } : t
      )
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      setAttachPreview(URL.createObjectURL(file));
    } else {
      setAttachPreview(null);
    }
    // reset input so same file can be re-selected
    e.target.value = "";
  };

  const clearAttachment = () => {
    if (attachPreview) URL.revokeObjectURL(attachPreview);
    setAttachedFile(null);
    setAttachPreview(null);
  };

  const sendReply = async () => {
    const text = replyInput.trim();
    if ((!text && !attachedFile) || !viewingTicket) return;
    setReplyInput("");

    const fileToUpload = attachedFile;
    clearAttachment();

    const tempId = `temp-${Date.now()}`;

    // Optimistic: add message immediately with text only
    const tempMsg: ConversationMessage = {
      id: tempId,
      sender: "user",
      message: text,
      date_created: new Date().toISOString(),
      file_url: null,
      file_type: null,
      file_name: null,
    };
    setViewingConversation((prev) => [...prev, tempMsg]);
    if (text) pendingMessages.current.add(text);

    let file_url: string | null = null;
    let file_type: "image" | "pdf" | null = null;
    let file_name: string | null = null;

    if (fileToUpload) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", fileToUpload);
        const res = await fetch("/api/cloudinary/upload-ticket", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        file_url  = data.url;
        file_type = data.fileType;
        file_name = data.fileName;

        // Update the optimistic message with the uploaded file
        setViewingConversation((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, file_url, file_type, file_name }
              : m
          )
        );
      } catch {
        // keep the text message even if upload fails
      } finally {
        setUploading(false);
      }
    }

    fetch("/api/support/save-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticket_id: viewingTicket.ticket_id,
        sender: "user",
        message: text,
        file_url,
        file_type,
        file_name,
      }),
    }).catch(() => {});
  };

  const saveMessage = (ticket_id: string, sender: "bot" | "user", message: string) => {
    fetch("/api/support/save-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket_id, sender, message }),
    }).catch(() => {});
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step, submitting]);

  useEffect(() => {
    convBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [viewingConversation]);

  useEffect(() => {
    if (centerMode !== "viewing" || !viewingTicket?.ticket_id) return;
    const channel = supabase
      .channel(`ticket_conv:${viewingTicket.ticket_id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "ticket_conversations",
        filter: `ticket_id=eq.${viewingTicket.ticket_id}`,
      }, (payload) => {
        const newMsg = payload.new as ConversationMessage & { ticket_id?: string };
        if (!newMsg) return;
        setViewingConversation((prev) => {
          // Already have this DB row
          if (newMsg.id && prev.some((m) => m.id === newMsg.id)) return prev;

          // Replace matching optimistic user message (dedup by text)
          if (newMsg.sender === "user" && newMsg.message && pendingMessages.current.has(newMsg.message)) {
            pendingMessages.current.delete(newMsg.message);
            return prev
              .filter((m) => !(typeof m.id === "string" && m.id.startsWith("temp-") && m.message === newMsg.message))
              .concat(newMsg);
          }

          // If it's a realtime message that matches an optimistic entry by tempId pattern — replace it
          // (covers file-only messages where message is empty)
          if (newMsg.sender === "user") {
            const tempMatch = prev.find(
              (m) =>
                typeof m.id === "string" &&
                m.id.startsWith("temp-") &&
                m.message === (newMsg.message ?? "") &&
                !m.file_url && newMsg.file_url
            );
            if (tempMatch) {
              return prev
                .filter((m) => m.id !== tempMatch.id)
                .concat(newMsg);
            }
          }

          return [...prev, newMsg];
        });

        // If it's a new non-user message while viewing, mark it seen immediately
        if (newMsg.sender !== "user") {
          fetch("/api/support/mark-seen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket_id: viewingTicket.ticket_id }),
          }).catch(() => {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [centerMode, viewingTicket?.ticket_id]);

  const addBot = (text: string) => {
    setMessages((prev) => [...prev, botMsg(text)]);
    saveMessage(sessionId.current, "bot", text);
  };
  const addUser = (text: string) => {
    setMessages((prev) => [...prev, userMsg(text)]);
    saveMessage(sessionId.current, "user", text);
  };

  const startTicket = () => {
    setStep("ask_subject");
    addBot(STEP_PROMPTS["ask_subject"]);
  };

  const handleSubjectSelect = (subject: string) => {
    addUser(subject);
    setDraft((d) => ({ ...d, ticket_subject: subject }));
    const entry = getKnowledge(subject);
    if (entry) {
      setQaEntry(entry);
      setStep("show_qa");
      addBot("Here are some steps and answers that may help with your issue:");
    } else {
      setStep("ask_remarks");
      setTimeout(() => addBot(STEP_PROMPTS["ask_remarks"]), 300);
    }
  };

  const handleQaHelpful = () => {
    setStep("done");
    setQaEntry(null);
    addBot("Great! Glad that helped. 👍 No ticket needed. Feel free to come back anytime you need help.");
  };

  const handleQaNeedAssistance = () => {
    setQaEntry(null);
    setStep("ask_remarks");
    addBot("Got it. Let's create a support ticket. " + STEP_PROMPTS["ask_remarks"]);
  };

  const handleFAQClick = (faqItem: typeof FAQ_ITEMS[number]) => {
    setCenterMode("chat");
    addUser(faqItem.q);
    if (faqItem.subject) {
      const entry = getKnowledge(faqItem.subject);
      if (entry) {
        setDraft((d) => ({ ...d, ticket_subject: faqItem.subject! }));
        setQaEntry(entry);
        setStep("show_qa");
        addBot("Here are some steps and answers that may help with your question:");
        return;
      }
    }
    addBot("For this question, please create a support ticket so our team can assist you directly.");
  };

  const handleQuickLink = (link: typeof QUICK_LINKS[number]) => {
    setCenterMode("chat");
    if (link.action === "report_bug") {
      addUser("I want to report a bug.");
      addBot("To report a bug, please create a ticket. Click **Create a Ticket** and select the relevant subject from the Taskflow category.");
      return;
    }
    if (link.action === "request_feature") {
      addUser("I want to request a feature.");
      addBot("To request a feature, please create a support ticket. Click **Create a Ticket** and describe what you need in the remarks.");
      return;
    }
    if (link.subject) {
      const entry = getKnowledge(link.subject);
      if (entry) {
        addUser(link.label);
        setDraft((d) => ({ ...d, ticket_subject: link.subject! }));
        setQaEntry(entry);
        setStep("show_qa");
        addBot(`Here is the guide for **${link.label}**:`);
        return;
      }
    }
    addUser(link.label);
    addBot(`For **${link.label}**, please create a support ticket so our team can assist you.`);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || step === "idle" || step === "ask_subject" || step === "submitting" || step === "done") return;
    setInput("");
    addUser(text);

    switch (step) {
      case "ask_remarks": {
        const remarks = text.toLowerCase() === "none" ? "" : text;
        const finalDraft = { ...draft, remarks };
        setDraft(finalDraft);
        setStep("confirm");
        setTimeout(() => {
          addBot(
            `Here's a summary of your ticket:\n\n` +
            `📋 **Subject:** ${finalDraft.ticket_subject}\n` +
            `👤 **Name:** ${finalDraft.requestor_name}\n` +
            `🏢 **Department:** ${finalDraft.department}\n` +
            `🔖 **Mode:** ${finalDraft.mode}\n` +
            `🛠 **Group/Service:** ${finalDraft.group_services}\n` +
            (finalDraft.remarks ? `📝 **Remarks:** ${finalDraft.remarks}\n` : "") +
            `\nType **yes** to submit, or **no** to cancel.`
          );
        }, 300);
        break;
      }
      case "confirm": {
        if (text.toLowerCase() === "yes") {
          setStep("submitting");
          setSubmitting(true);
          addBot("Submitting your ticket…");
          try {
            const res = await fetch("/api/support/create-ticket", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...draft, session_id: sessionId.current }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error ?? "Failed to submit");
            if (data.ticket?.ticket_id) sessionId.current = data.ticket.ticket_id;
            setStep("done");
            addBot(
              `✅ Your ticket has been submitted!\n\n` +
              `**Ticket ID:** ${data.ticket?.ticket_id ?? "—"}\n` +
              `Our team will get back to you shortly. Thank you!`
            );
            fetchMyTickets();
          } catch (err: unknown) {
            setStep("confirm");
            addBot(`❌ Failed to submit: ${err instanceof Error ? err.message : "Unknown error"}. Please try again or type **yes** to retry.`);
          } finally {
            setSubmitting(false);
          }
        } else {
          setStep("idle");
          addBot("Ticket submission cancelled. Feel free to start a new ticket anytime.");
        }
        break;
      }
    }
  };

  const canSend = input.trim().length > 0
    && step !== "idle"
    && step !== "ask_subject"
    && step !== "show_qa"
    && step !== "submitting"
    && step !== "done";

  const renderText = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part.split("\n").map((line, j) => (
            <span key={`${i}-${j}`}>{line}{j < part.split("\n").length - 1 && <br />}</span>
          ))
    );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    } catch { return dateStr; }
  };

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset>
        <GlobalTopBar title="Support" />

        {/* ── ROOT 3-col container: fixed height, no overflow ── */}
        <div className="flex overflow-hidden" style={{ height: "calc(100vh - 3.5rem)" }}>

          {/* ── LEFT PANEL: fixed width, independent scroll ── */}
          <div className="w-[720px] shrink-0 border-r bg-slate-50 overflow-y-auto">
            <div className="grid grid-cols-2 divide-x divide-slate-200">

              {/* FAQ */}
              <div className="p-4 space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">FAQ</p>
                {FAQ_ITEMS.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleFAQClick(item)}
                    className="w-full text-left group rounded-lg px-3 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold text-slate-700 group-hover:text-indigo-700 leading-snug">{item.q}</p>
                      <ChevronRight size={12} className="text-slate-300 group-hover:text-indigo-400 shrink-0 mt-0.5" />
                    </div>
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {item.category}
                    </span>
                  </button>
                ))}
              </div>

              {/* Quick Links + CTA + My Tickets */}
              <div className="p-4 space-y-6">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Quick Links</p>
                  <div className="space-y-1.5">
                    {QUICK_LINKS.map((link, i) => {
                      const Icon = link.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => handleQuickLink(link)}
                          className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
                        >
                          <Icon size={13} className="text-slate-400 group-hover:text-indigo-500 shrink-0" />
                          <span className="text-[11px] font-semibold text-slate-600 group-hover:text-indigo-700">{link.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Support</p>
                  <button
                    onClick={startTicket}
                    disabled={step !== "idle" && step !== "done"}
                    className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-sm shadow-indigo-200"
                  >
                    <HeadphonesIcon size={15} className="shrink-0" />
                    <div className="text-left">
                      <p className="text-[11px] font-black uppercase tracking-wide">Create a Ticket</p>
                      <p className="text-[9px] text-indigo-200 mt-0.5">Start a support conversation</p>
                    </div>
                  </button>
                </div>

                {/* My Tickets */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">My Tickets</p>
                    <button
                      onClick={fetchMyTickets}
                      disabled={loadingTickets || !referenceId}
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Refresh tickets"
                    >
                      <RefreshCw size={11} className={loadingTickets ? "animate-spin" : ""} />
                    </button>
                  </div>
                  {!referenceId ? (
                    <p className="text-[10px] text-slate-400 text-center py-3">Loading user info…</p>
                  ) : loadingTickets ? (
                    <div className="flex items-center justify-center py-4 gap-2">
                      <Loader2 size={13} className="animate-spin text-indigo-400" />
                      <span className="text-[10px] text-slate-400">Loading tickets…</span>
                    </div>
                  ) : myTickets.length === 0 ? (
                    <div className="text-center py-4">
                      <MessageSquare size={20} className="text-slate-200 mx-auto mb-1" />
                      <p className="text-[10px] text-slate-400">No tickets yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {myTickets.map((ticket) => (
                        <button
                          key={ticket.ticket_id}
                          onClick={() => openTicket(ticket)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg bg-white border transition-all group ${
                            (ticket.unseen_count ?? 0) > 0
                              ? "border-indigo-300 ring-1 ring-indigo-200 shadow-sm"
                              : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono font-bold text-[10px] text-indigo-600 group-hover:text-indigo-700 shrink-0">
                                {ticket.ticket_id}
                              </span>
                              {(ticket.unseen_count ?? 0) > 0 && (
                                <span className="inline-flex items-center justify-center bg-red-500 text-white text-[8px] font-black rounded-full w-4 h-4 leading-none shrink-0 animate-pulse">
                                  {ticket.unseen_count}
                                </span>
                              )}
                            </div>
                            <StatusBadge status={ticket.status} />
                          </div>
                          <p className={`text-[10px] truncate leading-snug ${
                            (ticket.unseen_count ?? 0) > 0 ? "text-slate-800 font-semibold" : "text-slate-600 group-hover:text-slate-800"
                          }`}>
                            {ticket.ticket_subject}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5">{formatDate(ticket.date_created)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── CENTER PANEL: flex-col, never overflows parent ── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">

            {centerMode === "viewing" && viewingTicket ? (
              <>
                {/* Viewer header — always visible, never scrolls */}
                <div className="shrink-0 border-b px-6 py-4 flex items-center gap-3">
                  <button
                    onClick={() => { setCenterMode("chat"); setViewingTicket(null); setViewingConversation([]); setReplyInput(""); }}
                    className="flex items-center gap-1.5 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                  >
                    <ArrowLeft size={13} />
                    Back to chat
                  </button>
                  <Separator orientation="vertical" className="h-5 mx-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-indigo-600">{viewingTicket.ticket_id}</span>
                      <StatusBadge status={viewingTicket.status} />
                      <span className="text-[10px] text-slate-400">{formatDate(viewingTicket.date_created)}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate mt-0.5">{viewingTicket.ticket_subject}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wide">Technician:</span>
                      <span className="text-[10px] font-semibold text-slate-700">{viewingTicket.technician_name ?? "Unassigned"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wide">Processed by:</span>
                      <span className="text-[10px] font-semibold text-slate-700">{viewingTicket.processed_by ?? "Unassigned"}</span>
                    </div>
                  </div>
                </div>

                {/* Messages — only this scrolls */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
                  {loadingConversation ? (
                    <div className="flex items-center justify-center h-full gap-2">
                      <Loader2 size={16} className="animate-spin text-indigo-400" />
                      <span className="text-sm text-slate-400">Loading conversation…</span>
                    </div>
                  ) : viewingConversation.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
                      <MessageSquare size={32} />
                      <p className="text-sm">No messages found for this ticket.</p>
                    </div>
                  ) : (
                    viewingConversation.map((msg, i) => (
                      <div key={msg.id ?? i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.sender === "bot" && (
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                            <HeadphonesIcon size={12} className="text-indigo-600" />
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5 max-w-[70%]">
                          {/* Image attachment */}
                          {msg.file_url && msg.file_url.length > 0 && (msg.file_type === "image" || (msg.file_type as string)?.startsWith("image/")) && (
                            <div className={`rounded-xl overflow-hidden border ${msg.sender === "user" ? "border-indigo-400" : "border-slate-200"}`}>
                              <img
                                src={msg.file_url}
                                alt={msg.file_name ?? "attachment"}
                                className="max-w-full max-h-60 object-cover w-full cursor-pointer"
                                onClick={() => window.open(msg.file_url!, "_blank")}
                              />
                              <a
                                href={`/api/support/download-file?url=${encodeURIComponent(msg.file_url!)}&name=${encodeURIComponent(msg.file_name ?? "image")}`}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border-t transition-colors ${
                                  msg.sender === "user"
                                    ? "border-indigo-400 bg-indigo-500 text-white hover:bg-indigo-400"
                                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                <span className="truncate max-w-[160px]">{msg.file_name ?? "Download image"}</span>
                              </a>
                            </div>
                          )}
                          {/* PDF attachment */}
                          {msg.file_url && msg.file_url.length > 0 && (msg.file_type === "pdf" || (msg.file_type as string) === "application/pdf") && (
                            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
                              msg.sender === "user"
                                ? "bg-indigo-500 border-indigo-400"
                                : "bg-white border-slate-200"
                            }`}>
                              <FileText size={16} className={`shrink-0 ${msg.sender === "user" ? "text-white" : "text-red-500"}`} />
                              <span className={`text-[11px] font-semibold truncate flex-1 max-w-[160px] ${msg.sender === "user" ? "text-white" : "text-slate-700"}`}>
                                {msg.file_name ?? "attachment.pdf"}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <a
                                  href={msg.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-colors ${
                                    msg.sender === "user"
                                      ? "bg-white/20 hover:bg-white/30 text-white"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  View
                                </a>
                                <a
                                  href={`/api/support/download-file?url=${encodeURIComponent(msg.file_url!)}&name=${encodeURIComponent(msg.file_name ?? "attachment.pdf")}`}
                                  className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-colors ${
                                    msg.sender === "user"
                                      ? "bg-white/20 hover:bg-white/30 text-white"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  ↓
                                </a>
                              </div>
                            </div>
                          )}
                          {/* Text message */}
                          {msg.message && (
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                              msg.sender === "user"
                                ? "bg-indigo-600 text-white rounded-br-sm"
                                : "bg-slate-100 text-slate-800 rounded-bl-sm"
                            }`}>
                              {msg.message}
                            </div>
                          )}
                          {msg.date_created && (
                            <p className={`text-[9px] font-mono ${msg.sender === "user" ? "text-right text-indigo-300" : "text-left text-slate-400"}`}>
                              {new Date(msg.date_created).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={convBottomRef} />
                </div>

                {/* Reply input — always visible, never scrolls */}
                <div className="shrink-0 border-t px-6 py-4">
                  {viewingTicket?.status === "Resolved" ? (
                    <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-50 border border-emerald-100">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <p className="text-[11px] text-emerald-700 font-semibold">
                        This ticket has been resolved. Messaging is disabled.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* File preview strip */}
                      {attachedFile && (
                    <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                      {attachPreview ? (
                        <img src={attachPreview} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                          <FileText size={16} className="text-red-500" />
                        </div>
                      )}
                      <span className="text-[11px] text-slate-600 font-medium truncate flex-1">{attachedFile.name}</span>
                      <button onClick={clearAttachment} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    {/* Attach button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-9 h-9 rounded-full flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-40 shrink-0"
                      title="Attach image or PDF"
                    >
                      <Paperclip size={14} />
                    </button>
                    <Input
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
                      placeholder="Type a message for this ticket..."
                      disabled={uploading}
                      className="flex-1 rounded-full border-slate-200 bg-slate-50 focus:bg-white text-sm px-4"
                    />
                    <Button
                      onClick={sendReply}
                      disabled={(!replyInput.trim() && !attachedFile) || uploading}
                      size="icon"
                      className="rounded-full w-9 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 shrink-0"
                    >
                      {uploading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    </Button>
                  </div>
                  <p className="text-[9px] text-slate-400 text-center mt-2">
                    Press Enter to send · Attach images or PDFs
                  </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Chat header — always visible, never scrolls */}
                <div className="shrink-0 border-b px-6 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                    <HeadphonesIcon size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Taskflow Support</p>
                    <p className="text-[10px] text-slate-400">We usually reply within a few hours</p>
                  </div>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>

                {/* Messages — only this scrolls */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.sender === "bot" && (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                          <HeadphonesIcon size={12} className="text-indigo-600" />
                        </div>
                      )}
                      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.sender === "user"
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-slate-100 text-slate-800 rounded-bl-sm"
                      }`}>
                        {renderText(msg.text)}
                      </div>
                    </div>
                  ))}

                  {step === "show_qa" && qaEntry && (
                    <div className="flex justify-start">
                      <div className="w-7 h-7 shrink-0 mr-2 mt-0.5" />
                      <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 w-full max-w-lg">
                        <QAViewer
                          subject={draft.ticket_subject}
                          entry={qaEntry}
                          onHelpful={handleQaHelpful}
                          onNeedAssistance={handleQaNeedAssistance}
                        />
                      </div>
                    </div>
                  )}

                  {step === "ask_subject" && (
                    <div className="flex justify-start">
                      <div className="w-7 h-7 shrink-0 mr-2 mt-0.5" />
                      <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 max-w-sm w-full">
                        <SubjectPicker onSelect={handleSubjectSelect} />
                      </div>
                    </div>
                  )}

                  {submitting && (
                    <div className="flex justify-start">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                        <HeadphonesIcon size={12} className="text-indigo-600" />
                      </div>
                      <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-slate-100 flex items-center gap-2">
                        <Loader2 size={13} className="animate-spin text-indigo-500" />
                        <span className="text-sm text-slate-500">Submitting…</span>
                      </div>
                    </div>
                  )}

                  {step === "done" && (
                    <div className="flex justify-start pl-9">
                      <button
                        onClick={() => {
                          setStep("idle");
                          setDraft({ ticket_subject: "", requestor_name: userName, requestor_id: referenceId, department: "Sales", mode: "Request", group_services: "System and Website Services", remarks: "" });
                          sessionId.current = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                          addBot("Ready for another ticket. Click **Create a Ticket** whenever you need help.");
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                      >
                        Submit another ticket
                      </button>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>

                {/* Input bar — always visible, never scrolls */}
                <div className="shrink-0 border-t px-6 py-4">
                  {step === "idle" || step === "done" || step === "ask_subject" || step === "show_qa" ? (
                    <div className="flex items-center justify-center gap-2 py-1">
                      <MessageSquare size={13} className="text-slate-300" />
                      <p className="text-[11px] text-slate-400">
                        {step === "ask_subject"
                          ? "Select a subject from the picker above."
                          : step === "show_qa"
                          ? "Click \"Yes, Helpful\" or \"Need Assistance\" above."
                          : step === "idle"
                          ? "Click \"Create a Ticket\" on the left to get started."
                          : "Ticket submitted. Start a new one anytime."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Input
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                          placeholder="Type your answer..."
                          disabled={submitting}
                          className="flex-1 rounded-full border-slate-200 bg-slate-50 focus:bg-white text-sm px-4"
                          autoFocus
                        />
                        <Button
                          onClick={handleSend}
                          disabled={!canSend || submitting}
                          size="icon"
                          className="rounded-full w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 shrink-0"
                        >
                          <Send size={14} />
                        </Button>
                      </div>
                      <p className="text-[9px] text-slate-400 text-center mt-2">Press Enter to send</p>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

export default function SupportPage() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div />}>
            <SupportContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}