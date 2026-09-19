import type { AppState, Reading } from "./model.ts";
import { current, localDay, uid } from "./model.ts";
const majors = [
  "The Fool",
  "The Magician",
  "The High Priestess",
  "The Empress",
  "The Emperor",
  "The Hierophant",
  "The Lovers",
  "The Chariot",
  "Strength",
  "The Hermit",
  "Wheel of Fortune",
  "Justice",
  "The Hanged One",
  "Death",
  "Temperance",
  "The Devil",
  "The Tower",
  "The Star",
  "The Moon",
  "The Sun",
  "Judgement",
  "The World",
];
const themes = [
  "Beginnings · Curiosity",
  "Intention · Possibility",
  "Intuition · Stillness",
  "Care · Abundance",
  "Structure · Boundaries",
  "Values · Belonging",
  "Connection · Choice",
  "Direction · Momentum",
  "Patience · Courage",
  "Reflection · Rest",
  "Change · Perspective",
  "Balance · Honesty",
  "Pause · Perspective",
  "Release · Renewal",
  "Balance · Moderation",
  "Habits · Freedom",
  "Change · Rebuilding",
  "Hope · Renewal",
  "Uncertainty · Intuition",
  "Joy · Clarity",
  "Reflection · Renewal",
  "Integration · Wholeness",
];
export const deck = [
  ...majors.map((name, i) => ({
    name,
    theme: themes[i],
    symbol: [
      "✧",
      "✦",
      "☾",
      "❀",
      "◇",
      "✧",
      "♡",
      "↗",
      "∞",
      "☽",
      "◉",
      "⚖",
      "◇",
      "❋",
      "∞",
      "◈",
      "ϟ",
      "✧",
      "☾",
      "☀",
      "✦",
      "◎",
    ][i],
  })),
  ...["Cups", "Wands", "Swords", "Pentacles"].flatMap((suit) =>
    [
      "Ace",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Page",
      "Knight",
      "Queen",
      "King",
    ].map((rank) => ({
      name: `${rank} of ${suit}`,
      theme:
        suit === "Cups"
          ? "Connection · Care"
          : suit === "Wands"
            ? "Energy · Inspiration"
            : suit === "Swords"
              ? "Clarity · Perspective"
              : "Grounding · Growth",
      symbol:
        suit === "Cups"
          ? "♡"
          : suit === "Wands"
            ? "✦"
            : suit === "Swords"
              ? "◇"
              : "✺",
    })),
  ),
];
export const positions = [
  "Today’s Energy",
  "Connection & Environment",
  "Guidance",
];
export function makeReading(
  s: AppState,
  date = localDay(new Date(), s.profile.timezone),
): Reading {
  const ids = Array.from({ length: deck.length }, (_, i) => i);
  for (let i = ids.length - 1; i > 0; i--) {
    const x = new Uint32Array(1);
    crypto.getRandomValues(x);
    const j = x[0] % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const cards = ids.slice(0, 3),
    energy = current(s).social;
  return {
    id: uid(),
    date,
    cards,
    energy,
    reading: `${deck[cards[0]].name} invites you to reflect on ${deck[cards[0]].theme.toLowerCase().replace(" · ", " and ")}. In your connections, ${deck[cards[1]].name} offers a prompt about ${deck[cards[1]].theme.toLowerCase().replace(" · ", " and ")}. Finally, ${deck[cards[2]].name} asks: what would ${deck[cards[2]].theme.toLowerCase().split(" · ")[0]} look like in one small choice today?`,
    guidance: `With social energy at ${energy}%, ${energy < 40 ? "make space for quiet before committing to more" : "consider one connection that feels nourishing"}. ${s.profile.recovery > 60 ? "Leave some recovery time in your day." : "Check in with yourself as the day unfolds."} These cards are reflection prompts, not predictions or instructions.`,
  };
}
