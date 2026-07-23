import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { dbCollab } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { parse } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "PUT") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const { spf_number, revision_type, revision_remarks, edited_data } = req.body;

        if (!spf_number) {
            return res.status(400).json({ message: "spf_number is required" });
        }

        // Get current user from session cookie
        const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
        const sessionUserId = cookies.session;

        if (!sessionUserId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Fetch user's Department based on logged-in user ID
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("Department")
            .eq("id", sessionUserId)
            .single();

        if (userError || !userData) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const userDepartment = userData.Department;

        const updateData: any = {
            status: "For Revision by PD",
            date_updated: new Date().toISOString()
        };

        if (revision_type) updateData.revision_type = revision_type;
        if (revision_remarks) updateData.revision_remarks = revision_remarks;

        // Fetch current spf_creation data to get previous status
        const { data: currentCreationData, error: fetchError } = await supabase
            .from("spf_creation")
            .select("status")
            .eq("spf_number", spf_number)
            .single();

        let creationData: any;

        if (fetchError || !currentCreationData) {
            // If spf_creation doesn't exist, create a new record
            const { data: newCreationData, error: insertError } = await supabase
                .from("spf_creation")
                .insert({
                    spf_number,
                    status: "For Revision by PD",
                    date_created: new Date().toISOString(),
                    date_updated: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) throw insertError;
            creationData = newCreationData;
        } else {
            // Update existing spf_creation table with revision info
            const { data: updatedCreationData, error: creationError } = await supabase
                .from("spf_creation")
                .update(updateData)
                .eq("spf_number", spf_number)
                .select()
                .single();

            if (creationError) throw creationError;
            creationData = updatedCreationData;
        }

        // If edited_data is provided, always store in spf_request_revision table
        if (edited_data) {
            // Remove status from edited_data
            const { status, ...requestDataWithoutStatus } = edited_data;

            // Insert into spf_request_revision table
            const { error: revisionError } = await supabase
                .from("spf_request_revision")
                .insert({
                    ...requestDataWithoutStatus,
                    spf_revision_approval_sales_status: "Ongoing",
                    spf_revision_approval_sales_date: new Date().toISOString(),
                    date_created: new Date().toISOString(),
                    date_updated: new Date().toISOString(),
                });

            if (revisionError) throw revisionError;

            // Update spf_request.remarks with the revision remarks
            if (revision_remarks) {
                const { error: requestRemarksError } = await supabase
                    .from("spf_request")
                    .update({ remarks: revision_remarks })
                    .eq("spf_number", spf_number);

                if (requestRemarksError) throw requestRemarksError;
            }

            // Get the next revision number for this spf_number
            const { data: historyData, error: historyFetchError } = await supabase
                .from("spf_request_revision_history")
                .select("revision_number")
                .eq("spf_number", spf_number)
                .order("revision_number", { ascending: false })
                .limit(1);

            let nextRevisionNumber = 1;
            if (!historyFetchError && historyData && historyData.length > 0) {
                const maxRevision = parseInt(historyData[0].revision_number) || 0;
                nextRevisionNumber = maxRevision + 1;
            }

            // Insert into spf_request_revision_history for tracking
            // Exclude id to avoid unique constraint violation
            const { id, ...requestDataWithoutId } = requestDataWithoutStatus;
            const { error: historyError } = await supabase
                .from("spf_request_revision_history")
                .insert({
                    ...requestDataWithoutId,
                    spf_revision_approval_sales_status: "Ongoing",
                    spf_revision_approval_sales_date: new Date().toISOString(),
                    spf_revision_remarks_sales: revision_remarks,
                    date_created: new Date().toISOString(),
                    date_updated: new Date().toISOString(),
                    revision_number: nextRevisionNumber,
                    revision_result: `Requested By ${userDepartment}`,
                    revision_date: new Date().toISOString(),
                });

            if (historyError) throw historyError;

            // Update spf_creation status to "Processing by PD" when revision is Ongoing
            // Save the previous status before changing
            const { error: creationStatusError } = await supabase
                .from("spf_creation")
                .update({
                    status: "Processing by PD",
                    previous_status: currentCreationData?.status || null,
                    spf_revision_approval_sales_status: "Ongoing",
                    date_updated: new Date().toISOString()
                })
                .eq("spf_number", spf_number);

            if (creationStatusError) throw creationStatusError;
        }

        // Send system message to collaboration hub when revision is requested (only to specific spf_number)
        try {
            const systemMessage = "Revision is Being Processed By PD";

            const docRef = doc(dbCollab, "spf_creations", spf_number);
            try {
                await updateDoc(docRef, {
                    messages: arrayUnion({
                        id: `sys-${Date.now()}`,
                        text: systemMessage,
                        senderId: "system",
                        senderName: "System",
                        role: "system",
                        time: new Date().toISOString(),
                        isSystem: true,
                        seenBy: []
                    })
                });
            } catch (docError: any) {
                // If document doesn't exist, create it
                if (docError.code === 'not-found') {
                    await setDoc(docRef, {
                        messages: [{
                            id: `sys-${Date.now()}`,
                            text: systemMessage,
                            senderId: "system",
                            senderName: "System",
                            role: "system",
                            time: new Date().toISOString(),
                            isSystem: true,
                            seenBy: []
                        }],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    throw docError;
                }
            }
        } catch (firebaseError) {
            console.error("Failed to send system message to collaboration hub:", firebaseError);
            // Don't fail the request if Firebase message fails
        }

        return res.status(200).json({
            success: true,
            message: "Status updated to For Revision",
            data: creationData
        });
    } catch (err: any) {
        console.error("Server error:", err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
}
