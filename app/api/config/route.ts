import { databaseConfigured } from "../../../lib/db";
import { nvidiaConfigured } from "../../../lib/nvidia";

export async function GET() {
  return Response.json({
    auth: databaseConfigured(),
    ai: nvidiaConfigured(),
    vision: nvidiaConfigured(),
  });
}
