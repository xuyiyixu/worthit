export type DecisionVerdict = "undecided" | "going" | "skip";

export type DecisionMetric = {
  label: string;
  value: number;
};

export type DecisionReply = {
  reply: string;
  score: number | null;
  confidence: "low" | "medium" | "high";
  summary: string;
  cost: DecisionMetric[];
  upside: DecisionMetric[];
  verdict: DecisionVerdict;
  reasons: string[];
  choices: string[];
  event: {
    title: string;
    description: string;
    whenText: string | null;
    startAt: string | null;
    endAt: string | null;
    location: string | null;
  } | null;
  threadId?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
};

export type ChatAttachment = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

export function questionNeedsTypedAnswer(question: string) {
  return /\b(?:estimated?|cost|price|amount|budget|how (?:much|many|far|long)|\d+\s*(?:to|-|–)\s*\d+|minutes?|hours?|miles?|dollars?)\b/i.test(question);
}
