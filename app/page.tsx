"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Battery,
  CalendarDays,
  Check,
  ChevronDown,
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
  current,
  demoState,
  dimensions,
  emptyState,
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
  readAttachment,
} from "@/lib/client";
import cardStyles from "./decision-cards.module.css";
import { questionNeedsTypedAnswer } from "@/lib/decision-chat";
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
  const energy = current(state).social;
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
            <Battery size={19} /> Social Battery
          </div>
          <strong>
            {state.checkins.length ? energy : "—"}
            <span>{state.checkins.length ? "%" : ""}</span>
          </strong>
          <div className="meter">
            <i style={{ width: `${state.checkins.length ? energy : 0}%` }} />
          </div>
          <p>
            {state.checkins.length
              ? energy < 40
                ? "Make a little room for rest."
                : "Room for a little connection."
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
    [feedback, setFeedback] = useState<Decision | null>(null),
    [viewPlan, setViewPlan] = useState<Decision | null>(null),
    [extractingPlan, setExtractingPlan] = useState(false),
    [saving, setSaving] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [tick, setTick] = useState(new Date());
  const [viewReading, setViewReading] = useState<Reading | null>(null);
  const stateRef = useRef(state);
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
  function requireAccount(action: () => void) {
    if (!account && !demo) {
      setAuth("signup");
      return;
    }
    if (!state.profile.onboarded) {
      setSurvey(true);
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
    today = localDay(tick, state.profile.timezone),
    reading = state.readings.find((r) => r.date === today),
    summary = patternSummary(state),
    active = state.decisions.find((d) => d.id === selected) ?? null,
    calendarPlans = state.decisions.filter((d) => d.markedChoice === "going");
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
    });
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
    if (!needsExtraction) return;
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
        navigate={navigate}
        state={state}
        checkin={() => requireAccount(() => setCheckin(true))}
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
                        {state.checkins.length ? energy.social : "—"}
                        <span>{state.checkins.length ? "%" : ""}</span>
                      </div>
                      <h3>
                        {!state.checkins.length
                          ? "How are you arriving today?"
                          : energy.social < 40
                            ? "A little room to recharge"
                            : "A little room to connect"}
                      </h3>
                      <p>
                        {energy.createdAt
                          ? `Last checked in ${new Date(energy.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${energy.mood.toLowerCase()} mood`
                          : "Your check-in helps put guidance in context."}
                      </p>
                      <button
                        className="secondary"
                        onClick={() => requireAccount(() => setCheckin(true))}
                      >
                        How are you feeling?
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
                                {new Date(d.createdAt).toLocaleDateString()} ·{" "}
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
                            `${energy.social}% social battery`,
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
                            energy.social < 40
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
                        requireAccount={requireAccount}
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
                      <div className="row between">
                        <h2>Your social profile</h2>
                        <button
                          className="text-button"
                          onClick={() => requireAccount(() => setSurvey(true))}
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
                    <div className="row between">
                      <h2>
                        {tick.toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })}
                      </h2>
                      <span className="pill">YOUR SAVED PLANS</span>
                    </div>
                    <CalendarView now={tick} decisions={calendarPlans} />
                    {calendarPlans.length ? (
                      <div className={cardStyles.calendarPlans}>
                        <p className="eyebrow">PLANS YOU CHOSE</p>
                        {calendarPlans.map((decision) => (
                          <article className={cardStyles.calendarPlan} key={decision.id}>
                            <span><CalendarDays size={18} /></span>
                            <div>
                              <strong>{decisionTitle(decision)}</strong>
                              <p>{formatEventDetails(decision.event)}</p>
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
                          onClick={() => navigate("What Should I Do?")}
                        >
                          Talk through a plan <ArrowUpRight size={16} />
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
      <Dialog open={survey} onOpenChange={setSurvey}>
        <DialogContent className="app-dialog survey-dialog">
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
      <Dialog open={checkin} onOpenChange={setCheckin}>
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
              setCheckin(false);
              toast.success("Check-in saved. A little more in tune.");
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
              </div>
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
function calendarDay(startAt: string | null | undefined, now: Date) {
  if (!startAt) return null;
  const date = new Date(startAt);
  return Number.isNaN(date.getTime()) ||
    date.getMonth() !== now.getMonth() ||
    date.getFullYear() !== now.getFullYear()
    ? null
    : date.getDate();
}
function formatEventDetails(event: Decision["event"]) {
  if (event?.whenText)
    return event.location ? `${event.whenText} · ${event.location}` : event.whenText;
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
    : "Date and time to confirm";
  return event?.location ? `${time} · ${event.location}` : time;
}
function formatEventRange(event: Decision["event"]) {
  if (event?.whenText) return event.whenText;
  if (!event?.startAt) return "Date and time to confirm";
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
function CalendarView({ now, decisions }: { now: Date; decisions: Decision[] }) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getDay(),
    count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    planDays = new Set(
      decisions
        .map((decision) => calendarDay(decision.event?.startAt, now))
        .filter((day): day is number => day !== null),
    );
  return (
    <div className="calendar-grid">
      {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
        <strong key={d}>{d}</strong>
      ))}
      {Array.from({ length: start }, (_, i) => (
        <span key={"empty" + i} />
      ))}
      {Array.from({ length: count }, (_, i) => (
        <div className={i + 1 === now.getDate() ? "today" : ""} key={i}>
          <span>{i + 1}</span>
          {i + 1 === now.getDate() && <small>Today</small>}
          {planDays.has(i + 1) && (
            <i className={cardStyles.calendarDot} aria-label="Saved plan" />
          )}
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
function CheckinForm({
  initial,
  save,
}: {
  initial: Checkin;
  save: (c: Checkin) => Promise<void>;
}) {
  const [v, setV] = useState(initial),
    [busy, setBusy] = useState(false);
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
      <Range
        label="Social energy"
        value={v.social}
        onChange={(social) => setV({ ...v, social })}
        ends={["Need some quiet", "Ready to connect"]}
      />
      <Range
        label="Physical energy"
        value={v.physical}
        onChange={(physical) => setV({ ...v, physical })}
        ends={["Running on empty", "Rested and ready"]}
      />
      <Choice
        label="Your mood"
        value={v.mood}
        options={["Low", "Okay", "Good", "Great"]}
        onChange={(mood) => setV({ ...v, mood })}
      />
      <Range
        label="Stress"
        value={v.stress}
        onChange={(stress) => setV({ ...v, stress })}
        ends={["At ease", "Overwhelmed"]}
      />
      <button className="primary full" disabled={busy}>
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
          await save(d, v);
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
            label="Social battery afterward"
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
            label="Social battery afterward"
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
      batteryBefore: current(state).social,
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
      await save("decisions", { ...active, markedChoice: choice, event });
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
        {state.decisions.map((d) => (
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
            {current(state).social}% social energy
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
                  const f = await readAttachment(file);
                  if (
                    files.reduce(
                      (sum, a) =>
                        sum + (a.dataUrl?.length ?? a.text?.length ?? 0),
                      0,
                    ) +
                      (f.dataUrl?.length ?? f.text?.length ?? 0) >
                    7_000_000
                  )
                    throw new Error("Keep total attachments under 5 MB.");
                  setFiles((prev) => [...prev, f]);
                  toast.success(
                    f.text ? "PDF text extracted." : "Image attached.",
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
  return <div className={cardStyles.factors}><b>{title}</b>{items.map((item) => <div key={item.label}><span>{item.label}</span><i><span style={{ width: `${item.value}%` }} /></i><strong>{item.value}</strong></div>)}</div>;
}
function Insights({ state }: { state: AppState }) {
  const observations = patterns(state),
    summary = patternSummary(state),
    history = state.checkins.slice(0, 14).reverse();
  const groups = [
    ["Small gatherings", observations.filter((v) => v.d.group === "small")],
    ["Large gatherings", observations.filter((v) => v.d.group === "large")],
    ["Close friends", observations.filter((v) => v.d.people === "friends")],
    ["New people", observations.filter((v) => v.d.people === "strangers")],
    ["90 minutes or less", observations.filter((v) => v.d.duration <= 90)],
    ["Longer than 90 minutes", observations.filter((v) => v.d.duration > 90)],
  ] as const;
  return (
    <>
      <div className="three-grid stats">
        <div className="panel">
          <span>Experiences reflected on</span>
          <strong>{observations.length}</strong>
          <p>Every reflection adds context.</p>
        </div>
        <div className="panel">
          <span>Average enjoyment</span>
          <strong>
            {observations.length
              ? average(observations.map((v) => v.o.enjoyment)).toFixed(1)
              : "—"}
            <small>/10</small>
          </strong>
          <p>Among events you attended.</p>
        </div>
        <div className="panel">
          <span>Average battery change</span>
          <strong>
            {observations.length
              ? `${summary.averageBatteryChange > 0 ? "+" : ""}${Math.round(summary.averageBatteryChange)}`
              : "—"}
            <small>pts</small>
          </strong>
          <p>After an event, compared with before.</p>
        </div>
      </div>
      <section className="panel history-chart">
        <div className="row between">
          <h2>Your social energy</h2>
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
                    `${new Date(c.createdAt).toLocaleDateString()}: ${c.social}%`,
                )
                .join(", ")}
            >
              {history.map((c) => (
                <div key={c.id}>
                  <span>{c.social}%</span>
                  <i style={{ height: `${Math.max(3, c.social * 1.65)}px` }} />
                  <small>
                    {new Date(c.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </div>
              ))}
            </div>
            <p className="small">Energy changes. A low day isn’t a bad day.</p>
          </>
        ) : (
          <p className="empty-copy">
            Your first check-in will start your energy history.
          </p>
        )}
      </section>
      <div className="insights-grid">
        <section className="panel">
          <h2>What seems to fill your cup?</h2>
          <p className="small">Observed enjoyment · 1–10</p>
          {groups.map(([label, rows]) => (
            <div className="pattern-row" key={label}>
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
              {rows.length > 0 && (
                <p>
                  Average energy change:{" "}
                  {Math.round(
                    average(rows.map((v) => v.o.after - v.d.batteryBefore)),
                  )}{" "}
                  points
                </p>
              )}
            </div>
          ))}
        </section>
        <section className="panel learning-panel">
          <span className="feature-icon">✧</span>
          <h2>A profile that grows with you.</h2>
          <p>
            Your survey gives us a starting point. Your lived experience
            gradually adds more weight.
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
