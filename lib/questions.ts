import { SocialPatternProfile } from "./types";

type Weights = Partial<Record<keyof SocialPatternProfile, number>>;
export type Question = { prompt: string; eyebrow: string; options: { label: string; weights: Weights }[] };

export const questions: Question[] = [
  {
    eyebrow: "Walking in",
    prompt: "You arrive at an event where you only know one person. What do you usually do?",
    options: [
      { label: "Start meeting people pretty quickly", weights: { strangerOpenness: 1, connectionMotivation: .8, largeGroupPreference: .7 } },
      { label: "Stay with the person I know at first", weights: { familiarPeoplePreference: .8, smallGroupPreference: .6 } },
      { label: "Observe for a while, then join in", weights: { strangerOpenness: .45, crowdTolerance: .4, smallGroupPreference: .7 } },
      { label: "Wish I had brought another friend", weights: { familiarPeoplePreference: 1, strangerOpenness: .15, crowdTolerance: .2 } }
    ]
  },
  {
    eyebrow: "A free evening",
    prompt: "You unexpectedly get a completely free evening. Which sounds most appealing?",
    options: [
      { label: "Find something happening nearby", weights: { noveltySeeking: 1, explorationMotivation: 1, travelTolerance: .7 } },
      { label: "Meet a few friends", weights: { connectionMotivation: .7, familiarPeoplePreference: .9, smallGroupPreference: .8 } },
      { label: "Do something low-key outside", weights: { explorationMotivation: .7, smallGroupPreference: .8 } },
      { label: "Stay home and recharge", weights: { crowdTolerance: .15, lateNightTolerance: .2, smallGroupPreference: .6 } }
    ]
  },
  {
    eyebrow: "Getting there",
    prompt: "Something sounds interesting, but getting there takes 35 minutes. Your first reaction?",
    options: [
      { label: "If it sounds good, I’m going", weights: { travelTolerance: 1, noveltySeeking: .8 } },
      { label: "Depends how unique it is", weights: { travelTolerance: .65, noveltySeeking: 1 } },
      { label: "I’d check if someone else is going", weights: { travelTolerance: .45, familiarPeoplePreference: .9 } },
      { label: "The commute makes me hesitate", weights: { travelTolerance: .1 } }
    ]
  },
  {
    eyebrow: "In the room",
    prompt: "At a busy event, which moment usually feels best?",
    options: [
      { label: "Meeting someone unexpected", weights: { strangerOpenness: 1, connectionMotivation: 1, crowdTolerance: .8 } },
      { label: "Doing the main activity", weights: { learningMotivation: .7, crowdTolerance: .55 } },
      { label: "Talking with people I already know", weights: { familiarPeoplePreference: 1, connectionMotivation: .6 } },
      { label: "Finding a quieter corner", weights: { crowdTolerance: .1, smallGroupPreference: 1 } }
    ]
  },
  {
    eyebrow: "The pull",
    prompt: "Which event would be hardest for you to say no to?",
    options: [
      { label: "Something related to my career", weights: { careerMotivation: 1, learningMotivation: .7 } },
      { label: "Something close friends are attending", weights: { familiarPeoplePreference: 1, connectionMotivation: .8 } },
      { label: "Something I’ve never experienced", weights: { noveltySeeking: 1, explorationMotivation: 1 } },
      { label: "Something purely fun", weights: { funMotivation: 1, crowdTolerance: .65 } }
    ]
  },
  {
    eyebrow: "Tomorrow morning",
    prompt: "An event ends at 11 PM and tomorrow starts early. What usually happens?",
    options: [
      { label: "I go anyway if it’s worth it", weights: { lateNightTolerance: 1 } },
      { label: "I go, but leave early", weights: { lateNightTolerance: .55 } },
      { label: "I decide based on how rare it is", weights: { lateNightTolerance: .65, noveltySeeking: .85 } },
      { label: "I usually skip it", weights: { lateNightTolerance: .1 } }
    ]
  },
  {
    eyebrow: "After a long week",
    prompt: "Which plan sounds most attractive?",
    options: [
      { label: "A large, exciting event", weights: { largeGroupPreference: 1, crowdTolerance: 1, funMotivation: .8 } },
      { label: "Dinner with friends", weights: { smallGroupPreference: .9, familiarPeoplePreference: .9 } },
      { label: "A small, interesting activity", weights: { smallGroupPreference: 1, learningMotivation: .7, noveltySeeking: .7 } },
      { label: "A quiet evening", weights: { crowdTolerance: .1, largeGroupPreference: .1 } }
    ]
  },
  {
    eyebrow: "Looking back",
    prompt: "What makes an event feel worth remembering?",
    options: [
      { label: "I learned something", weights: { learningMotivation: 1 } },
      { label: "I met someone interesting", weights: { connectionMotivation: 1, strangerOpenness: .8 } },
      { label: "I shared it with people I care about", weights: { familiarPeoplePreference: 1, connectionMotivation: .7 } },
      { label: "I experienced something new", weights: { noveltySeeking: 1, explorationMotivation: 1 } },
      { label: "I simply had a great time", weights: { funMotivation: 1 } }
    ]
  }
];

export function inferProfile(answers: number[]): SocialPatternProfile {
  const keys: (keyof SocialPatternProfile)[] = ["crowdTolerance", "strangerOpenness", "travelTolerance", "lateNightTolerance", "familiarPeoplePreference", "noveltySeeking", "learningMotivation", "careerMotivation", "connectionMotivation", "funMotivation", "explorationMotivation", "largeGroupPreference", "smallGroupPreference"];
  const totals = Object.fromEntries(keys.map(k => [k, { sum: .5, count: 1 }])) as Record<keyof SocialPatternProfile, { sum: number; count: number }>;
  answers.forEach((answer, qi) => {
    const weights = questions[qi]?.options[answer]?.weights ?? {};
    Object.entries(weights).forEach(([key, value]) => {
      totals[key as keyof SocialPatternProfile].sum += value ?? 0;
      totals[key as keyof SocialPatternProfile].count += 1;
    });
  });
  return Object.fromEntries(keys.map(k => [k, Number((totals[k].sum / totals[k].count).toFixed(2))])) as SocialPatternProfile;
}
