import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationMessages } from "@/db/schema";
import { GPT_4_1_MINI_MODEL } from "@/lib/ai/core";
import openai from "@/lib/ai/openai";
import { trackAIUsageEvent } from "@/lib/data/aiUsageEvents";
import { type Mailbox } from "@/lib/data/mailbox";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { ConversationSummary } from "@/types/summarization";

const SUMMARIZATION_SYSTEM_PROMPT = `You are an expert customer support analyst. Your task is to analyze a conversation between a customer and support agents and provide a structured, concise summary.

You MUST format your response with these EXACT section headers and follow this structure precisely:

## CORE ISSUE:
[The main problem or request reported by the customer - what they need help with]

## ACTIONS TAKEN:
[Key troubleshooting steps, solutions attempted, or responses provided by agents - what was already done]

## CUSTOMER SENTIMENT:
[Current emotional state of the customer - frustrated, satisfied, urgent, calm, etc.]

## STATUS & NEXT STEPS:
[What still needs to be resolved, pending actions, or what will happen next - focus ONLY on future actions and current status]

CRITICAL RULES:
- Use the EXACT headers above with ## and colons
- Keep each section separate and focused
- Do NOT repeat content between sections
- Status & Next Steps should ONLY contain unresolved issues and future actions
- Actions Taken should ONLY contain past actions already completed
- Provide COMPLETE information - do NOT truncate important details like URLs, file names, or instructions
- Each bullet point should be a complete, actionable sentence`;

const SUMMARIZATION_PROMPT = `Please analyze this customer support conversation and provide a structured summary using the exact format specified in your system prompt:

{conversation}

Focus on:
- Core Issue: What the customer needs help with
- Actions Taken: What agents have already done
- Customer Sentiment: How the customer is feeling  
- Status & Next Steps: What still needs to happen next (future actions only)

Use the exact section headers: ## CORE ISSUE:, ## ACTIONS TAKEN:, ## CUSTOMER SENTIMENT:, ## STATUS & NEXT STEPS:`;

export const generateConversationSummary = async (
  conversationId: number,
  mailbox: Mailbox,
): Promise<ConversationSummary> => {
  try {
    // Load conversation messages
    const messages = await db.query.conversationMessages.findMany({
      where: eq(conversationMessages.conversationId, conversationId),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    });

    if (messages.length === 0) {
      throw new Error("No messages found for conversation");
    }

    // Format messages for summarization
    const conversationText = messages
      .filter((msg) => msg.body && msg.body.trim().length > 0)
      .map((msg) => {
        const role =
          msg.role === "user"
            ? "Customer"
            : msg.role === "staff"
              ? "Agent"
              : msg.role === "ai_assistant"
                ? "AI Assistant"
                : "System";
        const timestamp = new Date(msg.createdAt).toLocaleString();
        return `[${timestamp}] ${role}: ${msg.cleanedUpText || msg.body}`;
      })
      .join("\n\n");

    if (conversationText.length === 0) {
      throw new Error("No valid message content found for summarization");
    }

    // Generate AI summary
    const { text: fullSummary, usage } = await generateText({
      model: openai(GPT_4_1_MINI_MODEL),
      system: SUMMARIZATION_SYSTEM_PROMPT,
      prompt: SUMMARIZATION_PROMPT.replace("{conversation}", conversationText),
      temperature: 0.1,
      maxTokens: 2000,
    });

    // Track AI usage
    await trackAIUsageEvent({
      mailbox,
      model: GPT_4_1_MINI_MODEL,
      queryType: "conversation_summary",
      usage: {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        cachedTokens: 0,
      },
    });

    // Parse structured summary (basic implementation)
    // In a more sophisticated version, you could use structured output or JSON mode
    const summary = parseAISummary(fullSummary);

    return {
      ...summary,
      fullSummary,
    };
  } catch (error) {
    captureExceptionAndLog(error);
    throw new Error(
      `Failed to generate conversation summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

const parseAISummary = (aiResponse: string): Omit<ConversationSummary, "fullSummary"> => {
  // New structured parsing for the ## header format
  const sections = extractStructuredSections(aiResponse);

  return {
    coreIssue: sections.coreIssue || "Issue details not clearly identified",
    actionsTaken: sections.actionsTaken || "No specific actions documented",
    customerSentiment: sections.customerSentiment || "Sentiment unclear",
    statusAndNextSteps: sections.statusAndNextSteps || "Status requires review",
  };
};

const extractStructuredSections = (
  text: string,
): {
  coreIssue: string;
  actionsTaken: string;
  customerSentiment: string;
  statusAndNextSteps: string;
} => {
  const lines = text.split("\n");
  const sections = {
    coreIssue: "",
    actionsTaken: "",
    customerSentiment: "",
    statusAndNextSteps: "",
  };

  let currentSection: keyof typeof sections | null = null;
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || "";

    // Check for section headers
    if (line.startsWith("## CORE ISSUE:")) {
      // Save previous section if any
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = cleanSectionContent(currentContent.join(" "));
      }
      currentSection = "coreIssue";
      currentContent = [];

      // Check if content is on the same line after the header
      const contentAfterHeader = line.substring("## CORE ISSUE:".length).trim();
      if (contentAfterHeader) {
        currentContent.push(contentAfterHeader);
      }
    } else if (line.startsWith("## ACTIONS TAKEN:")) {
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = cleanSectionContent(currentContent.join(" "));
      }
      currentSection = "actionsTaken";
      currentContent = [];

      const contentAfterHeader = line.substring("## ACTIONS TAKEN:".length).trim();
      if (contentAfterHeader) {
        currentContent.push(contentAfterHeader);
      }
    } else if (line.startsWith("## CUSTOMER SENTIMENT:")) {
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = cleanSectionContent(currentContent.join(" "));
      }
      currentSection = "customerSentiment";
      currentContent = [];

      const contentAfterHeader = line.substring("## CUSTOMER SENTIMENT:".length).trim();
      if (contentAfterHeader) {
        currentContent.push(contentAfterHeader);
      }
    } else if (line.startsWith("## STATUS & NEXT STEPS:")) {
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = cleanSectionContent(currentContent.join(" "));
      }
      currentSection = "statusAndNextSteps";
      currentContent = [];

      const contentAfterHeader = line.substring("## STATUS & NEXT STEPS:".length).trim();
      if (contentAfterHeader) {
        currentContent.push(contentAfterHeader);
      }
    } else if (currentSection && line.length > 0) {
      // Add content to current section, but ignore empty lines
      currentContent.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = cleanSectionContent(currentContent.join(" "));
  }

  return sections;
};

const cleanSectionContent = (content: string): string => {
  return content
    .replace(/\[|\]/g, "") // Remove template brackets like [The main problem...]
    .replace(/^\d+\.\s*/, "") // Remove leading numbers like "1. ", "2. "
    .replace(/^[-•*]\s*/, "") // Remove leading bullets
    .trim();
};
