import { getStore } from "@netlify/blobs";
import { stripe } from "../lib/util.mjs";
// Runs on the 1st of each month (UTC). Adds last month's extra questions (A$0.50 each, within the user's cap)
// to the customer's next Stripe invoice.
export default async () => {
  const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 1);
  const m = d.toISOString().slice(0, 7), st = getStore("accounts"), { blobs } = await st.list();
  for (const { key } of blobs) {
    const a = await st.get(key, { type: "json" });
    const n = (a && a.usage && a.usage[m]) || 0;
    if (n <= 30 || !a.customer || (a.billed && a.billed[m])) continue;
    const amt = Math.min((n - 30) * 50, (a.cap || 0) * 100);
    if (amt <= 0) continue;
    await stripe("invoiceitems", { customer: a.customer, currency: "aud", amount: String(amt), description: `Extra follow-up questions, ${m}: ${amt / 50} x A$0.50` });
    a.billed = { ...a.billed, [m]: amt };
    await st.setJSON(key, a);
  }
};
export const config = { schedule: "0 1 1 * *" };
