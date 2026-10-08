// Triggers the subscription maintenance job against the local dev server.
const secret = process.env.CRON_SECRET ?? "change-me";
const res = await fetch("http://localhost:3000/api/cron/subscriptions", {
  headers: { authorization: `Bearer ${secret}` },
});
console.log(res.status, await res.text());
