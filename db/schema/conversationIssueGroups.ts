import { relations } from "drizzle-orm";
import { bigint, index, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { issueGroups } from "./issueGroups";

export const conversationIssueGroups = pgTable(
  "conversation_issue_groups",
  {
    conversationId: bigint({ mode: "number" }).notNull(),
    issueGroupId: bigint({ mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.issueGroupId] }),
    index("conversation_issue_groups_conversation_id_idx").on(table.conversationId),
    index("conversation_issue_groups_issue_group_id_idx").on(table.issueGroupId),
  ],
).enableRLS();

export const conversationIssueGroupsRelations = relations(conversationIssueGroups, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationIssueGroups.conversationId],
    references: [conversations.id],
  }),
  issueGroup: one(issueGroups, {
    fields: [conversationIssueGroups.issueGroupId],
    references: [issueGroups.id],
  }),
}));
