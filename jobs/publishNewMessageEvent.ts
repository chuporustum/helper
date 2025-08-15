import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationAgentReadStatus, conversationMessages } from "@/db/schema";
import { serializeMessage, serializeMessageForWidget } from "@/lib/data/conversationMessage";
import { createMessageEventPayload } from "@/lib/data/dashboardEvent";
import { getMailbox } from "@/lib/data/mailbox";
import {
  conversationChannelId,
  conversationsListChannelId,
  dashboardChannelId,
  publicConversationChannelId,
} from "@/lib/realtime/channels";
import { publishToRealtime } from "@/lib/realtime/publish";

export const publishNewMessageEvent = async ({ messageId }: { messageId: number }) => {
  const message = await db.query.conversationMessages.findFirst({
    where: eq(conversationMessages.id, messageId),
    with: {
      conversation: {
        with: {
          platformCustomer: true,
        },
      },
      files: true,
    },
  });
  const published = [];
  const mailbox = await getMailbox();
  if (!mailbox) return `No mailbox found, cannot publish events.`;

  if (message && message.role !== "user") {
    await publishToRealtime({
      channel: publicConversationChannelId(message.conversation.slug),
      event: "agent-reply",
      data: await serializeMessageForWidget(message, message.files),
    });
  }
  if (message && message?.role !== "ai_assistant") {
    await publishToRealtime({
      channel: conversationChannelId(message.conversation.slug),
      event: "conversation.message",
      data: await serializeMessage(message, message.conversation.id, mailbox),
      trim: (data, amount) => ({
        ...data,
        body: data.body && amount < data.body.length ? data.body.slice(0, data.body.length - amount) : null,
      }),
    });
    published.push("conversation.message");
  }
  if (message?.role === "user" && message.conversation.status === "open") {
    // Calculate unread status for assigned agent
    const unreadData = message.conversation.assignedToId
      ? await db
          .select({
            hasUnreadReplies: sql<boolean>`
              CASE 
                WHEN ${message.conversation.lastUserEmailCreatedAt} > COALESCE(
                  (SELECT last_read_at FROM ${conversationAgentReadStatus} 
                   WHERE conversation_id = ${message.conversation.id} 
                   AND agent_clerk_id = ${message.conversation.assignedToId}),
                  ${message.conversation.createdAt}
                )
                THEN true 
                ELSE false 
              END
            `.as('has_unread_replies'),
            unreadCount: sql<number>`
              (
                SELECT COUNT(*) 
                FROM ${conversationMessages} 
                WHERE conversation_id = ${message.conversation.id}
                AND created_at > COALESCE(
                  (SELECT last_read_at FROM ${conversationAgentReadStatus} 
                   WHERE conversation_id = ${message.conversation.id} 
                   AND agent_clerk_id = ${message.conversation.assignedToId}),
                  ${message.conversation.createdAt}
                )
                AND role = 'user'
              )
            `.as('unread_count')
          })
          .from(sql`(SELECT 1) as dummy`)
          .then(results => results[0] ?? { hasUnreadReplies: false, unreadCount: 0 })
      : { hasUnreadReplies: false, unreadCount: 0 };

    await publishToRealtime({
      channel: conversationsListChannelId(),
      event: "conversation.new",
      data: {
        ...message.conversation,
        hasUnreadReplies: unreadData.hasUnreadReplies,
        unreadCount: unreadData.unreadCount,
      },
    });
    published.push("conversation.new");
  }
  if (message) {
    await publishToRealtime({
      channel: dashboardChannelId(),
      event: "event",
      data: createMessageEventPayload(message, mailbox),
    });
    published.push("realtime.event");
  }
  return `Events for message ${message?.id} published: ${published.join(", ") || "none"}`;
};
