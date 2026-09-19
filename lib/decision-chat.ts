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
