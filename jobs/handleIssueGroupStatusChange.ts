import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { env } from "@/lib/env";
import { publishIssueGroupEvent } from "./publishIssueGroupEvent";

export const handleIssueGroupStatusChange = async ({ conversationId }: { conversationId: number }) => {
  // Only run if Common Issues feature is enabled
  if (!env.COMMON_ISSUES_ENABLED) {
    return;
  }

  // Find the issue group this conversation belongs to (direct relationship)
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    columns: { issueGroupId: true },
  });

  // If conversation is assigned to an issue group, publish update event
  if (conversation?.issueGroupId) {
    await publishIssueGroupEvent({
      issueGroupId: conversation.issueGroupId,
      eventType: "updated",
    });
  }
};
