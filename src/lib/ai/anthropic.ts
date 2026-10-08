import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  buyerChatSystem,
  CAPTION_SYSTEM,
  captionPrompt,
  LEAD_ANALYSIS_SYSTEM,
  LISTING_COPY_SYSTEM,
  listingCopyPrompt,
  SAVE_CONTACT_TOOL_DESCRIPTION,
} from "./prompts";
import {
  AiError,
  LeadAnalysisSchema,
  ListingCopySchema,
  type AiProvider,
  type BuyerContact,
  type ChatTurn,
  type ListingFacts,
} from "./types";

// Default model per Anthropic's guidance; set AI_MODEL to use another one.
const MODEL = process.env.AI_MODEL || "claude-opus-5-5";

// Server-side refusal fallback ("default" routes by refusal category) and the
// effort control are only accepted by these models.
const SUPPORTS_FALLBACK = ["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"].includes(MODEL);
const SUPPORTS_EFFORT = !MODEL.startsWith("claude-haiku");

// Copywriting and chat are routine tasks: low effort keeps them fast and cheap.
function base() {
  return {
    model: MODEL,
    max_tokens: 16000,
    ...(SUPPORTS_FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };
}
const effort = (level: "low" | "medium") => (SUPPORTS_EFFORT ? { effort: level } : {});

function client() {
  return new Anthropic({ timeout: 60_000, maxRetries: 2 });
}

function assertNotRefused(res: { stop_reason: string | null }) {
  if (res.stop_reason === "refusal") throw new AiError("The AI couldn't help with this request. Try rephrasing it.");
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

const SAVE_CONTACT_TOOL: Anthropic.Beta.BetaTool = {
  name: "save_buyer_contact",
  description: SAVE_CONTACT_TOOL_DESCRIPTION,
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Buyer's name as they gave it" },
      phone: { type: "string", description: "Mobile number, or empty string if not given" },
      email: { type: "string", description: "Email, or empty string if not given" },
      interest_summary: {
        type: "string",
        description: "One or two sentences: what the buyer wants (viewing date, budget, questions)",
      },
    },
    required: ["name", "phone", "email", "interest_summary"],
    additionalProperties: false,
  },
};

export const anthropicProvider: AiProvider = {
  name: "anthropic",

  async listingCopy(facts, language) {
    const res = await client().beta.messages.parse({
      ...base(),
      system: LISTING_COPY_SYSTEM,
      messages: [{ role: "user", content: listingCopyPrompt(facts, language) }],
      output_config: { ...effort("low"), format: betaZodOutputFormat(ListingCopySchema) },
    });
    assertNotRefused(res);
    if (!res.parsed_output) throw new AiError("The AI response was incomplete. Please try again.");
    return res.parsed_output;
  },

  async facebookCaption(facts, link, language) {
    const res = await client().beta.messages.create({
      ...base(),
      system: CAPTION_SYSTEM,
      messages: [{ role: "user", content: captionPrompt(facts, link, language) }],
      output_config: effort("low"),
    });
    assertNotRefused(res);
    const text = textOf(res.content);
    if (!text) throw new AiError("The AI response was empty. Please try again.");
    // The link must survive verbatim; add it if the model dropped it.
    return text.includes(link) ? text : `${text}\n\n${link}`;
  },

  async analyzeLead({ lead, activity }) {
    const res = await client().beta.messages.parse({
      ...base(),
      system: LEAD_ANALYSIS_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Lead:\n${lead}\n\nActivity (newest first):\n${activity.length ? activity.join("\n") : "(none)"}`,
        },
      ],
      output_config: { ...effort("medium"), format: betaZodOutputFormat(LeadAnalysisSchema) },
    });
    assertNotRefused(res);
    if (!res.parsed_output) throw new AiError("The AI response was incomplete. Please try again.");
    return res.parsed_output;
  },

  async buyerChat(facts: ListingFacts, history: ChatTurn[], saveContact: (c: BuyerContact) => Promise<string>) {
    const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
    let contact: BuyerContact | null = null;

    // At most one tool round: reply, or save contact then reply.
    for (let round = 0; round < 3; round++) {
      const res = await client().beta.messages.create({
        ...base(),
        max_tokens: 2000,
        system: buyerChatSystem(facts),
        tools: [SAVE_CONTACT_TOOL],
        messages,
        output_config: effort("low"),
      });
      if (res.stop_reason === "refusal") {
        return { reply: "Sorry, I can't help with that. You can leave your details below and the agent will contact you.", contact };
      }
      const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || !toolUses.length) {
        return { reply: textOf(res.content) || "The agent will get back to you soon.", contact };
      }

      // Append the assistant turn unchanged, then every tool result in one user message.
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const input = use.input as Partial<BuyerContact>;
        const valid =
          use.name === "save_buyer_contact" &&
          typeof input.name === "string" &&
          typeof input.phone === "string" &&
          typeof input.email === "string" &&
          typeof input.interest_summary === "string";
        if (!valid || contact) {
          results.push({ type: "tool_result", tool_use_id: use.id, content: contact ? "Already saved." : "Invalid input.", is_error: !contact });
          continue;
        }
        try {
          const c = input as BuyerContact;
          const note = await saveContact(c);
          contact = c;
          results.push({ type: "tool_result", tool_use_id: use.id, content: note });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: use.id, content: (e as Error).message, is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    return { reply: "Thanks! The agent will get back to you soon.", contact };
  },
};
