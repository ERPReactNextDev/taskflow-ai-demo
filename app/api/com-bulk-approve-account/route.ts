import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { logAuditTrailApp } from "@/lib/auditTrail";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { ids, status, referenceid } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { success: false, error: "Missing or empty 'ids' array." },
                { status: 400 }
            );
        }
        if (typeof status !== "string" || !status.trim()) {
            return NextResponse.json(
                { success: false, error: "Missing or invalid 'status'." },
                { status: 400 }
            );
        }

        // Generate placeholders like $1, $2, ..., for the ids
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");

        let updatedRows: any[];

        if (status === "Approval for Transfer") {
          // Transfer approval: set status to Active, update referenceid to transfer_to,
          // set date_approved and date_transferred to NOW()
          const query = `
            UPDATE accounts
            SET status         = 'Active',
                referenceid    = transfer_to,
                date_approved  = NOW(),
                date_transferred = NOW()
            WHERE id IN (${placeholders})
            RETURNING *;
          `;
          updatedRows = await Xchire_sql.query(query, ids);
        } else {
          // Normal approval: just update status and date_approved
          const query = `
            UPDATE accounts
            SET status       = $${ids.length + 1},
                date_approved = NOW()
            WHERE id IN (${placeholders})
            RETURNING *;
          `;
          updatedRows = await Xchire_sql.query(query, [...ids, status]);
        }

        if (updatedRows.length === 0) {
            return NextResponse.json(
                { success: false, error: "No accounts updated. IDs may not exist." },
                { status: 404 }
            );
        }

        // Log audit trail for bulk approval
        await logAuditTrailApp(
            req,
            "update",
            "company accounts",
            ids.join(", "),
            `Bulk approval of ${ids.length} accounts`,
            `Approved ${ids.length} accounts with status: ${status}`,
            { ids, status }
        );

        return NextResponse.json(
            { success: true, updatedCount: updatedRows.length, data: updatedRows },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Error bulk approve accounts:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to bulk approve accounts." },
            { status: 500 }
        );
    }
}

export const dynamic = "force-dynamic";
