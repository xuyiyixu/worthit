import { EventUnderstanding, CostKey, TraitKey } from "./types";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const has = (text: string, words: string[]) => words.some(word => text.includes(word));

export const demoText = `CMU Startup Mixer
Friday, 7:00 PM – 10:00 PM
Swartz Center for Entrepreneurship, Pittsburgh
Free
Meet founders, students and investors for startup demos, short talks, networking and refreshments.`;

export function understandEvent(sourceText: string, demo = false): EventUnderstanding {
  const lower = sourceText.toLowerCase();
  const lines = sourceText.split("\n").map(line => line.trim()).filter(Boolean);
  const times = [...sourceText.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi)].map(match => {
    let hour = Number(match[1]) % 12 + (match[3].toLowerCase() === "pm" ? 12 : 0);
    return hour + Number(match[2] ?? 0) / 60;
  });
  const professional = has(lower, ["startup", "career", "founder", "investor", "professional", "industry", "network"]);
  const educational = has(lower, ["talk", "workshop", "learn", "lecture", "panel", "conference", "demo"]);
  const social = has(lower, ["mixer", "network", "meet", "social", "party", "community"]);
  const playful = has(lower, ["music", "party", "festival", "game", "fun", "dance", "food", "refreshment"]);
  const intimate = has(lower, ["small group", "intimate", "limited seating", "dinner"]);
  const free = has(lower, ["free", "$0", "no cost"]);
  const priceMatch = sourceText.match(/\$(\d+(?:\.\d{1,2})?)/);
  const startHour = times[0] ?? 19;
  const endHour = times[1] ?? Math.min(startHour + 2.5, 24);

  const takeaway: Record<TraitKey, number> = {
    learning: educational ? .82 : .45,
    career: professional ? .9 : .3,
    connection: social ? .9 : .4,
    relationships: has(lower, ["friends", "community", "club", "reunion"]) ? .75 : .35,
    novelty: has(lower, ["new", "first", "launch", "discover", "demo"]) ? .82 : .62,
    fun: playful ? .82 : .55,
    exploration: has(lower, ["tour", "explore", "exhibit", "festival", "discover"]) ? .82 : .5
  };
  const cost: Record<CostKey, number> = {
    crowd: intimate ? .25 : social || playful ? .78 : .5,
    socialEffort: social ? .86 : .42,
    time: clamp((endHour - startHour) / 4),
    lateNight: clamp((endHour - 21) / 3),
    money: free ? 0 : clamp(Number(priceMatch?.[1] ?? 18) / 80)
  };
  const tags = [professional && "professional", educational && "learning", social && "networking", playful && "social", has(lower, ["technology", "tech", "startup"]) && "technology"].filter(Boolean) as string[];
  const locationLine = lines.find(line => /center|hall|street|avenue|pittsburgh|room|venue/i.test(line));

  return {
    name: lines[0]?.slice(0, 70) || "Untitled event",
    location: locationLine ?? "Location not found",
    startHour,
    endHour: Math.max(endHour, startHour + 1),
    price: free ? 0 : Number(priceMatch?.[1] ?? 18),
    sourceText,
    costTraits: cost,
    takeawayTraits: takeaway,
    interestTags: tags.length ? tags : ["general interest"],
    provenance: demo ? "DEMO" : "INFERRED"
  };
}
