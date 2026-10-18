import PocketBase from "pocketbase";
import { type DevLoginRole, isDevLoginEnabled } from "@/lib/dev-auth";

const POCKETBASE_URL =
  process.env.POCKETBASE_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_POCKETBASE_URL ||
  "http://127.0.0.1:8090";

/**
 * Loguje testowego użytkownika DEV (dane z .env.development.local, po stronie serwera).
 * Poza development z lokalnym PocketBase zwraca 404.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isDevLoginEnabled(process.env.NODE_ENV, POCKETBASE_URL)) {
    return new Response("Not found", { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { role?: DevLoginRole };
  const prefix = body.role === "admin" ? "DEV_ADMIN" : "DEV_USER";
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) {
    return Response.json(
      { error: "Brak danych DEV w .env.development.local — uruchom pnpm dev:seed" },
      { status: 500 },
    );
  }
  try {
    const authData = await new PocketBase(POCKETBASE_URL)
      .collection("users")
      .authWithPassword(email, password);
    return Response.json({ token: authData.token, record: authData.record });
  } catch {
    return Response.json(
      { error: "Logowanie nie powiodło się — uruchom pnpm dev:seed" },
      { status: 401 },
    );
  }
}
