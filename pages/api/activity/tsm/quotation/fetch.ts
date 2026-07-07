import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { 
    referenceid, 
    from, 
    to, 
    limit = "10",
    page = "1",
    search
  } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Parse pagination parameters
  const pageNum = Math.max(1, parseInt(typeof page === "string" ? page : "1", 10));
  const limitNum = Math.min(Math.max(1, parseInt(typeof limit === "string" ? limit : "10", 10)), 50);
  const offset = (pageNum - 1) * limitNum;

  try {
    // Build base query for history table
    let query = supabase
      .from("history")
      .select("*", { count: "exact" })
      .eq("tsm", referenceid)
      .eq("type_activity", "Quotation Preparation")
      .in("tsm_approved_status", ["Approved", "Approved By Sales Head"])
      .order("date_updated", { ascending: false });

    // Apply search filter
    if (search && typeof search === "string") {
      const searchTerm = search.trim();
      if (searchTerm) {
        query = query.or(`quotation_number.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%`);
      }
    }

    // Apply date range filter
    if (from && typeof from === "string") {
      query = query.gte("date_created", from);
    }
    if (to && typeof to === "string") {
      query = query.lte("date_created", to);
    }

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    // Execute query
    const { data, error, count: totalCount } = await query;

    if (error) {
      console.error("History query error:", error);
      throw error;
    }

    // Filter out items without meaningful data
    const filteredData = (data || []).filter((item: any) => {
      const columnsToCheck = ["activity_reference_number", "referenceid", "quotation_number", "quotation_amount"];
      return columnsToCheck.some((col) => {
        const val = item[col];
        if (val === null || val === undefined) return false;
        if (typeof val === "string") return val.trim() !== "";
        if (typeof val === "number") return !isNaN(val);
        return Boolean(val);
      });
    });

    // Fetch signatory data for all quotations
    const quotationNumbers = filteredData
      .map((item: any) => item.quotation_number)
      .filter(Boolean);

    const signatoryMap = new Map<string, any>();
    if (quotationNumbers.length > 0) {
      const { data: signatories } = await supabase
        .from("signatories")
        .select("*")
        .in("quotation_number", quotationNumbers);

      signatories?.forEach((sig: any) => {
        signatoryMap.set(sig.quotation_number, sig);
      });
    }

    // Merge signatory data with history data
    const mergedData = filteredData.map((item: any) => {
      const sig = signatoryMap.get(item.quotation_number);
      return {
        ...item,
        // Signatory data
        agent_name: sig?.agent_name || null,
        agent_signature: sig?.agent_signature || null,
        agent_contact_number: sig?.agent_contact_number || null,
        agent_email_address: sig?.agent_email_address || null,
        tsm_name: sig?.tsm_name || null,
        tsm_signature: sig?.tsm_signature || null,
        tsm_contact_number: sig?.tsm_contact_number || null,
        tsm_email_address: sig?.tsm_email_address || null,
        manager_name: sig?.manager_name || null,
        manager_signature: sig?.manager_signature || null,
        manager_contact_number: sig?.manager_contact_number || null,
        manager_email_address: sig?.manager_email_address || null,
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil((totalCount || 0) / limitNum);
    const hasMore = pageNum < totalPages;

    // Validate and sanitize response data
    const safeResponse = {
      activities: mergedData || [],
      totalCount: Math.max(0, totalCount || 0),
      totalPages: Math.max(0, totalPages),
      currentPage: Math.max(1, pageNum),
      itemsPerPage: Math.max(1, limitNum),
      hasMore: Boolean(hasMore),
      offset: Math.max(0, offset),
      search_applied: {
        query: typeof search === 'string' ? search.trim() : null,
        date_range: {
          from: from || null,
          to: to || null
        }
      },
      cached: false
    };

    return res.status(200).json(safeResponse);
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ 
      message: err.message || "Server error",
      activities: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      itemsPerPage: 10,
      hasMore: false,
      offset: 0
    });
  }
}