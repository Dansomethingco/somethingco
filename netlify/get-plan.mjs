import { getStore } from "@netlify/blobs";
import { generatePlan } from "../lib/generate.mjs";

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const FAIL = { error: "Plan generation failed. Refresh to try again." };

const handler = async (req) => {
  const q = new URL(req.url).searchParams;
  const sid = q.get("session_id");
  const free = q.get("free");
  const plans = getStore("plans");
  let key, ideaId;

  if (free) {
    // Promo-code route: only valid if create-checkout marked this id as approved
    if (!/^[0-9a-f-]{36}$/.test(free)) return json({ error: "Invalid link." }, 400);
    if (!(await getStore("free").get(free))) return json({ error: "Invalid link." }, 403);
    key = "free_" + free;
    ideaId = free;
  } else {
    if (!sid || !/^cs_[A-Za-z0-9_]+$/.test(sid)) return json({ error: "Invalid session." }, 400);
    key = sid;
  }

  const cached = await plans.get(key, { type: "json" });
  if (cached) return json(cached);

  if (!free) {
    const sr = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    const session = await sr.json();
    if (!sr.ok) return json({ error: "Could not verify payment." }, 400);
    if (session.payment_status !== "paid") return json({ error: "Payment has not been completed." }, 402);
    ideaId = session.client_reference_id;
  }

  const idea = await getStore("ideas").get(ideaId);
  if (!idea) return json({ error: "Idea not found." }, 404);

  const plan = await generatePlan(idea);
  if (!plan) return json(FAIL, 502);
  await plans.setJSON(key, plan);
  return json(plan);
};

export default async (req) => {
  try {
    return await handler(req);
  } catch (e) {
    console.error(e);
    return json({ error: "Server error: " + (e && e.message ? e.message : "unknown") }, 500);
  }
};
