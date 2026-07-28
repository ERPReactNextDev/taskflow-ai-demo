"use client";

import React, { useEffect, useState } from "react";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, XCircle, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/utils/supabase";

interface RevisionNotification {
    spf_number: string;
    revision_result: string;
    revision_date: string;
}

export function RevisionNotificationDialog() {
    const [open, setOpen] = useState(false);
    const [revisions, setRevisions] = useState<RevisionNotification[]>([]);
    const [dismissedRevisions, setDismissedRevisions] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Load dismissed revisions from localStorage
        const stored = localStorage.getItem("dismissed_revisions");
        if (stored) {
            setDismissedRevisions(new Set(JSON.parse(stored)));
        }

        // Check for new revisions periodically
        const checkForRevisions = async () => {
            try {
                const { data: revisionData, error } = await supabase
                    .from("spf_request_revision_history")
                    .select("spf_number, revision_result, revision_date")
                    .in("revision_result", ["Requested", "Rejected", "Approved"])
                    .order("revision_date", { ascending: false })
                    .limit(50);

                if (error) throw error;

                if (revisionData) {
                    const newRevisions = revisionData.filter(
                        (rev) => !dismissedRevisions.has(`${rev.spf_number}-${rev.revision_result}-${rev.revision_date}`)
                    );

                    if (newRevisions.length > 0) {
                        setRevisions(newRevisions);
                        setOpen(true);
                    }
                }
            } catch (err) {
                console.error("Failed to check for revisions:", err);
            }
        };

        // Check immediately on mount
        checkForRevisions();

        // Check every 30 seconds
        const interval = setInterval(checkForRevisions, 30000);

        return () => clearInterval(interval);
    }, [dismissedRevisions]);

    const handleDismiss = () => {
        // Save dismissed revisions to localStorage
        const newDismissed = new Set(dismissedRevisions);
        revisions.forEach((rev) => {
            newDismissed.add(`${rev.spf_number}-${rev.revision_result}-${rev.revision_date}`);
        });
        setDismissedRevisions(newDismissed);
        localStorage.setItem("dismissed_revisions", JSON.stringify(Array.from(newDismissed)));
        
        setOpen(false);
        setRevisions([]);
    };

    const getIcon = (result: string) => {
        switch (result.toLowerCase()) {
            case "requested":
                return <RefreshCw className="w-5 h-5 text-amber-600" />;
            case "rejected":
                return <XCircle className="w-5 h-5 text-red-600" />;
            case "approved":
                return <CheckCircle className="w-5 h-5 text-emerald-600" />;
            default:
                return <AlertCircle className="w-5 h-5 text-zinc-600" />;
        }
    };

    const getColor = (result: string) => {
        switch (result.toLowerCase()) {
            case "requested":
                return "bg-amber-50 border-amber-200 text-amber-800";
            case "rejected":
                return "bg-red-50 border-red-200 text-red-800";
            case "approved":
                return "bg-emerald-50 border-emerald-200 text-emerald-800";
            default:
                return "bg-zinc-50 border-zinc-200 text-zinc-800";
        }
    };

    if (revisions.length === 0) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-center">Revision Updates</DialogTitle>
                </DialogHeader>
                <div className="py-4 max-h-[400px] overflow-y-auto">
                    <div className="space-y-3">
                        {revisions.map((rev, idx) => (
                            <div
                                key={`${rev.spf_number}-${idx}`}
                                className={`flex items-center gap-3 p-3 border rounded-none ${getColor(rev.revision_result)}`}
                            >
                                {getIcon(rev.revision_result)}
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">{rev.spf_number}</p>
                                    <p className="text-xs opacity-75">
                                        Revision {rev.revision_result}
                                    </p>
                                </div>
                                <p className="text-xs opacity-60">
                                    {new Date(rev.revision_date).toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
                <DialogFooter className="justify-center">
                    <Button
                        onClick={handleDismiss}
                        className="rounded-none h-9 text-xs uppercase font-black tracking-wider bg-gray-900 hover:bg-gray-800 text-white"
                    >
                        OK
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
