// Contact links for public listing and agent pages. Plain links, no Meta or
// Viber API: they open the buyer's own app.

export type ContactChannel = "call" | "messenger" | "viber";

/**
 * Accepts what agents paste ("ana.reyes", "m.me/ana.reyes",
 * "https://www.facebook.com/ana.reyes", "facebook.com/profile.php?id=1000…")
 * and returns the bare username or ID, "" for blank, or null if unusable.
 */
export function parseMessenger(input: string): string | null {
  const v = input.trim();
  if (!v) return "";
  const id = v.match(/profile\.php\?id=(\d{5,20})/) ?? v.match(/facebook\.com\/people\/[^/]+\/(\d{5,20})/i);
  if (id) return id[1];
  const bare = v.replace(/^https?:\/\//i, "");
  const host = /^(www\.|m\.|web\.)?(facebook\.com|fb\.com|m\.me|messenger\.com\/t)\//i;
  // A link to anywhere other than Facebook/Messenger is not a username.
  if (bare.includes("/") && !host.test(bare)) return null;
  const name = bare
    .replace(host, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "");
  // Facebook pages that aren't a person (share links, groups, posts) can't open a chat.
  if (NOT_A_PROFILE.has(name.toLowerCase())) return null;
  return /^[A-Za-z0-9.]{3,50}$/.test(name) ? name : null;
}

const NOT_A_PROFILE = new Set([
  "share", "people", "groups", "pages", "watch", "marketplace", "reel", "reels", "photo", "photo.php",
  "story.php", "permalink.php", "profile.php", "events", "login", "home.php",
]);

/** Facebook "share" links (facebook.com/share/…) hide the profile, so they can't be turned into a Messenger link. */
export function isFacebookShareLink(input: string): boolean {
  return /facebook\.com\/share\//i.test(input);
}

export function messengerUrl(username: string): string {
  return `https://m.me/${encodeURIComponent(username)}`;
}

/** "0917 555 0142" / "+63 917 555 0142" / "639175550142" -> "+639175550142". Null if not a PH mobile. */
export function toPhilippineE164(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (/^09\d{9}$/.test(d)) return `+63${d.slice(1)}`;
  if (/^639\d{9}$/.test(d)) return `+${d}`;
  if (/^9\d{9}$/.test(d)) return `+63${d}`;
  return null;
}

export function viberUrl(phone: string): string | null {
  const e164 = toPhilippineE164(phone);
  return e164 ? `viber://chat?number=${encodeURIComponent(e164)}` : null;
}

export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
