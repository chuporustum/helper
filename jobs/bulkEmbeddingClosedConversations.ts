import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema/conversations";
import { triggerEvent } from "@/jobs/trigger";
import { env } from "@/lib/env";

const BATCH_SIZE = parseInt(env.CLOSED_CONVERSATIONS_BATCH_SIZE, 10);

export const bulkEmbeddingClosedConversations = async () => {
  // eslint-disable-next-line no-console
  console.log("Starting bulk embedding for conversations without embeddings...");

  let processed = 0;
  let lastId = 0;

  while (true) {
    // Get next batch of conversations without embeddings (both closed and open)
    const conversationsBatch = await db
      .select({
        id: conversations.id,
        slug: conversations.slug,
        status: conversations.status,
      })
      .from(conversations)
      .where(
        and(
          or(
            eq(conversations.status, "closed"),
            eq(conversations.status, "open"), // Now also process open conversations
          ),
          isNull(conversations.embedding),
          isNull(conversations.mergedIntoId),
        ),
      )
      .orderBy(conversations.id)
      .limit(BATCH_SIZE);

    if (conversationsBatch.length === 0) {
      // eslint-disable-next-line no-console
      console.log("No more conversations to process");
      break;
    }

    // eslint-disable-next-line no-console
    console.log(
      `Processing batch of ${conversationsBatch.length} conversations (${conversationsBatch.filter((c) => c.status === "open").length} open, ${conversationsBatch.filter((c) => c.status === "closed").length} closed)...`,
    );

    // Trigger embedding creation for each conversation
    const events = conversationsBatch.map((conversation) =>
      triggerEvent("conversations/embedding.create", {
        conversationSlug: conversation.slug,
      }),
    );

    await Promise.all(events);

    processed += conversationsBatch.length;
    lastId = conversationsBatch[conversationsBatch.length - 1]?.id ?? lastId;

    // eslint-disable-next-line no-console
    console.log(`Processed ${processed} conversations so far...`);

    // Add a small delay to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // eslint-disable-next-line no-console
  console.log(`✅ Bulk embedding complete! Processed ${processed} conversations total.`);
  return { success: true, processedConversations: processed };
};
