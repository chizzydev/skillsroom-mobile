import { Linking } from "react-native";
import { router } from "expo-router";
import { evidenceViewerRoute, openableEvidenceUrl } from "../../config/evidence-links";

export function openEvidenceInApp(value?: string | null, title = "Evidence") {
  const route = evidenceViewerRoute(value, title);
  if (route) {
    router.push(route as never);
    return true;
  }

  const url = openableEvidenceUrl(value);
  if (!url) return false;
  void Linking.openURL(url);
  return true;
}
