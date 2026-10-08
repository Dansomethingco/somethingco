import { getStore } from "@netlify/blobs";
import { randomUUID, timingSafeEqual } from "node:crypto";

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

const handler = async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let idea = "";
  let promo = "";
  try { ({ idea, promo } = await req.json()); } catch {}
  idea = String(idea || "").trim();
  promo = String(promo || "").trim();
  if (idea.length < 30 || idea.length > 2000)
    return json({ error: "Please describe your idea in 30 to 2000 characters." }, 400);

  const id = randomUUID();
  await getStore("ideas").set(id, idea);

  const site = process.env.URL || new URL(req.url).origin;

  // Promo code bypass (testing): code is set in the PROMO_BYPASS_CODE environment variable
  if (promo) {
    const expected = Buffer.from((process.env.PROMO_BYPASS_CODE || "").toLowerCase());
    const given = Buffer.from(promo.toLowerCase());
    const ok = expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
    if (!ok) return json({ error: "That promo code is not valid." }, 400);
    await getStore("free").set(id, "1");
    return json({ url: `${site}/plan.html?free=${id}` });
  }

  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "aud",
    "line_items[0][price_data][unit_amount]": "2000",
    "line_items[0][price_data][product_data][name]": "Startup idea assessment and MVP plan (PDF)",
    "line_items[0][quantity]": "1",
    client_reference_id: id,
    success_url: `${site}/plan.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/plan.html?cancelled=1`,
  });
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const s = await r.json();
  if (!r.ok) return json({ error: "Could not start payment. Please try again." }, 500);
  return json({ url: s.url });
};

export default async (req) => {
  try {
    return await handler(req);
  } catch (e) {
    console.error(e);
    return json({ error: "Server error: " + (e && e.message ? e.message : "unknown") }, 500);
  }
};
