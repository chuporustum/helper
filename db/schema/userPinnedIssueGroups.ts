import { relations } from "drizzle-orm";
import { bigint, pgTable, text, unique } from "drizzle-orm/pg-core";
import { withTimestamps } from "../lib/with-timestamps";
import { issueGroups } from "./issueGroups";
import { userProfiles } from "./userProfiles";

export const userPinnedIssueGroups = pgTable(
  "user_pinned_issue_groups",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text().notNull(),
    issueGroupId: bigint({ mode: "number" }).notNull(),
  },
  (table) => [unique("user_pinned_issue_groups_user_id_issue_group_id_key").on(table.userId, table.issueGroupId)],
).enableRLS();

export const userPinnedIssueGroupsRelations = relations(userPinnedIssueGroups, ({ one }) => ({
  user: one(userProfiles, {
    fields: [userPinnedIssueGroups.userId],
    references: [userProfiles.id],
  }),
  issueGroup: one(issueGroups, {
    fields: [userPinnedIssueGroups.issueGroupId],
    references: [issueGroups.id],
  }),
}));
