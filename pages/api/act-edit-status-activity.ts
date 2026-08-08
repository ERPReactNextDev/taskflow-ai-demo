import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

const safe = (v: any) => (v === undefined || v === "" ? null : v);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const {
    activity_reference_number,
    status,
    scheduled_date,
    // Additional fields for new activity creation
    referenceid,
    tsm,
    manager,
    account_reference_number,
    ticket_reference_number,
    type_client,
    company_name,
    contact_person,
    contact_number,
    email_address,
    address,
    agent,
    is_new_activity,
    // Email bridge — nullable soft link
    source_email_message_id,
  } = req.body;

  if (!activity_reference_number) {
    return res.status(400).json({ error: "Missing activity_reference_number" });
  }

  if (!status) {
    return res.status(400).json({ error: "Missing status" });
  }

  try {
    // Check if activity exists
    const { data: existingActivity } = await supabase
      .from("activity")
      .select("id")
      .eq("activity_reference_number", activity_reference_number)
      .maybeSingle();

    let result;

    if (existingActivity) {
      // UPDATE existing activity
      const updateData: any = {
        status,
        date_updated: new Date().toISOString(),
      };

      if (scheduled_date) {
        updateData.scheduled_date = scheduled_date;
      }

      const { data, error } = await supabase
        .from("activity")
        .update(updateData)
        .eq("activity_reference_number", activity_reference_number)
        .select();

      if (error) {
        console.error("Supabase Update Error:", error);
        return res.status(500).json({ error: error.message });
      }

      result = data;

      // Log audit trail for activity status edit
      await logAuditTrailWithSession(
        req,
        "update",
        "activity status",
        activity_reference_number,
        activity_reference_number,
        `Edited activity status to ${status}`,
        { status, scheduled_date }
      );
    } else {
      // INSERT new activity (for Cluster/OB Calls creation)
      if (!referenceid || !account_reference_number) {
        console.error("Missing required fields:", {
          referenceid,
          account_reference_number,
          activity_reference_number,
        });
        return res.status(400).json({
          error: `Missing required fields: ${!referenceid ? 'referenceid' : ''} ${!account_reference_number ? 'account_reference_number' : ''}`,
        });
      }

      const insertData: any = {
        activity_reference_number,
        referenceid: safe(referenceid),
        tsm: safe(tsm),
        manager: safe(manager),
        // Note: target_quota is NOT in activity table (only in history)
        account_reference_number,
        ticket_reference_number: safe(ticket_reference_number) || "-",
        status,
        type_client: safe(type_client),
        company_name: safe(company_name),
        contact_person: safe(contact_person),
        contact_number: safe(contact_number),
        email_address: safe(email_address),
        address: safe(address),
        agent: safe(agent),
        scheduled_date: scheduled_date || new Date().toISOString().split("T")[0],
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
        // Email bridge — only set when activity originates from email module
        ...(source_email_message_id ? { source_email_message_id } : {}),
      };

      const { data, error } = await supabase
        .from("activity")
        .insert(insertData)
        .select();

      if (error) {
        console.error("Supabase Insert Error:", error);
        return res.status(500).json({ error: error.message });
      }

      result = data;

      // Log audit trail for new activity creation
      await logAuditTrailWithSession(
        req,
        "create",
        "activity",
        activity_reference_number,
        activity_reference_number,
        `Created new activity for ${company_name || "N/A"} with status ${status}`,
        { status, scheduled_date, company_name, is_new_activity: true }
      );
    }

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
}
