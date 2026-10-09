import { getStore } from "@netlify/blobs";
import { json, wrap, stripe } from "../lib/util.mjs";
import { sessionEmail, clearCookie } from "../lib/auth.mjs";
const out = () => new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", "Set-Cookie": clearCookie } });
export default wrap(async (req) => {
  const e = sessionEmail(req);
  if (!e) return json({ error: "Not signed in." }, 401);
  const users = getStore("users"), accs = getStore("accounts"), u = (await users.get(e, { type: "json" })) || { plans: [] };
  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (b.action === "logout") return out();
    if (b.action === "delete") {
      for (const t of u.plans) {
        const a = await accs.get(t, { type: "json" });
        if (!a) continue;
        if (a.sub && !a.free) { try { await stripe("subscriptions/" + a.sub, null, "DELETE"); } catch (x) { console.error(x); } }
        if (a.ideaId) await getStore("ideas").delete(a.ideaId);
        await accs.delete(t);
      }
      await users.delete(e); await getStore("newsletter").delete(e);
      return out();
    }
  }
  const plans = [];
  for (const t of u.plans) {
    const a = await accs.get(t, { type: "json" });
    if (!a) continue;
    const ss = a.plan.phases.flatMap((p) => p.steps);
    plans.push({ token: t, title: a.plan.title, done: ss.filter((s) => a.state[s.id] === "done").length, total: ss.length });
  }
  return json({ email: e, plans });
});
