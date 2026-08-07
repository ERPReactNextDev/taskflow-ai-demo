/**
 * POST /api/chat/messages/upload
 * Upload a file to Supabase Storage (chat-attachments or chat-media bucket)
 * and return the public URL. Path = /{conversation_id}/{filename}
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm"];
const DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES, ...AUDIO_TYPES, ...DOC_TYPES];

function getBucket(mimeType: string): "chat-media" | "chat-attachments" {
  if ([...IMAGE_TYPES, ...VIDEO_TYPES, ...AUDIO_TYPES].includes(mimeType)) {
    return "chat-media";
  }
  return "chat-attachments";
}

function getMessageType(mimeType: string): string {
  if (IMAGE_TYPES.includes(mimeType)) return "image";
  if (VIDEO_TYPES.includes(mimeType)) return "video";
  if (AUDIO_TYPES.includes(mimeType)) return "voice";
  return "file";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const convId = formData.get("conversation_id") as string | null;
    const userId = formData.get("user_id") as string | null;

    if (!file || !convId || !userId) {
      return NextResponse.json(
        { error: "file, conversation_id, and user_id are required" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 100 MB limit" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Allowed: images, video, audio, PDF, Word, Excel" },
        { status: 400 }
      );
    }

    // Verify uploader is a participant
    const { data: participant } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", convId)
      .eq("user_id", userId)
      .single();

    if (!participant) {
      return NextResponse.json({ error: "Not a participant of this conversation" }, { status: 403 });
    }

    const bucket = getBucket(file.type);
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${convId}/${timestamp}_${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr || !uploadData) {
      return NextResponse.json({ error: uploadErr?.message || "Upload failed" }, { status: 500 });
    }

    const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);

    return NextResponse.json({
      url: publicData.publicUrl,
      path: storagePath,
      bucket,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      message_type: getMessageType(file.type),
    });
  } catch (err) {
    console.error("[chat/messages/upload]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
