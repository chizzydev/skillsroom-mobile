import EventSource, { type EventSourceListener } from "react-native-sse";
import { env } from "../config/env";
import { getStoredTokens } from "./session";

type RealtimeStreamEventName = "ready" | "heartbeat" | "realtime-event";

type RealtimeHandlers = {
  onEvent: (event: unknown) => void;
  onReady?: () => void;
  onError?: (error: { status?: number; message?: string }) => void;
};

export type RealtimeStreamHandle = {
  close: () => void;
  transport: "native-sse";
};

function parseJsonEvent(event: { data: string | null }, callback: (value: unknown) => void) {
  if (!event.data) return;
  try {
    callback(JSON.parse(event.data));
  } catch {
    // Ignore malformed realtime payloads and wait for the next event.
  }
}

export async function openRealtimeStream(handlers: RealtimeHandlers): Promise<RealtimeStreamHandle | null> {
  const { accessToken } = await getStoredTokens();
  if (!accessToken) return null;

  try {
    const source = new EventSource<RealtimeStreamEventName>(`${env.apiBaseUrl}/community/realtime/stream`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      timeout: 0,
      timeoutBeforeConnection: 250,
      pollingInterval: 5000,
      lineEndingCharacter: "\n"
    });

    const readyListener: EventSourceListener<RealtimeStreamEventName, "ready"> = () => handlers.onReady?.();
    const eventListener: EventSourceListener<RealtimeStreamEventName, "realtime-event"> = (event) => parseJsonEvent(event, handlers.onEvent);
    const errorListener: EventSourceListener<RealtimeStreamEventName, "error"> = (event) => {
      const status = "xhrStatus" in event ? event.xhrStatus : undefined;
      const message = "message" in event ? event.message : undefined;
      handlers.onError?.({ status, message });
    };

    source.addEventListener("ready", readyListener);
    source.addEventListener("realtime-event", eventListener);
    source.addEventListener("error", errorListener);

    return {
      transport: "native-sse",
      close: () => {
        source.removeAllEventListeners();
        source.close();
      }
    };
  } catch (error) {
    handlers.onError?.({ message: error instanceof Error ? error.message : "Unable to start realtime stream." });
    return null;
  }
}
