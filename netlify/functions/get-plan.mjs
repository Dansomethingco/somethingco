import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { json, wrap, stripe } from "../lib/util.mjs";
import { generatePlan } from "../lib/generate.mjs";
import { sendLogin } from "../lib/auth.mjs";

export default wrap(async (req) => {
  const q = new URL(req.url).searchParams, sid = q.get("session_id"), free = q.get("free"), plans = getStore("plans");
  let key, id, sess = {};
  if (free) {
    if (!/^[0-9a-f-]{36}$/.test(free)) return json({ error: "Invalid link." }, 400);
    if (!(await getStore("free").get(free))) return json({ error: "Invalid link." }, 403);
    key = "free_" + free; id = free;
  } else {
    if (!sid || !/^cs_[A-Za-z0-9_]+$/.test(sid)) return json({ error: "Invalid session." }, 400);
    key = sid;
  }
  const cached = await plans.get(key, { type: "json" });
  if (cached) return json(cached);
  if (!free) {
    try { sess = await stripe("checkout/sessions/" + sid); } catch { return json({ error: "Could not verify payment." }, 400); }
    if (sess.payment_status !== "paid") return json({ error: "Payment has not been completed." }, 402);
    id = sess.client_reference_id;
  }
  const o = await getStore("ideas").get(id, { type: "json" });
  if (!o) return json({ error: "Idea not found." }, 404);
  const plan = await generatePlan(o.idea);
  if (!plan) return json({ error: "Plan generation failed. Refresh to try again." }, 502);
  let out = { plan };
  if (o.type === "dash") {
    const token = randomUUID();
    await getStore("accounts").setJSON(token, {
      token, ideaId: id, email: o.contact.email, name: o.contact.name, idea: `${o.idea.name}: ${o.idea.idea}`.slice(0, 2300), plan,
      fu: o.fu, edit: o.edit, cap: o.cap, free: !!free, sub: sess.subscription || null, customer: sess.customer || null,
      state: {}, notes: {}, details: {}, chats: {}, usage: {}, billed: {},
    });
    const em = o.contact.email.toLowerCase(), users = getStore("users"), u = (await users.get(em, { type: "json" })) || { plans: [] };
    u.plans.push(token); await users.setJSON(em, u);
    try { await sendLogin(em, process.env.URL || new URL(req.url).origin, "Your plan is ready. "); } catch (e) { console.error(e); }
    out = { token };
  }
  await plans.setJSON(key, out);
  return json(out);
});
