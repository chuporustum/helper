import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationEvents, conversationMessages, mailboxes } from "@/db/schema";
import { authUsers } from "@/db/supabaseSchema/auth";
import { assertDefinedOrRaiseNonRetriableError } from "@/jobs/utils";
import { getFullName } from "@/lib/auth/authUtils";
import { createHumanSupportRequestEventPayload } from "@/lib/data/dashboardEvent";
import { dashboardChannelId } from "@/lib/realtime/channels";
import { publishToRealtime } from "@/lib/realtime/publish";

export const publishRequestHumanSupport = async ({
  mailboxSlug,
  conversationId,
}: {
  mailboxSlug: string;
  conversationId: number;
}) => {
  const mailbox = assertDefinedOrRaiseNonRetriableError(
    await db.query.mailboxes.findFirst({
      where: eq(mailboxes.slug, mailboxSlug),
    }),
  );

  const event = assertDefinedOrRaiseNonRetriableError(
    await db.query.conversationEvents.findFirst({
      where: eq(conversationEvents.conversationId, conversationId),
      with: {
        conversation: {
          columns: { id: true, slug: true, emailFrom: true, subject: true },
          with: {
            platformCustomer: { columns: { value: true } },
          },
        },
      },
      orderBy: desc(conversationEvents.createdAt),
    }),
  );

  // Check if this is an agent-initiated conversation for dashboard events
  let agentInitiated = false;
  let agentName: string | undefined;

  if (!event.conversation.emailFrom) {
    // Get the first message to see if it's from an agent
    const firstMessage = await db.query.conversationMessages.findFirst({
      columns: { role: true, userId: true },
      where: and(
        eq(conversationMessages.conversationId, event.conversation.id),
        isNull(conversationMessages.deletedAt),
      ),
      orderBy: conversationMessages.createdAt,
    });

    if (firstMessage?.role === "staff" && firstMessage.userId) {
      agentInitiated = true;
      // Get the agent's display name
      const agent = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, firstMessage.userId),
      });
      if (agent) {
        agentName = getFullName(agent);
      }
    }
  }

  await publishToRealtime({
    channel: dashboardChannelId(mailboxSlug),
    event: "event",
    data: createHumanSupportRequestEventPayload(event, mailbox, agentInitiated, agentName),
  });

  return { success: true };
};
