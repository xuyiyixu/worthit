import { redirect } from "next/navigation";
import { currentUser } from "../../lib/auth";
import { databaseConfigured } from "../../lib/db";
import { profileForUser } from "../../lib/profile";
import { OnboardingClient } from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!databaseConfigured()) redirect("/login");
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login");
  if (await profileForUser(user.id)) redirect("/history");
  return <OnboardingClient />;
}
