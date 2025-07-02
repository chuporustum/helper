import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationEvents, conversationMessages, conversations, mailboxes, platformCustomers } from "@/db/schema";
import { authUsers } from "@/db/supabaseSchema/auth";
import { getFullName } from "@/lib/auth/authUtils";
import { Mailbox } from "@/lib/data/mailbox";
import { determineVipStatus } from "@/lib/data/platformCustomer";

type DashboardEventPayload = {
  type: "email" | "chat" | "ai_reply" | "human_support_request" | "good_reply" | "bad_reply" | "new_conversation";
  id: string;
  conversationSlug: string;
  emailFrom: string | null;
  title: string | null;
  value: number | null;
  isVip: boolean;
  description?: string | null;
  timestamp: Date;
  messageCount?: number;
  agentInitiated?: boolean;
  agentName?: string;
};

type ConversationForEvent = Pick<typeof conversations.$inferSelect, "slug" | "emailFrom" | "subject"> & {
  platformCustomer: Pick<typeof platformCustomers.$inferSelect, "value"> | null;
};

type BaseEventInput = {
  conversation: ConversationForEvent;
  mailbox: Pick<typeof mailboxes.$inferSelect, "vipThreshold">;
  agentInitiated?: boolean;
  agentName?: string;
};

const createBaseEventPayload = ({
  conversation,
  mailbox,
  agentInitiated,
  agentName,
}: BaseEventInput): Omit<DashboardEventPayload, "type" | "id" | "description" | "timestamp" | "messageCount"> => {
  const value = conversation.platformCustomer?.value ? Number(conversation.platformCustomer.value) : null;
  return {
    conversationSlug: conversation.slug,
    emailFrom: conversation.emailFrom,
    title: conversation.subject,
    value,
    isVip: determineVipStatus(value, mailbox.vipThreshold),
    agentInitiated,
    agentName,
  };
};

export const createMessageEventPayload = (
  message: Pick<typeof conversationMessages.$inferSelect, "id" | "role" | "emailTo" | "cleanedUpText" | "createdAt"> & {
    conversation: ConversationForEvent;
  },
  mailbox: Pick<typeof mailboxes.$inferSelect, "vipThreshold">,
  agentInitiated?: boolean,
  agentName?: string,
): DashboardEventPayload => {
  return {
    ...createBaseEventPayload({ conversation: message.conversation, mailbox, agentInitiated, agentName }),
    type: message.role === "ai_assistant" ? "ai_reply" : message.emailTo ? "email" : "chat",
    id: `${message.id}-message`,
    description: message.cleanedUpText,
    timestamp: message.createdAt,
  };
};

export const createReactionEventPayload = (
  message: Pick<
    typeof conversationMessages.$inferSelect,
    "id" | "reactionType" | "reactionFeedback" | "reactionCreatedAt"
  > & {
    conversation: ConversationForEvent;
  },
  mailbox: Pick<typeof mailboxes.$inferSelect, "vipThreshold">,
  agentInitiated?: boolean,
  agentName?: string,
): DashboardEventPayload => {
  return {
    ...createBaseEventPayload({ conversation: message.conversation, mailbox, agentInitiated, agentName }),
    type: message.reactionType === "thumbs-up" ? "good_reply" : "bad_reply",
    id: `${message.id}-reaction`,
    description: message.reactionFeedback,
    timestamp: message.reactionCreatedAt!,
  };
};

export const createHumanSupportRequestEventPayload = (
  request: Pick<typeof conversationEvents.$inferSelect, "id" | "createdAt"> & {
    conversation: ConversationForEvent;
  },
  mailbox: Pick<typeof mailboxes.$inferSelect, "vipThreshold">,
  agentInitiated?: boolean,
  agentName?: string,
): DashboardEventPayload => {
  return {
    ...createBaseEventPayload({ conversation: request.conversation, mailbox, agentInitiated, agentName }),
    type: "human_support_request",
    id: `${request.id}-human-support-request`,
    timestamp: request.createdAt,
  };
};

export const getLatestEvents = async (mailbox: Mailbox, before?: Date) => {
  // Get all recent conversations in the mailbox
  const recentConversations = await db.query.conversations.findMany({
    columns: { id: true, slug: true, emailFrom: true, subject: true, createdAt: true },
    with: {
      platformCustomer: { columns: { value: true } },
    },
    where: and(eq(conversations.mailboxId, mailbox.id), before ? lt(conversations.createdAt, before) : undefined),
    orderBy: desc(conversations.createdAt),
    limit: 50, // Get more conversations since we'll be filtering to get latest activity per conversation
  });

  if (recentConversations.length === 0) return [];

  const conversationIds = recentConversations.map((c) => c.id);

  // Get the most recent activity for each conversation
  const events: DashboardEventPayload[] = [];

  // Get most recent message per conversation
  for (const conversation of recentConversations) {
    const conversationData = {
      slug: conversation.slug,
      emailFrom: conversation.emailFrom,
      subject: conversation.subject,
      platformCustomer: conversation.platformCustomer,
    };

    // Check if this is an agent-initiated conversation
    let agentInitiated = false;
    let agentName: string | undefined;

    if (!conversation.emailFrom) {
      // Get the first message to see if it's from an agent
      const firstMessage = await db.query.conversationMessages.findFirst({
        columns: { role: true, userId: true },
        where: and(eq(conversationMessages.conversationId, conversation.id), isNull(conversationMessages.deletedAt)),
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

    // Get most recent message (user, staff, ai_assistant - include all message types)
    const recentMessage = await db.query.conversationMessages.findFirst({
      columns: {
        id: true,
        createdAt: true,
        role: true,
        cleanedUpText: true,
        emailTo: true,
      },
      where: and(
        eq(conversationMessages.conversationId, conversation.id),
        inArray(conversationMessages.role, ["user", "staff", "ai_assistant"]),
        isNull(conversationMessages.deletedAt),
      ),
      orderBy: desc(conversationMessages.createdAt),
    });

    // Get most recent reaction
    const recentReaction = await db.query.conversationMessages.findFirst({
      columns: {
        id: true,
        reactionType: true,
        reactionFeedback: true,
        reactionCreatedAt: true,
      },
      where: and(
        eq(conversationMessages.conversationId, conversation.id),
        isNotNull(conversationMessages.reactionType),
        isNotNull(conversationMessages.reactionCreatedAt),
        isNull(conversationMessages.deletedAt),
      ),
      orderBy: desc(conversationMessages.reactionCreatedAt),
    });

    // Get most recent human support request
    const recentHumanRequest = await db.query.conversationEvents.findFirst({
      columns: { id: true, createdAt: true },
      where: and(
        eq(conversationEvents.conversationId, conversation.id),
        eq(conversationEvents.type, "request_human_support"),
      ),
      orderBy: desc(conversationEvents.createdAt),
    });

    // Determine which is the most recent activity
    const activities = [
      recentMessage ? { type: "message" as const, timestamp: recentMessage.createdAt, data: recentMessage } : null,
      recentReaction
        ? { type: "reaction" as const, timestamp: recentReaction.reactionCreatedAt!, data: recentReaction }
        : null,
      recentHumanRequest
        ? { type: "human_request" as const, timestamp: recentHumanRequest.createdAt, data: recentHumanRequest }
        : null,
    ].filter(Boolean);

    if (activities.length === 0) continue;

    // Sort by most recent and take the latest activity
    activities.sort((a, b) => b!.timestamp.getTime() - a!.timestamp.getTime());
    const latestActivity = activities[0]!;

    // Create event based on the most recent activity type
    if (latestActivity.type === "message") {
      const message = latestActivity.data as typeof recentMessage;
      // Count total messages in this conversation for context
      const messageCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(conversationMessages)
        .where(
          and(
            eq(conversationMessages.conversationId, conversation.id),
            isNull(conversationMessages.deletedAt),
            inArray(conversationMessages.role, ["user", "ai_assistant", "staff"]),
          ),
        );

      events.push({
        ...createMessageEventPayload(
          { ...message!, conversation: conversationData },
          mailbox,
          agentInitiated,
          agentName,
        ),
        messageCount: messageCountResult[0]?.count || 0,
      });
    } else if (latestActivity.type === "reaction") {
      const reaction = latestActivity.data as typeof recentReaction;
      events.push(
        createReactionEventPayload(
          { ...reaction!, conversation: conversationData },
          mailbox,
          agentInitiated,
          agentName,
        ),
      );
    } else if (latestActivity.type === "human_request") {
      const request = latestActivity.data as typeof recentHumanRequest;
      events.push(
        createHumanSupportRequestEventPayload(
          { ...request!, conversation: conversationData },
          mailbox,
          agentInitiated,
          agentName,
        ),
      );
    }
  }

  // Sort all events by timestamp and limit to 20
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20);
};
