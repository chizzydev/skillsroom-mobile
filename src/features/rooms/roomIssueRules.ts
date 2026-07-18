export type RoomIssueRule = {
  key: string;
  title: string;
  body: string;
};

export const fallbackRoomIssueRules: RoomIssueRule[] = [
  {
    key: "late_opponent",
    title: "Late opponent",
    body: "Give the opponent 10 minutes after both entries are confirmed unless the room or event says otherwise. Keep lobby or chat proof of your attempts to start."
  },
  {
    key: "no_show",
    title: "No-show",
    body: "If a player does not appear after the wait window, the present player should save lobby or chat proof. Skillsroom can award the present player or void and refund when proof is unclear."
  },
  {
    key: "disconnect",
    title: "Disconnect",
    body: "Pause or replay only when both players agree. If there is no agreement, save proof and Skillsroom will review the room history before deciding the result, forfeit, or refund path."
  },
  {
    key: "timeout",
    title: "Timeout",
    body: "When a result response or required action passes its deadline, Skillsroom can decide from saved proof, timestamps, and room activity."
  },
  {
    key: "unverifiable_proof",
    title: "Proof unclear",
    body: "Proof must show the players and result clearly. Missing, edited, cropped, or unclear proof can lead to rejection, more review, or a void and refund."
  }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(value: Record<string, unknown> | null, key: string, fallback: string) {
  const field = value ? value[key] : null;
  return typeof field === "string" ? field : fallback;
}

export function roomIssueRulesFromRuleset(rulesetRules?: Record<string, unknown> | null): RoomIssueRule[] {
  const issueRules = isRecord(rulesetRules?.room_issue_rules) ? rulesetRules.room_issue_rules : null;
  if (!issueRules) return fallbackRoomIssueRules;

  return fallbackRoomIssueRules.map((fallback) => {
    const rawRule = issueRules[fallback.key];
    const rule = isRecord(rawRule) ? rawRule : null;
    return {
      key: fallback.key,
      title: stringField(rule, "title", fallback.title),
      body: stringField(rule, "body", fallback.body)
    };
  });
}
