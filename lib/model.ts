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
  energyRecorded?: boolean;
  estimatedEnergyLoad?: number;
  energyExplanation?: string;
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
  energyRecorded?: boolean;
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
export const current = (s: AppState): Checkin => {
  const today = localDay(new Date(), s.profile.timezone);
  const latestToday = s.checkins.find((checkin) => {
    const createdAt = new Date(checkin.createdAt);
    return Number.isFinite(createdAt.getTime()) && localDay(createdAt, s.profile.timezone) === today;
  });
  return latestToday ?? {
    id: "",
    createdAt: "",
    social: 50,
    physical: 50,
    mood: "Okay",
    stress: 50,
  };
};

const moodEnergy: Record<string, number> = {
  Bad: 15,
  Low: 25,
  Okay: 50,
  Good: 90,
  Great: 90,
  Fantastic: 100,
};

export function checkinEnergy(checkin: Checkin) {
  const mood = moodEnergy[checkin.mood] ?? 50;
  return Math.round(
    mood * 0.3 +
      checkin.physical * 0.3 +
      (100 - checkin.stress) * 0.25 +
      checkin.social * 0.15,
  );
}

export function eventDurationMinutes(event?: CalendarEvent) {
  if (!event?.startAt || !event.endAt) return null;
  const start = Date.parse(event.startAt);
  const end = Date.parse(event.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60000);
}

export function calendarEventLoad(decision: Decision, state?: AppState) {
  if (
    Number.isInteger(decision.estimatedEnergyLoad) &&
    decision.estimatedEnergyLoad! >= 0 &&
    decision.estimatedEnergyLoad! <= 40
  ) return decision.estimatedEnergyLoad!;

  const duration = eventDurationMinutes(decision.event);
  const durationLoad = duration === null ? 3 : Math.min(18, Math.max(2, Math.round(duration / 25)));
  const profile = state?.profile;
  const crowdLoad = decision.group === "large"
    ? Math.round(2 + (100 - (profile?.groupSize ?? 50)) / 12)
    : decision.group === "small"
      ? Math.round(1 + Math.abs((profile?.groupSize ?? 40) - 35) / 30)
      : 0;
  const peopleLoad = decision.people === "strangers"
    ? Math.round(2 + (100 - (profile?.strangerComfort ?? 50)) / 14)
    : decision.people === "friends"
      ? Math.round(1 + (100 - (profile?.support ?? 50)) / 50)
      : 0;
  const description = `${decision.title} ${decision.event?.description ?? ""} ${decision.event?.location ?? ""}`;
  const travelLoad = /travel|drive|airport|downtown|across town|commute/i.test(description) ? 5 : 0;
  const startHour = decision.event?.startAt ? new Date(decision.event.startAt).getHours() : null;
  const lateLoad = startHour !== null && startHour >= 20
    ? Math.round(2 + (profile?.recovery ?? 50) / 35)
    : 0;
  const baseLoad = durationLoad + crowdLoad + peopleLoad + travelLoad + lateLoad;
  if (!state) return Math.min(40, baseLoad);

  const similar = patterns(state).filter(
    ({ d, o }) => {
      const historicalDuration = eventDurationMinutes(d.event);
      const sameDurationBand =
        duration === null ||
        (historicalDuration !== null && (duration <= 90) === (historicalDuration <= 90));
      return (
        d.energyRecorded &&
        o.energyRecorded &&
        d.group === decision.group &&
        d.people === decision.people &&
        sameDurationBand
      );
    },
  );
  if (!similar.length) return Math.min(40, baseLoad);
  const historicalDrain = Math.max(
    0,
    -average(similar.map(({ d, o }) => o.after - d.batteryBefore)),
  );
  const historyWeight = similar.length / (similar.length + 3);
  return Math.min(
    40,
    Math.max(0, Math.round(baseLoad * (1 - historyWeight) + historicalDrain * historyWeight)),
  );
}

export function energyForecast(state: AppState, now = new Date()) {
  const nowMs = now.getTime();
  const endOfDay = nowMs + minutesUntilNextDay(now, state.profile.timezone) * 60000;
  const plans = state.decisions.filter((decision) => {
    if (decision.markedChoice !== "going" || !decision.event?.startAt) return false;
    const start = Date.parse(decision.event.startAt);
    const parsedEnd = decision.event.endAt ? Date.parse(decision.event.endAt) : Number.NaN;
    const end = Number.isFinite(parsedEnd) ? parsedEnd : start;
    return Number.isFinite(start) && start < endOfDay && end >= nowMs;
  });
  const checkin = current(state);
  const energy = checkin.createdAt ? checkinEnergy(checkin) : 50;
  const calendarLoad = Math.min(
    60,
    plans.reduce((total, plan) => total + calendarEventLoad(plan, state), 0),
  );
  return {
    energy,
    calendarLoad,
    projected: Math.max(5, energy - calendarLoad),
    plans,
  };
}

export function demoState(): AppState {
  const s = emptyState("Alex");
  s.profile.onboarded = true;
  s.profile.strangerComfort = 35;
  s.profile.boundaries = 70;
  const now = new Date();
  s.checkins = [90, 72, 81, 68, 86, 75, 79].map((social, i) => ({
    id: uid(),
    createdAt: new Date(now.getTime() - i * 86400000).toISOString(),
    social,
    physical: i ? 70 : 90,
    mood: "Good",
    stress: i ? 30 : 20,
  }));
  const conversations = [
    {
      title: "Coffee with Maya",
      location: "Commonplace Coffee",
      dayOffset: -1,
      startHour: 16,
      startMinute: 30,
      duration: 60,
      markedChoice: "going" as const,
      score: 78,
      summary: "A short, clearly bounded coffee offers meaningful connection without taking over the evening.",
      upside: [{ label: "close connection", value: 88 }, { label: "enjoyment", value: 76 }],
      cost: [{ label: "social energy", value: 38 }, { label: "time", value: 30 }],
      reasons: ["You genuinely want to see Maya", "A one-hour boundary protects recovery time", "The setting is familiar and low pressure"],
      messages: [
        ["user", "Maya asked if I want to get coffee after class tomorrow. I miss her, but this week has been nonstop and I also need a quiet evening."],
        ["assistant", "It sounds like you want the connection, just not another open-ended plan. How would a short coffee feel compared with spending the whole evening together?"],
        ["user", "A short coffee actually sounds nice. If I leave by 5:30, I’d still have the evening to myself."],
        ["assistant", "That sounds like a good fit: say yes, name the time boundary up front, and keep the rest of the evening clear. You could text: “I’d love to—want to grab coffee from 4:30 to 5:30?”"],
      ],
    },
    {
      title: "A friend’s birthday",
      location: "Spirit Hall",
      dayOffset: -2,
      startHour: 19,
      startMinute: 0,
      duration: 90,
      markedChoice: "going" as const,
      score: 68,
      summary: "Showing up early for a limited time keeps the friendship upside while reducing the crowd cost.",
      upside: [{ label: "friendship", value: 86 }, { label: "celebration", value: 72 }],
      cost: [{ label: "crowd", value: 69 }, { label: "recovery", value: 62 }],
      reasons: ["The relationship matters to you", "Arriving early avoids the busiest part", "A planned exit keeps the night manageable"],
      messages: [
        ["user", "Jordan’s birthday party is Friday night. I care about them, but it’s a big party and I’ve already had three social nights this week."],
        ["assistant", "The birthday matters to you, and the crowd plus timing sound like the expensive parts. Would showing up for the first hour still feel meaningful?"],
        ["user", "Yes. I could arrive early, give them their gift, and leave before it gets packed."],
        ["assistant", "That gives you the connection without committing your whole night. Tell Jordan in advance that you’re excited to celebrate and may head out early, then arrange your own ride home so leaving stays easy."],
      ],
    },
    {
      title: "Book club evening",
      location: "Hillman Library café",
      dayOffset: -3,
      startHour: 18,
      startMinute: 30,
      duration: 90,
      markedChoice: "going" as const,
      score: 74,
      summary: "The smaller familiar group is a good fit, and being halfway through the book does not erase the value of going.",
      upside: [{ label: "connection", value: 80 }, { label: "learning", value: 75 }],
      cost: [{ label: "preparation", value: 42 }, { label: "energy", value: 35 }],
      reasons: ["You usually enjoy this group", "The discomfort is about preparation, not the people", "You can participate honestly without finishing every page"],
      messages: [
        ["user", "Book club meets tonight, but I only finished half the book. I’m tempted to skip because I’ll feel unprepared."],
        ["assistant", "Is the uncomfortable part the social energy, or mostly feeling like you need to have finished the book to belong there?"],
        ["user", "Mostly feeling unprepared. I usually enjoy everyone once I’m there."],
        ["assistant", "Then going is probably worth it. You can be honest that you’re halfway through and listen during the spoiler-heavy parts. Your past smaller-group plans have tended to leave you glad you went."],
      ],
    },
    {
      title: "Campus mixer",
      location: "William Pitt Union ballroom",
      dayOffset: -4,
      startHour: 17,
      startMinute: 30,
      duration: 45,
      markedChoice: "going" as const,
      score: 63,
      summary: "The mixer is worth a brief visit when the goal is two useful conversations rather than working the whole room.",
      upside: [{ label: "career", value: 79 }, { label: "new contacts", value: 73 }],
      cost: [{ label: "strangers", value: 72 }, { label: "crowd", value: 67 }],
      reasons: ["The event connects directly to your program", "A two-conversation goal makes success concrete", "A 45-minute cap limits the energy cost"],
      messages: [
        ["user", "There’s a campus mixer for design students. I want to meet people in the program, but I won’t know anyone and networking events drain me."],
        ["assistant", "The career upside is real, but a large room of strangers is a high-energy setting for you. What would make the event feel finite and purposeful?"],
        ["user", "Maybe stay 45 minutes and try to have two actual conversations instead of working the whole room."],
        ["assistant", "That’s a strong plan. Go for 45 minutes, aim for two genuine conversations, and leave once you’ve done that. A specific goal should make the room feel less open-ended."],
      ],
    },
    {
      title: "Sunday brunch",
      location: "The Porch at Schenley",
      dayOffset: -6,
      startHour: 11,
      startMinute: 0,
      duration: 90,
      markedChoice: "going" as const,
      score: 66,
      summary: "Brunch fits if it stays a 90-minute break and the afternoon remains protected for project work.",
      upside: [{ label: "roommates", value: 78 }, { label: "break", value: 70 }],
      cost: [{ label: "deadline", value: 61 }, { label: "time", value: 55 }],
      reasons: ["A break may help you reset", "The group is familiar and supportive", "Leaving by 12:30 protects the deadline"],
      messages: [
        ["user", "My roommates want to do brunch Sunday, but I have a project due Monday and brunch with them can turn into an all-day hangout."],
        ["assistant", "You seem to want both the break and a protected work block. How much time can you spend without making Sunday night stressful?"],
        ["user", "About 90 minutes. I’d feel okay if I started work again by 1:00."],
        ["assistant", "Then brunch can fit if you make the boundary concrete: meet at 11:00, leave by 12:30, and tell them you have a project block afterward. You don’t need to decline the connection to protect the deadline."],
      ],
    },
    {
      title: "A concert downtown",
      location: "Stage AE",
      dayOffset: -6,
      startHour: 20,
      startMinute: 0,
      duration: 180,
      markedChoice: "skip" as const,
      score: 36,
      summary: "The late finish and travel cost outweigh a plan driven mostly by FOMO.",
      upside: [{ label: "fun", value: 58 }, { label: "friends", value: 62 }],
      cost: [{ label: "late night", value: 86 }, { label: "tomorrow", value: 82 }],
      reasons: ["You are not especially invested in the band", "The plan ends late before an early class", "Most of the pull is coming from FOMO"],
      messages: [
        ["user", "There are cheap tickets for a concert downtown tonight. I like the band, but doors are at 8 and I have an early class tomorrow."],
        ["assistant", "This sounds fun, but the late finish, travel, and tomorrow morning all add cost. Is this a band you’d be genuinely disappointed to miss?"],
        ["user", "Honestly, no. I know a few songs, but I’m mostly reacting because everyone else is going."],
        ["assistant", "Skipping sounds more aligned than forcing it from FOMO. Save the money and energy, and make a lower-key plan with your friends later this week."],
      ],
    },
  ] as const;
  conversations.forEach((conversation, i) => {
    const {
      title,
      location,
      messages,
      dayOffset,
      startHour,
      startMinute,
      duration,
      markedChoice,
      score,
      summary,
      upside,
      cost,
      reasons,
    } = conversation;
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + dayOffset,
      startHour,
      startMinute,
    );
    const end = new Date(start.getTime() + duration * 60000);
    const event: CalendarEvent = {
      title,
      description: title,
      whenText: start.toLocaleString(),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      location,
    };
    const decision: DecisionCard = {
      score,
      confidence: "high",
      summary,
      cost: [...cost],
      upside: [...upside],
      verdict: score >= 60 ? "going" : "skip",
      reasons: [...reasons],
      event,
    };
    const d: Decision = {
      id: uid(),
      createdAt: start.toISOString(),
      title,
      messages: messages.map(([role, content], messageIndex) => ({
        id: uid(),
        role,
        content,
        ...(role === "assistant" ? { mode: messageIndex === messages.length - 1 ? decision.verdict : "guidance" } : {}),
        ...(messageIndex === messages.length - 1 ? { decision } : {}),
      })),
      group: i % 2 ? "large" : "small",
      people: i === 3 ? "strangers" : "friends",
      duration,
      batteryBefore: 70,
      energyRecorded: true,
      markedChoice,
      event,
    };
    s.decisions.push(d);
    s.outcomes.push({
      id: uid(),
      decisionId: d.id,
      createdAt: d.createdAt,
      went: markedChoice === "going",
      enjoyment: markedChoice === "going" ? [9, 7, 8, 7, 8, 0][i] : 0,
      after: markedChoice === "going" ? [64, 48, 59, 50, 61, 76][i] : 76,
      glad: markedChoice === "going",
      again: markedChoice === "going" && i !== 3,
      ...(markedChoice === "skip" ? { skipReason: "Needed rest", skipRelief: 9, regret: 2 } : {}),
      energyRecorded: true,
    });
  });
  const upcoming = [
    {
      title: "Design review",
      description: "A focused review of the final project flow with the team.",
      group: "small" as const,
      people: "friends" as const,
      duration: 60,
      weekday: 1,
      startHour: 14,
      startMinute: 0,
      location: "Project room",
    },
    {
      title: "SteelHacks showcase",
      description: "Present the project, meet judges, and explore other teams’ demos.",
      group: "large" as const,
      people: "strangers" as const,
      duration: 150,
      weekday: 6,
      startHour: 11,
      startMinute: 0,
      location: "Main showcase hall",
    },
  ];
  upcoming.forEach((plan) => {
    const dayOffset = (plan.weekday - now.getDay() + 7) % 7 || 7;
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + dayOffset,
      plan.startHour,
      plan.startMinute,
    );
    const end = new Date(start.getTime() + plan.duration * 60 * 1000);
    s.decisions.push({
      id: uid(),
      createdAt: now.toISOString(),
      title: plan.title,
      messages: [],
      group: plan.group,
      people: plan.people,
      duration: plan.duration,
      batteryBefore: checkinEnergy(s.checkins[0]),
      energyRecorded: true,
      markedChoice: "going",
      event: {
        title: plan.title,
        description: plan.description,
        whenText: start.toLocaleString(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        location: plan.location,
      },
    });
  });
  const semesterYear = now.getFullYear();
  const semesterStart = new Date(semesterYear, 7, 24);
  const semesterEnd = new Date(semesterYear, 10, 20);
  const classSchedule = [
    {
      weekdays: [1, 3],
      title: "CS 0449 (LEC)",
      description: "Introduction to Systems Software lecture.",
      location: "5502 Sennott Square",
      startHour: 11,
      startMinute: 0,
      duration: 75,
      energyLoad: 6,
    },
    {
      weekdays: [2, 4],
      title: "CMPINF 0011 (LEC)",
      description: "Introduction to Computing for the Information Sciences lecture.",
      location: "324 Cathedral of Learning",
      startHour: 13,
      startMinute: 0,
      duration: 75,
      energyLoad: 5,
    },
    {
      weekdays: [1, 3],
      title: "CS 1530 (LEC)",
      description: "Software Engineering lecture.",
      location: "305 Information Sciences Building",
      startHour: 16,
      startMinute: 0,
      duration: 75,
      energyLoad: 6,
    },
    {
      weekdays: [2, 4],
      title: "CS 0441 (LEC)",
      description: "Discrete Structures for Computer Science lecture.",
      location: "125 Frick Fine Arts Building",
      startHour: 16,
      startMinute: 0,
      duration: 75,
      energyLoad: 5,
    },
    {
      weekdays: [5],
      title: "CS 0441 (REC)",
      description: "Discrete Structures for Computer Science recitation.",
      location: "501 Information Sciences Building",
      startHour: 11,
      startMinute: 0,
      duration: 50,
      energyLoad: 4,
    },
    {
      weekdays: [5],
      title: "CS 0449 (REC)",
      description: "Introduction to Systems Software recitation.",
      location: "405 Information Sciences Building",
      startHour: 12,
      startMinute: 0,
      duration: 50,
      energyLoad: 4,
    },
  ];
  for (
    const date = new Date(semesterStart);
    date <= semesterEnd;
    date.setDate(date.getDate() + 1)
  ) {
    classSchedule
      .filter((course) => course.weekdays.includes(date.getDay()))
      .forEach((course) => {
        const start = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          course.startHour,
          course.startMinute,
        );
        const end = new Date(start.getTime() + course.duration * 60000);
        s.decisions.push({
          id: uid(),
          createdAt: now.toISOString(),
          title: course.title,
          messages: [],
          group: "large",
          people: "strangers",
          duration: course.duration,
          batteryBefore: checkinEnergy(s.checkins[0]),
          energyRecorded: true,
          estimatedEnergyLoad: course.energyLoad,
          energyExplanation: "A recurring class with a predictable time, location, and workload.",
          markedChoice: "going",
          event: {
            title: course.title,
            description: course.description,
            whenText: start.toLocaleString(undefined, {
              weekday: "long",
              hour: "numeric",
              minute: "2-digit",
            }),
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            location: course.location,
          },
        });
      });
  }
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
  const energyHistory = p.filter(({ d, o }) => d.energyRecorded && o.energyRecorded);
  return {
    observations: p.length,
    historyWeight: p.length / (p.length + 5),
    smallEnjoyment: average(
      p.filter((x) => x.d.group === "small").map((x) => x.o.enjoyment),
    ),
    largeEnjoyment: average(
      p.filter((x) => x.d.group === "large").map((x) => x.o.enjoyment),
    ),
    averageBatteryChange: average(
      energyHistory.map((x) => x.o.after - x.d.batteryBefore),
    ),
    shortEnjoyment: average(
      p.filter((x) => x.d.duration > 0 && x.d.duration <= 90).map((x) => x.o.enjoyment),
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
    energy = checkinEnergy(state),
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
    energy < 40 ||
    state.physical < 35 ||
    state.stress > 75;
  const boundary =
    s.profile.boundaries < 40
      ? "You could prepare a simple exit line: “I’m glad I came; I need to recharge now.”"
      : "Give yourself permission to change your mind.";
  return `${follow ? "Let’s build on that." : "Let’s make room for both what you want and what you have energy for."}\n\n${/leave|say|text|decline/i.test(last) ? "You could say: “I’d love to see you. I’m low on energy today, so I can stay for about an hour. Would that work?”" : tired ? "A brief visit or a quiet evening would both be reasonable today." : fit >= 65 ? "Your preferences and recorded experience lean toward making room for this plan. A short visit is still an option." : "A short, intentional plan could be a good place to start."}\n\nGo normally — ${tired ? "consider this only if you genuinely want to go and can make room for recovery." : "a reasonable option if you’re excited and have room to recover afterward."}\n\nGo briefly — try 45–60 minutes, choose a comfortable person to connect with, and plan your own way home.\n\nSkip — protect some downtime and suggest a lower-pressure way to connect another day.\n\nWhat I’m weighing\n• For a ${context.group} gathering, your blended preference/history fit is ${fit}/100 (${relevant.length} matching events). This is a reflection aid, not a probability of enjoyment.\n• Your combined energy estimate is ${energy}% (social ${state.social}%, physical ${state.physical}%, stress ${state.stress}%).${!state.createdAt ? " You haven’t checked in yet, so this uses a neutral starting value." : ""}\n• Your initial profile suggests ${s.profile.recovery > 60 ? "a stronger need for recovery" : "a flexible need for recovery"} and ${s.profile.groupSize < 50 ? "a preference for smaller groups" : "comfort with larger groups"}.\n• ${h.observations ? `Across ${h.observations} recorded events, small gatherings average ${h.smallEnjoyment.toFixed(1)}/10 enjoyment. History currently contributes ${Math.round(h.historyWeight * 100)}% of the profile/history balance; this is an observation, not a prediction.` : "There aren’t enough outcomes yet to identify personal patterns."}\n\n${boundary} ${context.people === "strangers" ? "Would you know anyone there?" : "What part of this plan are you most looking forward to—or dreading?"}`;
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
