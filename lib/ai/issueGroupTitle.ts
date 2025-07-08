import { generateCompletion, GPT_4O_MINI_MODEL } from "@/lib/ai/core";
import { captureExceptionAndLogIfDevelopment } from "@/lib/shared/sentry";

const TITLE_GENERATION_PROMPT = `You are generating a title for a group of SIMILAR, SPECIFIC issues that support agents will handle together.

CRITICAL: Create SPECIFIC, ACTIONABLE titles that describe the EXACT problem - not general categories.

The title should:
1. Describe the SPECIFIC problem that all conversations share
2. Be action-oriented and specific enough for bulk handling
3. Be 3-8 words long
4. Include specific symptoms, errors, or actions when relevant

Examples of GOOD specific titles:
- "Cannot receive 2FA SMS codes"
- "Password reset email not arriving"
- "Credit card declined error 402"
- "PDF downloads failing in Chrome"
- "Subscription auto-renewal failing silently"
- "Video stops playing after 30 seconds"
- "Cannot access account after migration"
- "Refund not appearing after 7 days"

Examples of BAD generic titles:
- "Login Issues" (too broad)
- "Payment Problems" (too vague)
- "Account Access" (not specific)
- "Technical Difficulties" (meaningless)
- "Customer Support Request" (too generic)
- "Billing and Account Issues" (combines multiple problems)

The summary will contain a "Problem:" line - use this as the basis for your title, making it slightly more descriptive if needed.

Return ONLY the title, nothing else.`;

export const generateIssueGroupTitle = async (embeddingText: string, subject?: string): Promise<string> => {
  try {
    // First, try to use the structured embedding text to generate a categorical title
    if (embeddingText) {
      const { text } = await generateCompletion({
        system: TITLE_GENERATION_PROMPT,
        prompt: `Structured summary:\n${embeddingText}\n\nOriginal subject: ${subject || "N/A"}`,
        functionId: "generate-issue-group-title",
        model: GPT_4O_MINI_MODEL,
      });

      // Clean up the generated title
      const cleanTitle = text.trim().replace(/^["']|["']$/g, ""); // Remove quotes
      if (cleanTitle.length > 0 && cleanTitle.length <= 100) {
        return cleanTitle;
      }
    }

    // Fallback to cleaned subject if AI generation fails
    if (subject) {
      return cleanSubjectForTitle(subject);
    }

    // Final fallback
    return "Support Issues";
  } catch (error) {
    captureExceptionAndLogIfDevelopment(error);

    // Fallback to cleaned subject
    if (subject) {
      return cleanSubjectForTitle(subject);
    }

    return "Support Issues";
  }
};

/**
 * Cleans up email subjects to make them more suitable as issue group titles
 */
const cleanSubjectForTitle = (subject: string): string => {
  return subject
    .replace(/^(Re:|RE:|Fwd:|FWD:)\s*/i, "") // Remove email prefixes
    .replace(/\s*-\s*(urgent|asap|help|please)/i, "") // Remove urgency indicators
    .replace(/\s*\(.*?\)\s*/, "") // Remove parenthetical content
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
    .substring(0, 100); // Ensure it fits in database
};

/**
 * Generates a title for multiple conversations in an issue group
 * This could be used when we want to regenerate titles for existing groups
 */
export const generateTitleForMultipleConversations = async (
  conversations: { subject?: string; embeddingText?: string }[],
): Promise<string> => {
  try {
    // Combine all embedding texts and subjects
    const allContent = conversations
      .map((conv) => {
        const parts = [];
        if (conv.subject) parts.push(`Subject: ${conv.subject}`);
        if (conv.embeddingText) parts.push(`Summary: ${conv.embeddingText}`);
        return parts.join("\n");
      })
      .join("\n---\n");

    const { text } = await generateCompletion({
      system: `${
        TITLE_GENERATION_PROMPT
      }\n\nYou are analyzing ${conversations.length} similar conversations. Create a title that captures what they all have in common.`,
      prompt: `Multiple conversation data:\n${allContent}`,
      functionId: "generate-group-title-multiple",
      model: GPT_4O_MINI_MODEL,
    });

    const cleanTitle = text.trim().replace(/^["']|["']$/g, "");
    if (cleanTitle.length > 0 && cleanTitle.length <= 100) {
      return cleanTitle;
    }

    return "Support Issues";
  } catch (error) {
    captureExceptionAndLogIfDevelopment(error);
    return "Support Issues";
  }
};
