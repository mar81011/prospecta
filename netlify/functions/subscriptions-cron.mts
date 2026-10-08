// Netlify Scheduled Function: calls the daily subscription maintenance route
// (src/app/api/cron/subscriptions) with `Authorization: Bearer $CRON_SECRET`.
// Same schedule as vercel.json: 16:00 UTC = midnight Manila time.

export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/subscriptions`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  if (!res.ok) {
    console.error("subscription maintenance failed", res.status, await res.text());
  }
};

export const config = { schedule: "0 16 * * *" };
