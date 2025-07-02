import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationMessages } from "@/db/schema";
import { authUsers } from "@/db/supabaseSchema/auth";
import { getFullName } from "@/lib/auth/authUtils";
import { serializeMessage } from "@/lib/data/conversationMessage";
import { createMessageEventPayload } from "@/lib/data/dashboardEvent";
import { conversationChannelId, conversationsListChannelId, dashboardChannelId } from "@/lib/realtime/channels";
import { publishToRealtime } from "@/lib/realtime/publish";

export const publishNewConversationEvent = async ({ messageId }: { messageId: number }) => {
  const message = await db.query.conversationMessages.findFirst({
    where: eq(conversationMessages.id, messageId),
    with: {
      conversation: {
        with: {
          platformCustomer: true,
          mailbox: true,
        },
      },
    },
  });
  const published = [];
  if (message && message?.role !== "ai_assistant") {
    await publishToRealtime({
      channel: conversationChannelId(message.conversation.mailbox.slug, message.conversation.slug),
      event: "conversation.message",
      data: await serializeMessage(message, message.conversation.id, message.conversation.mailbox),
      trim: (data, amount) => ({
        ...data,
        body: data.body && amount < data.body.length ? data.body.slice(0, data.body.length - amount) : null,
      }),
    });
    published.push("conversation.message");
  }
  if (message?.role === "user" && message.conversation.status === "open") {
    await publishToRealtime({
      channel: conversationsListChannelId(message.conversation.mailbox.slug),
      event: "conversation.new",
      data: message.conversation,
    });
    published.push("conversation.new");
  }
  if (message) {
    // Check if this is an agent-initiated conversation for dashboard events
    let agentInitiated = false;
    let agentName: string | undefined;

    if (!message.conversation.emailFrom) {
      // Get the first message to see if it's from an agent
      const firstMessage = await db.query.conversationMessages.findFirst({
        columns: { role: true, userId: true },
        where: and(
          eq(conversationMessages.conversationId, message.conversation.id),
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
      channel: dashboardChannelId(message.conversation.mailbox.slug),
      event: "event",
      data: createMessageEventPayload(message, message.conversation.mailbox, agentInitiated, agentName),
    });
    published.push("realtime.event");
  }
  return `Events for message ${message?.id} published: ${published.join(", ") || "none"}`;
};
