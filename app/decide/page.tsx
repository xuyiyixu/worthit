import { redirect } from "next/navigation";
import { currentUser } from "../../lib/auth";
import { databaseConfigured } from "../../lib/db";
import { DecideClient } from "./decide-client";

export const dynamic = "force-dynamic";

export default async function DecidePage() {
  if (!databaseConfigured()) redirect("/login");
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login");
  return <DecideClient />;
}
