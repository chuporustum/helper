import { db } from "@/db/client";
import { conversationEvents, mailboxes } from "@/db/schema";
import { assertDefinedOrRaiseNonRetriableError } from "@/jobs/utils";
import { getAgentInitiationInfo } from "@/lib/data/conversation";
import { createHumanSupportRequestEventPayload } from "@/lib/data/dashboardEvent";
import { dashboardChannelId } from "@/lib/realtime/channels";
import { publishToRealtime } from "@/lib/realtime/publish";
import { desc, eq } from "drizzle-orm";

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
  const { agentInitiated, agentName } = await getAgentInitiationInfo(
    event.conversation.id,
    event.conversation.emailFrom,
  );

  await publishToRealtime({
    channel: dashboardChannelId(mailboxSlug),
    event: "event",
    data: createHumanSupportRequestEventPayload(event, mailbox, agentInitiated, agentName),
  });

  return { success: true };
};
