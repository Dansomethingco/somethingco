import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import nodemailer from "nodemailer";

const SECRET = () => process.env.SESSION_SECRET || "";
const sig = (p) => createHmac("sha256", SECRET()).update(p).digest("base64url");
const FLAGS = "HttpOnly; Secure; SameSite=Lax; Path=/";
export const cookie = (email) => {
  const p = Buffer.from(JSON.stringify({ e: email, x: Date.now() + 30 * 864e5 })).toString("base64url");
  return `sc_session=${p}.${sig(p)}; ${FLAGS}; Max-Age=${30 * 86400}`;
};
export const clearCookie = `sc_session=; ${FLAGS}; Max-Age=0`;
export function sessionEmail(req) {
  if (!SECRET()) return null;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)sc_session=([^;]+)/);
  if (!m) return null;
  const [p, s] = m[1].split(".");
  if (!p || !s) return null;
  const a = Buffer.from(sig(p)), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const d = JSON.parse(Buffer.from(p, "base64url").toString()); return d.x > Date.now() ? d.e : null; } catch { return null; }
}
export const mail = (to, subject, text) => {
  const user = process.env.GMAIL_USER || "dan.somethingco@gmail.com";
  return nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass: process.env.GMAIL_APP_PASSWORD } })
    .sendMail({ from: `something.co <${user}>`, to, subject, text });
};
export async function sendLogin(email, site, intro = "") {
  if (!SECRET()) throw new Error("SESSION_SECRET is not set");
  const tok = randomBytes(24).toString("hex");
  await getStore("logins").setJSON(tok, { email, exp: Date.now() + 15 * 60000 });
  await mail(email, "Your something.co sign-in link",
    `${intro}Click to sign in (valid for 15 minutes):\n\n${site}/.netlify/functions/verify?t=${tok}\n\nIf you did not ask for this, you can ignore this email.\n\nDan, something.co`);
}
