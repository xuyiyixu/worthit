export type Profile = {
  name: string;
  timezone: string;
  onboarded: boolean;
  recovery: number;
  groupSize: number;
  strangerComfort: number;
  spontaneity: number;
  fomo: number;
  boundaries: number;
  support: number;
};
export type Checkin = {
  id: string;
  createdAt: string;
  social: number;
  physical: number;
  mood: string;
  stress: number;
};
export type Attachment = {
  name: string;
  type: string;
  text?: string;
  dataUrl?: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  mode?: string;
  choices?: string[];
  decision?: DecisionCard;
};
export type DecisionMetric = { label: string; value: number };
export type DecisionCard = {
  score: number;
  confidence: "low" | "medium" | "high";
  summary: string;
  cost: DecisionMetric[];
  upside: DecisionMetric[];
  verdict: "going" | "skip";
  reasons: string[];
  event?: CalendarEvent;
};
export type CalendarEvent = {
  title: string;
  description: string;
  whenText: string | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
};
export type Decision = {
  id: string;
  threadId?: string;
  createdAt: string;
  title: string;
  messages: Message[];
  group: "small" | "large" | "solo";
  people: "friends" | "strangers" | "alone";
  duration: number;
  batteryBefore: number;
  markedChoice?: "going" | "skip";
  event?: CalendarEvent;
};
export type Outcome = {
  id: string;
  decisionId: string;
  createdAt: string;
  went: boolean;
  enjoyment: number;
  after: number;
  glad: boolean;
  again: boolean;
  skipReason?: string;
  skipRelief?: number;
  regret?: number;
};
export type Reading = {
  id: string;
  date: string;
  cards: number[];
  reading: string;
  guidance: string;
  energy: number;
};
export type AppState = {
  profile: Profile;
  checkins: Checkin[];
  decisions: Decision[];
  outcomes: Outcome[];
  readings: Reading[];
};
export const dimensions = [
  [
    "recovery",
    "Need for recovery",
    "After several hours with people, how much recovery do you need?",
    "Very little",
    "A full day",
  ],
  [
    "groupSize",
    "Group-size preference",
    "What kind of gathering feels most comfortable?",
    "One-on-one",
    "A big crowd",
  ],
  [
    "strangerComfort",
    "Comfort with new people",
    "How comfortable are you around people you don’t know?",
    "Not yet comfortable",
    "Very comfortable",
  ],
  [
    "spontaneity",
    "Spontaneity",
    "How do last-minute invitations feel?",
    "I prefer a plan",
    "Count me in",
  ],
  [
    "fomo",
    "FOMO tendency",
    "How often does fear of missing out influence your plans?",
    "Rarely",
    "Very often",
  ],
  [
    "boundaries",
    "Boundary comfort",
    "How comfortable are you saying no or leaving early?",
    "It’s difficult",
    "Very comfortable",
  ],
  [
    "support",
    "Social-support preference",
    "On a difficult day, what usually helps you recharge?",
    "Quiet time alone",
    "Time with someone",
  ],
] as const;
export function localDay(date = new Date(), timezone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export const uid = () => crypto.randomUUID();
export function emptyState(name = "Friend"): AppState {
  return {
    profile: {
      name,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      onboarded: false,
      recovery: 60,
      groupSize: 40,
      strangerComfort: 50,
      spontaneity: 50,
      fomo: 50,
      boundaries: 50,
      support: 50,
    },
    checkins: [],
    decisions: [],
    outcomes: [],
    readings: [],
  };
}
export const current = (s: AppState): Checkin =>
  s.checkins[0] ?? {
    id: "",
    createdAt: "",
    social: 50,
    physical: 50,
    mood: "Okay",
    stress: 50,
  };
export function demoState(): AppState {
  const s = emptyState("Alex");
  s.profile.onboarded = true;
  s.profile.strangerComfort = 35;
  s.profile.boundaries = 70;
  const now = new Date();
  s.checkins = [62, 48, 73, 55, 82, 65, 70].map((social, i) => ({
    id: uid(),
    createdAt: new Date(now.getTime() - i * 86400000).toISOString(),
    social,
    physical: 70,
    mood: "Good",
    stress: 30,
  }));
  [
    "Coffee with Maya",
    "A friend’s birthday",
    "Book club evening",
    "Campus mixer",
    "Sunday brunch",
    "A concert downtown",
  ].forEach((title, i) => {
    const d: Decision = {
      id: uid(),
      createdAt: new Date(now.getTime() - (i + 1) * 86400000).toISOString(),
      title,
      messages: [],
      group: i % 2 ? "large" : "small",
      people: i === 3 ? "strangers" : "friends",
      duration: i % 2 ? 180 : 60,
      batteryBefore: 70,
    };
    s.decisions.push(d);
    s.outcomes.push({
      id: uid(),
      decisionId: d.id,
      createdAt: d.createdAt,
      went: true,
      enjoyment: i % 2 ? 6 : 9,
      after: i % 2 ? 35 : 62,
      glad: true,
      again: i !== 3,
    });
  });
  s.readings = [1, 2, 3].map((days) => ({
    id: uid(),
    date: localDay(
      new Date(now.getTime() - days * 86400000),
      s.profile.timezone,
    ),
    cards: [(days * 3) % 22, 22 + days, (days * 5) % 22],
    energy: 65,
    reading:
      "A sample reflection: notice where connection feels easy, and where a quieter pace would help. Choose one small thing that supports your day.",
    guidance:
      "Make time for a nourishing conversation and a little space to recharge. This seeded reading is a reflection prompt, not a prediction.",
  }));
  return s;
}
export function patterns(s: AppState) {
  return s.outcomes
    .filter((o) => o.went)
    .map((o) => ({ o, d: s.decisions.find((d) => d.id === o.decisionId) }))
    .filter((x): x is { o: Outcome; d: Decision } => !!x.d);
}
export function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
export function patternSummary(s: AppState) {
  const p = patterns(s);
  return {
    observations: p.length,
    historyWeight: p.length / (p.length + 5),
    smallEnjoyment: average(
      p.filter((x) => x.d.group === "small").map((x) => x.o.enjoyment),
    ),
    largeEnjoyment: average(
      p.filter((x) => x.d.group === "large").map((x) => x.o.enjoyment),
    ),
    averageBatteryChange: average(p.map((x) => x.o.after - x.d.batteryBefore)),
    shortEnjoyment: average(
      p.filter((x) => x.d.duration <= 90).map((x) => x.o.enjoyment),
    ),
    friendsEnjoyment: average(
      p.filter((x) => x.d.people === "friends").map((x) => x.o.enjoyment),
    ),
  };
}
export function inferContext(
  text: string,
): Pick<Decision, "group" | "people" | "duration"> {
  return {
    group: /party|concert|mixer|crowd|festival/i.test(text)
      ? "large"
      : /alone|solo|study|rest/i.test(text)
        ? "solo"
        : "small",
    people: /stranger|network|mixer/i.test(text)
      ? "strangers"
      : /alone|solo|rest/i.test(text)
        ? "alone"
        : "friends",
    duration: /concert|party|festival/i.test(text) ? 180 : 60,
  };
}
export function demoReply(s: AppState, messages: Message[]): string {
  const state = current(s),
    h = patternSummary(s),
    last = messages.filter((m) => m.role === "user").at(-1)?.content ?? "",
    context = inferContext(
      messages
        .filter((m) => m.role === "user")
        .map(
          (m) =>
            m.content +
            " " +
            (m.attachments ?? []).map((a) => a.text ?? "").join(" "),
        )
        .join(" "),
    );
  const relevant = patterns(s).filter((x) => x.d.group === context.group);
  const prior =
    context.group === "large" ? s.profile.groupSize : 100 - s.profile.groupSize;
  const observed = average(relevant.map((x) => x.o.enjoyment)) * 10;
  const weight = relevant.length / (relevant.length + 5);
  const fit = Math.round(prior * (1 - weight) + observed * weight);
  const follow = messages.length > 1;
  const tired =
    /tired|exhausted|drained|overwhelmed/i.test(last) ||
    state.social < 40 ||
    state.physical < 35 ||
    state.stress > 75;
  const boundary =
    s.profile.boundaries < 40
      ? "You could prepare a simple exit line: “I’m glad I came; I need to recharge now.”"
      : "Give yourself permission to change your mind.";
  return `${follow ? "Let’s build on that." : "Let’s make room for both what you want and what you have energy for."}\n\n${/leave|say|text|decline/i.test(last) ? "You could say: “I’d love to see you. I’m low on energy today, so I can stay for about an hour. Would that work?”" : tired ? "A brief visit or a quiet evening would both be reasonable today." : fit >= 65 ? "Your preferences and recorded experience lean toward making room for this plan. A short visit is still an option." : "A short, intentional plan could be a good place to start."}\n\nGo normally — ${tired ? "consider this only if you genuinely want to go and can make room for recovery." : "a reasonable option if you’re excited and have room to recover afterward."}\n\nGo briefly — try 45–60 minutes, choose a comfortable person to connect with, and plan your own way home.\n\nSkip — protect some downtime and suggest a lower-pressure way to connect another day.\n\nWhat I’m weighing\n• For a ${context.group} gathering, your blended preference/history fit is ${fit}/100 (${relevant.length} matching events). This is a reflection aid, not a probability of enjoyment.\n• Your social energy is ${state.social}%, physical energy ${state.physical}%, and stress ${state.stress}%.${!state.createdAt ? " You haven’t checked in yet, so these are neutral starting values." : ""}\n• Your initial profile suggests ${s.profile.recovery > 60 ? "a stronger need for recovery" : "a flexible need for recovery"} and ${s.profile.groupSize < 50 ? "a preference for smaller groups" : "comfort with larger groups"}.\n• ${h.observations ? `Across ${h.observations} recorded events, small gatherings average ${h.smallEnjoyment.toFixed(1)}/10 enjoyment. History currently contributes ${Math.round(h.historyWeight * 100)}% of the profile/history balance; this is an observation, not a prediction.` : "There aren’t enough outcomes yet to identify personal patterns."}\n\n${boundary} ${context.people === "strangers" ? "Would you know anyone there?" : "What part of this plan are you most looking forward to—or dreading?"}`;
}

export function minutesUntilNextDay(now: Date, timezone: string) {
  const day = localDay(now, timezone);
  let low = now.getTime(),
    high = low + 30 * 3600000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (localDay(new Date(mid), timezone) === day) low = mid;
    else high = mid;
  }
  return Math.ceil((high - now.getTime()) / 60000);
}
