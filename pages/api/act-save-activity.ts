import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

const safe = (v: any) => (v === undefined || v === "" ? null : v);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      activity_reference_number,
      account_reference_number,
      ticket_reference_number,
      status,
      type_activity,
      referenceid,
      tsm,
      manager,
      target_quota,
      type_client,
      company_name,
      contact_person,
      contact_number,
      email_address,
      address,
      source,
      callback,
      call_status,
      call_type,

      product_category,
      product_quantity,
      product_amount,
      product_description,
      product_photo,
      product_sku,
      product_title,
      item_remarks,
      discounted_priced,
      discounted_amount,
      product_is_promo,
      product_is_hidden,
      product_display_mode,

      project_type,
      project_name,
      quotation_number,
      quotation_amount,
      quotation_type,
      quotation_status,

      so_number,
      so_amount,
      so_status,
      payment_status,
      si_date,
      dr_number,
      actual_sales,
      payment_terms,
      delivery_date,
      date_followup,
      remarks,

      agent,
      start_date,
      end_date,
      tsm_approved_status,
      vat_type,
      delivery_fee,
      restocking_fee,
      wht_type,
      quotation_subject,

      // Quotation display configuration
      hide_discount_in_preview,
      show_discount_columns,
      show_summary_discounts,
      show_profit_margins,
      margin_alert_threshold,
      show_margin_alerts,
      product_view_mode,
      visible_columns,

      // Signatories
      contact,
      email,
      signature,
      agent_name,
      tsmname,
      managername,

      // Email bridge — nullable, only set when activity originates from email
      source_email_message_id,
    } = req.body;

    /* ================= VALIDATION ================= */

    if (!activity_reference_number)
      return res.status(400).json({ error: "Missing activity_reference_number" });

    if (!account_reference_number)
      return res.status(400).json({ error: "Missing account_reference_number" });

    if (!status)
      return res.status(400).json({ error: "Missing status" });

    if (!type_activity)
      return res.status(400).json({ error: "Missing type_activity" });

    // 🚨 REQUIRED for quotation prep
    if (type_activity === "Quotation Preparation" && !quotation_number) {
      return res.status(400).json({
        error: "quotation_number is required for Quotation Preparation",
      });
    }

    /* ================= PRODUCT VALIDATION ================= */

    const productFields = {
      product_category,
      product_quantity,
      product_amount,
      product_description,
      product_photo,
      product_sku,
      product_title,
      item_remarks,
      discounted_priced,
      discounted_amount,
    };

    for (const [key, value] of Object.entries(productFields)) {
      if (value !== undefined && typeof value !== "string") {
        return res
          .status(400)
          .json({ error: `Invalid ${key}, must be string` });
      }
    }

    if (
      product_category &&
      product_quantity &&
      product_amount &&
      product_title
    ) {
      // Only validate core fields that use comma separator
      // product_description uses "||" separator and may be empty for SPF products
      // item_remarks is optional and may be empty
      const lengths = new Set([
        product_category.split(",").length,
        product_quantity.split(",").length,
        product_amount.split(",").length,
        product_title.split(",").length,
      ]);

      if (lengths.size !== 1) {
        return res
          .status(400)
          .json({ error: "Product arrays length mismatch" });
      }
    }

    /* ================= INSERT HISTORY ================= */

    const { data, error } = await supabase
      .from("history")
      .insert({
        referenceid: safe(referenceid),
        tsm: safe(tsm),
        manager: safe(manager),
        target_quota: safe(target_quota),
        type_client: safe(type_client),
        company_name: safe(company_name),
        contact_person: safe(contact_person),
        contact_number: safe(contact_number),
        email_address: safe(email_address),
        address: safe(address),

        activity_reference_number,
        account_reference_number,
        ticket_reference_number,
        status,
        type_activity,

        source: safe(source),
        callback: safe(callback),
        call_status: safe(call_status),
        call_type: safe(call_type),

        product_category: safe(product_category),
        product_quantity: safe(product_quantity),
        product_amount: safe(product_amount),
        product_description: safe(product_description),
        product_photo: safe(product_photo),
        product_sku: safe(product_sku),
        product_title: safe(product_title),
        item_remarks: safe(item_remarks),
        discounted_priced: safe(discounted_priced),
        discounted_amount: safe(discounted_amount),
        product_is_promo: safe(product_is_promo),
        product_is_hidden: safe(product_is_hidden),
        product_display_mode: safe(product_display_mode),

        project_type: safe(project_type),
        project_name: safe(project_name),

        quotation_number: safe(quotation_number),
        quotation_amount: safe(quotation_amount),
        quotation_type: safe(quotation_type),
        quotation_status: safe(quotation_status) || (status === "Quote-Done" ? "Pending Client Approval" : null),

        so_number: safe(so_number),
        so_amount: safe(so_amount),
        so_status: safe(so_status),
        payment_status: safe(payment_status),
        si_date: safe(si_date),
        dr_number: safe(dr_number),
        actual_sales: safe(actual_sales),
        payment_terms: safe(payment_terms),
        delivery_date: safe(delivery_date),
        date_followup: safe(date_followup),

        remarks: safe(remarks),
        start_date: safe(start_date),
        end_date: safe(end_date),
        agent: safe(agent),
        tsm_approved_status: safe(tsm_approved_status),
        vat_type: safe(vat_type),
        delivery_fee: safe(delivery_fee),
        restocking_fee: safe(restocking_fee),
        quotation_vatable: safe(wht_type),
        quotation_subject: safe(quotation_subject),

        // Quotation display configuration
        hide_discount_in_preview: hide_discount_in_preview ?? false,
        show_discount_columns: show_discount_columns ?? false,
        show_summary_discounts: show_summary_discounts ?? false,
        show_profit_margins: show_profit_margins ?? false,
        margin_alert_threshold: safe(margin_alert_threshold),
        show_margin_alerts: show_margin_alerts ?? false,
        product_view_mode: safe(product_view_mode) || 'list',
        visible_columns: safe(visible_columns),
      })
      .select();

    if (error) {
      console.error("History Insert Error:", error);
      return res.status(500).json({ error: error.message });
    }

    /* ================= SIGNATORIES (QUOTATION ONLY) ================= */

    if (type_activity === "Quotation Preparation") {
      const { data: existing } = await supabase
        .from("signatories")
        .select("id")
        .eq("quotation_number", quotation_number)
        .maybeSingle();

      if (!existing) {
        const { error: sigError } = await supabase
          .from("signatories")
          .insert({
            referenceid: safe(referenceid),
            activity_reference_number,
            quotation_number: safe(quotation_number),

            agent_contact_number: safe(contact),
            agent_email_address: safe(email),
            agent_signature: safe(signature),
            agent_name: safe(agent_name),

            tsm: safe(tsm),
            tsm_name: safe(tsmname),

            manager: safe(manager),
            manager_name: safe(managername),

            date_created: new Date().toISOString(),
          });

        if (sigError) {
          console.error("Signatories Insert Error:", sigError);
          return res.status(500).json({ error: sigError.message });
        }
      }
    }

    /* ================= SUCCESS ================= */

    // Log audit trail for activity creation
    await logAuditTrailWithSession(
      req,
      "create",
      type_activity === "Quotation Preparation" ? "quotation" : "activity",
      activity_reference_number,
      quotation_number || activity_reference_number,
      `Created ${type_activity} for ${company_name || "N/A"}`,
      { type_activity, company_name, status }
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
}