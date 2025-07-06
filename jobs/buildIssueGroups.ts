import { cosineSimilarity } from "ai";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationIssueGroups } from "@/db/schema/conversationIssueGroups";
import { conversations } from "@/db/schema/conversations";
import { issueGroups } from "@/db/schema/issueGroups";
import { generateIssueGroupTitle } from "@/lib/ai/issueGroupTitle";
import { env } from "@/lib/env";

const SIMILARITY_THRESHOLD = (() => {
  const parsed = parseFloat(env.ISSUE_GROUPS_SIMILARITY_THRESHOLD || "0.85");
  if (isNaN(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(
      `Invalid ISSUE_GROUPS_SIMILARITY_THRESHOLD: ${env.ISSUE_GROUPS_SIMILARITY_THRESHOLD}. Must be a number between 0 and 1.`,
    );
  }
  return parsed;
})();

const BATCH_SIZE = (() => {
  const parsed = parseInt(env.ISSUE_GROUPS_BATCH_SIZE || "50", 10);
  if (isNaN(parsed) || parsed < 1) {
    throw new Error(`Invalid ISSUE_GROUPS_BATCH_SIZE: ${env.ISSUE_GROUPS_BATCH_SIZE}. Must be a positive integer.`);
  }
  return parsed;
})();

export const buildIssueGroups = async () => {
  // NOTE: This job loads all existing issue groups into memory for similarity comparison.
  // Consider pagination or partitioning if the number of groups grows significantly (>1000).
  // First, check how many conversations are missing embeddings
  const missingEmbeddingsResult = await db
    .select({ count: count() })
    .from(conversations)
    .where(and(eq(conversations.status, "open"), isNull(conversations.embedding), isNull(conversations.mergedIntoId)));

  const missingEmbeddingsCount = missingEmbeddingsResult[0]?.count ?? 0;

  if (missingEmbeddingsCount > 0) {
    // Found conversations without embeddings
  }

  // Get conversations that have embeddings and aren't already in groups
  const conversationsToProcess = await db
    .select({
      id: conversations.id,
      slug: conversations.slug,
      embedding: conversations.embedding,
      embeddingText: conversations.embeddingText,
      subject: conversations.subject,
    })
    .from(conversations)
    .leftJoin(conversationIssueGroups, eq(conversations.id, conversationIssueGroups.conversationId))
    .where(
      and(
        eq(conversations.status, "open"),
        isNotNull(conversations.embedding),
        isNull(conversations.mergedIntoId),
        isNull(conversationIssueGroups.conversationId), // Not already in a group
      ),
    )
    .limit(BATCH_SIZE);

  if (conversationsToProcess.length === 0) {
    return { success: true, processedConversations: 0, createdGroups: 0 };
  }

  // Get existing issue groups
  const existingGroups = await db
    .select({
      id: issueGroups.id,
      embedding: issueGroups.embedding,
      title: issueGroups.title,
    })
    .from(issueGroups);

  let processedConversations = 0;
  let createdGroups = 0;

  for (const conversation of conversationsToProcess) {
    if (!conversation.embedding) {
      continue;
    }

    let bestMatch: { id: number; similarity: number } | null = null;

    // Find the best matching existing group
    for (const group of existingGroups) {
      if (!group.embedding) continue;

      const similarity = cosineSimilarity(conversation.embedding, group.embedding);
      if (similarity >= SIMILARITY_THRESHOLD) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { id: group.id, similarity };
        }
      }
    }

    if (bestMatch) {
      // Add conversation to existing group
      await db.insert(conversationIssueGroups).values({
        conversationId: conversation.id,
        issueGroupId: bestMatch.id,
      });
      // Added conversation to existing group
    } else {
      // Create new group with AI-generated title
      const title = await generateIssueGroupTitle(conversation.embeddingText || "", conversation.subject || undefined);
      const description = conversation.embeddingText || "No description available";

      const [newGroup] = await db
        .insert(issueGroups)
        .values({
          title: title.substring(0, 200), // Ensure title fits in database
          description: description.substring(0, 1000), // Ensure description fits
          embedding: conversation.embedding,
        })
        .returning({ id: issueGroups.id });

      // Add conversation to new group
      await db.insert(conversationIssueGroups).values({
        conversationId: conversation.id,
        issueGroupId: newGroup.id,
      });

      // Add to existing groups for future matching
      existingGroups.push({
        id: newGroup.id,
        embedding: conversation.embedding,
        title: title,
      });

      createdGroups++;
    }

    processedConversations++;
  }

  return {
    success: true,
    processedConversations,
    createdGroups,
    missingEmbeddings: missingEmbeddingsCount,
  };
};
