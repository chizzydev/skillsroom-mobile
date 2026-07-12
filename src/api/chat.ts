import { apiRequest, ApiError } from "./client";
import { env } from "../config/env";
import { getStoredTokens } from "./session";
import * as FileSystem from "expo-file-system/legacy";
import type {
  ChatAttachment,
  ChatAttachmentAccess,
  ChatChannel,
  ChatChannelControls,
  ChatDmRequest,
  ChatMediaResponse,
  ChatMessage,
  ChatMessageSearchResponse,
  ChatMessagesResponse,
  ChatNotificationLevel,
  ChatPresenceSummary,
  ChatThreadResponse
} from "../types/api";

export async function listChannels() {
  const data = await apiRequest<{ channels: ChatChannel[] } | ChatChannel[]>("/community/channels");
  return Array.isArray(data) ? data : data.channels ?? [];
}

export async function listChatMessages(channelIdOrSlug: string, filters: { cursor?: string; before?: string; after?: string; limit?: number; view?: "full" | "list" } = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });

  const query = params.toString();
  return apiRequest<ChatMessagesResponse>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages${query ? `?${query}` : ""}`);
}

export async function searchChatMessages(
  channelIdOrSlug: string,
  filters: { q?: string; user?: string; date_from?: string; date_to?: string; mentions?: "any" | "me"; links?: boolean; pinned?: boolean; cursor?: string; limit?: number }
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });

  const query = params.toString();
  return apiRequest<ChatMessageSearchResponse>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/search${query ? `?${query}` : ""}`);
}

export async function getChatMessageDetail(
  channelIdOrSlug: string,
  messageId: string,
  filters: { include?: Array<"attachments" | "poll" | "thread" | "all"> } = {}
) {
  const params = new URLSearchParams();
  if (filters.include?.length) params.set("include", filters.include.join(","));
  const query = params.toString();
  return apiRequest<{ channel: ChatChannel; message: ChatMessage }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}${query ? `?${query}` : ""}`
  );
}
export async function getChatThread(channelIdOrSlug: string, messageId: string) {
  return apiRequest<ChatThreadResponse>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/thread`);
}

export async function listChatPresence(channelIdOrSlug: string) {
  return apiRequest<ChatPresenceSummary>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/presence`);
}

export async function listChatMedia(channelIdOrSlug: string, filters: { before?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });

  const query = params.toString();
  return apiRequest<ChatMediaResponse>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/media${query ? `?${query}` : ""}`);
}

export async function getChatChannelControls(channelIdOrSlug: string) {
  return apiRequest<ChatChannelControls>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/controls`);
}

export async function updateChatNotificationControls(
  channelIdOrSlug: string,
  input: { notification_level: ChatNotificationLevel; dm_notification_level?: ChatNotificationLevel; push_enabled?: boolean }
) {
  return apiRequest<ChatChannelControls>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/controls/notifications`, {
    method: "PATCH",
    body: input
  });
}

export async function sendChatHeartbeat(channelIdOrSlug: string) {
  return apiRequest<{ channel: ChatChannel }>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/heartbeat`, {
    method: "POST",
    body: {}
  });
}

export async function setChatTyping(channelIdOrSlug: string, isTyping: boolean) {
  return apiRequest<{ channel: ChatChannel }>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/typing`, {
    method: "POST",
    body: { is_typing: isTyping }
  });
}

export async function listChatMentionUsers(query: string) {
  const params = new URLSearchParams({ q: query });
  return apiRequest<{ users: Array<Record<string, unknown>> }>(`/community/users/mentions?${params.toString()}`);
}

export async function createChatPoll(channelIdOrSlug: string, input: { question: string; options: string[]; allow_multiple?: boolean; closes_at?: string }) {
  return apiRequest<{ channel: ChatChannel; message: ChatMessage }>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/polls`, {
    method: "POST",
    body: input
  });
}

export async function voteChatPoll(channelIdOrSlug: string, messageId: string, optionIds: string[]) {
  return apiRequest<{ channel: ChatChannel; message: ChatMessage }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/poll-votes`,
    {
      method: "POST",
      body: { option_ids: optionIds }
    }
  );
}

export async function listScheduledChatAnnouncements(channelIdOrSlug: string) {
  return apiRequest<{ announcements: Array<Record<string, unknown>> }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/scheduled-announcements`
  );
}

export async function scheduleChatAnnouncement(channelIdOrSlug: string, input: { body: string; scheduled_for: string }) {
  return apiRequest<{ announcement: Record<string, unknown> }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/scheduled-announcements`,
    {
      method: "POST",
      body: input
    }
  );
}

export async function cancelScheduledChatAnnouncement(channelIdOrSlug: string, announcementId: string) {
  return apiRequest<{ announcement: Record<string, unknown> }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/scheduled-announcements/${encodeURIComponent(announcementId)}/cancel`,
    {
      method: "POST",
      body: {}
    }
  );
}

export async function updateChatChannelModerationControls(
  channelIdOrSlug: string,
  input: { slow_mode_seconds: number; lockdown_minutes?: number; lockdown_reason?: string; unlock?: boolean }
) {
  return apiRequest<{ channel: ChatChannel }>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/controls/moderation`, {
    method: "PATCH",
    body: input
  });
}

export async function sendChatMessage(channelIdOrSlug: string, input: { body: string; client_message_id?: string; reply_to_message_id?: string; attachment_ids?: string[] }) {
  return apiRequest<{ channel: ChatChannel; message: ChatMessage }>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages`, {
    method: "POST",
    body: input
  });
}

export async function bookmarkChatMessage(channelIdOrSlug: string, messageId: string) {
  return apiRequest<{ bookmarked?: boolean; bookmark?: unknown }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/bookmark`,
    {
      method: "POST",
      body: {}
    }
  );
}

export async function pinChatMessage(channelIdOrSlug: string, messageId: string, durationHours: 24 | 168 | 720 = 168) {
  return apiRequest<{ pin?: unknown; message?: ChatMessage }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/pin`,
    {
      method: "POST",
      body: { duration_hours: durationHours }
    }
  );
}

export async function unpinChatMessage(channelIdOrSlug: string, messageId: string) {
  return apiRequest<{ pin?: unknown; message?: ChatMessage }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/unpin`,
    {
      method: "POST",
      body: {}
    }
  );
}

export async function reportChatMessage(channelIdOrSlug: string, messageId: string, reason: string) {
  return apiRequest<{ report?: unknown }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/report`,
    {
      method: "POST",
      body: { reason }
    }
  );
}

export async function deleteChatMessage(channelIdOrSlug: string, messageId: string, reason?: string) {
  return apiRequest<{ message?: ChatMessage }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/delete`,
    {
      method: "POST",
      body: reason ? { reason } : {}
    }
  );
}

export async function markChatRead(channelIdOrSlug: string, messageId?: string) {
  return apiRequest<{ channel: ChatChannel }>(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/read`, {
    method: "POST",
    body: messageId ? { message_id: messageId } : {}
  });
}

export async function reactChatMessage(channelIdOrSlug: string, messageId: string, reaction: string) {
  return apiRequest<{ message: ChatMessage; action: "added" | "removed" }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/messages/${encodeURIComponent(messageId)}/reactions`,
    {
      method: "POST",
      body: { reaction }
    }
  );
}

export async function getChatAttachmentAccess(channelIdOrSlug: string, attachmentId: string) {
  return apiRequest<ChatAttachmentAccess>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/attachments/${encodeURIComponent(attachmentId)}/access`
  );
}

export async function reserveChatAttachment(channelIdOrSlug: string, originalName?: string) {
  const data = await apiRequest<{ channel: ChatChannel; attachment: ChatAttachment }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/attachments`,
    {
      method: "POST",
      body: { original_name: originalName }
    }
  );
  return data.attachment;
}

export async function cancelChatAttachment(channelIdOrSlug: string, attachmentId: string) {
  return apiRequest<{ channel: ChatChannel; attachment: ChatAttachment | null }>(
    `/community/channels/${encodeURIComponent(channelIdOrSlug)}/attachments/${encodeURIComponent(attachmentId)}/cancel`,
    {
      method: "POST",
      body: {}
    }
  );
}

function absoluteApiUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${env.apiBaseUrl}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function parseUploadError(status: number, body?: string | null) {
  if (!body) return "Attachment upload failed.";
  try {
    const payload = JSON.parse(body) as { error?: { message?: string }; message?: string };
    return payload.error?.message ?? payload.message ?? "Attachment upload failed.";
  } catch {
    return status >= 500 ? "Skillsroom could not store this attachment right now." : "Attachment upload failed.";
  }
}

export async function uploadChatAttachment(channelIdOrSlug: string, input: { uri: string; name: string; mimeType: string }) {
  const reserved = await reserveChatAttachment(channelIdOrSlug, input.name);
  const attachmentId = String(reserved.id);
  const { accessToken } = await getStoredTokens();
  if (!accessToken) throw new ApiError("Sign in again before uploading an attachment.", 401, "AUTH_REQUIRED");

  try {
    const result = await FileSystem.uploadAsync(
      absoluteApiUrl(`/community/channels/${encodeURIComponent(channelIdOrSlug)}/attachments/${encodeURIComponent(attachmentId)}/content`),
      input.uri,
      {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
          "x-chat-attachment-mime-type": input.mimeType,
          "x-chat-attachment-name": encodeURIComponent(input.name)
        }
      }
    );

    if (result.status < 200 || result.status >= 300) {
      throw new ApiError(parseUploadError(result.status, result.body), result.status);
    }

    const payload = JSON.parse(result.body) as { data?: { attachment?: ChatAttachment } };
    if (!payload.data?.attachment) throw new ApiError("Attachment upload finished without attachment details.", 502, "CHAT_ATTACHMENT_UPLOAD_INVALID");
    return payload.data.attachment;
  } catch (error) {
    await cancelChatAttachment(channelIdOrSlug, attachmentId).catch(() => undefined);
    throw error;
  }
}

export function absoluteChatMediaUrl(url?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return absoluteApiUrl(url);
}

export async function listDmRequests() {
  const data = await apiRequest<{ requests: ChatDmRequest[] } | ChatDmRequest[]>("/community/dm-requests");
  return Array.isArray(data) ? data : data.requests ?? [];
}

export async function createDmRequest(input: { recipient_user_id?: string; recipient_username?: string; intro_message?: string }) {
  return apiRequest<{ request: ChatDmRequest }>("/community/dm-requests", {
    method: "POST",
    body: input
  });
}

export async function respondDmRequest(requestId: string, response: "accepted" | "declined") {
  return apiRequest<{ request: ChatDmRequest; channel: ChatChannel | null }>(`/community/dm-requests/${encodeURIComponent(requestId)}/respond`, {
    method: "POST",
    body: { response }
  });
}

