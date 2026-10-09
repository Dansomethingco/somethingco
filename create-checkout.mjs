import { getStore } from "@netlify/blobs";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { json, wrap, stripe, items, monthly } from "../lib/util.mjs";

export default wrap(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const b = await req.json().catch(() => ({}));
  const cl = (v, n) => String(v || "").trim().slice(0, n);
  const i = b.idea || {}, c = b.contact || {};
  const idea = { name: cl(i.name, 120), idea: cl(i.idea, 2000), stage: cl(i.stage, 40), stuck: cl(i.stuck, 500) };
  if (idea.idea.length < 30) return json({ error: "Please describe your idea in at least a couple of sentences." }, 400);
  const contact = { name: cl(c.name, 100), email: cl(c.email, 200), phone: cl(c.phone, 40), biz: cl(c.biz, 120) };
  if (!contact.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) return json({ error: "Please enter your name and a valid email." }, 400);

  const dash = b.type === "dash";
  const fu = dash && ["some", "lots"].includes(b.fu), edit = dash && b.edit === "yes";
  const cap = [0, 10, 25].includes(+b.cap) ? +b.cap : 10;
  const id = randomUUID();
  await getStore("ideas").setJSON(id, { idea, contact, type: dash ? "dash" : "pdf", fu, edit, cap });
  if (b.news) await getStore("newsletter").setJSON(contact.email.toLowerCase(), { name: contact.name, at: new Date().toISOString() });

  const site = process.env.URL || new URL(req.url).origin;
  const promo = cl(b.promo, 40);
  if (promo) {
    const exp = Buffer.from((process.env.PROMO_BYPASS_CODE || "").toLowerCase()), giv = Buffer.from(promo.toLowerCase());
    if (!(exp.length > 0 && exp.length === giv.length && timingSafeEqual(exp, giv))) return json({ error: "That promo code is not valid." }, 400);
    await getStore("free").set(id, "1");
    return json({ url: `${site}/plan.html?free=${id}` });
  }

  const mo = dash ? monthly(fu, edit) : 0;
  const list = dash ? [{ name: "something.co dashboard access (one-off)", amount: 2000 }] : [{ name: "Startup idea plan (PDF)", amount: 500 }];
  if (mo) list.push({ name: fu && edit ? "Premium plan" : fu ? "Follow-up questions (30 a month)" : "Step editing", amount: mo, rec: 1 });
  const p = {
    mode: mo ? "subscription" : "payment", ...items(list),
    client_reference_id: id, customer_email: contact.email,
    billing_address_collection: "required", "tax_id_collection[enabled]": "true",
    success_url: `${site}/plan.html?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${site}/plan.html?cancelled=1`,
  };
  if (!mo) p["invoice_creation[enabled]"] = "true";
  const s = await stripe("checkout/sessions", p);
  return json({ url: s.url });
});
