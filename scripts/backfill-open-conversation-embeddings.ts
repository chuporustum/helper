import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema/conversations";
import { triggerEvent } from "@/jobs/trigger";

const BATCH_SIZE = 10; // Process in small batches to avoid overwhelming the system

export const backfillOpenConversationEmbeddings = async () => {
  console.log("Starting backfill of embeddings for open conversations...");

  let processed = 0;
  let lastId = 0;

  while (true) {
    // Get next batch of open conversations without embeddings
    const conversationsBatch = await db
      .select({
        id: conversations.id,
        slug: conversations.slug,
      })
      .from(conversations)
      .where(and(eq(conversations.status, "open"), isNull(conversations.embedding), isNull(conversations.mergedIntoId)))
      .orderBy(conversations.id)
      .limit(BATCH_SIZE);

    if (conversationsBatch.length === 0) {
      console.log("No more conversations to process");
      break;
    }

    console.log(`Processing batch of ${conversationsBatch.length} conversations...`);

    // Trigger embedding creation for each conversation
    const events = conversationsBatch.map((conversation) =>
      triggerEvent("conversations/embedding.create", {
        conversationSlug: conversation.slug,
      }),
    );

    await Promise.all(events);

    processed += conversationsBatch.length;
    lastId = conversationsBatch[conversationsBatch.length - 1]?.id ?? lastId;

    console.log(`Processed ${processed} conversations so far...`);

    // Add a small delay to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`✅ Backfill complete! Processed ${processed} conversations total.`);
  return { success: true, processedConversations: processed };
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillOpenConversationEmbeddings()
    .then((result) => {
      console.log("Result:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}
