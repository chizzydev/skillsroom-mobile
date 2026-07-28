import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

const notificationTone = require("../../../assets/audio/notification-tone.wav");

type NotificationAudioPlayer = {
  play: () => void;
  remove: () => void;
  seekTo: (seconds: number) => Promise<void>;
  volume: number;
};

export function useNotificationSound(enabled: boolean) {
  const playerRef = useRef<NotificationAudioPlayer | null>(null);
  const lastPlayedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      playerRef.current?.remove();
      playerRef.current = null;
      return undefined;
    }

    void import("expo-audio")
      .then(async ({ createAudioPlayer, setAudioModeAsync }) => {
        if (cancelled) return;

        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: "mixWithOthers"
        }).catch(() => undefined);

        if (cancelled) return;
        const player = createAudioPlayer(notificationTone, {
          keepAudioSessionActive: false,
          updateInterval: 1000
        });
        player.volume = 1;
        playerRef.current = player;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      const player = playerRef.current;
      playerRef.current = null;
      player?.remove();
    };
  }, [enabled]);

  return useCallback(() => {
    if (!enabled || AppState.currentState !== "active") return;

    const now = Date.now();
    if (now - lastPlayedAtRef.current < 1500) return;
    lastPlayedAtRef.current = now;

    const player = playerRef.current;
    if (!player) return;

    try {
      player.volume = 1;
      void player.seekTo(0).catch(() => undefined);
      player.play();
    } catch {
      if (playerRef.current === player) playerRef.current = null;
      player.remove();
    }
  }, [enabled]);
}
