import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    referenceid,
    spf_number,
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
    // Build base query for spf_request table
    let query = supabase
      .from("spf_request")
      .select("*", { count: "exact" })
      .eq("referenceid", referenceid);

    // If spf_number is provided, filter by it as well
    if (spf_number && typeof spf_number === "string") {
      query = query.eq("spf_number", spf_number);
    }

    query = query.order("date_created", { ascending: false })
      .order("spf_number", { ascending: false });

    // Apply search filter
    if (search && typeof search === "string") {
      const searchTerm = search.trim();
      if (searchTerm) {
        query = query.or(`customer_name.ilike.%${searchTerm}%,spf_number.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%,contact_number.ilike.%${searchTerm}%,registered_address.ilike.%${searchTerm}%`);
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
    const { data: requestData, error: requestError, count: totalCount } = await query;

    if (requestError) {
      console.error("SPF request query error:", requestError);
      throw requestError;
    }

    // Fetch status and id from spf_creation table for each SPF request
    const spfNumbers = requestData?.map(item => item.spf_number).filter(Boolean) || [];
    let statusMap = new Map();
    let creationIdMap = new Map();
    
    if (spfNumbers.length > 0) {
      const { data: creationData, error: creationError } = await supabase
        .from("spf_creation")
        .select("id, spf_number, status")
        .in("spf_number", spfNumbers);
      
      if (creationError) {
        console.error("Error fetching data from spf_creation:", creationError);
      } else if (creationData) {
        statusMap = new Map(creationData.map(item => [item.spf_number, item.status]));
        creationIdMap = new Map(creationData.map(item => [item.spf_number, item.id]));
      }
    }

    // Merge status into the data
    // Note: spf_request.status holds approval-flow values like "Approved by Sales Head"
    // while spf_creation.status holds display values like "For Revision"/"Processing by PD".
    // Keep both — the frontend needs spf_request_status for Edit/Revision button logic.
    const mergedData = (requestData || []).map(item => ({
      ...item,
      spf_request_status: item.status || null,
      status: statusMap.get(item.spf_number) || item.status || "pending"
    }));

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
