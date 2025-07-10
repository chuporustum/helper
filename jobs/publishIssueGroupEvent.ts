import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { issueGroups, mailboxes } from "@/db/schema";
import { assertDefinedOrRaiseNonRetriableError } from "@/jobs/utils";
import { issueGroupsChannelId } from "@/lib/realtime/channels";
import { publishToRealtime } from "@/lib/realtime/publish";

export const publishIssueGroupEvent = async ({
  issueGroupId,
  eventType,
}: {
  issueGroupId: number;
  eventType: "created" | "updated" | "deleted";
}) => {
  const issueGroup = await db.query.issueGroups.findFirst({
    where: eq(issueGroups.id, issueGroupId),
  });

  if (!issueGroup && eventType !== "deleted") {
    return;
  }

  // For now, we'll publish to all mailboxes since issue groups span mailboxes
  // In the future, we could optimize this by tracking which mailboxes have conversations in each group
  const allMailboxes = await db.query.mailboxes.findMany({
    columns: { slug: true },
  });

  await Promise.all(
    allMailboxes.map((mailbox) =>
      publishToRealtime({
        channel: issueGroupsChannelId(mailbox.slug),
        event: "issueGroupUpdated",
        data: {
          eventType,
          issueGroup: eventType === "deleted" ? { id: issueGroupId } : issueGroup,
        },
      }),
    ),
  );
};
