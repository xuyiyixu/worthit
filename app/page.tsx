"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Battery,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Home,
  Leaf,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  Paperclip,
  Plus,
  RefreshCw,
  Sparkles,
  Sun,
  User,
  X,
} from "lucide-react";
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster, toast } from "sonner";
import {
  AppState,
  Attachment,
  Checkin,
  Decision,
  Message,
  Outcome,
  Profile,
  Reading,
  average,
  calendarEventLoad,
  checkinEnergy,
  current,
  demoState,
  dimensions,
  emptyState,
  energyForecast,
  eventDurationMinutes,
  inferContext,
  localDay,
  minutesUntilNextDay,
  patterns,
  patternSummary,
  uid,
} from "@/lib/model";
import { deck, positions } from "@/lib/tarot";
import { inferProfile, questions } from "@/lib/questions";
import {
  api,
  DEMO_KEY,
  drawDemo,
  persistDemo,
  readAttachments,
} from "@/lib/client";
import cardStyles from "./decision-cards.module.css";
import { metricScoreOutOfTen, questionNeedsTypedAnswer } from "@/lib/decision-chat";
const links = [
  ["Home", Home],
  ["What Should I Do?", MessageCircle],
  ["My Calendar", CalendarDays],
  ["Tarot", Sparkles],
  ["Insights", Heart],
  ["Profile", User],
] as const;
type PageName = (typeof links)[number][0];
type Account = { id: string; email?: string };
function decisionTitle(decision: Decision) {
  const firstMessage = decision.messages.find((message) => message.role === "user")?.content.trim() ?? "";
  const extracted = decision.event?.title.trim();
  if (
    extracted &&
    extracted.length <= 80 &&
    !extracted.includes("\n") &&
    extracted !== firstMessage &&
    !firstMessage.startsWith(extracted)
  ) return extracted;
  const brand = firstMessage.match(/\b([A-Z][A-Za-z0-9-]{2,})\s+is\s+back\b/);
  if (brand) return /\bkickoff\b/i.test(firstMessage) ? `${brand[1]} kickoff` : `${brand[1]} event`;
  if (/friends? (?:have )?invited me/i.test(firstMessage)) return "Friends’ invitation";
  const namedEvent = firstMessage.match(/\b((?:[A-Z][\w’'-]+\s+){0,2}(?:kickoff|workshop|mixer|concert|dinner|brunch|meeting|conference|party|lecture|game|festival))\b/i);
  return namedEvent?.[1].trim() || "Plan discussion";
}
function Range({
  label,
  value,
  onChange,
  max = 100,
  ends,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
  ends?: readonly string[];
}) {
  return (
    <div className="range-field">
      <div className="row between">
        <label>{label}</label>
        <strong>
          {value}
          {max === 100 ? "%" : `/${max}`}
        </strong>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={max === 10 ? 1 : 0}
        max={max}
        step={1}
      />
      {ends && (
        <div className="range-ends">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
    </div>
  );
}
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
function SideNav({
  page,
  navigate,
  state,
  checkin,
}: {
  page: PageName;
  navigate: (v: PageName) => void;
  state: AppState;
  checkin: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  const forecast = energyForecast(state),
    hasEnergy = Boolean(current(state).createdAt);
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="brand">
          <span>✦</span>
          <h2>
            What Should
            <br />I Do?
          </h2>
        </div>
        <p className="brand-note">A little clarity. A little more you.</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {links.map(([label, Icon]) => (
            <SidebarMenuItem key={label}>
              <SidebarMenuButton
                isActive={page === label}
                onClick={() => {
                  navigate(label);
                  setOpenMobile(false);
                }}
              >
                <Icon />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <button
          className="battery-box"
          onClick={() => {
            setOpenMobile(false);
            checkin();
          }}
        >
          <div className="row">
            <Battery size={19} /> Your Energy
          </div>
          <strong>
            {hasEnergy ? forecast.energy : "—"}
            <span>{hasEnergy ? "%" : ""}</span>
          </strong>
          <div className="meter">
            <i style={{ width: `${hasEnergy ? forecast.energy : 0}%` }} />
          </div>
          <p>
            {hasEnergy
              ? forecast.energy < 40
                ? "Make a little room for rest."
                : forecast.calendarLoad
                  ? `${forecast.calendarLoad} points of planned activity load today.`
                  : "Room for whatever feels right."
              : "Take a moment to check in."}
          </p>
          <span className="text-button">
            Update your check-in <ArrowUpRight size={15} />
          </span>
        </button>
        <div className="sidebar-quote">
          <Moon size={30} />
          <p>
            Your pace.
            <br />
            Your kind of day.
          </p>
          <small>MAKE SPACE FOR YOURSELF</small>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
export default function Page() {
  const [page, setPage] = useState<PageName>("Home"),
    [state, setState] = useState<AppState>(emptyState()),
    [account, setAccount] = useState<Account | null>(null),
    [demo, setDemo] = useState(false),
    [ready, setReady] = useState(false),
    [config, setConfig] = useState({ auth: false, ai: false, vision: false });
  const [auth, setAuth] = useState<"login" | "signup" | null>(null),
    [survey, setSurvey] = useState(false),
    [checkin, setCheckin] = useState(false),
    [manualCalendar, setManualCalendar] = useState(false),
    [editingPlan, setEditingPlan] = useState<Decision | null>(null),
    [feedback, setFeedback] = useState<Decision | null>(null),
    [viewPlan, setViewPlan] = useState<Decision | null>(null),
    [extractingPlan, setExtractingPlan] = useState(false),
    [saving, setSaving] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [tick, setTick] = useState(new Date()),
    [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [viewReading, setViewReading] = useState<Reading | null>(null);
  const stateRef = useRef(state);
  const pendingEnergyAction = useRef<(() => void) | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const c = await api("/api/config");
        if (cancelled) return;
        setConfig(c);
        const value = decodeURIComponent(location.hash.slice(1));
        const found = links.find(
          ([name]) =>
            name.toLowerCase().replaceAll(" ", "-").replace("?", "") === value,
        );
        if (found) setPage(found[0]);
        let a = await api("/api/auth");
        if (!a.user && c.auth) {
          try {
            a = await api("/api/auth", { action: "refresh" });
          } catch {}
        }
        if (cancelled) return;
        if (a.user) {
          const data = await api("/api/data");
          if (cancelled) return;
          setState(data);
          setAccount(a.user);
          setSurvey(!data.profile.onboarded);
        } else {
          const saved = localStorage.getItem(DEMO_KEY);
          if (saved) {
            const data = JSON.parse(saved);
            setState(data);
            setDemo(true);
            setSurvey(!data.profile.onboarded);
          } else setState(demoState());
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not load your account.",
        );
        setState(demoState());
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void boot();
    const timer = setInterval(() => setTick(new Date()), 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!account) return;
    const timer = setInterval(
      () => {
        api("/api/auth", { action: "refresh" }).catch(() =>
          toast.error("Your session expired. Please log in again."),
        );
      },
      40 * 60 * 1000,
    );
    return () => clearInterval(timer);
  }, [account]);
  useEffect(() => {
    const handler = () => {
      if (demo) {
        const saved = localStorage.getItem(DEMO_KEY);
        if (saved) setState(JSON.parse(saved));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [demo]);
  const navigate = useCallback((next: PageName) => {
    setPage(next);
    window.history.replaceState(
      null,
      "",
      `#${next.toLowerCase().replaceAll(" ", "-").replace("?", "")}`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (t: unknown, o: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "navigate_social_companion",
          description: "Navigate to a page in What Should I Do?",
          inputSchema: {
            type: "object",
            properties: {
              page: { type: "string", enum: links.map((l) => l[0]) },
            },
            required: ["page"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: { page: string }) => {
            if (!links.some((l) => l[0] === input.page))
              throw new Error("Unknown page");
            navigate(input.page as PageName);
            return { page: input.page };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [navigate]);
  function startDemo(fresh = false) {
    const next = fresh ? emptyState("Friend") : state;
    persistDemo(next);
    setState(next);
    setDemo(true);
    setAuth(null);
    setSurvey(!next.profile.onboarded);
    toast.success(
      fresh
        ? "Your private browser demo is ready."
        : "Demo ready. Sample history is included.",
    );
  }
  function requireAccount(action: () => void, options: { energy?: boolean } = {}) {
    if (!account && !demo) {
      setAuth("signup");
      return;
    }
    if (!state.profile.onboarded) {
      setSurvey(true);
      return;
    }
    const today = localDay(new Date(), state.profile.timezone);
    const checkedInToday = state.checkins.some((item) =>
      localDay(new Date(item.createdAt), state.profile.timezone) === today,
    );
    if (options.energy !== false && !checkedInToday) {
      pendingEnergyAction.current = action;
      setCheckin(true);
      return;
    }
    action();
  }
  async function save(
    table: "profiles" | "checkins" | "decisions" | "outcomes",
    data: Profile | Checkin | Decision | Outcome,
  ) {
    const latest = stateRef.current;
    const key = table === "profiles" ? "profile" : table;
    let next: AppState;
    if (table === "profiles") next = { ...latest, profile: data as Profile };
    else {
      const list = latest[key as "checkins" | "decisions" | "outcomes"] as (
        Checkin | Decision | Outcome
      )[];
      next = {
        ...latest,
        [key]: [
          data,
          ...list.filter((v) => v.id !== (data as { id: string }).id),
        ],
      };
    }
    if (account) await api("/api/data", { table, data });
    else if (demo) persistDemo(next);
    else throw new Error("Choose demo mode or log in first.");
    stateRef.current = next;
    setState(next);
    return next;
  }
  async function estimateCalendarPlan(decision: Decision) {
    const candidate = {
      ...decision,
      estimatedEnergyLoad: undefined,
      energyExplanation: undefined,
    };
    if (account && config.ai) {
      try {
        const estimate = await api("/api/calendar/energy", { decision: candidate });
        return {
          ...candidate,
          estimatedEnergyLoad: estimate.energyLoad as number,
          energyExplanation: estimate.explanation as string,
        };
      } catch {}
    }
    const estimatedEnergyLoad = calendarEventLoad(candidate, stateRef.current);
    return {
      ...candidate,
      estimatedEnergyLoad,
      energyExplanation: "Personalized from the plan’s duration, timing, group, familiarity, your preferences, and any relevant past outcomes.",
    };
  }
  async function saveCalendarPlan(decision: Decision) {
    const estimated = await estimateCalendarPlan(decision);
    if (account) await api("/api/data", { table: "calendar", data: estimated });
    const latest = stateRef.current;
    const exists = latest.decisions.some((item) => item.id === estimated.id);
    const next = {
      ...latest,
      decisions: exists
        ? latest.decisions.map((item) => item.id === estimated.id ? estimated : item)
        : [estimated, ...latest.decisions],
    };
    if (demo) persistDemo(next);
    stateRef.current = next;
    setState(next);
    setViewPlan(estimated);
    if (estimated.event?.startAt) setCalendarMonth(new Date(estimated.event.startAt));
    return estimated;
  }
  async function removeDecision(decision: Decision) {
    if (account) {
      if (!decision.threadId) throw new Error("This conversation has not been saved yet.");
      const response = await fetch("/api/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: decision.threadId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not delete this conversation.");
    }
    const latest = stateRef.current;
    const next = {
      ...latest,
      decisions: latest.decisions.filter((item) => item.id !== decision.id),
      outcomes: latest.outcomes.filter((item) => item.decisionId !== decision.id),
    };
    if (demo) persistDemo(next);
    stateRef.current = next;
    setState(next);
    if (selected === decision.id) setSelected(null);
  }
  async function signOut() {
    try {
      if (account) await api("/api/auth", { action: "logout" });
      setAccount(null);
      setDemo(false);
      localStorage.removeItem(DEMO_KEY);
      setState(demoState());
      setPage("Home");
      setSelected(null);
      toast.success("Signed out.");
    } catch (e) {
      toast.error(String(e));
    }
  }
  const energy = current(state),
    hasEnergy = Boolean(energy.createdAt),
    forecast = energyForecast(state, tick),
    today = localDay(tick, state.profile.timezone),
    reading = state.readings.find((r) => r.date === today),
    summary = patternSummary(state),
    active = state.decisions.find((d) => d.id === selected) ?? null,
    calendarPlans = state.decisions
      .filter((d) => d.markedChoice === "going")
      .sort((a, b) => {
        const aTime = a.event?.startAt ? Date.parse(a.event.startAt) : Number.POSITIVE_INFINITY;
        const bTime = b.event?.startAt ? Date.parse(b.event.startAt) : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      }),
    visibleCalendarPlans = calendarPlans.filter(
      (decision) => calendarDay(decision.event?.startAt, calendarMonth) !== null,
    );
  async function draw() {
    requireAccount(async () => {
      setSaving(true);
      try {
        const result = account
          ? await api("/api/data", { action: "draw" })
          : await drawDemo(state);
        const next = {
          ...state,
          readings: [
            result,
            ...state.readings.filter((r) => r.date !== result.date),
          ],
        };
        setState(next);
        if (demo) persistDemo(next);
        toast.success("Your three cards are ready.");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not save your reading.",
        );
      } finally {
        setSaving(false);
      }
    }, { energy: false });
  }
  async function openPlanDetails(decision: Decision) {
    setViewPlan(decision);
    const event = decision.event;
    const needsExtraction =
      !event?.whenText ||
      !event.location ||
      !event.description ||
      event.description === "A plan you are considering." ||
      event.description === "Event details were not provided.";
    if (!needsExtraction || !decision.messages.length) return;
    setExtractingPlan(true);
    try {
      const text = decision.messages
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .join("\n\n");
      const response = await fetch("/api/decide/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: decision.threadId, text }),
      });
      const payload = await response.json() as {
        error?: string;
        event?: NonNullable<Decision["event"]>;
      };
      if (!response.ok || !payload.event)
        throw new Error(payload.error ?? "Could not extract event details.");
      const updated = {
        ...decision,
        title: payload.event.title,
        event: payload.event,
      };
      const latest = stateRef.current;
      const next = {
        ...latest,
        decisions: latest.decisions.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      };
      stateRef.current = next;
      setState(next);
      setViewPlan(updated);
      if (demo) persistDemo(next);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not extract event details.",
      );
    } finally {
      setExtractingPlan(false);
    }
  }
  return (
    <SidebarProvider>
      <Toaster richColors position="bottom-right" />
      <SideNav
        page={page}
        navigate={(next) => {
          if (next === "Insights") {
            requireAccount(() => navigate(next));
            return;
          }
          navigate(next);
        }}
        state={state}
        checkin={() => requireAccount(() => setCheckin(true), { energy: false })}
      />
      <main className="workspace">
        <header className="topbar">
          <SidebarTrigger />
          <span className="eyebrow">YOUR EVERYDAY COMPANION</span>
          <div className="account">
            {(demo || !account) && (
              <span className="pill">
                {demo ? "Local demo" : "Demo preview"}
              </span>
            )}
            {account || demo ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="account-button">
                  <span className="avatar">{state.profile.name[0]}</span>
                  <span>Hi, {state.profile.name}</span>
                  <ChevronDown size={15} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("Profile")}>
                    <User size={16} />
                    My profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut size={16} />
                    {demo ? "Exit demo" : "Log out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <button className="quiet" onClick={() => setAuth("login")}>
                  Log In
                </button>
                <button className="primary" onClick={() => setAuth("signup")}>
                  Sign Up
                </button>
              </>
            )}
          </div>
        </header>
        <div className="page">
          {!ready ? (
            <div className="panel loading">
              <Sparkles />
              Getting your day ready…
            </div>
          ) : (
            <>
              {!account && !demo && (
                <div className="demo-banner">
                  <span>
                    Meet your everyday companion. Explore with sample data, or
                    make it your own.
                  </span>
                  <button onClick={() => startDemo()}>
                    Explore demo <ArrowUpRight size={15} />
                  </button>
                </div>
              )}
              {page === "Home" && (
                <>
                  <Heading
                    eyebrow="A MOMENT FOR YOU"
                    title={
                      account || demo
                        ? `Make today feel like you, ${state.profile.name}.`
                        : "Make today feel like you."
                    }
                    subtitle="You don’t have to do it all. Just what feels right."
                  />
                  <div className="home-grid">
                    <section className="hero">
                      <span className="pill">
                        A LITTLE CLARITY GOES A LONG WAY
                      </span>
                      <h2>
                        Big plans?
                        <br />
                        Mixed feelings?
                      </h2>
                      <p>
                        Talk it through with a companion that gets
                        <br />
                        your energy, your patterns, and your priorities.
                      </p>
                      <button
                        className="light"
                        onClick={() => navigate("What Should I Do?")}
                      >
                        Let’s figure it out <ArrowUpRight size={18} />
                      </button>
                      <Sparkles className="hero-star" />
                    </section>
                    <section className="panel energy">
                      <div className="row between">
                        <h3>Your energy, right now</h3>
                        <Battery size={20} />
                      </div>
                      <div className="energy-circle">
                        {hasEnergy ? forecast.energy : "—"}
                        <span>{hasEnergy ? "%" : ""}</span>
                      </div>
                      <h3>
                        {!hasEnergy
                          ? "How are you arriving today?"
                          : forecast.energy < 40
                            ? "A little room to recharge"
                            : "Enough room to choose your pace"}
                      </h3>
                      <p>
                        {energy.createdAt
                          ? `Now ${forecast.energy}% · after today’s plans about ${forecast.projected}%`
                          : "Four quick questions will create your first energy estimate."}
                      </p>
                      <button
                        className="secondary"
                        onClick={() => requireAccount(() => setCheckin(true), { energy: false })}
                      >
                        Check in with yourself
                      </button>
                    </section>
                  </div>
                  <div className="section-heading">
                    <h2>A little more in tune</h2>
                    <span>Small moments. Meaningful choices.</span>
                  </div>
                  <div className="three-grid">
                    {[
                      [
                        "✦",
                        "Your daily pause",
                        "Three cards. A fresh perspective.",
                        "Tarot",
                      ],
                      [
                        "♡",
                        "You’re learning about you",
                        `${summary.observations} experiences to reflect on.`,
                        "Insights",
                      ],
                      [
                        "↗",
                        "Close the loop",
                        "How did your last plan feel?",
                        "What Should I Do?",
                      ],
                    ].map(([icon, title, body, target]) => (
                      <button
                        className="panel feature"
                        key={title}
                        onClick={() => navigate(target as PageName)}
                      >
                        <span className="feature-icon">{icon}</span>
                        <h3>{title}</h3>
                        <p>{body}</p>
                        <ArrowUpRight />
                      </button>
                    ))}
                  </div>
                  <section className="panel recent-panel">
                    <div className="row between">
                      <h3>Recent moments</h3>
                      <button
                        className="text-button"
                        onClick={() => navigate("Insights")}
                      >
                        See your patterns <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {state.decisions.length ? (
                      state.decisions.slice(0, 3).map((d) => {
                        const o = state.outcomes.find(
                          (o) => o.decisionId === d.id,
                        );
                        return (
                          <div className="recent-row" key={d.id}>
                            <span className="mini-icon">
                              <MessageCircle size={18} />
                            </span>
                            <div>
                              <strong>{decisionTitle(d)}</strong>
                              <p>
                                {new Date(d.event?.startAt ?? d.createdAt).toLocaleDateString()} ·{" "}
                                {o
                                  ? o.went
                                    ? `Enjoyment ${o.enjoyment}/10`
                                    : "Chose to stay in"
                                  : "Ready for a little reflection"}
                              </p>
                            </div>
                            <button
                              className="quiet"
                              onClick={() =>
                                requireAccount(() => setFeedback(d))
                              }
                            >
                              {o ? "View / edit" : "Reflect"}{" "}
                              <ArrowUpRight size={15} />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <p className="empty-copy">
                        Your conversations and reflections will find a home
                        here.
                      </p>
                    )}
                  </section>
                </>
              )}
              {page === "What Should I Do?" && (
                <>
                  <Heading
                    eyebrow="YOUR SPACE TO THINK"
                    title="What’s on your mind?"
                    subtitle="Let’s find a plan that fits your day—and your energy."
                  />
                  <Chat
                    state={state}
                    active={active}
                    config={config}
                    demo={demo || !account}
                    selected={setSelected}
                    save={save}
                    remove={removeDecision}
                    requireAccount={requireAccount}
                    onFeedback={setFeedback}
                  />
                </>
              )}
              {page === "Tarot" && (
                <>
                  <div className="tarot-heading">
                    <div>
                      <p className="eyebrow">A DAILY RITUAL</p>
                      <h1>
                        Daily Tarot <span>✧</span>
                      </h1>
                      <p>
                        One set of cards. A little space for a new perspective.
                      </p>
                    </div>
                    <Moon size={66} strokeWidth={0.7} />
                  </div>
                  <div className="tarot-grid">
                    <div>
                      <section className="panel draw-panel">
                        <div className="row between">
                          <div>
                            <h2>Your cards for today</h2>
                            <p className="small">
                              {tick.toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                                timeZone: state.profile.timezone,
                              })}
                            </p>
                          </div>
                          <span className="pill">
                            {reading ? (
                              <>
                                <Check size={13} /> 1/1 drawn today
                              </>
                            ) : (
                              "YOUR DAILY THREE"
                            )}
                          </span>
                        </div>
                        <div className="cards-grid">
                          {[0, 1, 2].map((i) => (
                            <TarotCard
                              key={i}
                              id={reading?.cards[i]}
                              position={positions[i]}
                              index={i}
                            />
                          ))}
                        </div>
                        {reading ? (
                          <>
                            <div className="reading-block">
                              <h3>
                                <Sparkles size={21} />
                                Today’s reading
                              </h3>
                              <p>{reading.reading}</p>
                            </div>
                            <div className="reading-block guidance">
                              <h3>
                                <Heart size={20} />A little guidance, just for
                                you
                              </h3>
                              <p>{reading.guidance}</p>
                            </div>
                            <div className="tarot-quote">
                              “The most useful answers begin with a little
                              curiosity.”
                            </div>
                          </>
                        ) : (
                          <div className="draw-action">
                            <h3>Take a breath. Make a little space.</h3>
                            <p>
                              Draw three cards to reflect on your energy,
                              connections, and next step.
                            </p>
                            <button
                              className="primary"
                              onClick={draw}
                              disabled={saving}
                            >
                              <Sparkles size={17} />
                              {saving
                                ? "Drawing your cards…"
                                : "Draw my three cards"}
                            </button>
                          </div>
                        )}
                        <p className="disclaimer">
                          For reflection and fun. These cards don’t predict the
                          future.
                        </p>
                      </section>
                    </div>
                    <aside className="tarot-aside">
                      <section className="panel glance">
                        <h3>
                          <Sparkles size={20} />
                          Today at a glance
                        </h3>
                        {[
                          [
                            Sun,
                            "Your energy",
                            hasEnergy
                              ? `${forecast.energy}% now · ${forecast.projected}% after today’s plans`
                              : "50% neutral starting point",
                          ],
                          [
                            Heart,
                            "Connection",
                            reading
                              ? deck[reading.cards[1]].theme.split(" · ")[0]
                              : "Make room for care",
                          ],
                          [
                            Leaf,
                            "Reflection",
                            reading
                              ? deck[reading.cards[2]].theme.split(" · ")[0]
                              : "Listen to yourself",
                          ],
                          [
                            Sparkles,
                            "A gentle intention",
                            forecast.energy < 40
                              ? "Rest without guilt"
                              : "Connection at your pace",
                          ],
                        ].map(([Icon, label, value]) => {
                          const I = Icon as typeof Sun;
                          return (
                            <div className="glance-row" key={String(label)}>
                              <I size={25} />
                              <div>
                                <strong>{String(label)}</strong>
                                <p>{String(value)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </section>
                      <div className="tomorrow">
                        <Clock size={26} />
                        <div>
                          <h3>
                            {reading
                              ? "A fresh perspective tomorrow"
                              : "Your daily pause is ready"}
                          </h3>
                          <p>
                            {reading ? (
                              <Countdown
                                now={tick}
                                timezone={state.profile.timezone}
                              />
                            ) : (
                              "Three cards, once a day."
                            )}
                          </p>
                        </div>
                      </div>
                      <section className="panel past">
                        <h3>
                          <Clock size={20} />
                          Past readings
                        </h3>
                        {state.readings.filter((r) => r.date !== today)
                          .length ? (
                          state.readings
                            .filter((r) => r.date !== today)
                            .map((r) => (
                              <button
                                key={r.id}
                                onClick={() => setViewReading(r)}
                              >
                                <strong>
                                  {new Date(
                                    r.date + "T12:00:00",
                                  ).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </strong>
                                <p>
                                  {r.cards.map((c) => deck[c].name).join(" · ")}
                                </p>
                                <ArrowUpRight size={16} />
                              </button>
                            ))
                        ) : (
                          <p className="empty-copy">
                            Your ritual starts here. Today’s reading will join
                            your history tomorrow.
                          </p>
                        )}
                      </section>
                      <div className="little-quote">
                        <Leaf size={28} />
                        <p>
                          Small insights today,
                          <br />a little more you tomorrow.
                        </p>
                      </div>
                    </aside>
                  </div>
                </>
              )}
              {page === "Insights" && (
                <>
                  <Heading
                    eyebrow="PATTERNS, NOT LABELS"
                    title="Get to know your kind of good."
                    subtitle="Your real experiences tell a more useful story than a personality type."
                  />
                  <Insights state={state} />
                </>
              )}
              {page === "Profile" && (
                <>
                  <Heading
                    eyebrow="ALWAYS A WORK IN PROGRESS"
                    title="Your social landscape."
                    subtitle="A starting point for understanding yourself. You’re allowed to change."
                  />
                  <div className="profile-grid">
                    <section className="panel">
                      <div className="profile-identity">
                        <span className="avatar large">
                          {state.profile.name[0]}
                        </span>
                        <div>
                          <h2>{state.profile.name}</h2>
                          <p>
                            {account?.email ??
                              "Local demo · stored in this browser"}
                          </p>
                        </div>
                      </div>
                      <ProfileForm
                        profile={state.profile}
                        onSave={(p) => save("profiles", p)}
                        requireAccount={(action) => requireAccount(action, { energy: false })}
                      />
                      <div className="privacy-note">
                        <Heart size={20} />
                        <p>
                          {account
                            ? "Your account data is protected by per-user database access policies."
                            : "Demo data stays in this browser. It is not a secure account and does not sync between devices."}{" "}
                          Attachments sent for live guidance are processed by
                          NVIDIA; raw images are not saved.
                        </p>
                      </div>
                    </section>
                    <section className="panel">
                      {state.profile.onboarded ? (
                        <>
                          <div className="row between">
                            <h2>Your social profile</h2>
                            <button
                              className="text-button"
                              onClick={() => requireAccount(() => setSurvey(true), { energy: false })}
                            >
                              Edit / retake <RefreshCw size={14} />
                            </button>
                          </div>
                          {dimensions.map(([key, label]) => (
                            <div className="dimension" key={key}>
                              <div className="row between">
                                <span>{label}</span>
                                <strong>{state.profile[key]}%</strong>
                              </div>
                              <div className="meter">
                                <i style={{ width: `${state.profile[key]}%` }} />
                              </div>
                            </div>
                          ))}
                          <p className="small">
                            These are self-reported preferences, not a diagnosis.
                            Your outcomes gradually add more context.
                          </p>
                        </>
                      ) : (
                        <div className="profile-incomplete">
                          <Sparkles size={28} />
                          <h2>Complete your starting profile</h2>
                          <p>Your preference results will appear only after you answer all eight questions.</p>
                          <button className="primary" onClick={() => setSurvey(true)}>
                            Start the questions <ArrowUpRight size={16} />
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                </>
              )}
              {page === "My Calendar" && (
                <>
                  <Heading
                    eyebrow="MAKE SPACE FOR WHAT MATTERS"
                    title="A little breathing room."
                    subtitle="Your calendar, without the pressure to fill every square."
                  />
                  <section className="panel calendar-panel">
                    <div className="row between calendar-toolbar">
                      <div className="calendar-month-nav">
                        <button
                          type="button"
                          aria-label="Previous month"
                          onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <h2>
                          {calendarMonth.toLocaleDateString(undefined, {
                            month: "long",
                            year: "numeric",
                          })}
                        </h2>
                        <button
                          type="button"
                          aria-label="Next month"
                          onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => requireAccount(() => {
                          setEditingPlan(null);
                          setManualCalendar(true);
                        }, { energy: false })}
                      >
                        <Plus size={16} /> Add a plan
                      </button>
                    </div>
                    <CalendarView
                      today={tick}
                      month={calendarMonth}
                      decisions={calendarPlans}
                      onSelect={(decision) => void openPlanDetails(decision)}
                    />
                    {visibleCalendarPlans.length ? (
                      <div className={cardStyles.calendarPlans}>
                        <p className="eyebrow">PLANS THIS MONTH</p>
                        {visibleCalendarPlans.map((decision) => (
                          <article className={cardStyles.calendarPlan} key={decision.id}>
                            <span><CalendarDays size={18} /></span>
                            <div>
                              <strong>{decisionTitle(decision)}</strong>
                              <p>{formatEventDetails(decision.event)}</p>
                              <small>
                                Personalized energy load · {calendarEventLoad(decision, state)} points
                                {eventDurationMinutes(decision.event) !== null
                                  ? ` · ${eventDurationMinutes(decision.event)} min`
                                  : " · duration unavailable"}
                              </small>
                            </div>
                            <button className="quiet" onClick={() => void openPlanDetails(decision)}>
                              View details <ArrowUpRight size={15} />
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="calendar-empty">
                        <CalendarDays size={25} />
                        <h3>Room for your plans. And your pauses.</h3>
                        <p>Plans you mark “I’m going” will appear here.</p>
                        <button
                          className="secondary"
                          onClick={() => requireAccount(() => {
                            setEditingPlan(null);
                            setManualCalendar(true);
                          }, { energy: false })}
                        >
                          Add a plan <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}
              <p className="footer-note">
                A more intentional you, one day at a time.
              </p>
            </>
          )}
        </div>
      </main>
      <Dialog open={!!auth} onOpenChange={(v) => !v && setAuth(null)}>
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>
              {auth === "signup"
                ? "A little more in tune with you."
                : "Welcome back."}
            </DialogTitle>
            <DialogDescription>
              {config.auth
                ? "Save your profile, conversations, and daily rituals to your account."
                : "Account sync isn’t connected yet. Everything is ready to explore in a browser demo."}
            </DialogDescription>
          </DialogHeader>
          <AuthForm
            mode={auth ?? "login"}
            enabled={config.auth}
            switchMode={() => setAuth(auth === "login" ? "signup" : "login")}
            onSuccess={async (user) => {
              const data = await api("/api/data");
              setState(data);
              setAccount(user);
              setDemo(false);
              setAuth(null);
              setSurvey(!data.profile.onboarded);
            }}
          />
          <div className="demo-choices">
            <button className="secondary" onClick={() => startDemo()}>
              Explore the seeded demo
            </button>
            <button className="quiet" onClick={() => startDemo(true)}>
              Start fresh in demo mode
            </button>
            <p className="small">
              No credentials needed. Demo data is saved only on this device.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={survey}
        onOpenChange={(open) => {
          if (open || state.profile.onboarded) setSurvey(open);
        }}
      >
        <DialogContent
          className="app-dialog survey-dialog"
          showCloseButton={state.profile.onboarded}
          onEscapeKeyDown={(event) => {
            if (!state.profile.onboarded) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (!state.profile.onboarded) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Everyone has a different social rhythm.</DialogTitle>
            <DialogDescription>
              Eight quick questions. No labels, no right answers.
            </DialogDescription>
          </DialogHeader>
          <Survey
            profile={state.profile}
            save={async (answers) => {
              if (account) {
                const response = await fetch("/api/profile", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ answers }),
                });
                const payload = await response.json() as { error?: string };
                if (!response.ok) throw new Error(payload.error ?? "Could not save your answers.");
                setState(await api("/api/data"));
              } else {
                const source = inferProfile(answers);
                await save("profiles", {
                  ...state.profile,
                  onboarded: true,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  recovery: Math.round((1 - source.crowdTolerance) * 100),
                  groupSize: Math.round(source.largeGroupPreference * 100),
                  strangerComfort: Math.round(source.strangerOpenness * 100),
                  spontaneity: Math.round(source.noveltySeeking * 100),
                  fomo: Math.round(source.connectionMotivation * 100),
                  boundaries: Math.round((1 - source.familiarPeoplePreference / 2) * 100),
                  support: Math.round(source.connectionMotivation * 100),
                });
              }
              setSurvey(false);
              toast.success("Your social profile is ready.");
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={checkin} onOpenChange={(open) => {
        setCheckin(open);
        if (!open) pendingEnergyAction.current = null;
      }}>
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>How are you arriving today?</DialogTitle>
            <DialogDescription>
              A quick check-in helps put your choices in context.
            </DialogDescription>
          </DialogHeader>
          <CheckinForm
            initial={energy}
            save={async (value) => {
              await save("checkins", value);
              const continuation = pendingEnergyAction.current;
              pendingEnergyAction.current = null;
              setCheckin(false);
              toast.success("Check-in saved. A little more in tune.");
              continuation?.();
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={manualCalendar} onOpenChange={(open) => {
        setManualCalendar(open);
        if (!open) setEditingPlan(null);
      }}>
        <DialogContent className="app-dialog calendar-dialog">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit calendar plan" : "Add a calendar plan"}</DialogTitle>
            <DialogDescription>
              {editingPlan
                ? "Update the plan details. Its personalized energy estimate will be recalculated."
                : "Add a confirmed plan directly. Its scheduled time will be used for calendar placement and energy estimates."}
            </DialogDescription>
          </DialogHeader>
          <ManualCalendarForm
            key={editingPlan?.id ?? "new-calendar-plan"}
            decision={editingPlan}
            energy={hasEnergy ? checkinEnergy(energy) : 50}
            energyRecorded={hasEnergy}
            save={async (decision) => {
              await saveCalendarPlan(decision);
              setManualCalendar(false);
              setEditingPlan(null);
              toast.success(editingPlan ? "Calendar plan updated." : "Plan added to your calendar.");
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={!!feedback} onOpenChange={(v) => !v && setFeedback(null)}>
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>How did it feel?</DialogTitle>
            <DialogDescription>{feedback ? decisionTitle(feedback) : ""}</DialogDescription>
          </DialogHeader>
          {feedback && (
            <FeedbackForm
              key={feedback.id}
              decision={feedback}
              outcome={state.outcomes.find((o) => o.decisionId === feedback.id)}
              save={async (d, o) => {
                const reflected = {
                  ...d,
                  markedChoice: o.went ? ("going" as const) : ("skip" as const),
                };
                let next = {
                  ...state,
                  decisions: state.decisions.map((x) =>
                    x.id === reflected.id ? reflected : x,
                  ),
                  outcomes: [
                    o,
                    ...state.outcomes.filter((x) => x.decisionId !== reflected.id),
                  ],
                };
                if (account) {
                  await api("/api/data", { table: "decisions", data: reflected });
                  await api("/api/data", { table: "outcomes", data: o });
                  next = await api("/api/data");
                } else persistDemo(next);
                setState(next);
                setFeedback(null);
                toast.success("Reflection saved. Your insights are updated.");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewPlan} onOpenChange={(open) => !open && setViewPlan(null)}>
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>{viewPlan ? decisionTitle(viewPlan) : "Plan details"}</DialogTitle>
            <DialogDescription>What this plan is about.</DialogDescription>
          </DialogHeader>
          {viewPlan && (
            <div className={cardStyles.eventDetail}>
              <p>{extractingPlan ? "Extracting the event details…" : eventDescription(viewPlan)}</p>
              <div className={cardStyles.eventMeta}>
                <div>
                  <Clock size={18} />
                  <span><small>WHEN</small>{formatEventRange(viewPlan.event)}</span>
                </div>
                <div>
                  <MapPin size={18} />
                  <span><small>WHERE</small>{viewPlan.event?.location || "Location to confirm"}</span>
                </div>
                <div>
                  <Battery size={18} />
                  <span>
                    <small>PERSONALIZED ENERGY LOAD</small>
                    {calendarEventLoad(viewPlan, state)} points
                    <em>
                      {viewPlan.energyExplanation ??
                        "Estimated from this plan’s duration, timing, group, familiarity, your preferences, and relevant past outcomes."}
                    </em>
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="secondary full"
                onClick={() => {
                  setEditingPlan(viewPlan);
                  setViewPlan(null);
                  setManualCalendar(true);
                }}
              >
                Edit plan
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!viewReading}
        onOpenChange={(v) => !v && setViewReading(null)}
      >
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>Your reading · {viewReading?.date}</DialogTitle>
            <DialogDescription>Reflection, not prediction.</DialogDescription>
          </DialogHeader>
          {viewReading && (
            <>
              <div className="history-cards">
                {viewReading.cards.map((id, i) => (
                  <div key={id}>
                    <span>{positions[i]}</span>
                    <h3>{deck[id].name}</h3>
                  </div>
                ))}
              </div>
              <p>{viewReading.reading}</p>
              <p>{viewReading.guidance}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
function Heading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function Countdown({ now, timezone }: { now: Date; timezone: string }) {
  const minutes = minutesUntilNextDay(now, timezone);
  return (
    <>
      Come back in {Math.floor(minutes / 60)}h {minutes % 60}m
    </>
  );
}
function TarotCard({
  id,
  position,
  index,
}: {
  id?: number;
  position: string;
  index: number;
}) {
  const card = id === undefined ? null : deck[id];
  return (
    <div className="tarot-card-wrap">
      <p className="card-position">
        <span>0{index + 1}</span>
        {position}
      </p>
      <div
        className={`tarot-card card-${index} ${card ? "revealed" : "card-back"}`}
      >
        <div className="card-border">
          <span className="card-number">
            {card ? String(id! + 1).padStart(2, "0") : "✧"}
          </span>
          <span className="card-symbol" aria-hidden="true">
            {card?.symbol ?? "✦"}
          </span>
          <div className="card-stars">✧ · ✦ · ✧</div>
          <span className="card-name">
            {card?.name ?? "A little possibility"}
          </span>
        </div>
      </div>
      <h3>
        {card?.name ??
          ["Your energy", "Your connections", "Your next step"][index]}
      </h3>
      <p className="card-theme">{card?.theme ?? "Waiting to unfold"}</p>
    </div>
  );
}
function calendarDay(startAt: string | null | undefined, month: Date) {
  if (!startAt) return null;
  const date = new Date(startAt);
  return Number.isNaN(date.getTime()) ||
    date.getMonth() !== month.getMonth() ||
    date.getFullYear() !== month.getFullYear()
    ? null
    : date.getDate();
}
function formatEventDetails(event: Decision["event"]) {
  const startAt = event?.startAt;
  const date = startAt ? new Date(startAt) : null;
  const time = date && !Number.isNaN(date.getTime())
    ? date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    : event?.whenText || "Date and time to confirm";
  return event?.location ? `${time} · ${event.location}` : time;
}
function formatEventRange(event: Decision["event"]) {
  if (!event?.startAt) return event?.whenText || "Date and time to confirm";
  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return "Date and time to confirm";
  const startText = start.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  if (!event.endAt) return startText;
  const end = new Date(event.endAt);
  return Number.isNaN(end.getTime())
    ? startText
    : `${startText} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
function eventDescription(decision: Decision) {
  if (decision.event?.description?.trim()) return decision.event.description.trim();
  return "Event details are not available yet.";
}
function CalendarView({
  today,
  month,
  decisions,
  onSelect,
}: {
  today: Date;
  month: Date;
  decisions: Decision[];
  onSelect: (decision: Decision) => void;
}) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getDay(),
    count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    planDays = decisions.reduce((days, decision) => {
      const day = calendarDay(decision.event?.startAt, month);
      if (day === null) return days;
      days.set(day, [...(days.get(day) ?? []), decision]);
      return days;
    }, new Map<number, Decision[]>()),
    showingCurrentMonth = today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear();
  return (
    <div className="calendar-grid">
      {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
        <strong key={d}>{d}</strong>
      ))}
      {Array.from({ length: start }, (_, i) => (
        <span key={"empty" + i} />
      ))}
      {Array.from({ length: count }, (_, i) => (
        <div className={showingCurrentMonth && i + 1 === today.getDate() ? "today" : ""} key={i}>
          <span>{i + 1}</span>
          {showingCurrentMonth && i + 1 === today.getDate() && <small>Today</small>}
          {planDays.get(i + 1)?.map((decision) => (
            <button
              type="button"
              className="calendar-plan-label"
              aria-label={`Open details for ${decisionTitle(decision)}`}
              key={decision.id}
              onClick={() => onSelect(decision)}
            >
              <i className={cardStyles.calendarDot} />
              <span>{decisionTitle(decision)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
function AuthForm({
  mode,
  enabled,
  switchMode,
  onSuccess,
}: {
  mode: "login" | "signup";
  enabled: boolean;
  switchMode: () => void;
  onSuccess: (u: Account) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const data = new FormData(e.currentTarget);
        try {
          const result = await api("/api/auth", {
            action: mode,
            email: data.get("email"),
            password: data.get("password"),
            name: data.get("name") ?? undefined,
          });
          if (result.user && result.message === "Signed in")
            await onSuccess(result.user);
          else toast.success(result.message);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {mode === "signup" && (
        <label className="field">
          Your name
          <input
            name="name"
            placeholder="What should we call you?"
            maxLength={80}
            required
          />
        </label>
      )}
      <label className="field">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </label>
      <label className="field">
        Password
        <input
          name="password"
          type="password"
          minLength={8}
          maxLength={128}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="At least 8 characters"
          required
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary full" disabled={busy || !enabled}>
        {busy ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
      </button>
      <button type="button" className="quiet full" onClick={switchMode}>
        {mode === "login"
          ? "New here? Create an account"
          : "Already have an account? Log in"}
      </button>
    </form>
  );
}
function Survey({
  save,
}: {
  profile: Profile;
  save: (answers: number[]) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<number[]>([]),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false);
  const question = questions[step];
  const selected = answers[step];
  return (
    <div>
      <div className="survey-progress">
        {questions.map((_, i) => (
          <span className={i <= step ? "done" : ""} key={i} />
        ))}
      </div>
      <p className="eyebrow">
        QUESTION {step + 1} OF {questions.length} · {question.eyebrow.toUpperCase()}
      </p>
      <h2 className="survey-question">{question.prompt}</h2>
      <div className="prompts">
        {question.options.map((option, index) => (
          <button
            type="button"
            aria-pressed={selected === index}
            key={option.label}
            onClick={() => setAnswers((current) => {
              const next = current.slice();
              next[step] = index;
              return next;
            })}
          >
            <span>{String(index + 1).padStart(2, "0")} · {option.label}</span>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
      <div className="row between survey-actions">
        <button
          className="quiet"
          onClick={() => setStep(step - 1)}
          disabled={step === 0 || busy}
        >
          Back
        </button>
        <button
          className="primary"
          disabled={busy || selected === undefined}
          onClick={async () => {
            if (step < questions.length - 1) setStep(step + 1);
            else {
              setBusy(true);
              try {
                await save(answers);
              } catch (e) {
                toast.error(String(e));
              } finally {
                setBusy(false);
              }
            }
          }}
        >
          {busy ? "Saving…" : step === questions.length - 1 ? "Create my profile" : "Continue"}{" "}
          <ArrowUpRight size={16} />
        </button>
      </div>
      <p className="small">
        You can revisit these preferences from Profile at any time.
      </p>
    </div>
  );
}
function dateTimeInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function ManualCalendarForm({
  decision,
  energy,
  energyRecorded,
  save,
}: {
  decision?: Decision | null;
  energy: number;
  energyRecorded: boolean;
  save: (decision: Decision) => Promise<void>;
}) {
  const initialStart = new Date(Math.ceil(Date.now() / 3600000) * 3600000);
  const [value, setValue] = useState(() => ({
    title: decision?.event?.title ?? decision?.title ?? "",
    description: decision?.event?.description === "Manually added calendar plan." ? "" : decision?.event?.description ?? "",
    location: decision?.event?.location ?? "",
    start: decision?.event?.startAt ? dateTimeInputValue(new Date(decision.event.startAt)) : dateTimeInputValue(initialStart),
    end: decision?.event?.endAt ? dateTimeInputValue(new Date(decision.event.endAt)) : dateTimeInputValue(new Date(initialStart.getTime() + 3600000)),
    group: decision?.group ?? "small" as Decision["group"],
    people: decision?.people ?? "friends" as Decision["people"],
  }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="manual-calendar-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const start = new Date(value.start);
        const end = new Date(value.end);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
          setError("End time must be after start time.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          const id = decision?.id ?? uid();
          const calendarEvent = {
            title: value.title.trim(),
            description: value.description.trim() || "Manually added calendar plan.",
            whenText: `${start.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            location: value.location.trim() || null,
          };
          await save({
            ...decision,
            id,
            threadId: decision?.threadId ?? id,
            createdAt: decision?.createdAt ?? new Date().toISOString(),
            title: calendarEvent.title,
            messages: decision?.messages ?? [],
            group: value.group,
            people: value.people,
            duration: eventDurationMinutes(calendarEvent) ?? 0,
            batteryBefore: decision?.batteryBefore ?? energy,
            energyRecorded: decision?.energyRecorded ?? energyRecorded,
            markedChoice: "going",
            event: calendarEvent,
          });
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Could not add this plan.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Plan name
        <input required maxLength={80} value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} placeholder="Dinner with friends" />
      </label>
      <div className="manual-calendar-times">
        <label>
          Starts
          <input required type="datetime-local" value={value.start} onChange={(event) => setValue({ ...value, start: event.target.value })} />
        </label>
        <label>
          Ends
          <input required type="datetime-local" value={value.end} onChange={(event) => setValue({ ...value, end: event.target.value })} />
        </label>
      </div>
      <label>
        Location <span>optional</span>
        <input maxLength={120} value={value.location} onChange={(event) => setValue({ ...value, location: event.target.value })} placeholder="Riverside Grand Hotel" />
      </label>
      <label>
        Notes <span>optional</span>
        <textarea maxLength={360} rows={3} value={value.description} onChange={(event) => setValue({ ...value, description: event.target.value })} placeholder="What the plan is for" />
      </label>
      <div className="manual-calendar-times">
        <label>
          Group size
          <select value={value.group} onChange={(event) => setValue({ ...value, group: event.target.value as Decision["group"] })}>
            <option value="solo">Solo</option>
            <option value="small">Small group</option>
            <option value="large">Large group</option>
          </select>
        </label>
        <label>
          People
          <select value={value.people} onChange={(event) => setValue({ ...value, people: event.target.value as Decision["people"] })}>
            <option value="alone">Just me</option>
            <option value="friends">People I know</option>
            <option value="strangers">Mostly new people</option>
          </select>
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary full" disabled={busy || !value.title.trim()}>
        {busy ? "Analyzing energy…" : decision ? "Save changes" : "Add to calendar"}
      </button>
    </form>
  );
}
function CheckinForm({
  initial,
  save,
}: {
  initial: Checkin;
  save: (c: Checkin) => Promise<void>;
}) {
  const [v, setV] = useState(initial),
    [busy, setBusy] = useState(false),
    [answered, setAnswered] = useState<Set<string>>(
      () => new Set(initial.createdAt ? ["mood", "physical", "workload", "social"] : []),
    );
  const choose = (key: string, update: Checkin) => {
    setV(update);
    setAnswered((previous) => new Set(previous).add(key));
  };
  const questions = [
    {
      key: "mood",
      label: "How is your mood?",
      value: v.mood,
      options: [
        ["Bad", "Bad"],
        ["Okay", "Okay"],
        ["Good", "Good"],
        ["Fantastic", "Fantastic"],
      ],
      choose: (value: string) => choose("mood", { ...v, mood: value }),
    },
    {
      key: "physical",
      label: "How does your body feel?",
      value: String(v.physical),
      options: [
        ["15", "Exhausted"],
        ["35", "Low energy"],
        ["70", "Fine"],
        ["90", "Energized"],
      ],
      choose: (value: string) => choose("physical", { ...v, physical: Number(value) }),
    },
    {
      key: "workload",
      label: "What does today look like?",
      value: String(v.stress),
      options: [
        ["90", "Overloaded"],
        ["65", "Busy"],
        ["20", "Manageable"],
        ["10", "Nothing planned"],
      ],
      choose: (value: string) => choose("workload", { ...v, stress: Number(value) }),
    },
    {
      key: "social",
      label: "How open are you to people right now?",
      value: String(v.social),
      options: [
        ["15", "Need quiet"],
        ["40", "Something small"],
        ["70", "Open to company"],
        ["90", "Feeling social"],
      ],
      choose: (value: string) => choose("social", { ...v, social: Number(value) }),
    },
  ];
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await save({ ...v, id: uid(), createdAt: new Date().toISOString() });
        } catch (e) {
          toast.error(String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="checkin-score">
        <span>{answered.size === 4 ? "Your energy estimate" : "Your energy will appear here"}</span>
        <strong>{answered.size === 4 ? `${checkinEnergy(v)}%` : "—"}</strong>
        <p>
          {answered.size === 4
            ? "Mood, physical energy, workload, and social readiness all contribute."
            : `${4 - answered.size} quick ${4 - answered.size === 1 ? "answer" : "answers"} remaining.`}
        </p>
      </div>
      <div className="checkin-questions">
        {questions.map((question) => (
          <fieldset key={question.label}>
            <legend>{question.label}</legend>
            <div className="checkin-options">
              {question.options.map(([value, label]) => {
                const selected = answered.has(question.key) && question.value === value;
                return (
                  <button
                    type="button"
                    key={value}
                    className={selected ? "selected" : ""}
                    aria-pressed={selected}
                    onClick={() => question.choose(value)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <button className="primary full" disabled={busy || answered.size < 4}>
        {busy ? "Saving…" : "Save my check-in"}
      </button>
    </form>
  );
}
function ProfileForm({
  profile,
  onSave,
  requireAccount,
}: {
  profile: Profile;
  onSave: (p: Profile) => Promise<unknown>;
  requireAccount: (fn: () => void) => void;
}) {
  const [name, setName] = useState(profile.name),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        requireAccount(async () => {
          setBusy(true);
          try {
            await onSave({ ...profile, name: name.trim() });
            toast.success("Profile updated.");
          } catch (e) {
            toast.error(String(e));
          } finally {
            setBusy(false);
          }
        });
      }}
    >
      <label className="field">
        Your name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
        />
      </label>
      <div className="field">
        Daily reading timezone<p>{profile.timezone}</p>
        <small>Set from your browser when your profile is created.</small>
      </div>
      <button className="primary" disabled={busy || !name.trim()}>
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
function FeedbackForm({
  decision,
  outcome,
  save,
}: {
  decision: Decision;
  outcome?: Outcome;
  save: (d: Decision, o: Outcome) => Promise<void>;
}) {
  const [d, setD] = useState(decision),
    [v, setV] = useState<Outcome>(
      outcome ?? {
        id: uid(),
        decisionId: decision.id,
        createdAt: new Date().toISOString(),
        went: decision.markedChoice !== "skip",
        enjoyment: 7,
        after: 50,
        glad: true,
        again: true,
        skipReason: "Needed rest",
        skipRelief: 7,
        regret: 3,
      },
    ),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await save(d, { ...v, energyRecorded: true });
        } catch (e) {
          toast.error(String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="toggle-field">
        <label htmlFor="went">Did you go?</label>
        <Switch
          id="went"
          checked={v.went}
          onCheckedChange={(went) => setV({ ...v, went })}
        />
      </div>
      {v.went ? (
        <>
          <div className="two-grid">
            <Choice
              label="Group size"
              value={d.group}
              options={["small", "large", "solo"]}
              onChange={(group) =>
                setD({ ...d, group: group as Decision["group"] })
              }
            />
            <Choice
              label="Who was there?"
              value={d.people}
              options={["friends", "strangers", "alone"]}
              onChange={(people) =>
                setD({ ...d, people: people as Decision["people"] })
              }
            />
          </div>
          <label className="field">
            Duration in minutes
            <input
              type="number"
              min={0}
              max={1440}
              required
              value={d.duration}
              onChange={(e) => setD({ ...d, duration: Number(e.target.value) })}
            />
          </label>
          <Range
            label="Enjoyment"
            value={v.enjoyment}
            max={10}
            onChange={(enjoyment) => setV({ ...v, enjoyment })}
          />
          <Range
            label="Energy afterward"
            value={v.after}
            onChange={(after) => setV({ ...v, after })}
          />
          <div className="toggle-field">
            <label htmlFor="glad">Glad you went?</label>
            <Switch
              id="glad"
              checked={v.glad}
              onCheckedChange={(glad) => setV({ ...v, glad })}
            />
          </div>
          <div className="toggle-field">
            <label htmlFor="again">Would you do it again?</label>
            <Switch
              id="again"
              checked={v.again}
              onCheckedChange={(again) => setV({ ...v, again })}
            />
          </div>
        </>
      ) : (
        <>
          <Choice
            label="Main reason you skipped"
            value={v.skipReason ?? "Needed rest"}
            options={["Needed rest", "Schedule conflict", "Too expensive", "Travel or distance", "Changed my mind", "Other"]}
            onChange={(skipReason) => setV({ ...v, skipReason })}
          />
          <Range
            label="How right did skipping feel?"
            value={v.skipRelief ?? 7}
            max={10}
            onChange={(skipRelief) => setV({ ...v, skipRelief })}
            ends={["Not right", "Definitely right"]}
          />
          <Range
            label="How much regret did you feel?"
            value={v.regret ?? 3}
            max={10}
            onChange={(regret) => setV({ ...v, regret })}
            ends={["None", "A lot"]}
          />
          <Range
            label="Energy afterward"
            value={v.after}
            onChange={(after) => setV({ ...v, after })}
          />
        </>
      )}
      <button className="primary full" disabled={busy}>
        {busy ? "Saving…" : "Save reflection"}
      </button>
    </form>
  );
}
function Chat({
  state,
  active,
  config,
  demo,
  selected,
  save,
  remove,
  requireAccount,
  onFeedback,
}: {
  state: AppState;
  active: Decision | null;
  config: { ai: boolean; vision: boolean };
  demo: boolean;
  selected: (id: string | null) => void;
  save: (table: "decisions", d: Decision) => Promise<AppState>;
  remove: (d: Decision) => Promise<void>;
  requireAccount: (f: () => void) => void;
  onFeedback: (d: Decision) => void;
}) {
  const [text, setText] = useState(""),
    [files, setFiles] = useState<Attachment[]>([]),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const currentCheckin = current(state),
    hasEnergy = Boolean(currentCheckin.createdAt);
  const messageList = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const list = messageList.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, busy]);
  async function send(forceDemo = false, forcedText?: string) {
    const submittedFiles = forcedText ? [] : files;
    if (busy || (!forcedText?.trim() && !text.trim() && !submittedFiles.length)) return;
    const content = forcedText?.trim() || text.trim() || "Help me think through this event.";
    const d: Decision = active ?? {
      id: uid(),
      createdAt: new Date().toISOString(),
      title: "New plan",
      messages: [],
      ...inferContext(content + " " + submittedFiles.map((f) => f.text ?? "").join(" ")),
      batteryBefore: hasEnergy ? checkinEnergy(currentCheckin) : 50,
      energyRecorded: hasEnergy,
    };
    const user: Message = {
      id: uid(),
      role: "user",
      content,
      attachments: submittedFiles,
    };
    const previous = d.messages.at(-1);
    const retry = previous?.role === "user" && previous.content === content;
    const messages = retry
      ? [...d.messages.slice(0, -1), user]
      : [...d.messages, user];
    setBusy(true);
    setError("");
    setText("");
    setFiles([]);
    try {
      const storedMessages = messages.map((m) => ({
        ...m,
        attachments: m.attachments?.map((a) => ({
          name: a.name,
          type: a.type,
          text: a.text,
        })),
      }));
      const pending = { ...d, messages: storedMessages };
      await save("decisions", pending);
      selected(d.id);
      const result = await api("/api/chat", {
        messages: messages.slice(-40),
        threadId: d.threadId,
        state,
        demo,
        forceDemo,
      });
      const complete = {
        ...d,
        threadId: result.threadId ?? d.threadId,
        title: result.event?.title ?? result.decision?.event?.title ?? d.title,
        event: result.event ?? result.decision?.event ?? d.event,
        duration: eventDurationMinutes(result.event ?? result.decision?.event ?? d.event) ?? 0,
        messages: [
          ...storedMessages,
          {
            id: uid(),
            role: "assistant" as const,
            content: result.content,
            mode: result.mode,
            choices: result.choices,
            decision: result.decision,
          },
        ],
      };
      await save("decisions", complete);
    } catch (e) {
      setText(content);
      setFiles(submittedFiles);
      setError(e instanceof Error ? e.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  }
  async function markDecision(choice: "going" | "skip") {
    if (!active || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!demo && active.threadId) {
        const response = await fetch("/api/decide/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId: active.threadId, choice }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok)
          throw new Error(payload.error ?? "Could not save your choice.");
      }
      const event =
        active.event ??
        active.messages.findLast((message) => message.decision?.event)?.decision
          ?.event;
      let marked = { ...active, markedChoice: choice, event };
      if (choice === "going" && event?.startAt && event.endAt) {
        const candidate = { ...marked, estimatedEnergyLoad: undefined, energyExplanation: undefined };
        if (!demo && config.ai) {
          try {
            const estimate = await api("/api/calendar/energy", { decision: candidate });
            marked = {
              ...candidate,
              estimatedEnergyLoad: estimate.energyLoad as number,
              energyExplanation: estimate.explanation as string,
            };
          } catch {
            marked = {
              ...candidate,
              estimatedEnergyLoad: calendarEventLoad(candidate, state),
              energyExplanation: "Personalized from the plan and your current profile; AI analysis was temporarily unavailable.",
            };
          }
        } else {
          marked = {
            ...candidate,
            estimatedEnergyLoad: calendarEventLoad(candidate, state),
            energyExplanation: "Personalized from the plan’s duration, timing, group, familiarity, your preferences, and any relevant past outcomes.",
          };
        }
      }
      await save("decisions", marked);
      toast.success(
        choice === "going"
          ? "Added to your calendar."
          : "Saved — protect your time.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your choice.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="chat-layout">
      <aside className="conversation-list panel">
        <button
          className="secondary full"
          disabled={busy}
          onClick={() => {
            selected(null);
            setText("");
            setFiles([]);
            setError("");
          }}
        >
          <Plus size={16} />
          New conversation
        </button>
        <p className="eyebrow">YOUR CONVERSATIONS</p>
        {state.decisions.filter((d) => d.messages.length > 0).map((d) => (
          <div className="conversation-row" key={d.id}>
            <button
              disabled={busy}
              className={`conversation-select ${active?.id === d.id ? "chosen" : ""}`}
              onClick={() => {
                selected(d.id);
                setText("");
                setFiles([]);
                setError("");
              }}
            >
              <MessageCircle size={16} />
              <span>{decisionTitle(d)}</span>
            </button>
            <button
              type="button"
              className="conversation-delete"
              disabled={busy}
              aria-label={`Delete ${decisionTitle(d)}`}
              title="Delete conversation"
              onClick={async () => {
                if (!window.confirm(`Delete “${decisionTitle(d)}”? This cannot be undone.`)) return;
                try {
                  await remove(d);
                  toast.success("Conversation deleted.");
                } catch (reason) {
                  setError(reason instanceof Error ? reason.message : "Could not delete this conversation.");
                }
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </aside>
      <section className="chat-panel panel">
        <div className="chat-context">
          <span className="pill">
            <Battery size={14} />
            {hasEnergy ? checkinEnergy(currentCheckin) : 50}% current energy
          </span>
          <span className="small">
            {patternSummary(state).observations} past experiences ·{" "}
            {demo || !config.ai ? "Demo guidance" : "NVIDIA Nemotron"}
          </span>
        </div>
        <div className="messages" aria-live="polite" ref={messageList}>
          {!active?.messages.length ? (
            <div className="chat-welcome">
              <div className="companion-mark">✦</div>
              <h2>
                A little less overthinking.
                <br />A little more clarity.
              </h2>
              <p>
                Plans, invitations, or a quiet night in.
                <br />
                Whatever you’re weighing, we can talk it through.
              </p>
              <div className="prompts">
                {[
                  "My friends invited me out, but I’m tired.",
                  "Should I go to an event where I won’t know anyone?",
                  "Help me say no without feeling guilty.",
                ].map((t) => (
                  <button key={t} onClick={() => setText(t)}>
                    {t}
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            active.messages.map((m) => {
              const isLatest = active.messages.at(-1)?.id === m.id;
              return (
                <div key={m.id} className={`message ${m.role}`}>
                  <span className="message-avatar">
                    {m.role === "assistant" ? "✦" : state.profile.name[0]}
                  </span>
                  <div>
                    <strong>
                      {m.role === "assistant" ? "Your companion" : "You"}
                      <small>{m.mode}</small>
                    </strong>
                    <p>{m.content}</p>
                    {m.decision && (
                      <DecisionScoreCard
                        decision={m.decision}
                        markedChoice={active.markedChoice}
                        disabled={busy || !isLatest}
                        onMark={(choice) =>
                          requireAccount(() => void markDecision(choice))
                        }
                        onFeedback={() =>
                          requireAccount(() => onFeedback(active))
                        }
                      />
                    )}
                    {!!m.choices?.length && !questionNeedsTypedAnswer(m.content) && (
                      <div
                        className={cardStyles.choiceGrid}
                        aria-label="Choose an answer"
                      >
                        {m.choices.map((choice) => (
                          <button
                            className={cardStyles.choiceButton}
                            type="button"
                            key={choice}
                            disabled={busy || !isLatest}
                            onClick={() => requireAccount(() => void send(false, choice))}
                          >
                            <span>{choice}</span>
                            <ArrowUpRight size={15} />
                          </button>
                        ))}
                      </div>
                    )}
                    {m.attachments?.map((f, i) => (
                      <span key={i} className="attachment-chip">
                        <Paperclip size={13} />
                        {f.name}
                        {f.text ? " · text extracted" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
          {busy && (
            <div className="thinking">
              <Sparkles size={17} />
              Making room for the whole picture…
            </div>
          )}
        </div>
        {active && (
          <button
            className="reflection-link"
            disabled={busy}
            onClick={() => requireAccount(() => onFeedback(active))}
          >
            <Heart size={15} />
            How did this plan turn out? Add a reflection
          </button>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
            <button
              className="quiet"
              onClick={() => requireAccount(() => void send(true))}
            >
              Try demo guidance
            </button>
          </div>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            requireAccount(() => void send());
          }}
        >
          {files.length > 0 && (
            <div className="attachment-list">
              {files.map((f, i) => (
                <span className="attachment-chip" key={i}>
                  <Paperclip size={14} />
                  {f.name}
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles(files.filter((_, j) => i !== j))}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            aria-label="Your message"
            placeholder="Tell me what you’re thinking about…"
            value={text}
            maxLength={15000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                requireAccount(() => void send());
              }
            }}
          />
          <div className="row between">
            <input
              ref={input}
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (files.length >= 3) {
                  toast.error("Attach up to three files.");
                  return;
                }
                setUploading(true);
                try {
                  const addedFiles = await readAttachments(file, 3 - files.length);
                  if (
                    files.reduce(
                      (sum, a) =>
                        sum + (a.dataUrl?.length ?? a.text?.length ?? 0),
                      0,
                    ) +
                      addedFiles.reduce(
                        (sum, attachment) =>
                          sum +
                          (attachment.dataUrl?.length ??
                            attachment.text?.length ??
                            0),
                        0,
                      ) >
                    7_000_000
                  )
                    throw new Error("Keep total attachments under 5 MB.");
                  setFiles((prev) => [...prev, ...addedFiles]);
                  toast.success(
                    addedFiles[0]?.text
                      ? "PDF text extracted."
                      : file.type === "application/pdf" ||
                          file.name.toLowerCase().endsWith(".pdf")
                        ? `${addedFiles.length} PDF page${addedFiles.length === 1 ? "" : "s"} attached as image${addedFiles.length === 1 ? "" : "s"}.`
                        : "Image attached.",
                  );
                } catch (e) {
                  const message = e instanceof Error ? e.message : String(e);
                  setError(message);
                  toast.error(message);
                } finally {
                  setUploading(false);
                  if (input.current) input.current.value = "";
                }
              }}
            />
            <button
              type="button"
              className="attach-button"
              disabled={uploading || busy}
              onClick={() => input.current?.click()}
            >
              <Paperclip size={18} />
              {uploading ? "Reading file…" : "Add image or PDF"}
              <span> · up to 5 MB</span>
            </button>
            <button
              className="send-button"
              aria-label="Send message"
              disabled={busy || uploading || (!text.trim() && !files.length)}
            >
              <ArrowUp size={19} />
            </button>
          </div>
        </form>
        <p className="chat-footnote">
          A perspective, not a prescription. You get to choose.
        </p>
      </section>
    </div>
  );
}
function DecisionScoreCard({
  decision,
  markedChoice,
  disabled,
  onMark,
  onFeedback,
}: {
  decision: NonNullable<Message["decision"]>;
  markedChoice?: "going" | "skip";
  disabled: boolean;
  onMark: (choice: "going" | "skip") => void;
  onFeedback: () => void;
}) {
  return (
    <section
      className={`${cardStyles.scoreCard} ${decision.verdict === "skip" ? cardStyles.skip : ""}`}
      aria-label="Decision scorecard"
    >
      <div className={cardStyles.scoreHead}>
        <div>
          <span className={cardStyles.scoreLabel}>YOUR DECISION SCORE</span>
          <h3>{decision.verdict === "going" ? "Worth making room for." : "Better to protect your time."}</h3>
        </div>
        <div className={cardStyles.scoreNumber}><strong>{decision.score}</strong><small>/100</small></div>
      </div>
      <p className={cardStyles.summary}>{decision.summary}</p>
      <div className={cardStyles.scoreColumns}>
        <DecisionFactors title="UPSIDE" items={decision.upside} />
        <DecisionFactors title="COST" items={decision.cost} />
      </div>
      <ol className={cardStyles.reasons}>{decision.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ol>
      <span className={cardStyles.confidence}>{decision.confidence.toUpperCase()} CONFIDENCE · A PERSPECTIVE, NOT A PRESCRIPTION</span>
      <div className={cardStyles.decisionActions}>
        <button type="button" className={`${cardStyles.actionButton} ${markedChoice === "going" ? cardStyles.selectedAction : ""}`} disabled={disabled} onClick={() => onMark("going")}>
          <Check size={16} /> {markedChoice === "going" ? "Going · added to calendar" : "I’m going"}
        </button>
        <button type="button" className={`${cardStyles.actionButton} ${markedChoice === "skip" ? cardStyles.selectedAction : ""}`} disabled={disabled} onClick={() => onMark("skip")}>
          <X size={16} /> {markedChoice === "skip" ? "Skipping · saved" : "I’ll skip"}
        </button>
        {markedChoice && (
          <button type="button" className={cardStyles.feedbackButton} disabled={disabled} onClick={onFeedback}>
            <Heart size={15} /> Tell us what happened
          </button>
        )}
      </div>
    </section>
  );
}
function DecisionFactors({ title, items }: { title: string; items: NonNullable<Message["decision"]>["cost"] }) {
  return <div className={cardStyles.factors}><b>{title} · /10</b>{items.map((item) => { const score = metricScoreOutOfTen(item.value); return <div key={item.label}><span>{item.label}</span><i><span style={{ width: `${score * 10}%` }} /></i><strong>{score || "—"}</strong></div>; })}</div>;
}
function Insights({ state }: { state: AppState }) {
  const observations = patterns(state),
    summary = patternSummary(state),
    history = state.checkins.slice(0, 14).reverse(),
    forecast = energyForecast(state),
    hasEnergy = Boolean(current(state).createdAt);
  const groups = [
    ["Small gatherings", observations.filter((v) => v.d.group === "small")],
    ["Large gatherings", observations.filter((v) => v.d.group === "large")],
    ["Close friends", observations.filter((v) => v.d.people === "friends")],
    ["New people", observations.filter((v) => v.d.people === "strangers")],
    ["90 minutes or less", observations.filter((v) => v.d.duration > 0 && v.d.duration <= 90)],
    ["Longer than 90 minutes", observations.filter((v) => v.d.duration > 90)],
  ] as const;
  return (
    <>
      <div className="three-grid stats">
        <div className="panel">
          <span>Energy right now</span>
          <strong>
            {hasEnergy ? <>{forecast.energy}<small>%</small></> : "—"}
          </strong>
          <p>{hasEnergy ? "Based on today’s check-in." : "Complete today’s check-in to create an energy estimate."}</p>
        </div>
        <div className="panel">
          <span>Today’s calendar load</span>
          <strong>−{forecast.calendarLoad}<small> pts</small></strong>
          <p>{forecast.plans.length ? `${forecast.plans.length} remaining ${forecast.plans.length === 1 ? "plan" : "plans"} today.` : "No timed plans are weighing on the rest of today."}</p>
        </div>
        <div className="panel">
          <span>Expected after today’s plans</span>
          <strong>{hasEnergy ? <>{forecast.projected}<small>%</small></> : "—"}</strong>
          <p>{hasEnergy ? "Adjusted using your calendar and similar past experiences." : "Complete today’s check-in before we forecast your remaining energy."}</p>
        </div>
      </div>
      <section className="panel forecast-panel">
        <div>
          <p className="eyebrow">WHAT SHAPES TODAY</p>
          <h2>Your calendar has an energy footprint.</h2>
          <p>
            We estimate each plan from its actual scheduled duration, crowd size,
            unfamiliar people, travel, and the average energy change from similar
            activities you reflected on.
          </p>
        </div>
        <div className="forecast-plans">
          {forecast.plans.length ? forecast.plans.map((plan) => {
            const duration = eventDurationMinutes(plan.event);
            return (
              <div key={plan.id}>
                <span>{decisionTitle(plan)}</span>
                <strong>−{calendarEventLoad(plan, state)} pts</strong>
                <small>{duration === null ? "Duration unavailable" : `${duration} min`} · {plan.people === "strangers" ? "new people" : plan.people}</small>
              </div>
            );
          }) : <p className="empty-copy">Plans marked “I’m going” with a confirmed time today will appear here.</p>}
        </div>
      </section>
      <section className="panel history-chart">
        <div className="row between">
          <h2>Your energy over time</h2>
          <span className="small">Last {history.length} check-ins</span>
        </div>
        {history.length ? (
          <>
            <div
              className="bar-chart"
              role="img"
              aria-label={history
                .map(
                  (c) =>
                    `${new Date(c.createdAt).toLocaleDateString()}: ${checkinEnergy(c)}%`,
                )
                .join(", ")}
            >
              {history.map((c) => (
                <div key={c.id}>
                  <span>{checkinEnergy(c)}%</span>
                  <i style={{ height: `${Math.max(3, checkinEnergy(c) * 1.65)}px` }} />
                  <small>
                    {new Date(c.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </div>
              ))}
            </div>
            <p className="small">Energy combines mood, physical state, workload, and social readiness. A low day isn’t a bad day.</p>
          </>
        ) : (
          <p className="empty-copy">
            Your first check-in will start your energy history.
          </p>
        )}
      </section>
      <div className="insights-grid">
        <section className="panel">
          <h2>Which plans tend to feel worth it?</h2>
          <p className="small">Observed enjoyment · 1–10</p>
          {groups.map(([label, rows]) => {
            const energyRows = rows.filter(({ d, o }) => d.energyRecorded && o.energyRecorded);
            return <div className="pattern-row" key={label}>
              <div className="row between">
                <span>{label}</span>
                <strong>
                  {rows.length
                    ? average(rows.map((v) => v.o.enjoyment)).toFixed(1)
                    : "—"}{" "}
                  <small>
                    ({rows.length} {rows.length === 1 ? "event" : "events"})
                  </small>
                </strong>
              </div>
              <div className="meter">
                <i
                  style={{
                    width: `${average(rows.map((v) => v.o.enjoyment)) * 10}%`,
                  }}
                />
              </div>
              {energyRows.length > 0 && (
                <p>
                  Average energy change:{" "}
                  {Math.round(
                    average(energyRows.map((v) => v.o.after - v.d.batteryBefore)),
                  )}{" "}
                  points
                </p>
              )}
            </div>
          })}
        </section>
        <section className="panel learning-panel">
          <span className="feature-icon">✧</span>
          <h2>A profile that grows with you.</h2>
          <p>
            Check-ins, today’s calendar, chatbot decisions, and your reflections
            gradually make future estimates more personal.
          </p>
          <div className="weight-bar">
            <i style={{ width: `${summary.historyWeight * 100}%` }} />
          </div>
          <div className="row between small">
            <span>
              Observed history {Math.round(summary.historyWeight * 100)}%
            </span>
            <span>Survey {Math.round((1 - summary.historyWeight) * 100)}%</span>
          </div>
          <div className="learning-note">
            <Heart size={19} />
            <p>
              {observations.length < 5
                ? "Still getting to know you. A few more reflections will help reveal tentative patterns."
                : "A pattern is a conversation starter, not a rule. Small samples, event differences, and changing circumstances all matter."}
            </p>
          </div>
          <p className="small">
            History weight = observations ÷ (observations + 5). Skipped events
            are saved but excluded from enjoyment comparisons.
          </p>
        </section>
      </div>
    </>
  );
}
