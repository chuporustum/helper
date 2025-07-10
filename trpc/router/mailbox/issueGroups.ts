import { TRPCError, TRPCRouterRecord } from "@trpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { db } from "@/db/client";
import {
  conversationIssueGroups,
  conversations,
  issueGroups,
  mailboxes,
  platformCustomers,
  userPinnedIssueGroups,
} from "@/db/schema";
import { triggerEvent } from "@/jobs/trigger";
import { env } from "@/lib/env";
import { mailboxProcedure } from "./procedure";

const checkFeatureEnabled = () => {
  if (!env.COMMON_ISSUES_ENABLED) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Common Issues feature is not enabled" });
  }
};

export const issueGroupsRouter = {
  list: mailboxProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
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

      // First get basic issue groups
      const baseGroups = await db
        .select({
          id: issueGroups.id,
          title: issueGroups.title,
          description: issueGroups.description,
          createdAt: issueGroups.createdAt,
          updatedAt: issueGroups.updatedAt,
        })
        .from(issueGroups)
        .orderBy(desc(issueGroups.updatedAt))
        .limit(limit)
        .offset(offset);

      // For each group, get conversation counts
      const groups = await Promise.all(
        baseGroups.map(async (group) => {
          const conversationCounts = await db
            .select({
              totalCount: count(conversations.id),
              openCount: sql<number>`COUNT(CASE WHEN ${conversations.status} = 'open' THEN 1 END)`,
              todayCount: sql<number>`COUNT(CASE WHEN ${conversations.status} = 'open' AND ${conversations.createdAt} >= ${startOfToday} THEN 1 END)`,
              weekCount: sql<number>`COUNT(CASE WHEN ${conversations.status} = 'open' AND ${conversations.createdAt} >= ${startOfWeek} THEN 1 END)`,
              monthCount: sql<number>`COUNT(CASE WHEN ${conversations.status} = 'open' AND ${conversations.createdAt} >= ${startOfMonth} THEN 1 END)`,
              vipCount: sql<number>`COUNT(DISTINCT CASE WHEN ${conversations.status} = 'open' AND (${platformCustomers.value}::numeric / 100) >= COALESCE(${mailboxes.vipThreshold}, 999999) THEN ${conversations.emailFrom} END)`,
            })
            .from(conversationIssueGroups)
            .innerJoin(conversations, eq(conversationIssueGroups.conversationId, conversations.id))
            .leftJoin(mailboxes, eq(conversations.mailboxId, mailboxes.id))
            .leftJoin(
              platformCustomers,
              and(
                eq(platformCustomers.email, conversations.emailFrom),
                eq(platformCustomers.mailboxId, conversations.mailboxId),
              ),
            )
            .where(
              and(eq(conversationIssueGroups.issueGroupId, group.id), eq(conversations.mailboxId, ctx.mailbox.id)),
            );

          const counts = conversationCounts[0] || {
            totalCount: 0,
            openCount: 0,
            todayCount: 0,
            weekCount: 0,
            monthCount: 0,
            vipCount: 0,
          };

          return {
            ...group,
            openCount: Number(counts.openCount || 0),
            todayCount: Number(counts.todayCount || 0),
            weekCount: Number(counts.weekCount || 0),
            monthCount: Number(counts.monthCount || 0),
            vipCount: Number(counts.vipCount || 0),
          };
        }),
      );

      return { groups };
    }),

  get: mailboxProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    checkFeatureEnabled();
    const group = await db.query.issueGroups.findFirst({
      where: eq(issueGroups.id, input.id),
      with: {
        conversationIssueGroups: {
          with: {
            conversation: {
              columns: {
                id: true,
                slug: true,
                subject: true,
                emailFrom: true,
                status: true,
                createdAt: true,
                assignedToId: true,
                mailboxId: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Issue group not found" });
    }

    return {
      ...group,
      conversations: group.conversationIssueGroups
        .map((cig) => cig.conversation)
        .filter((c) => c !== null && c.mailboxId === ctx.mailbox.id),
    };
  }),

  merge: mailboxProcedure
    .input(
      z.object({
        sourceId: z.number(),
        targetId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      checkFeatureEnabled();
      const { sourceId, targetId } = input;

      if (sourceId === targetId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot merge a group with itself" });
      }

      const [sourceGroup, targetGroup] = await Promise.all([
        db.query.issueGroups.findFirst({ where: eq(issueGroups.id, sourceId) }),
        db.query.issueGroups.findFirst({ where: eq(issueGroups.id, targetId) }),
      ]);

      if (!sourceGroup || !targetGroup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or both issue groups not found" });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(conversationIssueGroups)
          .set({ issueGroupId: targetId })
          .where(eq(conversationIssueGroups.issueGroupId, sourceId));

        await tx.delete(issueGroups).where(eq(issueGroups.id, sourceId));
      });

      return { success: true };
    }),

  rename: mailboxProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      checkFeatureEnabled();
      const { id, title, description } = input;

      const group = await db.query.issueGroups.findFirst({
        where: eq(issueGroups.id, id),
      });

      if (!group) {
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

  bulkCloseAll: mailboxProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    checkFeatureEnabled();
    const group = await db.query.issueGroups.findFirst({
      where: eq(issueGroups.id, input.id),
      with: {
        conversationIssueGroups: {
          with: {
            conversation: {
              columns: {
                id: true,
                mailboxId: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Issue group not found" });
    }

    const conversationIds = group.conversationIssueGroups
      .map((cig) => cig.conversation)
      .filter((c) => c !== null && c.mailboxId === ctx.mailbox.id && c.status === "open")
      .map((c) => c.id);

    if (conversationIds.length === 0) {
      return { updatedCount: 0 };
    }

    await triggerEvent("conversations/bulk-update", {
      mailboxId: ctx.mailbox.id,
      userId: ctx.user.id,
      conversationFilter: conversationIds,
      status: "closed",
    });

    return { updatedCount: conversationIds.length };
  }),

  openCount: mailboxProcedure.query(async ({ ctx }) => {
    checkFeatureEnabled();
    const result = await db
      .select({
        count: count(issueGroups.id),
      })
      .from(issueGroups);

    return { count: result[0]?.count ?? 0 };
  }),

  // Pinned issues endpoints
  pinnedList: mailboxProcedure.input(z.object({ mailboxSlug: z.string() })).query(async ({ ctx }) => {
    checkFeatureEnabled();
    const userId = ctx.user.id;

    const pinnedGroups = await db
      .select({
        id: issueGroups.id,
        title: issueGroups.title,
        description: issueGroups.description,
        openCount: count(conversations.id),
      })
      .from(userPinnedIssueGroups)
      .innerJoin(issueGroups, eq(userPinnedIssueGroups.issueGroupId, issueGroups.id))
      .leftJoin(conversationIssueGroups, eq(issueGroups.id, conversationIssueGroups.issueGroupId))
      .leftJoin(
        conversations,
        and(
          eq(conversationIssueGroups.conversationId, conversations.id),
          eq(conversations.status, "open"),
          eq(conversations.mailboxId, ctx.mailbox.id),
        ),
      )
      .where(eq(userPinnedIssueGroups.userId, userId))
      .groupBy(issueGroups.id, userPinnedIssueGroups.createdAt)
      .orderBy(desc(userPinnedIssueGroups.createdAt))
      .limit(10);

    return { groups: pinnedGroups };
  }),

  pin: mailboxProcedure
    .input(z.object({ mailboxSlug: z.string(), id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      checkFeatureEnabled();
      const userId = ctx.user.id;

      // Check if issue group exists and belongs to this mailbox
      const group = await db
        .select({ id: issueGroups.id })
        .from(issueGroups)
        .innerJoin(conversationIssueGroups, eq(issueGroups.id, conversationIssueGroups.issueGroupId))
        .innerJoin(conversations, eq(conversationIssueGroups.conversationId, conversations.id))
        .where(and(eq(issueGroups.id, input.id), eq(conversations.mailboxId, ctx.mailbox.id)))
        .limit(1);

      if (group.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue group not found" });
      }

      // Insert or ignore if already pinned
      await db
        .insert(userPinnedIssueGroups)
        .values({
          userId,
          issueGroupId: input.id,
        })
        .onConflictDoNothing();

      return { success: true };
    }),

  unpin: mailboxProcedure
    .input(z.object({ mailboxSlug: z.string(), id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      checkFeatureEnabled();
      const userId = ctx.user.id;

      await db
        .delete(userPinnedIssueGroups)
        .where(and(eq(userPinnedIssueGroups.userId, userId), eq(userPinnedIssueGroups.issueGroupId, input.id)));

      return { success: true };
    }),
} satisfies TRPCRouterRecord;
