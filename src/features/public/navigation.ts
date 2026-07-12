import { router } from "expo-router";

export type NativeGuideTopic = "how-it-works" | "rules" | "trust" | "support";
export type CommunityHubTab = "hub" | "highlights" | "updates" | "clans" | "rankings";

export function openNativeGuide(topic: NativeGuideTopic) {
  router.push({ pathname: "/public-guide", params: { topic } } as never);
}

export function openNativeCommunity(tab: CommunityHubTab = "hub") {
  router.push({ pathname: "/community", params: { tab } } as never);
}

export function openPublicWeb(path: string) {
  router.push({ pathname: "/public-web", params: { path } } as never);
}
