import * as FileSystem from "expo-file-system/legacy";
import { env } from "../config/env";
import { getStoredTokens } from "./session";
import { apiRequest, ApiError } from "./client";

export type EvidenceUploadContextType = "match_room" | "tournament" | "wallet";
export type EvidenceMimeType = "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm" | "video/quicktime";

export type UploadedEvidence = {
  file_name: string;
  url: string;
  context_type: EvidenceUploadContextType;
  context_id: string;
  evidence_type: "screenshot" | "video";
  mime_type: EvidenceMimeType;
  byte_size: number;
  sha256: string;
};

type InitiateUploadResponse = {
  upload: {
    id: string;
    status: "initiated";
    method: "PUT";
    upload_url: string;
    expires_at: string;
    max_bytes: number;
    mime_type: EvidenceMimeType;
  };
};

type CompleteUploadResponse = {
  upload: {
    id: string;
    status: "completed";
  };
  evidence: UploadedEvidence;
};

function absoluteApiUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${env.apiBaseUrl}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function parseUploadError(status: number, body?: string | null) {
  if (!body) return "Could not upload this file.";
  try {
    const payload = JSON.parse(body) as { error?: { message?: string }; message?: string };
    return payload.error?.message ?? payload.message ?? "Could not upload this file.";
  } catch {
    return status >= 500 ? "Skillsroom could not store this file right now." : "Could not upload this file.";
  }
}

export async function uploadEvidenceFile(input: {
  context_type: EvidenceUploadContextType;
  context_id: string;
  uri: string;
  mime_type: EvidenceMimeType;
  original_name?: string;
  byte_size?: number;
}) {
  const initiated = await apiRequest<InitiateUploadResponse>("/evidence/uploads", {
    method: "POST",
    body: {
      context_type: input.context_type,
      context_id: input.context_id,
      original_name: input.original_name,
      mime_type: input.mime_type,
      byte_size: input.byte_size
    }
  });

  const { accessToken } = await getStoredTokens();
  if (!accessToken) throw new ApiError("Sign in again before uploading evidence.", 401, "AUTH_REQUIRED");

  const uploadResult = await FileSystem.uploadAsync(absoluteApiUrl(initiated.upload.upload_url), input.uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "X-Skillsroom-Client": "mobile"
    }
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new ApiError(parseUploadError(uploadResult.status, uploadResult.body), uploadResult.status);
  }

  const completed = await apiRequest<CompleteUploadResponse>(`/evidence/uploads/${initiated.upload.id}/complete`, {
    method: "POST",
    body: {}
  });

  return completed.evidence;
}
