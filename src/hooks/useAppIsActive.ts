import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function useAppIsActive() {
  const [appIsActive, setAppIsActive] = useState(() => AppState.currentState === "active");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppIsActive(nextState === "active");
    });
    return () => subscription.remove();
  }, []);

  return appIsActive;
}
