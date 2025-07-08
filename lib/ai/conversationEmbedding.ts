import { eq } from "drizzle-orm";
import { encode } from "gpt-tokenizer/model/gpt-4o";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { db } from "@/db/client";
import { conversationMessages } from "@/db/schema";
import { conversations } from "@/db/schema/conversations";
import { generateCompletion, generateEmbedding } from "@/lib/ai";
import { cleanUpTextForAI, GPT_4O_MINI_MODEL } from "@/lib/ai/core";

const SYSTEM_PROMPT = `You will be given a support conversation between a customer and a support agent. Your task is to extract the SPECIFIC problem and create a summary for clustering similar issues.

CRITICAL: Focus on the EXACT, SPECIFIC problem - not general categories.

Good examples of specific problems:
- "Cannot receive 2FA SMS code"
- "Credit card declined with error 402"
- "Video playback freezes after 30 seconds"
- "Cannot download PDF receipts"
- "Subscription renewal failed silently"

Bad examples (too general):
- "Login issues"
- "Payment problems"
- "Technical difficulties"
- "Account access"

Follow these steps:

1. Identify the SPECIFIC problem or error the customer reported
2. Extract any error messages, codes, or specific symptoms
3. Note the exact action the user was trying to perform
4. Capture the specific resolution or workaround provided
5. Remove PII but keep technical details and error specifics

Your response should include:
1. Problem: The EXACT issue in 5-10 words (e.g., "Cannot receive password reset email")
2. Details: Specific symptoms, error codes, or technical details
3. Solution: The specific fix or workaround provided
4. Action: What needs to be done to resolve this

Format your response as:
Problem: [Specific issue in 5-10 words]
Details: [Technical details and symptoms]
Solution: [Specific resolution]
Action: [Required action to fix]`;

const GPT_4O_MINI_CONTEXT_WINDOW_MAX_TOKENS = 128000;

export class PromptTooLongError extends Error {
  constructor(conversationId: number) {
    super(`Prompt for conversation ${conversationId} is too long`);
  }
}

export const createConversationEmbedding = async (conversationId: number) => {
  const messages = await db.query.conversationMessages.findMany({
    where: eq(conversationMessages.conversationId, conversationId),
  });

  const messagesFormatted: string[] = messages.map((m) => {
    const role = m.role === "user" ? "Customer" : "Agent";
    return `${role}: ${cleanUpTextForAI(m.cleanedUpText ?? m.body ?? "")}`;
  });

  const prompt = `Conversation:\n${messagesFormatted.join("\n")}`;
  const tokenCount = encode(SYSTEM_PROMPT + prompt).length;
  if (tokenCount > GPT_4O_MINI_CONTEXT_WINDOW_MAX_TOKENS - 100) {
    throw new PromptTooLongError(conversationId);
  }
  const { text } = await generateCompletion({
    system: SYSTEM_PROMPT,
    prompt,
    functionId: "summary-embedding-conversation",
    model: GPT_4O_MINI_MODEL,
  });
  const embedding = await generateEmbedding(text, "embedding-conversation", { skipCache: true });

  return await db
    .update(conversations)
    .set({
      embedding,
      embeddingText: text,
    })
    .where(eq(conversations.id, conversationId))
    .returning()
    .then(takeUniqueOrThrow);
};
