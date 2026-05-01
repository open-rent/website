import { checkBotId } from "botid/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const verification = await checkBotId();

  if (verification.isBot) {
    return Response.json({ error: "Bot detected" }, { status: 403 });
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { email } = body;

  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    console.error("subscribe: LOOPS_API_KEY is not set");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const upstream = await fetch(
      "https://app.loops.so/api/v1/contacts/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ email, source: "waitlist" }),
      }
    );

    // 409 = contact already exists. Treat as success — same UX either way.
    if (upstream.ok || upstream.status === 409) {
      return Response.json({ success: true });
    }

    const data = (await upstream.json().catch(() => ({}))) as {
      message?: string;
    };
    console.error("subscribe: Loops non-2xx", upstream.status, data);
    return Response.json(
      { error: data.message ?? "Subscription failed" },
      { status: upstream.status }
    );
  } catch (err) {
    console.error("subscribe: Loops fetch failed", err);
    return Response.json({ error: "Upstream error" }, { status: 502 });
  }
}
