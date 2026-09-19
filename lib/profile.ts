import type { SocialPatternProfile } from "./types";
import { query } from "./db";

export type StoredProfile = {
  answers: number[];
  profile: SocialPatternProfile;
};

type ProfileRow = {
  answers: number[];
  profile_json: SocialPatternProfile;
};

export async function profileForUser(userId: string): Promise<StoredProfile | null> {
  const result = await query<ProfileRow>("SELECT answers, profile_json FROM user_profiles WHERE user_id = $1", [userId]);
  const row = result.rows[0];
  return row ? { answers: row.answers, profile: row.profile_json } : null;
}
