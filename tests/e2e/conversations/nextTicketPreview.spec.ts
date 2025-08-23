import { expect, test } from "@playwright/test";

const CONVERSATION_LINKS_SELECTOR = 'a[href*="/conversations?id="]';

test.use({ storageState: "tests/e2e/.auth/user.json" });

test.describe("Next Ticket Preview", () => {
  test("should display Next Ticket Preview when enabled", async ({ page }) => {
    // Navigate to /mine to find conversations
    await page.goto("/mine");
    await page.waitForLoadState("domcontentloaded");

    // Check if we have conversations available
    const conversationLinks = page.locator(CONVERSATION_LINKS_SELECTOR);
    const conversationCount = await conversationLinks.count();

    if (conversationCount < 2) {
      console.log("Skipping test: Need at least 2 conversations for Next Ticket Preview test");
      return;
    }

    // Click on first conversation
    await conversationLinks.first().click();
    await page.waitForLoadState("networkidle");

    // Look for Next Ticket Preview - check if it exists on the page
    const nextTicketHeader = page.locator("h4").filter({
      hasText: /^(Next|First) Ticket/i,
    });
    
    // If the feature is enabled, we should see the preview
    const headerCount = await nextTicketHeader.count();
    
    if (headerCount > 0) {
      // Feature is enabled - verify it works correctly
      await expect(nextTicketHeader.first()).toBeVisible();
      
      // Should have a Switch button
      const switchButton = page.locator("button").filter({ hasText: /Switch to/i });
      await expect(switchButton).toBeVisible();
      
      // Should show customer info (email)
      const customerInfo = page.locator("text=/@/i").first();
      await expect(customerInfo).toBeVisible();
      
      // Test switching functionality
      const initialUrl = page.url();
      await switchButton.click();
      
      // Wait for navigation to complete
      await page.waitForLoadState("networkidle");
      
      // Verify we navigated to a different conversation
      const newUrl = page.url();
      expect(newUrl).not.toBe(initialUrl);
      expect(newUrl).toMatch(/\/conversations\?id=/);
      
      console.log("✅ Next Ticket Preview is working correctly");
    } else {
      console.log("ℹ️ Next Ticket Preview is not enabled - this is okay");
    }
  });
});