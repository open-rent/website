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

  const loopsUrl = process.env.LOOPS_FORM_URL;
  if (!loopsUrl) {
    console.error("subscribe: LOOPS_FORM_URL is not set");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const formBody = `userGroup=&mailingLists=&email=${encodeURIComponent(email)}`;

    const upstream = await fetch(loopsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });

    if (!upstream.ok) {
      const data = (await upstream.json().catch(() => ({}))) as {
        message?: string;
      };
      console.error("subscribe: Loops non-2xx", upstream.status, data);
      return Response.json(
        { error: data.message ?? "Subscription failed" },
        { status: upstream.status }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("subscribe: Loops fetch failed", err);
    return Response.json({ error: "Upstream error" }, { status: 502 });
  }
}
