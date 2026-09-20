import { AppState, Attachment, current, DecisionCard, demoReply, Message, Reading } from "./model";
import { makeReading } from "./tarot";
export const DEMO_KEY = "wsid-demo-v4";
export function api(
  path: "/api/config",
): Promise<{ auth: boolean; ai: boolean; vision: boolean }>;
export function api(
  path: "/api/auth",
  body?: unknown,
): Promise<{ user: { id: string; email?: string } | null; message: string }>;
export function api(path: "/api/data"): Promise<AppState>;
export function api(
  path: "/api/data",
  body: { action: "draw" },
): Promise<Reading>;
export function api(path: "/api/data", body: unknown): Promise<{ ok: boolean }>;
export function api(
  path: "/api/calendar/energy",
  body: unknown,
): Promise<{ energyLoad: number; explanation: string }>;
export function api(
  path: "/api/chat",
  body: unknown,
): Promise<{ content: string; mode: string; threadId?: string; choices?: string[]; decision?: DecisionCard; event?: DecisionCard["event"] }>;
export async function api(path: string, body?: unknown): Promise<unknown> {
  if (path === "/api/chat" && body && typeof body === "object") {
    const input = body as { messages?: Message[]; threadId?: string; state?: AppState; demo?: boolean; forceDemo?: boolean };
    if ((input.demo || input.forceDemo) && input.state) {
      const messages = input.messages ?? [];
      const userTurns = messages.filter((message) => message.role === "user");
      if (userTurns.length < 2) {
        return {
          content: "Before I score this, how much energy do you realistically have for the plan today?",
          mode: "demo",
          choices: ["Plenty — I feel up for it", "Some — a short visit could work", "Very little — I need recovery"],
          event: { title: "Event plan", description: "A plan you are considering.", whenText: null, startAt: null, endAt: null, location: null },
        };
      }
      const energy = current(input.state).social;
      const score = Math.max(35, Math.min(86, Math.round(58 + (energy - 50) * 0.35)));
      return {
        content: demoReply(input.state, messages),
        mode: score >= 60 ? "going" : "skip",
        decision: {
          score,
          confidence: "medium",
          summary: score >= 60 ? "The likely upside is worth making room for, especially with a clear time boundary." : "Your current energy makes the cost heavier than the likely benefit today.",
          cost: [{ label: "social effort", value: Math.max(20, 85 - energy) }, { label: "recovery", value: 62 }],
          upside: [{ label: "connection", value: 74 }, { label: "enjoyment", value: 68 }],
          verdict: score >= 60 ? "going" : "skip",
          reasons: score >= 60
            ? ["There is meaningful connection upside", "A shorter visit keeps the cost manageable", "Your current energy leaves room to participate"]
            : ["Your available energy is limited", "Recovery cost is likely to linger", "A lower-pressure alternative fits better today"],
          event: { title: "Event plan", description: "A plan you are considering.", whenText: null, startAt: null, endAt: null, location: null },
        },
        event: { title: "Event plan", description: "A plan you are considering.", whenText: null, startAt: null, endAt: null, location: null },
      };
    }
    const messages = (input.messages ?? []).map((message) => ({
      role: message.role,
      content: `${message.content}${(message.attachments ?? []).filter((item) => item.text).map((item) => `\n\n[Attached ${item.name}]\n${item.text}`).join("")}`,
      attachments: (message.attachments ?? []).filter((item) => item.dataUrl).map((item) => ({
        name: item.name,
        type: item.type,
        size: Math.max(1, Math.floor((item.dataUrl!.split(",")[1]?.length ?? 0) * 0.75)),
        dataUrl: item.dataUrl!,
      })),
    }));
    const response = await fetch("/api/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, threadId: input.threadId }),
    });
    const data = await response.json() as { error?: string; reply?: string; verdict?: "undecided" | "going" | "skip"; threadId?: string; choices?: string[]; score?: number | null; confidence?: "low" | "medium" | "high"; summary?: string; cost?: DecisionCard["cost"]; upside?: DecisionCard["upside"]; reasons?: string[]; event?: DecisionCard["event"] | null };
    if (!response.ok) throw new Error(data.error ?? "Please try again.");
    const decision = data.verdict && data.verdict !== "undecided" && typeof data.score === "number"
      ? { score: data.score, confidence: data.confidence ?? "low", summary: data.summary ?? "", cost: data.cost ?? [], upside: data.upside ?? [], verdict: data.verdict, reasons: data.reasons ?? [], event: data.event ?? undefined }
      : undefined;
    return { content: data.reply ?? "", mode: data.verdict ?? "guidance", threadId: data.threadId, choices: data.choices, decision, event: data.event ?? undefined };
  }
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Please try again.");
  return data;
}
export function persistDemo(state: AppState) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(state));
}
export async function drawDemo(state: AppState): Promise<Reading> {
  const draw = () => {
    const latest = JSON.parse(
      localStorage.getItem(DEMO_KEY) ?? JSON.stringify(state),
    ) as AppState;
    const next = makeReading(latest);
    const existing = latest.readings.find((r) => r.date === next.date);
    if (existing) return existing;
    latest.readings.unshift(next);
    persistDemo(latest);
    return next;
  };
  if (navigator.locks) return navigator.locks.request("wsid-daily-draw", draw);
  return draw();
}
export async function readAttachments(file: File, maxPdfImagePages = 3): Promise<Attachment[]> {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose a file smaller than 5 MB.");
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    const pdf = await task.promise;
    try {
      if (pdf.numPages > 10)
        throw new Error("Please upload a PDF with 10 pages or fewer.");
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text +=
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ") + "\n";
      }
      if (text.trim())
        return [{ name: file.name, type: "application/pdf", text: text.slice(0, 20000) }];

      const pageCount = Math.min(pdf.numPages, Math.max(1, maxPdfImagePages));
      const baseName = file.name.replace(/\.pdf$/i, "");
      const pages: Attachment[] = [];
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, 1800 / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport, background: "#ffffff" }).promise;
        pages.push({
          name: `${baseName} - page ${i}.jpg`,
          type: "image/jpeg",
          dataUrl: canvas.toDataURL("image/jpeg", 0.86),
        });
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
      return pages;
    } finally {
      await task.destroy();
    }
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Use a PNG, JPG, WebP, or PDF.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
  return [{ name: file.name, type: file.type, dataUrl }];
}
