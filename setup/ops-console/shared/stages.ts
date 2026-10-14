/** Pipeline stages, in order. `candidate` only exists for lead-generator results awaiting review. */
export const STAGES = [
  "candidate", "prospect", "contacted", "conversation", "demo_called",
  "discovery", "proposal", "won", "lost", "not_now",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  candidate: "Candidate", prospect: "Prospect", contacted: "Contacted", conversation: "Conversation",
  demo_called: "Demo called", discovery: "Discovery", proposal: "Proposal", won: "Won", lost: "Lost", not_now: "Not now",
};

/** Board columns: everything except the review queue. */
export const BOARD_STAGES = STAGES.filter((s) => s !== "candidate");

/** "Possible clients" = conversation and beyond, still open. */
export const POSSIBLE_CLIENT_STAGES: Stage[] = ["conversation", "demo_called", "discovery", "proposal"];

export const SEGMENTS = ["residential", "commercial", "mixed", "unknown"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const TOUCH_TYPES = ["email", "call", "demo_call", "discovery", "proposal", "note", "stage_change"] as const;
export type TouchType = (typeof TOUCH_TYPES)[number];

export const NEXT_ACTION_TYPES = ["call", "email", "follow_up", "other"] as const;

export const isStage = (s: unknown): s is Stage => typeof s === "string" && (STAGES as readonly string[]).includes(s);
