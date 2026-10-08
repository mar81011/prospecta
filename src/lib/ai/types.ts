import { z } from "zod";

export const LANGUAGES = ["English", "Taglish", "Tagalog"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Plain listing facts given to the model. Never includes agent-private data. */
export type ListingFacts = {
  title: string;
  listingType: "sale" | "rent";
  propertyType: string;
  price: string;
  location: string;
  specs: string;
  description: string;
  agentName: string;
};

export const ListingCopySchema = z.object({
  title: z.string().describe("Catchy listing title, max 90 characters, no emojis"),
  description: z
    .string()
    .describe("Listing description, 80-180 words, short paragraphs and a few bullet points, no made-up facts"),
});
export type ListingCopy = z.infer<typeof ListingCopySchema>;

export const LeadAnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence summary of who the buyer is and what they want"),
  temperature: z.enum(["hot", "warm", "cold"]),
  suggested_status: z.enum(["new", "contacted", "qualified", "viewing", "negotiating", "won", "lost"]),
  next_step: z.string().describe("One concrete next action for the agent, max 25 words"),
});
export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type BuyerContact = {
  name: string;
  phone: string;
  email: string;
  interest_summary: string;
};

export type ChatReply = { reply: string; contact: BuyerContact | null };

export interface AiProvider {
  readonly name: string;
  listingCopy(facts: Partial<ListingFacts>, language: Language): Promise<ListingCopy>;
  facebookCaption(facts: ListingFacts, link: string, language: Language): Promise<string>;
  analyzeLead(input: { lead: string; activity: string[] }): Promise<LeadAnalysis>;
  /**
   * One buyer-chat turn. `saveContact` is called (at most once) when the buyer
   * shares contact details; it returns a short confirmation for the model.
   */
  buyerChat(facts: ListingFacts, history: ChatTurn[], saveContact: (c: BuyerContact) => Promise<string>): Promise<ChatReply>;
}

/** Thrown for problems the user should see (refusal, misconfiguration). */
export class AiError extends Error {}
