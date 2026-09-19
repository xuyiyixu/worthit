import { redirect } from "next/navigation";
import { currentUser } from "../lib/auth";
import { databaseConfigured } from "../lib/db";
import { profileForUser } from "../lib/profile";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!databaseConfigured()) redirect("/login");
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login");
  redirect(await profileForUser(user.id) ? "/history" : "/onboarding");
}
