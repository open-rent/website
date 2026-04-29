import { checkBotId } from "botid/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const verification = await checkBotId();

  if (verification.isBot) {
    return Response.json({ error: "Bot detected" }, { status: 403 });
  }

  let body: { email?: unknown; source?: unknown; timestamp?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { email, source, timestamp } = body;

  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    console.error("subscribe: GOOGLE_SCRIPT_URL is not set");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const upstream = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        source: typeof source === "string" ? source : "unknown",
        timestamp:
          typeof timestamp === "string" ? timestamp : new Date().toISOString(),
      }),
    });

    if (!upstream.ok) {
      console.error("subscribe: upstream non-2xx", upstream.status);
      return Response.json({ error: "Upstream error" }, { status: 502 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("subscribe: upstream fetch failed", err);
    return Response.json({ error: "Upstream error" }, { status: 502 });
  }
}
