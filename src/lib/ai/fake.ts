import type { AiProvider, BuyerContact, ChatTurn, ListingFacts } from "./types";

/**
 * Deterministic stand-in used by tests and local development without an API
 * key (AI_PROVIDER=fake). It follows the same contract as the real provider.
 */
export const fakeProvider: AiProvider = {
  name: "fake",

  async listingCopy(f, language) {
    const where = f.location ? ` in ${f.location}` : "";
    const kind = f.propertyType || "Property";
    return {
      title: `${kind}${where}${f.listingType === "rent" ? " for rent" : " for sale"}`.slice(0, 90),
      description: [
        language === "English" ? `Welcome to this ${kind.toLowerCase()}${where}.` : `Ibinebenta/Paupahan: ${kind}${where}.`,
        "",
        f.price && `• Price: ${f.price}`,
        f.specs && `• ${f.specs}`,
        f.description && `• ${f.description.split("\n")[0]}`,
        "",
        "Send an inquiry to schedule a viewing.",
      ]
        .filter((l): l is string => typeof l === "string")
        .join("\n"),
    };
  },

  async facebookCaption(f: ListingFacts, link: string) {
    return `${f.listingType === "rent" ? "FOR RENT" : "FOR SALE"}: ${f.title}\n💰 ${f.price}\n📍 ${f.location}\n\nMessage us here 👉 ${link}\n#RealEstatePH #${f.listingType === "rent" ? "ForRent" : "ForSale"}`;
  },

  async analyzeLead({ lead, activity }) {
    const text = `${lead}\n${activity.join("\n")}`.toLowerCase();
    const hot = /viewing|reserve|negotiat/.test(text);
    return {
      summary: "Buyer inquired about the listing and shared contact details.",
      temperature: hot ? "hot" : "warm",
      suggested_status: hot ? "viewing" : "contacted",
      next_step: hot ? "Confirm the site viewing schedule by text." : "Call the buyer to ask about budget and timing.",
    };
  },

  async buyerChat(f: ListingFacts, history: ChatTurn[], saveContact: (c: BuyerContact) => Promise<string>) {
    const last = history.at(-1)?.content ?? "";
    const phone = last.match(/(\+?\d[\d\s-]{6,}\d)/)?.[1];
    const name = last.match(/(?:name is|ako si|i'm|i am)\s+([A-Za-z][A-Za-z ]{1,40}?)(?=[,.]|\s+(?:and|my|number|phone)|$)/i)?.[1];
    if (phone && name) {
      await saveContact({ name: name.trim(), phone: phone.trim(), email: "", interest_summary: `Interested in ${f.title}. Asked: ${history[0]?.content ?? ""}`.slice(0, 300) });
      return { reply: `Thanks, ${name.trim()}! ${f.agentName || "The agent"} will contact you soon.`, contact: { name, phone, email: "", interest_summary: "" } };
    }
    if (/price|how much|magkano/i.test(last)) return { reply: `The price is ${f.price}. Would you like to schedule a viewing?`, contact: null };
    if (/view|visit|tingnan/i.test(last)) return { reply: "I'd be happy to arrange that. May I have your name and mobile number?", contact: null };
    return { reply: `Thanks for your interest in ${f.title}! The agent will confirm any details not in the listing.`, contact: null };
  },
};
