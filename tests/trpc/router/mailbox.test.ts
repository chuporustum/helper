import { conversationFactory } from "@tests/support/factories/conversations";
import { userFactory } from "@tests/support/factories/users";
import { createTestTRPCContext } from "@tests/support/trpcUtils";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { mailboxes } from "@/db/schema";
import { getMailboxInfo } from "@/lib/data/mailbox";
import { UserRoles } from "@/lib/data/user";
import { createCaller } from "@/trpc";

vi.mock("@/lib/data/user", () => ({
  UserRoles: {
    CORE: "core",
    NON_CORE: "nonCore",
    AFK: "afk",
    ADMIN: "admin",
  },
  updateUserMailboxData: vi.fn(),
  getUsersWithMailboxAccess: vi.fn(),
}));

describe("mailboxRouter", () => {
  describe("update", () => {
    it("updates slack settings", async () => {
      const { user, mailbox } = await userFactory.createRootUser();

      const caller = createCaller(createTestTRPCContext(user));

      const promptUpdatedAtBefore = mailbox.promptUpdatedAt;

      const updateData = {
        slackAlertChannel: "#another-channel",
      };

      await caller.mailbox.update({ mailboxSlug: mailbox.slug, ...updateData });

      const updatedMailbox = await db.query.mailboxes.findFirst({
        where: eq(mailboxes.id, mailbox.id),
      });

      expect(updatedMailbox).toMatchObject(updateData);
      expect(updatedMailbox?.promptUpdatedAt).toEqual(promptUpdatedAtBefore);
    });
  });

  describe("members", () => {
    it("returns a list of mailbox members", async () => {
      const { user, mailbox } = await userFactory.createRootUser();

      const user2 = await userFactory.createUser();
      const { conversation: conversation1 } = await conversationFactory.create(mailbox.id);
      await conversationFactory.createStaffEmail(conversation1.id, user2.id);
      await conversationFactory.createStaffEmail(conversation1.id, user2.id);

      const user3 = await userFactory.createUser();
      const { conversation: conversation2 } = await conversationFactory.create(mailbox.id);
      await conversationFactory.createStaffEmail(conversation2.id, user3.id);

      const caller = createCaller(createTestTRPCContext(user));

      const result = await caller.mailbox.members.stats({ mailboxSlug: mailbox.slug, period: "1y" });

      expect(result.sort((a, b) => a.replyCount - b.replyCount)).toEqual([
        {
          id: user.id,
          email: user.email,
          displayName: user.email,
          replyCount: 0,
          role: UserRoles.AFK,
        },
        {
          id: user3.id,
          email: user3.email,
          displayName: user3.email,
          replyCount: 1,
          role: UserRoles.AFK,
        },
        {
          id: user2.id,
          email: user2.email,
          displayName: user2.email,
          replyCount: 2,
          role: UserRoles.AFK,
        },
      ]);
    });
  });
  describe("get", () => {
    it("returns info for the requested mailbox", async () => {
      const { user, mailbox } = await userFactory.createRootUser();

      const caller = createCaller(createTestTRPCContext(user));

      expect(await caller.mailbox.get({ mailboxSlug: mailbox.slug })).toEqual(await getMailboxInfo(mailbox));
    });
  });
});
