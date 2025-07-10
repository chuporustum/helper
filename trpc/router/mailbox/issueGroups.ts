import { TRPCError, TRPCRouterRecord } from "@trpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { db } from "@/db/client";
import { conversations, issueGroups, mailboxes, platformCustomers, userProfiles } from "@/db/schema";
import { publishIssueGroupEvent } from "@/jobs/publishIssueGroupEvent";
import { triggerEvent } from "@/jobs/trigger";
import { env } from "@/lib/env";
import { mailboxProcedure } from "./procedure";

// Used as a fallback threshold when no VIP threshold is set
const NO_VIP_THRESHOLD = 999999;

const checkFeatureEnabled = () => {
  if (!env.COMMON_ISSUES_ENABLED) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Common Issues feature is not enabled" });
  }
};

export const issueGroupsRouter = {
  // List all issue groups for a mailbox with conversation counts
  list: mailboxProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      checkFeatureEnabled();
      const { limit, offset } = input;

      // Get current date boundaries for time-based counting
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get issue groups with conversation counts
      const groupsWithCounts = await db
        .select({
          id: issueGroups.id,
          title: issueGroups.title,
          description: issueGroups.description,
          createdAt: issueGroups.createdAt,
          updatedAt: issueGroups.updatedAt,
          totalCount: count(conversations.id),
          openCount: sql<number>`COUNT(CASE WHEN ${conversations.status} = 'open' THEN 1 END)`,
          todayCount: sql<number>`COUNT(CASE WHEN ${conversations.status} = 'open' AND ${conversations.createdAt} >= ${startOfToday} THEN 1 END)`,
          weekCount: sql<number>`COUNT(CASE WHEN ${conversations.status} = 'open' AND ${conversations.createdAt} >= ${startOfWeek} THEN 1 END)`,
          monthCount: sql<number>`COUNT(CASE WHEN ${conversations.status} = 'open' AND ${conversations.createdAt} >= ${startOfMonth} THEN 1 END)`,
          vipCount: sql<number>`COUNT(DISTINCT CASE WHEN ${conversations.status} = 'open' AND (${platformCustomers.value}::numeric / 100) >= COALESCE(${mailboxes.vipThreshold}, ${NO_VIP_THRESHOLD}) THEN ${conversations.emailFrom} END)`,
        })
        .from(issueGroups)
        .leftJoin(conversations, eq(issueGroups.id, conversations.issueGroupId))
        .leftJoin(mailboxes, eq(conversations.mailboxId, mailboxes.id))
        .leftJoin(
          platformCustomers,
          and(
            eq(platformCustomers.email, conversations.emailFrom),
            eq(platformCustomers.mailboxId, conversations.mailboxId),
          ),
        )
        .where(eq(issueGroups.mailboxId, ctx.mailbox.id))
        .groupBy(
          issueGroups.id,
          issueGroups.title,
          issueGroups.description,
          issueGroups.createdAt,
          issueGroups.updatedAt,
        )
        .orderBy(desc(issueGroups.createdAt))
        .limit(limit)
        .offset(offset);

      const groups = groupsWithCounts.map((group) => ({
        ...group,
        openCount: Number(group.openCount || 0),
        todayCount: Number(group.todayCount || 0),
        weekCount: Number(group.weekCount || 0),
        monthCount: Number(group.monthCount || 0),
        vipCount: Number(group.vipCount || 0),
      }));

      // Filter out groups with 0 open conversations for the main view
      const activeGroups = groups.filter((group) => group.openCount > 0);

      return { groups: activeGroups };
    }),

  // Get all issue groups for settings (including those with 0 conversations)
  listAll: mailboxProcedure.query(async ({ ctx }) => {
    checkFeatureEnabled();

    const groups = await db
      .select({
        id: issueGroups.id,
        title: issueGroups.title,
        description: issueGroups.description,
        createdAt: issueGroups.createdAt,
        updatedAt: issueGroups.updatedAt,
        conversationCount: count(conversations.id),
      })
      .from(issueGroups)
      .leftJoin(conversations, eq(issueGroups.id, conversations.issueGroupId))
      .where(eq(issueGroups.mailboxId, ctx.mailbox.id))
      .groupBy(issueGroups.id, issueGroups.title, issueGroups.description, issueGroups.createdAt, issueGroups.updatedAt)
      .orderBy(desc(issueGroups.createdAt));

    return { groups };
  }),

  // Get a specific issue group
  get: mailboxProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    checkFeatureEnabled();

    const group = await db.query.issueGroups.findFirst({
      where: and(eq(issueGroups.id, input.id), eq(issueGroups.mailboxId, ctx.mailbox.id)),
      with: {
        conversations: {
          columns: {
            id: true,
            slug: true,
            subject: true,
            emailFrom: true,
            status: true,
            createdAt: true,
            assignedToId: true,
          },
        },
      },
    });

    if (!group) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Issue group not found" });
    }

    return group;
  }),

  // Create a new issue group
  create: mailboxProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      checkFeatureEnabled();

      const newGroup = await db
        .insert(issueGroups)
        .values({
          mailboxId: ctx.mailbox.id,
          title: input.title,
          description: input.description,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .then(takeUniqueOrThrow);

      return newGroup;
    }),

  // Update an issue group
  update: mailboxProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      checkFeatureEnabled();
      const { id, title, description } = input;

      // Verify ownership
      const existingGroup = await db.query.issueGroups.findFirst({
        where: and(eq(issueGroups.id, id), eq(issueGroups.mailboxId, ctx.mailbox.id)),
      });

      if (!existingGroup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue group not found" });
      }

      const updatedGroup = await db
        .update(issueGroups)
        .set({
          title,
          description,
          updatedAt: new Date(),
        })
        .where(eq(issueGroups.id, id))
        .returning()
        .then(takeUniqueOrThrow);

      return updatedGroup;
    }),

  // Delete an issue group
  delete: mailboxProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    checkFeatureEnabled();

    // Verify ownership and get conversation count
    const group = await db.query.issueGroups.findFirst({
      where: and(eq(issueGroups.id, input.id), eq(issueGroups.mailboxId, ctx.mailbox.id)),
      with: {
        conversations: {
          columns: { id: true },
        },
      },
    });

    if (!group) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Issue group not found" });
    }

    // Unassign all conversations from this group
    if (group.conversations.length > 0) {
      await db.update(conversations).set({ issueGroupId: null }).where(eq(conversations.issueGroupId, input.id));
    }

    // Delete the group
    await db.delete(issueGroups).where(eq(issueGroups.id, input.id));

    return { success: true, unassignedConversations: group.conversations.length };
  }),

  // Assign a conversation to an issue group
  assignConversation: mailboxProcedure
    .input(
      z.object({
        conversationId: z.number(),
        issueGroupId: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      checkFeatureEnabled();

      // Verify conversation belongs to this mailbox
      const conversation = await db.query.conversations.findFirst({
        where: and(eq(conversations.id, input.conversationId), eq(conversations.mailboxId, ctx.mailbox.id)),
      });

      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      }

      // If issueGroupId is provided, verify it belongs to this mailbox
      if (input.issueGroupId) {
        const issueGroup = await db.query.issueGroups.findFirst({
          where: and(eq(issueGroups.id, input.issueGroupId), eq(issueGroups.mailboxId, ctx.mailbox.id)),
        });

        if (!issueGroup) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Issue group not found" });
        }
      }

      // Update the conversation
      await db
        .update(conversations)
        .set({ issueGroupId: input.issueGroupId })
        .where(eq(conversations.id, input.conversationId));

      return { success: true };
    }),

  // Bulk close all conversations in an issue group
  bulkCloseAll: mailboxProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    checkFeatureEnabled();

    // Verify group belongs to this mailbox
    const group = await db.query.issueGroups.findFirst({
      where: and(eq(issueGroups.id, input.id), eq(issueGroups.mailboxId, ctx.mailbox.id)),
      with: {
        conversations: {
          columns: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!group) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Issue group not found" });
    }

    const openConversationIds = group.conversations.filter((c) => c.status === "open").map((c) => c.id);

    if (openConversationIds.length === 0) {
      return { updatedCount: 0 };
    }

    await triggerEvent("conversations/bulk-update", {
      mailboxId: ctx.mailbox.id,
      userId: ctx.user.id,
      conversationFilter: openConversationIds,
      status: "closed",
    });

    // Trigger real-time update for issue groups
    await publishIssueGroupEvent({
      issueGroupId: input.id,
      eventType: "updated",
    });

    return { updatedCount: openConversationIds.length };
  }),

  // Get pinned issue groups for current user
  pinnedList: mailboxProcedure.query(async ({ ctx }) => {
    checkFeatureEnabled();

    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ctx.user.id),
    });

    if (!userProfile?.pinnedIssueGroupIds || userProfile.pinnedIssueGroupIds.length === 0) {
      return { groups: [] };
    }

    const pinnedGroups = await db
      .select({
        id: issueGroups.id,
        title: issueGroups.title,
        description: issueGroups.description,
        openCount: count(conversations.id),
      })
      .from(issueGroups)
      .leftJoin(conversations, and(eq(issueGroups.id, conversations.issueGroupId), eq(conversations.status, "open")))
      .where(
        and(
          eq(issueGroups.mailboxId, ctx.mailbox.id),
          sql`${issueGroups.id} = ANY(${userProfile.pinnedIssueGroupIds})`,
        ),
      )
      .groupBy(issueGroups.id)
      .orderBy(desc(issueGroups.createdAt))
      .limit(10);

    // Filter out pinned groups with 0 open conversations
    const activePinnedGroups = pinnedGroups.filter((group) => group.openCount > 0);

    return { groups: activePinnedGroups };
  }),

  // Pin an issue group for current user
  pin: mailboxProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    checkFeatureEnabled();

    // Verify issue group exists and belongs to this mailbox
    const group = await db.query.issueGroups.findFirst({
      where: and(eq(issueGroups.id, input.id), eq(issueGroups.mailboxId, ctx.mailbox.id)),
    });

    if (!group) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Issue group not found" });
    }

    // Get current user profile
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ctx.user.id),
    });

    const currentPinned = userProfile?.pinnedIssueGroupIds || [];

    // Add to pinned if not already there
    if (!currentPinned.includes(input.id)) {
      await db
        .update(userProfiles)
        .set({
          pinnedIssueGroupIds: [...currentPinned, input.id],
        })
        .where(eq(userProfiles.id, ctx.user.id));
    }

    return { success: true };
  }),

  // Unpin an issue group for current user
  unpin: mailboxProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    checkFeatureEnabled();

    // Get current user profile
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ctx.user.id),
    });

    const currentPinned = userProfile?.pinnedIssueGroupIds || [];

    // Remove from pinned
    const updatedPinned = currentPinned.filter((id) => id !== input.id);

    await db
      .update(userProfiles)
      .set({
        pinnedIssueGroupIds: updatedPinned,
      })
      .where(eq(userProfiles.id, ctx.user.id));

    return { success: true };
  }),
} satisfies TRPCRouterRecord;
