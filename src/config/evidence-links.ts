import { env } from "./env";

const evidencePathPattern = /\/(?:api\/evidence-files|evidence\/files)\/([^/?#]+)/i;

export function evidenceFileName(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const match = evidencePathPattern.exec(parsed.pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    const match = evidencePathPattern.exec(trimmed);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }
}

export function evidenceApiUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const fileName = evidenceFileName(trimmed);
  if (fileName) return `${env.apiBaseUrl}/evidence/files/${encodeURIComponent(fileName)}`;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${env.webAppUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function evidenceWebUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const fileName = evidenceFileName(trimmed);
  if (fileName) return `${env.webAppUrl}/api/evidence-files/${encodeURIComponent(fileName)}`;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${env.webAppUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function openableEvidenceUrl(value?: string | null) {
  return evidenceApiUrl(value);
}

export function evidenceViewerRoute(value?: string | null, title = "Evidence") {
  const url = evidenceApiUrl(value);
  const externalUrl = evidenceWebUrl(value);
  if (!url) return null;
  const fileName = evidenceFileName(value);
  return {
    pathname: "/(app)/evidence",
    params: {
      title,
      url,
      ...(externalUrl ? { externalUrl } : {}),
      ...(fileName ? { fileName } : {})
    }
  } as const;
}
