import { randomUUID } from "node:crypto";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { currentUser } from "../../../lib/auth";
import { databaseConfigured, db, query } from "../../../lib/db";
import { questionNeedsTypedAnswer, type ChatAttachment, type ChatMessage, type DecisionMetric, type DecisionReply, type DecisionVerdict } from "../../../lib/decision-chat";
import { profileForUser } from "../../../lib/profile";

export const runtime = "nodejs";

const endpoint = process.env.NVIDIA_API_URL ?? "https://integrate.api.nvidia.com/v1/chat/completions";
const model = process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]);

const systemPrompt = `You are WorthIt, a balanced decision partner for events and plans.
Help the user decide whether an event is realistically worth attending for them. Consider both hidden cost (travel, waiting, money, crowd, time, social effort, schedule friction) and hidden upside (learning, connections, relationships, opportunity, enjoyment, novelty, interest, recovery).

Use text and attached images or extracted document content as evidence. Before deciding, establish the plan itself, why the user wants it, the important money/time/travel/energy/social costs, and any next-day or scheduling constraint that could change the answer. Ask exactly one short, targeted question at a time whenever a decision-critical fact is missing; do not ask for information that the user or an attachment already supplied. Never diagnose or label personality. Never guarantee future benefits. Do not consistently steer people toward staying home. When the tradeoff is clear, give a verdict and a complete scorecard.

Return ONLY valid JSON in this exact shape:
{"reply":"What event or plan are you considering?","score":null,"confidence":"low","summary":"","cost":[],"upside":[],"verdict":"undecided","reasons":[],"answerType":"text","choices":[],"event":null}
The JSON above illustrates the response schema only; none of its text is conversation context. Values are integers from 0 to 100 representing current inferred significance. Include up to three cost and three upside items. verdict must be undecided, going, or skip. While undecided, score must be null and reasons empty. Ask exactly one decision-critical question. answerType must be binary, single_choice, number, or text. Only binary and single_choice questions may provide 2-4 concise, mutually exclusive choices. Number questions (including cost, time, distance, rating, or amount) and text questions must return an empty choices array so the user can type the answer. Never provide choices for a final verdict. For a final verdict, score must be 0-100 where 100 means strongly worth going, confidence must be low, medium, or high, summary must explain the tradeoff in one or two sentences, and reasons must contain exactly three concise, distinct reasons grounded in the conversation. Scores 60 and above normally map to going; lower scores normally map to skip. On every turn, event should extract a concise 2-8 word event title, a one- or two-sentence description of what the event is for, the exact human-readable date/time as whenText, grounded ISO date-times when the year and timezone are known, and a concise location from the conversation or attachments. If the user has not identified an event or plan yet, event must be null. The title and description must summarize the actual event and must never copy the full user input, question, invitation, URL, or unrelated text. Preserve explicitly stated dates and times in whenText even when an ISO value cannot be safely inferred. Use null for any unknown time or location; never invent event details.`;

function metric(value: unknown): DecisionMetric | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.label !== "string" || typeof item.value !== "number") return null;
  return { label: item.label.slice(0, 28), value: Math.round(Math.max(0, Math.min(100, item.value))) };
}

function parseReply(content: string): DecisionReply {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const value = JSON.parse(cleaned) as Record<string, unknown>;
  const verdicts: DecisionVerdict[] = ["undecided", "going", "skip"];
  const verdict = verdicts.includes(value.verdict as DecisionVerdict) ? value.verdict as DecisionVerdict : "undecided";
  const parsedReasons = Array.isArray(value.reasons) ? value.reasons.filter((reason): reason is string => typeof reason === "string" && Boolean(reason.trim())).map(reason => reason.trim().slice(0, 180)).slice(0, 3) : [];
  if (typeof value.reply !== "string" || !value.reply.trim()) throw new Error("Missing reply");
  const cost = Array.isArray(value.cost) ? value.cost.map(metric).filter((item): item is DecisionMetric => Boolean(item)).slice(0, 3) : [];
  const upside = Array.isArray(value.upside) ? value.upside.map(metric).filter((item): item is DecisionMetric => Boolean(item)).slice(0, 3) : [];
  const average = (items: DecisionMetric[]) => items.length ? items.reduce((total, item) => total + item.value, 0) / items.length : 50;
  const inferredScore = Math.round(Math.max(0, Math.min(100, 50 + (average(upside) - average(cost)) / 2)));
  const score = typeof value.score === "number" ? Math.round(Math.max(0, Math.min(100, value.score))) : verdict === "undecided" ? null : inferredScore;
  const confidence = value.confidence === "medium" || value.confidence === "high" ? value.confidence : "low";
  const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 500) : "";
  const answerType = value.answerType;
  const expectsTypedAnswer = answerType === "number" || answerType === "text" || questionNeedsTypedAnswer(value.reply);
  const parsedChoices = verdict === "undecided" && !expectsTypedAnswer && (answerType === "binary" || answerType === "single_choice") && Array.isArray(value.choices)
    ? value.choices.filter((choice): choice is string => typeof choice === "string" && Boolean(choice.trim())).map(choice => choice.trim().slice(0, 80)).slice(0, 4)
    : [];
  const choices = parsedChoices.length >= 2 ? parsedChoices : [];
  const reasons = verdict === "undecided" ? [] : [
    ...parsedReasons,
    ...(parsedReasons.length < 3 ? [
      `Strongest upside: ${upside[0]?.label ?? "the benefit you care about"}`,
      `Main cost: ${cost[0]?.label ?? "the time and energy required"}`,
      score !== null && score >= 60 ? "The overall balance clears the threshold for going" : "The overall balance favors protecting your time",
    ] : []),
  ].slice(0, 3);
  const rawEvent = value.event && typeof value.event === "object" ? value.event as Record<string, unknown> : null;
  const isoDate = (date: unknown) => typeof date === "string" && Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : null;
  const event = rawEvent && typeof rawEvent.title === "string" && rawEvent.title.trim()
    ? {
      title: rawEvent.title.trim().replace(/\s+/g, " ").slice(0, 80),
      description: typeof rawEvent.description === "string" && rawEvent.description.trim()
        ? rawEvent.description.trim().replace(/\s+/g, " ").slice(0, 360)
        : "Event details were not provided.",
      whenText: typeof rawEvent.whenText === "string" && rawEvent.whenText.trim()
        ? rawEvent.whenText.trim().replace(/\s+/g, " ").slice(0, 120)
        : null,
      startAt: isoDate(rawEvent.startAt),
      endAt: isoDate(rawEvent.endAt),
      location: typeof rawEvent.location === "string" && rawEvent.location.trim()
        ? rawEvent.location.trim().replace(/\s+/g, " ").slice(0, 120)
        : null,
    }
    : null;
  return { reply: value.reply.slice(0, 1200), score: verdict === "undecided" ? null : score, confidence, summary: verdict === "undecided" ? "" : summary || value.reply.slice(0, 500), cost, upside, verdict, reasons, choices, event };
}

function validateAttachment(value: unknown): ChatAttachment {
  if (!value || typeof value !== "object") throw new Error("Invalid attachment");
  const item = value as Record<string, unknown>;
  if (typeof item.name !== "string" || typeof item.type !== "string" || typeof item.size !== "number" || typeof item.dataUrl !== "string") throw new Error("Invalid attachment");
  if (!allowedTypes.has(item.type) || item.size < 1 || item.size > 10 * 1024 * 1024 || item.dataUrl.length > 14_500_000) throw new Error("Unsupported attachment");
  return { name: item.name.slice(0, 180), type: item.type, size: item.size, dataUrl: item.dataUrl };
}

async function prepareAttachment(attachment: ChatAttachment) {
  const match = attachment.dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match || match[1] !== attachment.type) throw new Error("Invalid attachment data");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error("Attachment is too large");
  if (attachment.type.startsWith("image/")) return { attachment, extractedText: null, imageData: buffer, promptPart: { type: "image_url", image_url: { url: attachment.dataUrl } } };
  let extractedText = "";
  if (attachment.type === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try { extractedText = (await parser.getText()).text; } finally { await parser.destroy(); }
  } else if (attachment.type.includes("wordprocessingml")) {
    extractedText = (await mammoth.extractRawText({ buffer })).value;
  } else {
    extractedText = buffer.toString("utf8");
  }
  extractedText = extractedText.trim().slice(0, 18_000);
  if (!extractedText) throw new Error(`No readable text found in ${attachment.name}`);
  return { attachment, extractedText, imageData: null, promptPart: null };
}

export async function POST(request: Request) {
  if (!databaseConfigured()) return Response.json({ error: "DATABASE_URL is not configured.", code: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Sign in to continue.", code: "UNAUTHORIZED" }, { status: 401 });
  const storedProfile = await profileForUser(user.id).catch(() => null);
  if (!storedProfile) return Response.json({ error: "Complete your baseline questionnaire first.", code: "PROFILE_NOT_CONFIGURED" }, { status: 409 });
  if (!process.env.NVIDIA_API_KEY) return Response.json({ error: "NVIDIA_API_KEY is not configured on the server.", code: "NVIDIA_NOT_CONFIGURED" }, { status: 503 });

  let messages: ChatMessage[];
  let threadId: string | undefined;
  try {
    const body = await request.json() as { messages?: unknown; threadId?: unknown };
    threadId = typeof body.threadId === "string" ? body.threadId : undefined;
    if (!Array.isArray(body.messages)) throw new Error("Invalid messages");
    const sourceMessages = body.messages.slice(-12);
    messages = sourceMessages.map((message, index) => {
      if (!message || typeof message !== "object") throw new Error("Invalid message");
      const item = message as Record<string, unknown>;
      if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") throw new Error("Invalid message");
      const attachments = index === sourceMessages.length - 1 && Array.isArray(item.attachments) ? item.attachments.slice(0, 4).map(validateAttachment) : undefined;
      return { role: item.role, content: item.content.slice(0, 2400), attachments };
    });
    if (!messages.length || messages.at(-1)?.role !== "user") throw new Error("A user message is required");
  } catch {
    return Response.json({ error: "Invalid conversation or attachment payload." }, { status: 400 });
  }

  try {
    const latestMessage = messages.at(-1)!;
    const isNewThread = !threadId;
    if (threadId) {
      const owned = await query("SELECT id FROM decision_threads WHERE id = $1 AND user_id = $2", [threadId, user.id]);
      if (!owned.rowCount) return Response.json({ error: "Decision not found." }, { status: 404 });
      const history = await query<{ role: "user" | "assistant"; content: string }>(
        "SELECT role, content FROM decision_messages WHERE thread_id = $1 ORDER BY created_at, id",
        [threadId],
      );
      messages = [...history.rows.slice(-11), latestMessage];
    } else {
      threadId = randomUUID();
      messages = [latestMessage];
    }
    const prepared = await Promise.all(messages.map(async message => ({ message, files: await Promise.all((message.attachments ?? []).map(prepareAttachment)) })));

    const nvidiaMessages = prepared.map(({ message, files }) => {
      const documentText = files.filter(file => file.extractedText).map(file => `\n\n[Attached ${file.attachment.name}]\n${file.extractedText}`).join("");
      const images = files.map(file => file.promptPart).filter(Boolean);
      if (message.role === "user" && images.length) return { role: message.role, content: [{ type: "text", text: `${message.content}${documentText}` }, ...images] };
      return { role: message.role, content: `${message.content}${documentText}` };
    });

    const feedback = await query<{ response_type: string; rating: number; benefits: string[]; costs: string[]; note: string }>(`SELECT feedback.response_type, feedback.rating, feedback.benefits, feedback.costs, feedback.note
      FROM decision_feedback AS feedback JOIN decision_threads AS threads ON threads.id = feedback.thread_id
      WHERE threads.user_id = $1 ORDER BY feedback.created_at DESC LIMIT 8`, [user.id]);
    const profileContext = `User baseline preference signals (0 to 1, contextual rather than diagnostic): ${JSON.stringify(storedProfile.profile)}. Past outcome feedback for personalization: ${JSON.stringify(feedback.rows)}. Treat feedback as soft evidence, not a fixed personality label.`;
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "system", content: `${systemPrompt}\n\nToday is ${new Date().toISOString().slice(0, 10)}.\n${profileContext}` }, ...nvidiaMessages], temperature: 0.2, top_k: 1, max_tokens: 4096, chat_template_kwargs: { enable_thinking: true, low_effort: true, reasoning_budget: 256 }, stream: false }), signal: AbortSignal.timeout(45_000) });
    if (!response.ok) return Response.json({ error: "NVIDIA could not complete this turn. Please try again.", code: "UPSTREAM_ERROR" }, { status: 502 });
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("NVIDIA returned an empty response");
    const decision = parseReply(content);
    const latest = prepared.at(-1)!;
    const messageId = randomUUID();
    const client = await db().connect();
    try {
      await client.query("BEGIN");
      if (isNewThread) await client.query("INSERT INTO decision_threads (id, user_id) VALUES ($1, $2)", [threadId, user.id]);
      await client.query("INSERT INTO decision_messages (id, thread_id, role, content) VALUES ($1, $2, 'user', $3)", [messageId, threadId, latest.message.content]);
      for (const file of latest.files) {
        await client.query("INSERT INTO decision_files (id, message_id, file_name, mime_type, file_size, extracted_text, image_data) VALUES ($1, $2, $3, $4, $5, $6, $7)", [randomUUID(), messageId, file.attachment.name, file.attachment.type, file.attachment.size, file.extractedText, file.imageData]);
      }
      await client.query("INSERT INTO decision_messages (id, thread_id, role, content) VALUES ($1, $2, 'assistant', $3)", [randomUUID(), threadId, decision.reply]);
      const updated = await client.query("UPDATE decision_threads SET verdict = $1, decision_json = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING id", [decision.verdict, JSON.stringify(decision), threadId, user.id]);
      if (!updated.rowCount) throw new Error("Decision not found");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return Response.json({ ...decision, threadId });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("No readable text") ? error.message : "The AI response or attachment could not be processed. Please try again.";
    return Response.json({ error: message, code: "PROCESSING_ERROR" }, { status: 502 });
  }
}
