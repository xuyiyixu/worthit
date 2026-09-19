import { EventUnderstanding, SocialPatternProfile, WorthAnalysis } from "./types";

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const roundQuarter = (n: number) => Math.round(n * 4) / 4;

const benefitLabels = { learning: "Learning", career: "Career exposure", connection: "New connections", relationships: "Existing relationships", novelty: "Novelty", fun: "Enjoyment", exploration: "Exploration" } as const;
const motivation = { learning: "learningMotivation", career: "careerMotivation", connection: "connectionMotivation", relationships: "familiarPeoplePreference", novelty: "noveltySeeking", fun: "funMotivation", exploration: "explorationMotivation" } as const;

export function calculateWorth(event: EventUnderstanding, profile: SocialPatternProfile, travelMinutes: number, knownPeople: number): WorthAnalysis {
  const upside = Object.entries(event.takeawayTraits).map(([key, potential]) => {
    const preference = profile[motivation[key as keyof typeof motivation]];
    const peopleBoost = key === "relationships" ? knownPeople * .06 : key === "connection" ? Math.max(0, 2 - knownPeople) * .03 : 0;
    const points = Math.round(potential * (0.58 + preference * .42 + peopleBoost) * 24);
    return { key, label: benefitLabels[key as keyof typeof benefitLabels], points, note: potential > .75 ? "Strong potential" : potential > .5 ? "Good potential" : "Possible upside" };
  }).sort((a, b) => b.points - a.points).slice(0, 5);

  const duration = event.endHour - event.startHour;
  const costs = [
    { key: "crowd", label: "Crowd", raw: event.costTraits.crowd * (1.15 - profile.crowdTolerance * .55), note: "Predicted from event format" },
    { key: "travel", label: "Travel", raw: clamp(travelMinutes / 60, 0, 1) * (1.15 - profile.travelTolerance * .5), note: `${travelMinutes} min · user provided` },
    { key: "social", label: "Social effort", raw: event.costTraits.socialEffort * (1.1 - profile.strangerOpenness * .48) * (1 - knownPeople * .07), note: knownPeople ? "Familiar faces may help" : "Few familiar anchors" },
    { key: "time", label: "Time", raw: clamp(duration / 4, 0, 1), note: `${duration.toFixed(1)} hour event` },
    { key: "late", label: "Late-night friction", raw: event.costTraits.lateNight * (1.15 - profile.lateNightTolerance * .55), note: "Based on end time" },
    { key: "money", label: "Money", raw: event.costTraits.money, note: event.price ? `$${event.price} listed` : "Free event" }
  ].map(item => ({ key: item.key, label: item.label, points: Math.round(item.raw * 15), note: item.note })).filter(item => item.points > 0).sort((a, b) => b.points - a.points).slice(0, 5);

  const upsideTotal = upside.reduce((sum, item) => sum + item.points, 0);
  const costTotal = costs.reduce((sum, item) => sum + item.points, 0);
  const baseScore = clamp(48 + upsideTotal * .72 - costTotal * .58);
  const span = Math.max(1, event.endHour - event.startHour);
  const curve = Array.from({ length: Math.floor(span * 4) + 1 }, (_, i) => {
    const hour = event.startHour + i / 4;
    const progress = (hour - event.startHour) / span;
    const crowd = clamp(event.costTraits.crowd + .17 - progress * .35, .12, .95);
    const wait = Math.max(0, Math.round(crowd * 22 - progress * 4));
    const valueRemaining = 1 - Math.max(0, progress - .25) * .62;
    const timingBoost = (event.costTraits.crowd - crowd) * 22 - (1 - valueRemaining) * 28;
    return { hour, crowd, wait, score: Math.round(clamp(baseScore + timingBoost)) };
  });
  const best = curve.reduce((a, b) => b.score > a.score ? b : a);
  const bestStart = roundQuarter(best.hour);
  const bestEnd = Math.min(event.endHour, roundQuarter(bestStart + Math.min(1.5, span * .55)));
  const score = best.score;
  return { score, verdict: score >= 78 ? "WORTH IT" : score >= 62 ? "LIKELY WORTH IT" : score >= 48 ? "A CLOSE CALL" : "MAYBE NOT THIS TIME", upside, costs, curve, bestStart, bestEnd };
}

export function formatTime(hour: number) {
  const h = Math.floor(hour);
  const minutes = Math.round((hour - h) * 60);
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  const display = h % 12 || 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
