"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { useUser } from "@/contexts/UserContext";
import { dbCollab } from "@/lib/firebase";
import { collection, onSnapshot, QuerySnapshot, DocumentData } from "firebase/firestore";
import { sileo } from "sileo";

// Extend Window interface for global test function
declare global {
  interface Window {
    testGlobalNotification?: () => void;
  }
}

/** Raw `spf_creation.status` values that map to actionable badges on the requests list. */
const CREATION_NOTIFICATION_STATUSES = new Set([
  "pending for procurement",
  "approved by procurement",
  "for revision",
]);

function normalizeCreationStatusForCompare(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isCreationNotificationStatus(status: unknown): boolean {
  return CREATION_NOTIFICATION_STATUSES.has(normalizeCreationStatusForCompare(status));
}

interface QuotationNotification {
  id: string;
  quotationNumber: string;
  companyName: string;
  activityReferenceNumber: string;
  tsm: string;
  dateCreated: string;
}

interface NotificationContextValue {
  unreadCount: number;
  unreadChatCount: number;
  markSPFRequestAsRead: (spfNumber: string) => void;
  isSPFRequestUnread: (spfNumber: string) => boolean;
  getSPFRequestUnreadCount: (spfNumber: string) => number;
  clearNotifications: () => void;
  // Chat message notification functions
  markChatAsRead: (requestId: string) => void;
  isChatUnread: (requestId: string) => boolean;
  getChatUnreadCount: (requestId: string) => number;
  updateChatUnreadCount: (requestId: string, count: number) => void;
  // Quotation notification functions
  showQuotationNotification: (quotation: QuotationNotification) => void;
  testQuotationNotification: () => void; // Manual test function
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  unreadChatCount: 0,
  markSPFRequestAsRead: () => {},
  isSPFRequestUnread: () => false,
  getSPFRequestUnreadCount: () => 0,
  clearNotifications: () => {},
  markChatAsRead: () => {},
  isChatUnread: () => false,
  getChatUnreadCount: () => 0,
  updateChatUnreadCount: () => {},
  showQuotationNotification: () => {},
  testQuotationNotification: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
      console.log("🔔 NotificationProvider: Initializing with userId:", userId);
      console.log("🔔 NotificationProvider: Current path:", pathname);
      console.log("🔔 NotificationProvider: Is TSA page:", pathname?.includes('/roles/tsa/'));
    }
  }, [isClient, userId, pathname]);
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const quotationAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const readSPFRef = useRef<Map<string, string>>(new Map());
  const unreadSPFRef = useRef<Set<string>>(new Set());
  const latestSignatureRef = useRef<Map<string, string>>(new Map());
  const knownSignatureRef = useRef<Map<string, string>>(new Map());
  const unreadCountMapRef = useRef<Map<string, number>>(new Map());
  const latestCreationStatusRef = useRef<Map<string, string>>(new Map());
  const lastSeenCreationRef = useRef<Map<string, string>>(new Map());

  // ─── Chat notification state ─────────────────────────────────────────────────
  // Source of truth: Firebase seenBy array per message.
  // Persisted to localStorage so it survives page refreshes/restarts.
  // Cleared only when the user actually opens the chat dialog (markChatAsRead).
  const chatUnreadMapRef = useRef<Map<string, number>>(new Map());
  const firebaseUnsubscribeRef = useRef<(() => void) | null>(null);
  const chatNotifSoundRef = useRef<HTMLAudioElement | null>(null);
  // Track the last known message count per chat to detect genuinely NEW messages
  const chatLastMsgCountRef = useRef<Map<string, number>>(new Map());

  const getStorageKey = useCallback((uid: string) => `spf-notif-read-map:${uid}`, []);
  const getInitKey = useCallback((uid: string) => `spf-notif-init:${uid}`, []);
  const getLegacyStorageKey = useCallback((uid: string) => `spf-notif-read:${uid}`, []);
  const getKnownSignatureKey = useCallback((uid: string) => `spf-notif-known-map:${uid}`, []);
  const getUnreadCountKey = useCallback((uid: string) => `spf-notif-unread-count-map:${uid}`, []);
  const getLastSeenCreationKey = useCallback((uid: string) => `spf-notif-last-seen-creation:${uid}`, []);

  // ── Chat localStorage keys ───────────────────────────────────────────────────
  // Key format: chat-unread-v2:{userId}
  // Stores a plain object: { [docId]: unreadCount }
  // "v2" to avoid conflicts with the old key schema
  const getChatUnreadKey = useCallback((uid: string) => `chat-unread-v2:${uid}`, []);

  // ── Clear stale notification storage to free up quota ───────────────────────
  const clearNotificationStorage = useCallback((uid: string) => {
    try {
      // Remove all notification-related keys for this user
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith("spf-notif-") ||
          key.startsWith("chat-unread-") ||
          key.startsWith("tsm-kpi-") ||
          key.startsWith("tsm-agent-performance-") ||
          key.startsWith("manager-kpi-") ||
          key.startsWith("manager-agent-performance-") ||
          key.startsWith("tsa-kpi-")
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      console.warn(`clearNotificationStorage: removed ${keysToRemove.length} stale keys for uid=${uid}`);
    } catch {}
  }, []);

  const normalizeSPFNumber = useCallback((value: unknown) => {    if (typeof value !== "string") return "";
    return value.trim().replace(/\s+/g, "").toUpperCase();
  }, []);

  const persistReadMap = useCallback((uid: string, map: Map<string, string>) => {
    const payload = Object.fromEntries(map.entries());
    try {
      localStorage.setItem(getStorageKey(uid), JSON.stringify(payload));
    } catch (e) {
      console.warn("persistReadMap: localStorage quota exceeded, clearing stale notification keys");
      clearNotificationStorage(uid);
      try { localStorage.setItem(getStorageKey(uid), JSON.stringify(payload)); } catch {}
    }
  }, [getStorageKey]);

  const persistKnownSignatureMap = useCallback((uid: string, map: Map<string, string>) => {
    const payload = Object.fromEntries(map.entries());
    try {
      localStorage.setItem(getKnownSignatureKey(uid), JSON.stringify(payload));
    } catch (e) {
      console.warn("persistKnownSignatureMap: localStorage quota exceeded, clearing stale notification keys");
      clearNotificationStorage(uid);
      try { localStorage.setItem(getKnownSignatureKey(uid), JSON.stringify(payload)); } catch {}
    }
  }, [getKnownSignatureKey]);

  const persistUnreadCountMap = useCallback((uid: string, map: Map<string, number>) => {
    const payload = Object.fromEntries(map.entries());
    try {
      localStorage.setItem(getUnreadCountKey(uid), JSON.stringify(payload));
    } catch (e) {
      console.warn("persistUnreadCountMap: localStorage quota exceeded, clearing stale notification keys");
      clearNotificationStorage(uid);
      try { localStorage.setItem(getUnreadCountKey(uid), JSON.stringify(payload)); } catch {}
    }
  }, [getUnreadCountKey]);

  const persistLastSeenCreationMap = useCallback((uid: string, map: Map<string, string>) => {
    const payload = Object.fromEntries(map.entries());
    try {
      localStorage.setItem(getLastSeenCreationKey(uid), JSON.stringify(payload));
    } catch (e) {
      console.warn("persistLastSeenCreationMap: localStorage quota exceeded, clearing stale notification keys");
      clearNotificationStorage(uid);
      try { localStorage.setItem(getLastSeenCreationKey(uid), JSON.stringify(payload)); } catch {}
    }
  }, [getLastSeenCreationKey]);

  // ── Persist chat unread map to localStorage ──────────────────────────────────
  const persistChatUnreadMap = useCallback((uid: string, map: Map<string, number>) => {
    try {
      const payload: Record<string, number> = {};
      map.forEach((count, docId) => {
        if (count > 0) payload[docId] = count;
      });
      localStorage.setItem(getChatUnreadKey(uid), JSON.stringify(payload));
    } catch (e) {
      console.error("Failed to persist chat unread map:", e);
    }
  }, [getChatUnreadKey]);

  // ── Recalculate total chat unread and update state ───────────────────────────
  const recalcChatUnreadTotal = useCallback(() => {
    let total = 0;
    chatUnreadMapRef.current.forEach((count) => { total += count; });
    setUnreadChatCount(total);
  }, []);

  const applyEffectiveUnreadAggregates = useCallback(() => {
    const unreadSet = new Set<string>();
    let total = 0;
    latestSignatureRef.current.forEach((_, spf) => {
      const delta = unreadCountMapRef.current.get(spf) ?? 0;
      const creation = latestCreationStatusRef.current.get(spf) ?? "";
      const lastSeen = lastSeenCreationRef.current.get(spf);
      const alertUnread =
        isCreationNotificationStatus(creation) &&
        normalizeCreationStatusForCompare(creation) !== normalizeCreationStatusForCompare(lastSeen);
      const effective = Math.max(delta, alertUnread ? 1 : 0);
      if (effective > 0) {
        unreadSet.add(spf);
        total += effective;
      }
    });
    unreadSPFRef.current = unreadSet;
    setUnreadCount(total);
  }, []);

  const playNotificationSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    audio.currentTime = 0;
    void audio.play().catch(() => {});
    stopTimerRef.current = window.setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      stopTimerRef.current = null;
    }, 5000);
  }, []);

  const playQuotationNotificationSound = useCallback(() => {
    if (!isClient) return;
    console.log("🔔 GLOBAL playQuotationNotificationSound: CALLED");
    console.log("🔔 GLOBAL playQuotationNotificationSound: Page:", pathname);
    
    const audio = quotationAudioRef.current;
    if (!audio) {
      console.log("🔔 GLOBAL playQuotationNotificationSound: ❌ No audio element found");
      console.log("🔔 GLOBAL playQuotationNotificationSound: Creating new audio element...");
      try {
        const newAudio = new Audio("/quotation-req.mp3");
        newAudio.preload = "auto";
        newAudio.currentTime = 0;
        newAudio.play().then(() => {
          console.log("🔔 GLOBAL playQuotationNotificationSound: ✅ New audio played successfully");
        }).catch((error) => {
          console.log("🔔 GLOBAL playQuotationNotificationSound: ❌ New audio play failed:", error);
        });
      } catch (error) {
        console.log("🔔 GLOBAL playQuotationNotificationSound: ❌ Failed to create audio:", error);
      }
      return;
    }
    
    console.log("🔔 GLOBAL playQuotationNotificationSound: ✅ Audio element found");
    console.log("🔔 GLOBAL playQuotationNotificationSound: Audio src:", audio.src);
    console.log("🔔 GLOBAL playQuotationNotificationSound: Audio readyState:", audio.readyState);
    
    audio.currentTime = 0;
    void audio.play().then(() => {
      console.log("🔔 GLOBAL playQuotationNotificationSound: ✅ Audio played successfully");
    }).catch((error) => {
      console.log("🔔 GLOBAL playQuotationNotificationSound: ❌ Audio play failed:", error);
      
      // Try with user interaction fallback
      console.log("🔔 GLOBAL playQuotationNotificationSound: Trying user interaction fallback...");
      document.addEventListener('click', function playAudioFallback() {
        audio.currentTime = 0;
        audio.play().then(() => {
          console.log("🔔 GLOBAL playQuotationNotificationSound: ✅ Audio played with user interaction");
        }).catch((e) => {
          console.log("🔔 GLOBAL playQuotationNotificationSound: ❌ Still failed with user interaction:", e);
        });
        document.removeEventListener('click', playAudioFallback);
      }, { once: true });
      
      console.log("🔔 GLOBAL playQuotationNotificationSound: Click anywhere to test audio with user interaction");
    });
  }, [isClient, pathname]);

  const showQuotationNotification = useCallback((quotation: QuotationNotification) => {
    if (!isClient) return;
    console.log("🔔 GLOBAL showQuotationNotification: 🚨 CALLED with:", quotation);
    console.log("🔔 GLOBAL showQuotationNotification: 🚨 Page:", pathname);
    console.log("🔔 GLOBAL showQuotationNotification: 🚨 Timestamp:", new Date().toISOString());
    console.log("🔔 GLOBAL showQuotationNotification: 🚨 Document ready:", document.readyState);
    console.log("🔔 GLOBAL showQuotationNotification: 🚨 Body available:", !!document.body);
    
    try {
      // Play the quotation notification sound
      console.log("🔔 GLOBAL showQuotationNotification: 🚨 STEP 1: Playing sound...");
      playQuotationNotificationSound();
      console.log("🔔 GLOBAL showQuotationNotification: 🚨 STEP 1: Sound function called");
      
      // Show toast notification
      console.log("🔔 GLOBAL showQuotationNotification: 🚨 STEP 2: Checking toast options...");
      console.log("🔔 GLOBAL showQuotationNotification: 🚨 Sileo available:", typeof sileo);
      console.log("🔔 GLOBAL showQuotationNotification: 🚨 Sileo.success available:", !!(sileo && sileo.success));
      
      if (sileo && sileo.success) {
        console.log("🔔 GLOBAL showQuotationNotification: 🚨 STEP 2A: Using sileo toast");
        sileo.success({
          title: "📋 New Quotation Request",
          description: `${quotation.companyName} - ${quotation.quotationNumber}`,
          duration: 8000,
          fill: "white",
          styles: { 
            title: "text-blue-600!", 
            description: "text-gray-700 font-medium" 
          },
        });
        console.log("🔔 GLOBAL showQuotationNotification: 🚨 ✅ Sileo toast displayed successfully");
      } else {
        console.log("🔔 GLOBAL showQuotationNotification: 🚨 STEP 2B: Using manual toast fallback");
        // Fallback: create manual toast
        console.log("🔔 GLOBAL showQuotationNotification: 🚨 Creating manual toast element...");
        const toast = document.createElement('div');
        toast.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: white;
          color: #1e293b;
          padding: 15px 20px;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          z-index: 9999;
          min-width: 300px;
          transform: translateX(400px);
          transition: transform 0.3s ease;
          border-left: 4px solid #2563eb;
        `;
        toast.innerHTML = `
          <div style="color: #2563eb; font-weight: bold; margin-bottom: 5px;">📋 New Quotation Request</div>
          <div style="color: #374151; font-weight: 500;">${quotation.companyName} - ${quotation.quotationNumber}</div>
          <div style="color: #64748b; font-size: 12px; margin-top: 5px;">Global Notification</div>
        `;
        
        console.log("🔔 GLOBAL showQuotationNotification: 🚨 Appending toast to body...");
        document.body.appendChild(toast);
        console.log("🔔 GLOBAL showQuotationNotification: 🚨 Toast appended to DOM");
        
        setTimeout(() => {
          console.log("🔔 GLOBAL showQuotationNotification: 🚨 Showing toast with animation...");
          toast.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
          console.log("🔔 GLOBAL showQuotationNotification: 🚨 Hiding toast...");
          toast.style.transform = 'translateX(400px)';
          setTimeout(() => {
            if (document.body.contains(toast)) {
              document.body.removeChild(toast);
              console.log("🔔 GLOBAL showQuotationNotification: 🚨 Toast removed from DOM");
            }
          }, 300);
        }, 8000);
        
        console.log("🔔 GLOBAL showQuotationNotification: 🚨 ✅ Manual toast displayed");
      }
      
      console.log("🔔 GLOBAL showQuotationNotification: 🚨 ✅ Notification process completed successfully");
    } catch (error) {
      console.log("🔔 GLOBAL showQuotationNotification: 🚨 ❌ ERROR:", error);
      console.log("🔔 GLOBAL showQuotationNotification: 🚨 ❌ Error stack:", error instanceof Error ? error.stack : 'No stack available');
    }
  }, [playQuotationNotificationSound]);

  // ─── SPF request notification logic (Supabase) ───────────────────────────────
  useEffect(() => {
    if (!userId) {
      unreadSPFRef.current = new Set();
      readSPFRef.current = new Map();
      latestSignatureRef.current = new Map();
      knownSignatureRef.current = new Map();
      unreadCountMapRef.current = new Map();
      latestCreationStatusRef.current = new Map();
      lastSeenCreationRef.current = new Map();
      queueMicrotask(() => setUnreadCount(0));
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio("/alert-notification.mp3");
      audioRef.current.preload = "auto";
    }
    if (!quotationAudioRef.current) {
      quotationAudioRef.current = new Audio("/quotation-req.mp3");
      quotationAudioRef.current.preload = "auto";
      console.log("🔔 Using quotation-req.mp3 for TSM quotation notifications");
    }
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    let cancelled = false;

    const syncUnreadState = async () => {
      const { data: requestData } = await supabase
        .from("spf_request")
        .select("spf_number, status")
        .not("spf_number", "is", null);
      const { data: creationData } = await supabase
        .from("spf_creation")
        .select("id, spf_number, status, date_created, date_updated, product_offer_image, product_offer_qty, product_offer_unit_cost, product_offer_technical_specification, supplier_brand, price_validity, tds")
        .not("spf_number", "is", null);

      if (cancelled) return;

      const requestRows = (requestData ?? []).reduce<Array<{ spf_number: string; status: string | null }>>(
        (acc, row) => {
          const spfNumber = normalizeSPFNumber(row?.spf_number);
          if (!spfNumber) return acc;
          acc.push({ spf_number: spfNumber, status: typeof row?.status === "string" ? row.status : null });
          return acc;
        }, []
      );
      const currentSPF = new Set(requestRows.map((row) => row.spf_number).filter((spf): spf is string => !!spf));

      const lastSeenKey = getLastSeenCreationKey(userId);
      const rawLastSeenCreation = localStorage.getItem(lastSeenKey);
      const lastSeenMap = new Map<string, string>();
      if (rawLastSeenCreation) {
        try {
          const parsed = JSON.parse(rawLastSeenCreation);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            Object.entries(parsed).forEach(([spf, v]) => {
              const n = normalizeSPFNumber(spf);
              if (n && typeof v === "string") lastSeenMap.set(n, v);
            });
          }
        } catch { /* ignore */ }
      }
      const staleLastSeenSpf: string[] = [];
      lastSeenMap.forEach((_, spf) => { if (!currentSPF.has(spf)) staleLastSeenSpf.push(spf); });
      staleLastSeenSpf.forEach((spf) => lastSeenMap.delete(spf));
      lastSeenCreationRef.current = lastSeenMap;

      const creationSnapshotMap = new Map<string, { status: string; version: number; contentFingerprint: string }>();
      const creationVersionMap = new Map<string, number>();
      (creationData ?? []).forEach((row) => {
        const spf = normalizeSPFNumber(row?.spf_number);
        if (!spf) return;
        const dateUpdatedMs = typeof row?.date_updated === "string" ? new Date(row.date_updated).getTime() : NaN;
        const dateCreatedMs = typeof row?.date_created === "string" ? new Date(row.date_created).getTime() : NaN;
        const idMs = typeof row?.id === "number" ? row.id : NaN;
        const versionPoint = Number.isFinite(dateUpdatedMs) ? dateUpdatedMs : Number.isFinite(dateCreatedMs) ? dateCreatedMs : Number.isFinite(idMs) ? idMs : 0;
        if (versionPoint < (creationVersionMap.get(spf) ?? -Infinity)) return;
        creationVersionMap.set(spf, versionPoint);
        const creationStatus = typeof row?.status === "string" ? row.status : "unknown";
        const contentFingerprint = [
          creationStatus,
          typeof row?.product_offer_image === "string" ? row.product_offer_image.slice(0, 100) : "",
          typeof row?.product_offer_qty === "string" ? row.product_offer_qty : "",
          typeof row?.product_offer_unit_cost === "string" ? row.product_offer_unit_cost : "",
          typeof row?.supplier_brand === "string" ? row.supplier_brand : "",
          typeof row?.price_validity === "string" ? row.price_validity : "",
          typeof row?.tds === "string" ? row.tds : "",
        ].join("|~|");
        creationSnapshotMap.set(spf, { status: creationStatus, version: versionPoint, contentFingerprint });
      });

      const currentSignatureMap = new Map<string, string>();
      requestRows.forEach((row) => {
        const requestStatus = typeof row.status === "string" ? row.status : "unknown";
        const creationSnapshot = creationSnapshotMap.get(row.spf_number);
        const normalizedCreationStatus = creationSnapshot ? creationSnapshot.status.trim().toLowerCase() : "__none__";
        const creationVersion = creationSnapshot ? String(creationSnapshot.version) : "__none__";
        const creationFingerprint = creationSnapshot?.contentFingerprint ?? "__none__";
        currentSignatureMap.set(
          row.spf_number,
          `request:${requestStatus.trim().toLowerCase()}|creation:${normalizedCreationStatus}|creation_v:${creationVersion}|has_creation:${creationSnapshot ? "1" : "0"}|content:${creationFingerprint}`
        );
      });
      latestSignatureRef.current = currentSignatureMap;

      const creationStatusBySpf = new Map<string, string>();
      requestRows.forEach((row) => {
        const snap = creationSnapshotMap.get(row.spf_number);
        creationStatusBySpf.set(row.spf_number, snap ? snap.status : "");
      });
      latestCreationStatusRef.current = creationStatusBySpf;

      const storageKey = getStorageKey(userId);
      const initKey = getInitKey(userId);
      const legacyKey = getLegacyStorageKey(userId);
      const knownKey = getKnownSignatureKey(userId);
      const unreadCountKey = getUnreadCountKey(userId);
      const initialized = localStorage.getItem(initKey) === "1";
      const parsedReadMap = (() => { try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; } })();
      const parsedLegacy = (() => { try { return JSON.parse(localStorage.getItem(legacyKey) || "[]"); } catch { return []; } })();
      const parsedKnownSignatureMap = (() => { try { return JSON.parse(localStorage.getItem(knownKey) || "{}"); } catch { return {}; } })();
      const parsedUnreadCountMap = (() => { try { return JSON.parse(localStorage.getItem(unreadCountKey) || "{}"); } catch { return {}; } })();

      const readMap = new Map<string, string>();
      const knownMap = new Map<string, string>();
      const unreadCountMap = new Map<string, number>();
      if (parsedReadMap && typeof parsedReadMap === "object") {
        Object.entries(parsedReadMap).forEach(([spf, sig]) => { const n = normalizeSPFNumber(spf); if (n && typeof sig === "string") readMap.set(n, sig); });
      }
      if (parsedKnownSignatureMap && typeof parsedKnownSignatureMap === "object") {
        Object.entries(parsedKnownSignatureMap).forEach(([spf, sig]) => { const n = normalizeSPFNumber(spf); if (n && typeof sig === "string") knownMap.set(n, sig); });
      }
      if (parsedUnreadCountMap && typeof parsedUnreadCountMap === "object") {
        Object.entries(parsedUnreadCountMap).forEach(([spf, count]) => { const n = normalizeSPFNumber(spf); if (n && typeof count === "number" && count > 0) unreadCountMap.set(n, count); });
      }
      if (Array.isArray(parsedLegacy)) {
        parsedLegacy.forEach((spf) => { const n = normalizeSPFNumber(spf); if (!n) return; const sig = currentSignatureMap.get(n); if (sig) readMap.set(n, sig); });
      }

      if (!initialized) {
        currentSignatureMap.forEach((sig, spf) => { readMap.set(spf, sig); knownMap.set(spf, sig); });
        unreadCountMap.clear();
        localStorage.setItem(initKey, "1");
      }

      const activeReadMap = new Map<string, string>();
      const activeUnreadCountMap = new Map<string, number>();
      const activeKnownMap = new Map<string, string>();
      currentSPF.forEach((spf) => {
        const currentSignature = currentSignatureMap.get(spf);
        if (!currentSignature) return;
        activeKnownMap.set(spf, currentSignature);
        const signature = readMap.get(spf);
        if (typeof signature === "string") activeReadMap.set(spf, signature);
        if (!initialized) return;
        const previousKnownSignature = knownMap.get(spf);
        const readSignature = activeReadMap.get(spf);
        const previousUnreadCount = unreadCountMap.get(spf) ?? 0;
        if (!previousKnownSignature) {
          if (readSignature !== currentSignature) activeUnreadCountMap.set(spf, Math.max(1, previousUnreadCount));
          return;
        }
        if (previousKnownSignature !== currentSignature) {
          if (readSignature !== currentSignature) activeUnreadCountMap.set(spf, Math.max(1, previousUnreadCount + 1));
          return;
        }
        if (readSignature !== currentSignature) activeUnreadCountMap.set(spf, Math.max(1, previousUnreadCount));
      });
      readSPFRef.current = activeReadMap;
      knownSignatureRef.current = activeKnownMap;
      unreadCountMapRef.current = activeUnreadCountMap;

      applyEffectiveUnreadAggregates();
      persistReadMap(userId, activeReadMap);
      persistKnownSignatureMap(userId, activeKnownMap);
      persistUnreadCountMap(userId, activeUnreadCountMap);
    };

    void syncUnreadState();

    const channel = supabase
      .channel("spf_request_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "spf_request" }, () => { void syncUnreadState(); playNotificationSound(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "spf_creation" }, () => { void syncUnreadState(); playNotificationSound(); })
      .subscribe();
    channelRef.current = channel;

    // TSA subscription for TSM quotation approvals/declines
    if (isClient) {
      console.log("🔔 TSA SUBSCRIPTION: Setting up TSA subscription for TSM quotation approvals/declines");
      console.log("🔔 TSA SUBSCRIPTION: User ID:", userId);
      console.log("🔔 TSA SUBSCRIPTION: Current path:", pathname);
    }
    
    const tsmQuotationChannel = supabase
      .channel("tsm_quotation_approval_changes")
      .on("postgres_changes", { 
        event: "UPDATE", 
        schema: "public", 
        table: "history",
        filter: `tsm_approved_status=in.(Approved,Declined)` 
      }, (payload) => {
        console.log("🔔 TSA QUOTATION EVENT: TSM quotation status changed", payload);
        console.log("🔔 TSA QUOTATION EVENT: Event type:", payload.eventType);
        console.log("🔔 TSA QUOTATION EVENT: New data:", payload.new);
        console.log("🔔 TSA QUOTATION EVENT: Old data:", payload.old);
        
        if (payload.eventType === "UPDATE" && payload.new && isClient) {
          const newStatus = payload.new.tsm_approved_status;
          const oldStatus = payload.old?.tsm_approved_status;
          
          console.log("🔔 TSA QUOTATION EVENT: Status change detected");
          console.log("🔔 TSA QUOTATION EVENT: Old status:", oldStatus);
          console.log("🔔 TSA QUOTATION EVENT: New status:", newStatus);
          
          // Only notify if status changed from Pending to Approved/Declined
          if (oldStatus === "Pending" && (newStatus === "Approved" || newStatus === "Declined")) {
            console.log("🔔 TSA QUOTATION EVENT: ✅ Triggering TSA notification for", newStatus);
            
            // Play quotation sound for TSA notifications
            if (audioRef.current) {
              const audio = new Audio("/quotation-req.mp3");
              audio.volume = 0.6;
              audio.play().catch((error) => {
                console.log("🔔 TSA QUOTATION EVENT: ❌ Audio play failed:", error);
              });
              console.log("🔔 TSA QUOTATION EVENT: ✅ Quotation audio played");
            } else {
              console.log("🔔 TSA QUOTATION EVENT: ❌ No audio ref found");
            }
            
            // Show TSA-specific notification
            if (sileo && sileo.success) {
              sileo.success({
                title: newStatus === "Approved" ? "✅ Quotation Approved" : "❌ Quotation Declined",
                description: `TSM action: ${payload.new.company_name || 'Unknown Company'} - ${payload.new.quotation_number || 'Unknown'}`,
                duration: 8000,
                fill: "white",
                styles: { 
                  title: newStatus === "Approved" ? "text-green-600!" : "text-red-600!", 
                  description: "text-gray-700 font-medium" 
                },
              });
              console.log("🔔 TSA QUOTATION EVENT: ✅ Sileo toast shown");
            } else {
              console.log("🔔 TSA QUOTATION EVENT: ❌ Sileo not available");
            }
            
            // Dispatch custom event to trigger UnifiedNotificationBell refresh
            const customEvent = new CustomEvent('tsmQuotationApproval', {
              detail: payload.new
            });
            window.dispatchEvent(customEvent);
            console.log("🔔 TSA QUOTATION EVENT: ✅ Custom event dispatched", customEvent);
          } else {
            console.log("🔔 TSA QUOTATION EVENT: ❌ Status change not from Pending to Approved/Declined");
          }
        } else {
          console.log("🔔 TSA QUOTATION EVENT: ❌ Not an UPDATE event or no new data");
        }
      })
      .subscribe((status) => {
        if (isClient) {
          console.log("🔔 TSA SUBSCRIPTION: Subscription status:", status);
          if (status === 'SUBSCRIBED') {
            console.log("🔔 TSA SUBSCRIPTION: ✅ Successfully subscribed to TSA quotation changes");
          } else if (status === 'CHANNEL_ERROR') {
            console.log("🔔 TSA SUBSCRIPTION: ❌ Subscription error");
          }
        }
      });
    
    if (isClient) {
      console.log("🔔 TSA SUBSCRIPTION: ✅ TSA subscription setup complete");
    }

    return () => {
      cancelled = true;
      if (stopTimerRef.current) { window.clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      supabase.removeChannel(channel);
      supabase.removeChannel(tsmQuotationChannel);
    };
  }, [
    userId, getInitKey, getStorageKey, getLegacyStorageKey, getKnownSignatureKey,
    getUnreadCountKey, persistReadMap, persistKnownSignatureMap, persistUnreadCountMap,
    normalizeSPFNumber, playNotificationSound, getLastSeenCreationKey, applyEffectiveUnreadAggregates,
    isClient, pathname,
  ]);

  // ─── TSM Quotation notification system - RELY ON LOCAL SYSTEM + GLOBAL EVENTS ─────────────────────────────
  // Global system now only listens for custom events from the working local system
  // This avoids Supabase subscription conflicts and ensures reliable cross-page notifications

  // Manual test functions for debugging notifications
  useEffect(() => {
    if (!isClient) return;
    // Add global test functions
    (window as any).testTSANotification = () => {
      console.log("🔔 MANUAL TEST: Triggering TSA notification manually");
      
      // Play quotation sound
      if (audioRef.current) {
        const audio = new Audio("/quotation-req.mp3");
        audio.volume = 0.6;
        audio.play().catch((error) => {
          console.log("🔔 MANUAL TEST: ❌ Audio play failed:", error);
        });
        console.log("🔔 MANUAL TEST: ✅ Quotation audio played");
      } else {
        console.log("🔔 MANUAL TEST: ❌ No audio ref found");
      }
      
      // Show toast
      if (sileo && sileo.success) {
        sileo.success({
          title: "✅ Test TSA Notification",
          description: "This is a manual test of TSA notification system",
          duration: 8000,
          fill: "white",
          styles: { 
            title: "text-green-600!", 
            description: "text-gray-700 font-medium" 
          },
        });
        console.log("🔔 MANUAL TEST: ✅ Sileo toast shown");
      } else {
        console.log("🔔 MANUAL TEST: ❌ Sileo not available");
      }
      
      // Dispatch custom event to trigger bell refresh
      const customEvent = new CustomEvent('tsmQuotationApproval', {
        detail: {
          company_name: 'Test Company',
          quotation_number: 'Q-TEST-001',
          tsm_approved_status: 'Approved',
          date_created: new Date().toISOString()
        }
      });
      window.dispatchEvent(customEvent);
      console.log("🔔 MANUAL TEST: ✅ Custom event dispatched", customEvent);
    };

    // Test function to manually trigger database update
    (window as any).testDatabaseUpdate = async () => {
      console.log("🔔 DB TEST: Manually triggering database update");
      
      try {
        const { data, error } = await supabase
          .from("history")
          .update({ tsm_approved_status: "Approved" })
          .eq("quotation_number", "Q-TEST-DB-UPDATE")
          .select();
          
        if (error) {
          console.log("🔔 DB TEST: ❌ Database update failed", error);
        } else {
          console.log("🔔 DB TEST: ✅ Database update successful", data);
        }
      } catch (err) {
        console.log("🔔 DB TEST: ❌ Database update exception", err);
      }
    };
    
    console.log("🔔 MANUAL TEST: Test functions available. Run testTSANotification() or testDatabaseUpdate() in console");
    
    return () => {
      delete (window as any).testTSANotification;
      delete (window as any).testDatabaseUpdate;
    };
  }, [isClient]);

  // ─── Firebase chat unread listener ───────────────────────────────────────────
  // Strategy:
  //   1. On mount, load persisted unread counts from localStorage immediately
  //      so badges are visible before Firebase even connects.
  //   2. On every Firebase snapshot, recompute unread per chat doc by counting
  //      messages from others that this user hasn't seen
  //      messages where senderId !== userId AND userId NOT in seenBy.
  //   3. If the new count is higher than what we had, play a sound (new message).
  //   4. Persist the updated map to localStorage so it survives refreshes.
  //   5. markChatAsRead() clears the entry for that docId and persists — this is
  //      the ONLY way the badge goes away.
  useEffect(() => {
    if (!userId) {
      chatUnreadMapRef.current = new Map();
      chatLastMsgCountRef.current = new Map();
      setUnreadChatCount(0);
      if (firebaseUnsubscribeRef.current) { firebaseUnsubscribeRef.current(); firebaseUnsubscribeRef.current = null; }
      return;
    }

    // Init sound
    if (!chatNotifSoundRef.current) {
      chatNotifSoundRef.current = new Audio("/reminder-notification.mp3");
      chatNotifSoundRef.current.preload = "auto";
    }

    // ── Step 1: Load persisted unread counts immediately ───────────────────────
    try {
      const raw = localStorage.getItem(getChatUnreadKey(userId));
      if (raw) {
        const parsed: Record<string, number> = JSON.parse(raw);
        chatUnreadMapRef.current = new Map(
          Object.entries(parsed).filter(([, v]) => typeof v === "number" && v > 0) as [string, number][]
        );
        recalcChatUnreadTotal();
      }
    } catch (e) {
      console.error("Failed to load persisted chat unread:", e);
    }

    // ── Step 2: Subscribe to Firebase for live updates ─────────────────────────
    const collRef = collection(dbCollab, "spf_creations");
    const unsubscribe = onSnapshot(
      collRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        let hasNewMessages = false;

        snapshot.forEach((docSnapshot) => {
          const docId = docSnapshot.id;
          const data = docSnapshot.data();
          const messages: any[] = data.messages || [];

          // Count messages from others that this user hasn't seen
          const unreadCount = messages.filter(
            (msg) => msg.senderId !== userId && !(msg.seenBy ?? []).includes(userId)
          ).length;

          const prevCount = chatUnreadMapRef.current.get(docId) ?? 0;
          const prevMsgCount = chatLastMsgCountRef.current.get(docId) ?? 0;

          // Detect genuinely new incoming messages (total count grew AND there are new unseens)
          if (messages.length > prevMsgCount && unreadCount > prevCount) {
            hasNewMessages = true;
          }

          // Update msg count tracker
          chatLastMsgCountRef.current.set(docId, messages.length);

          // Update unread map
          if (unreadCount > 0) {
            chatUnreadMapRef.current.set(docId, unreadCount);
          } else {
            // Only clear if Firebase confirms seenBy contains userId
            // (i.e., the dialog already marked them as read in Firestore)
            chatUnreadMapRef.current.delete(docId);
          }
        });

        recalcChatUnreadTotal();
        persistChatUnreadMap(userId, chatUnreadMapRef.current);

        if (hasNewMessages && chatNotifSoundRef.current) {
          chatNotifSoundRef.current.currentTime = 0;
          chatNotifSoundRef.current.play().catch(() => {});
        }
      },
      (error) => {
        console.error("Firebase chat snapshot error:", error);
      }
    );

    firebaseUnsubscribeRef.current = unsubscribe;
    return () => {
      if (firebaseUnsubscribeRef.current) { firebaseUnsubscribeRef.current(); firebaseUnsubscribeRef.current = null; }
    };
  }, [userId, getChatUnreadKey, persistChatUnreadMap, recalcChatUnreadTotal]);

  // ─── SPF notification helpers ─────────────────────────────────────────────────
  const markSPFRequestAsRead = useCallback((spfNumber: string) => {
    if (!userId) return;
    const normalizedSPF = normalizeSPFNumber(spfNumber);
    if (!normalizedSPF) return;
    const currentSignature = latestSignatureRef.current.get(normalizedSPF);
    const currentCreation = latestCreationStatusRef.current.get(normalizedSPF) ?? "";
    if (currentSignature) readSPFRef.current.set(normalizedSPF, currentSignature);
    unreadCountMapRef.current.delete(normalizedSPF);
    lastSeenCreationRef.current.set(normalizedSPF, currentCreation);
    persistLastSeenCreationMap(userId, lastSeenCreationRef.current);
    persistReadMap(userId, readSPFRef.current);
    persistKnownSignatureMap(userId, knownSignatureRef.current);
    persistUnreadCountMap(userId, unreadCountMapRef.current);
    applyEffectiveUnreadAggregates();
  }, [normalizeSPFNumber, persistReadMap, persistKnownSignatureMap, persistUnreadCountMap, persistLastSeenCreationMap, userId, applyEffectiveUnreadAggregates]);

  const isSPFRequestUnread = useCallback((spfNumber: string) => {
    const normalizedSPF = normalizeSPFNumber(spfNumber);
    if (!normalizedSPF) return false;
    const delta = unreadCountMapRef.current.get(normalizedSPF) ?? 0;
    const creation = latestCreationStatusRef.current.get(normalizedSPF) ?? "";
    const lastSeen = lastSeenCreationRef.current.get(normalizedSPF);
    const alertUnread = isCreationNotificationStatus(creation) &&
      normalizeCreationStatusForCompare(creation) !== normalizeCreationStatusForCompare(lastSeen);
    return Math.max(delta, alertUnread ? 1 : 0) > 0;
  }, [normalizeSPFNumber]);

  const getSPFRequestUnreadCount = useCallback((spfNumber: string) => {
    const normalizedSPF = normalizeSPFNumber(spfNumber);
    if (!normalizedSPF) return 0;
    const delta = unreadCountMapRef.current.get(normalizedSPF) ?? 0;
    const creation = latestCreationStatusRef.current.get(normalizedSPF) ?? "";
    const lastSeen = lastSeenCreationRef.current.get(normalizedSPF);
    const alertUnread = isCreationNotificationStatus(creation) &&
      normalizeCreationStatusForCompare(creation) !== normalizeCreationStatusForCompare(lastSeen);
    return Math.max(delta, alertUnread ? 1 : 0);
  }, [normalizeSPFNumber]);

  // ─── Chat notification helpers ────────────────────────────────────────────────

  /**
   * Call this when the user opens the chat dialog for a specific docId.
   * It immediately clears the badge for that chat and persists the change.
   * The Firebase seenBy update (done inside CollaborationHubDialog) will
   * subsequently confirm via snapshot that unread = 0 for that doc.
   */
  const markChatAsRead = useCallback((requestId: string) => {
    if (!userId || !requestId) return;
    chatUnreadMapRef.current.delete(requestId);
    persistChatUnreadMap(userId, chatUnreadMapRef.current);
    recalcChatUnreadTotal();
  }, [userId, persistChatUnreadMap, recalcChatUnreadTotal]);

  const isChatUnread = useCallback((requestId: string) => {
    if (!requestId) return false;
    return (chatUnreadMapRef.current.get(requestId) ?? 0) > 0;
  }, []);

  const getChatUnreadCount = useCallback((requestId: string) => {
    if (!requestId) return 0;
    return chatUnreadMapRef.current.get(requestId) ?? 0;
  }, []);

  /**
   * Allows CollaborationHubDialog to manually push a count update.
   * Kept for backward compatibility but the primary source of truth
   * is now the Firebase onSnapshot listener above.
   */
  const updateChatUnreadCount = useCallback((requestId: string, count: number) => {
    if (!userId || !requestId) return;
    if (count <= 0) {
      chatUnreadMapRef.current.delete(requestId);
    } else {
      chatUnreadMapRef.current.set(requestId, count);
    }
    persistChatUnreadMap(userId, chatUnreadMapRef.current);
    recalcChatUnreadTotal();
  }, [userId, persistChatUnreadMap, recalcChatUnreadTotal]);

  const clearNotifications = useCallback(() => {
    if (!userId) { unreadSPFRef.current = new Set(); setUnreadCount(0); return; }
    latestSignatureRef.current.forEach((signature, spf) => {
      readSPFRef.current.set(spf, signature);
      const creation = latestCreationStatusRef.current.get(spf) ?? "";
      lastSeenCreationRef.current.set(spf, creation);
    });
    unreadCountMapRef.current.clear();
    persistReadMap(userId, readSPFRef.current);
    persistKnownSignatureMap(userId, knownSignatureRef.current);
    persistUnreadCountMap(userId, unreadCountMapRef.current);
    persistLastSeenCreationMap(userId, lastSeenCreationRef.current);
    applyEffectiveUnreadAggregates();
  }, [persistReadMap, persistKnownSignatureMap, persistUnreadCountMap, persistLastSeenCreationMap, userId, applyEffectiveUnreadAggregates]);

  // Manual test function for debugging
  const testQuotationNotification = useCallback(() => {
    console.log("🔔 TSM Quotation Notification: Manual test triggered");
    
    const testQuotation: QuotationNotification = {
      id: 'test-' + Date.now(),
      quotationNumber: 'Q-TEST-' + Math.floor(Math.random() * 1000),
      companyName: 'Test Company (Manual)',
      activityReferenceNumber: 'ACT-TEST',
      tsm: userId || 'unknown',
      dateCreated: new Date().toISOString(),
    };
    
    console.log("🔔 TSM Quotation Notification: Manual test with:", testQuotation);
    showQuotationNotification(testQuotation);
  }, [userId, showQuotationNotification]);

  // Make the test function available globally for console testing
  useEffect(() => {
    if (!isClient) return;
    (window as any).testGlobalNotification = () => {
      console.log("🔔 MANUAL CONSOLE TEST: Triggering global notification");
      const testQuotation: QuotationNotification = {
        id: 'console-test-' + Date.now(),
        quotationNumber: 'Q-CONSOLE-' + Math.floor(Math.random() * 1000),
        companyName: 'Console Test Company',
        activityReferenceNumber: 'ACT-CONSOLE',
        tsm: userId || 'unknown',
        dateCreated: new Date().toISOString(),
      };
      console.log("🔔 MANUAL CONSOLE TEST: Showing notification on page:", pathname);
      showQuotationNotification(testQuotation);
    };
    
    // Listen for custom events from local notification system
    const handleQuotationEvent = (event: Event) => {
      console.log("🔔 GLOBAL EVENT LISTENER: Received quotation event from local system");
      
      const customEvent = event as CustomEvent;
      console.log("🔔 GLOBAL EVENT LISTENER: Event data:", customEvent.detail);
      
      if (customEvent.detail && customEvent.detail.type_activity === 'Quotation Preparation' && 
          customEvent.detail.tsm_approved_status === 'Pending') {
        console.log("🔔 GLOBAL EVENT LISTENER: Triggering global notification from local event");
        
        const quotation: QuotationNotification = {
          id: customEvent.detail.id?.toString() || '',
          quotationNumber: customEvent.detail.quotation_number || 'Unknown',
          companyName: customEvent.detail.company_name || 'Unknown Company',
          activityReferenceNumber: customEvent.detail.activity_reference_number || '',
          tsm: customEvent.detail.tsm || '',
          dateCreated: customEvent.detail.date_created || new Date().toISOString(),
        };
        
        showQuotationNotification(quotation);
      }
    };

    // TSA subscription for TSM quotation approval/decline
    const handleTSMApprovalEvent = (event: Event) => {
      console.log("🔔 TSA EVENT LISTENER: Received TSM approval/decline event");
      
      const customEvent = event as CustomEvent;
      console.log("🔔 TSA EVENT LISTENER: Event data:", customEvent.detail);
      
      if (customEvent.detail && 
          customEvent.detail.type_activity === 'Quotation Preparation' && 
          (customEvent.detail.tsm_approved_status === 'Approved' || customEvent.detail.tsm_approved_status === 'Declined')) {
        console.log("🔔 TSA EVENT LISTENER: Triggering TSA notification for TSM action");
        
        const notification = {
          id: customEvent.detail.id?.toString() || '',
          quotationNumber: customEvent.detail.quotation_number || 'Unknown',
          companyName: customEvent.detail.company_name || 'Unknown Company',
          activityReferenceNumber: customEvent.detail.activity_reference_number || '',
          tsm: customEvent.detail.tsm || '',
          dateCreated: customEvent.detail.date_created || new Date().toISOString(),
        };
        
        // Show different notification for TSA users
        if (sileo && sileo.success) {
          sileo.success({
            title: customEvent.detail.tsm_approved_status === 'Approved' ? "✅ Quotation Approved" : "❌ Quotation Declined",
            description: `${customEvent.detail.company_name} - ${customEvent.detail.quotation_number}`,
            duration: 8000,
            fill: "white",
            styles: { 
              title: customEvent.detail.tsm_approved_status === 'Approved' ? "text-green-600!" : "text-red-600!", 
              description: "text-gray-700 font-medium" 
            },
          });
        } else {
          // Fallback: create manual toast
          const toast = document.createElement('div');
            toast.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: ${customEvent.detail.tsm_approved_status === 'Approved' ? '#10b981' : '#ef4444'};
              color: white;
              padding: 15px 20px;
              border-radius: 8px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.2);
              z-index: 9999;
              min-width: 300px;
              transform: translateX(400px);
              transition: transform 0.3s ease;
              border-left: 4px solid ${customEvent.detail.tsm_approved_status === 'Approved' ? '#059669' : '#dc2626'};
            `;
            toast.innerHTML = `
              <div style="color: white; font-weight: bold; margin-bottom: 5px;">
                ${customEvent.detail.tsm_approved_status === 'Approved' ? '✅ Quotation Approved' : '❌ Quotation Declined'}
              </div>
              <div style="color: white; font-size: 12px; margin-top: 5px;">
                ${customEvent.detail.company_name} - ${customEvent.detail.quotation_number}
              </div>
            `;
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
              toast.style.transform = 'translateX(0)';
            }, 100);
            
            setTimeout(() => {
              toast.style.transform = 'translateX(400px)';
              setTimeout(() => {
                if (document.body.contains(toast)) {
                  document.body.removeChild(toast);
                }
              }, 300);
            }, 8000);
          }
        }
      };
      
      window.addEventListener('quotationNotification', handleQuotationEvent);
      window.addEventListener('tsmQuotationApproval', handleTSMApprovalEvent);
      console.log("🔔 GLOBAL EVENT LISTENER: Listening for quotation events from local system");
      console.log("🔔 TSA EVENT LISTENER: Listening for TSM approval/decline events");
      
      return () => {
        window.removeEventListener('quotationNotification', handleQuotationEvent);
        window.removeEventListener('tsmQuotationApproval', handleTSMApprovalEvent);
        delete (window as any).testGlobalNotification;
      };
  }, [isClient, pathname, userId, showQuotationNotification]);

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      unreadChatCount,
      markSPFRequestAsRead,
      isSPFRequestUnread,
      getSPFRequestUnreadCount,
      clearNotifications,
      markChatAsRead,
      isChatUnread,
      getChatUnreadCount,
      updateChatUnreadCount,
      showQuotationNotification,
      testQuotationNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}