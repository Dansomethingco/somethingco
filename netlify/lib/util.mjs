export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
export const wrap = (h) => async (req) => { try { return await h(req); } catch (e) { console.error(e); return json({ error: "Server error: " + (e.message || "unknown") }, 500); } };
export const ym = () => new Date().toISOString().slice(0, 7);
export const monthly = (fu, ed) => (fu && ed ? 2500 : fu ? 2000 : ed ? 1000 : 0); // cents, AUD
export async function stripe(path, params, method) {
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method: method || (params ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || "Stripe error");
  return d;
}
export const items = (list) => {
  const p = {};
  list.forEach((it, i) => {
    const k = `line_items[${i}]`;
    p[k + "[quantity]"] = "1";
    p[k + "[price_data][currency]"] = "aud";
    p[k + "[price_data][unit_amount]"] = String(it.amount);
    p[k + "[price_data][product_data][name]"] = it.name;
    if (it.rec) p[k + "[price_data][recurring][interval]"] = "month";
  });
  return p;
};
export async function claude(system, user, max = 1500) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: max, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("AI request failed");
  const d = await r.json();
  return d.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}
