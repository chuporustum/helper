import { generateCompletion, GPT_4O_MINI_MODEL } from "@/lib/ai/core";
import { captureExceptionAndLogIfDevelopment } from "@/lib/shared/sentry";

const TITLE_GENERATION_PROMPT = `You are tasked with generating a concise, categorical title for a group of similar support conversations. 

Given the structured summary below, create a title that:
1. Describes the general category/type of issue (not specific details)
2. Is 2-6 words long
3. Uses clear, user-friendly language
4. Represents what multiple similar conversations would be about
5. Avoids technical jargon when possible

Examples of good titles:
- "Login & Authentication Issues"
- "Payment Processing Problems" 
- "File Download Issues"
- "Account Access Problems"
- "Subscription & Billing Questions"
- "Video Playback Issues"
- "API & Integration Help"

Examples of bad titles:
- "Re: Can't login to my account" (too specific)
- "Customer experiencing difficulties" (too vague)
- "Technical support request" (too generic)
- "User reported bug in system functionality" (too technical)

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
