import { getStore } from "@netlify/blobs";
import { json, wrap } from "../lib/util.mjs";
import { sendLogin } from "../lib/auth.mjs";
export default wrap(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { email } = await req.json().catch(() => ({}));
  const e = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || e.length > 200) return json({ error: "Please enter a valid email." }, 400);
  const lg = getStore("logins"), last = await lg.get("rl_" + e);
  if (last && Date.now() - +last < 60000) return json({ ok: true });
  await lg.set("rl_" + e, String(Date.now()));
  if (await getStore("users").get(e, { type: "json" })) await sendLogin(e, process.env.URL || new URL(req.url).origin);
  return json({ ok: true }); // same reply whether or not the email has an account
});
