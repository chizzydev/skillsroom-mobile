import { env } from "./env";

export function openableEvidenceUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${env.webAppUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}
