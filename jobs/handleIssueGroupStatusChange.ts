import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationIssueGroups } from "@/db/schema";
import { env } from "@/lib/env";
import { publishIssueGroupEvent } from "./publishIssueGroupEvent";

export const handleIssueGroupStatusChange = async ({ conversationId }: { conversationId: number }) => {
  // Only run if Common Issues feature is enabled
  if (!env.COMMON_ISSUES_ENABLED) {
    return;
  }

  // Find all issue groups this conversation belongs to
  const issueGroupRelations = await db.query.conversationIssueGroups.findMany({
    where: eq(conversationIssueGroups.conversationId, conversationId),
    columns: { issueGroupId: true },
  });

  // Publish update events for all affected issue groups
  await Promise.all(
    issueGroupRelations.map((relation) =>
      publishIssueGroupEvent({
        issueGroupId: relation.issueGroupId,
        eventType: "updated",
      }),
    ),
  );
};
