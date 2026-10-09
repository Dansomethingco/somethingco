import { getStore } from "@netlify/blobs";
import { wrap } from "../lib/util.mjs";
import { cookie } from "../lib/auth.mjs";
const go = (loc, c) => new Response(null, { status: 302, headers: c ? { Location: loc, "Set-Cookie": c } : { Location: loc } });
export default wrap(async (req) => {
  const t = new URL(req.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{48}$/.test(t)) return go("/login.html?expired=1");
  const st = getStore("logins"), r = await st.get(t, { type: "json" });
  if (!r || r.exp < Date.now()) return go("/login.html?expired=1");
  await st.delete(t); // single use
  return go("/account.html", cookie(r.email));
});
