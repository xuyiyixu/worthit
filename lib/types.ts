export type SocialPatternProfile = {
  crowdTolerance: number;
  strangerOpenness: number;
  travelTolerance: number;
  lateNightTolerance: number;
  familiarPeoplePreference: number;
  noveltySeeking: number;
  learningMotivation: number;
  careerMotivation: number;
  connectionMotivation: number;
  funMotivation: number;
  explorationMotivation: number;
  largeGroupPreference: number;
  smallGroupPreference: number;
};

export type TraitKey = "learning" | "career" | "connection" | "relationships" | "novelty" | "fun" | "exploration";
export type CostKey = "crowd" | "socialEffort" | "time" | "lateNight" | "money";

export type EventUnderstanding = {
  name: string;
  location: string;
  startHour: number;
  endHour: number;
  price: number;
  sourceText: string;
  costTraits: Record<CostKey, number>;
  takeawayTraits: Record<TraitKey, number>;
  interestTags: string[];
  provenance: "INFERRED" | "DEMO";
};

export type BreakdownItem = { key: string; label: string; points: number; note: string };
export type WorthPoint = { hour: number; score: number; crowd: number; wait: number };

export type WorthAnalysis = {
  score: number;
  verdict: string;
  upside: BreakdownItem[];
  costs: BreakdownItem[];
  curve: WorthPoint[];
  bestStart: number;
  bestEnd: number;
};
