import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

const notificationTone = require("../../../assets/audio/notification-tone.wav");

export function useNotificationSound(enabled: boolean) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const lastPlayedAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      playerRef.current?.remove();
      playerRef.current = null;
      return undefined;
    }

    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers"
    }).catch(() => undefined);

    const player = createAudioPlayer(notificationTone, {
      keepAudioSessionActive: false,
      updateInterval: 1000
    });
    player.volume = 1;
    playerRef.current = player;

    return () => {
      if (playerRef.current === player) playerRef.current = null;
      player.remove();
    };
  }, [enabled]);

  return useCallback(() => {
    if (!enabled || AppState.currentState !== "active") return;

    const now = Date.now();
    if (now - lastPlayedAtRef.current < 1500) return;
    lastPlayedAtRef.current = now;

    const player = playerRef.current;
    if (!player) return;

    player.volume = 1;
    void player.seekTo(0).catch(() => undefined);
    player.play();
  }, [enabled]);
}
