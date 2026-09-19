import { databaseConfigured } from "../../../lib/db";

export async function GET() {
  return Response.json({
    auth: databaseConfigured(),
    ai: Boolean(process.env.NVIDIA_API_KEY),
    vision: Boolean(process.env.NVIDIA_API_KEY),
  });
}
