import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

type ScenarioName =
  | "mobile_api_long_channel"
  | "mobile_api_slow_network"
  | "mobile_api_offline"
  | "mobile_sse_reconnect"
  | "mobile_api_recovered_after_offline";

type ScenarioResult = {
  name: ScenarioName;
  ok: boolean;
  duration_ms: number;
  note?: string;
  observations: Record<string, unknown>;
};

type RequestMetric = {
  label: string;
  method: string;
  path: string;
  ok: boolean;
  status?: number;
  duration_ms: number;
  error?: string;
};

const apiBaseUrl = trimTrailingSlash(process.env.MOBILE_CHAT_QA_API_BASE_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4100");
const channelSlug = process.env.MOBILE_CHAT_QA_CHANNEL ?? "chat_load_lab";
const reportDir = path.join(process.cwd(), "reports", "chat-mobile-network-qa");
const timeoutMs = Number(process.env.MOBILE_CHAT_QA_TIMEOUT_MS ?? 20_000);
const slowNetworkDelayMs = Number(process.env.MOBILE_CHAT_QA_SLOW_DELAY_MS ?? 1_200);
const userId = process.env.MOBILE_CHAT_QA_USER_ID ?? "chat-load-user-001";
const userEmail = process.env.MOBILE_CHAT_QA_EMAIL ?? "chat-load-1@skillsroom.local";
const userPassword = process.env.MOBILE_CHAT_QA_PASSWORD ?? process.env.CHAT_WEB_LOAD_PASSWORD ?? "SkillsroomLoadTest!2026";

let simulateOffline = false;
let artificialDelayMs = 0;
const metrics: RequestMetric[] = [];

async function main() {
  await mkdir(reportDir, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const token = process.env.MOBILE_CHAT_QA_ACCESS_TOKEN ?? await createAccessToken();
  const scenarios: ScenarioResult[] = [];

  let messageIds: string[] = [];
  let olderCursor: string | null = null;
  scenarios.push(await scenario("mobile_api_long_channel", async () => {
    artificialDelayMs = 0;
    const channels = await apiRequest<{ channels?: Array<{ slug?: string; id?: string }> } | Array<{ slug?: string; id?: string }>>(token, "GET", "/community/channels", "channels");
    const channelRows = Array.isArray(channels) ? channels : channels.channels ?? [];
    const target = channelRows.find((channel) => channel.slug === channelSlug || channel.id === channelSlug);
    const messages = await apiRequest<{ messages?: Array<{ id: string; thread_reply_count?: number }>; page_info?: { older_cursor?: string | null } }>(
      token,
      "GET",
      `/community/channels/${encodeURIComponent(channelSlug)}/messages?limit=80&view=list`,
      "messages"
    );
    messageIds = messages.messages?.map((message) => message.id) ?? [];
    olderCursor = messages.page_info?.older_cursor ?? null;
    return {
      channel_found: Boolean(target),
      visible_messages: messageIds.length,
      older_cursor_present: Boolean(olderCursor)
    };
  }));

  scenarios.push(await scenario("mobile_api_slow_network", async () => {
    artificialDelayMs = slowNetworkDelayMs;
    const startedAt = performance.now();
    await apiRequest(token, "GET", `/community/channels/${encodeURIComponent(channelSlug)}/messages/search?q=the&limit=25`, "search");
    await apiRequest(token, "GET", `/community/channels/${encodeURIComponent(channelSlug)}/media?limit=20`, "media");
    if (olderCursor) {
      await apiRequest(token, "GET", `/community/channels/${encodeURIComponent(channelSlug)}/messages?limit=80&view=list&cursor=${encodeURIComponent(olderCursor)}`, "older_messages");
    }
    artificialDelayMs = 0;
    return { artificial_delay_ms: slowNetworkDelayMs, completed_ms: Math.round(performance.now() - startedAt) };
  }, 60_000));

  scenarios.push(await scenario("mobile_api_offline", async () => {
    simulateOffline = true;
    const failedAsNetwork = await apiRequest(token, "GET", "/community/channels", "offline_channels")
      .then(() => false)
      .catch((error) => error instanceof Error && /offline|network/i.test(error.message));
    simulateOffline = false;
    return { failed_as_network_error: failedAsNetwork };
  }));

  scenarios.push(await scenario("mobile_sse_reconnect", async () => {
    const first = await openSseOnce(token, 1_500);
    const second = await openSseOnce(token, 1_500);
    return {
      first_connected: first.connected,
      second_connected: second.connected,
      first_events: first.events,
      second_events: second.events
    };
  }, 30_000));

  scenarios.push(await scenario("mobile_api_recovered_after_offline", async () => {
    simulateOffline = false;
    const presence = await apiRequest(token, "GET", `/community/channels/${encodeURIComponent(channelSlug)}/presence`, "presence");
    const threadMessageId = messageIds[0];
    if (threadMessageId) {
      await apiRequest(token, "GET", `/community/channels/${encodeURIComponent(channelSlug)}/messages/${encodeURIComponent(threadMessageId)}/thread?limit=40&view=list`, "thread");
    }
    return { presence_loaded: Boolean(presence), thread_checked: Boolean(threadMessageId) };
  }));

  const report = {
    run_id: runId,
    started_at: new Date().toISOString(),
    api_base_url: apiBaseUrl,
    channel: channelSlug,
    scenarios,
    summaries: summarizeMetrics(metrics),
    errors: metrics.filter((metric) => !metric.ok).slice(0, 25),
    total_requests: metrics.length,
    ok: scenarios.every((item) => item.ok)
  };
  const reportPath = path.join(reportDir, `chat-mobile-network-qa-${runId}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(reportDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printReport(report, reportPath);
  if (!report.ok) process.exitCode = 1;
}

async function createAccessToken() {
  const devToken = await createDevToken().catch(() => null);
  if (devToken) return devToken;
  return loginToken();
}

async function createDevToken() {
  const response = await fetch(`${apiBaseUrl}/auth/dev-token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-skillsroom-client": "mobile" },
    body: JSON.stringify({ id: userId, email: userEmail, role: "player", ttl_seconds: 60 * 60 * 8 })
  });
  const payload = await response.json().catch(() => null) as { data?: { access_token?: string }; error?: { message?: string } } | null;
  if (!response.ok || !payload?.data?.access_token) {
    throw new Error(payload?.error?.message ?? `Dev token request failed with HTTP ${response.status}.`);
  }
  return payload.data.access_token;
}

async function loginToken() {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-skillsroom-client": "mobile" },
    body: JSON.stringify({ identifier: userEmail, password: userPassword })
  });
  const payload = await response.json().catch(() => null) as { data?: { access_token?: string; accessToken?: string }; error?: { message?: string } } | null;
  const token = payload?.data?.access_token ?? payload?.data?.accessToken;
  if (!response.ok || !token) {
    throw new Error(payload?.error?.message ?? `Login failed with HTTP ${response.status}. Set MOBILE_CHAT_QA_ACCESS_TOKEN if password auth is unavailable.`);
  }
  return token;
}

async function apiRequest<T = unknown>(token: string, method: string, requestPath: string, label: string): Promise<T> {
  const startedAt = performance.now();
  try {
    if (simulateOffline) throw new Error("Simulated mobile offline network error.");
    if (artificialDelayMs > 0) await sleep(artificialDelayMs);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${apiBaseUrl}${requestPath}`, {
      method,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "x-skillsroom-client": "mobile"
      }
    });
    clearTimeout(timeout);
    const payload = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
    metrics.push({ label, method, path: requestPath, ok: response.ok, status: response.status, duration_ms: Math.round(performance.now() - startedAt) });
    if (!response.ok || payload?.ok === false) throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
    return (payload && "data" in payload ? payload.data : payload) as T;
  } catch (error) {
    metrics.push({ label, method, path: requestPath, ok: false, duration_ms: Math.round(performance.now() - startedAt), error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function openSseOnce(token: string, holdMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), holdMs);
  let events = 0;
  let connected = false;
  try {
    const response = await fetch(`${apiBaseUrl}/community/realtime/stream?limit=20`, {
      signal: controller.signal,
      headers: {
        accept: "text/event-stream",
        authorization: `Bearer ${token}`,
        "x-skillsroom-client": "mobile"
      }
    });
    connected = response.ok && Boolean(response.body);
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
    const reader = response.body.getReader();
    const startedAt = performance.now();
    while (performance.now() - startedAt < holdMs) {
      const read = await reader.read();
      if (read.done) break;
      events += 1;
      if (events >= 1) break;
    }
    await reader.cancel().catch(() => undefined);
    return { connected, events };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { connected, events };
    throw error;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function scenario(name: ScenarioName, action: () => Promise<Record<string, unknown>>, timeoutMsForScenario = 30_000): Promise<ScenarioResult> {
  const startedAt = performance.now();
  try {
    const observations = await Promise.race([
      action(),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMsForScenario}ms`)), timeoutMsForScenario);
        timer.unref?.();
      })
    ]);
    return { name, ok: true, duration_ms: Math.round(performance.now() - startedAt), observations };
  } catch (error) {
    simulateOffline = false;
    artificialDelayMs = 0;
    return { name, ok: false, duration_ms: Math.round(performance.now() - startedAt), note: error instanceof Error ? error.message : String(error), observations: {} };
  }
}

function summarizeMetrics(rows: RequestMetric[]) {
  const labels = [...new Set(rows.map((row) => row.label))].sort();
  return labels.map((label) => {
    const scoped = rows.filter((row) => row.label === label);
    const durations = scoped.map((row) => row.duration_ms).sort((left, right) => left - right);
    return {
      label,
      count: scoped.length,
      ok: scoped.filter((row) => row.ok).length,
      failed: scoped.filter((row) => !row.ok).length,
      p50_ms: percentile(durations, 50),
      p95_ms: percentile(durations, 95),
      max_ms: durations.at(-1) ?? null
    };
  });
}

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil((p / 100) * values.length) - 1));
  return values[index] ?? null;
}

function printReport(report: { scenarios: ScenarioResult[]; ok: boolean }, reportPath: string) {
  console.log(`Mobile chat network QA report: ${reportPath}`);
  for (const scenario of report.scenarios) {
    console.log(`${scenario.ok ? "ok" : "fail"} ${scenario.name}: ${scenario.duration_ms}ms${scenario.note ? ` (${scenario.note})` : ""}`);
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
