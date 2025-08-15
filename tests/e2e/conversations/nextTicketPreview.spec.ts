import { expect, test } from "@playwright/test";
import {
  CONVERSATION_LINKS_SELECTOR,
  ensureMinimumConversations,
  getTotalConversationCount,
  navigateToAnyConversation,
  setToggleState,
  waitForSettingSaved,
} from "../utils/conversationHelpers";

test.use({ storageState: "tests/e2e/.auth/user.json" });

test.describe("Next Ticket Preview", () => {

  test("should show Next Ticket Preview when enabled and multiple conversations exist", async ({ page }) => {
    // First ensure we have enough conversations for the test
    const conversationCount = await getTotalConversationCount(page);
    
    if (conversationCount < 2) {
      test.skip();
      return;
    }

    // Enable the setting
    await page.goto("/settings/preferences");
    await page.waitForLoadState("networkidle");
    
    // Wait for the settings to load
    await page.waitForSelector('text="Preferences"', { timeout: 10000 });
    
    // Enable Next Ticket Preview
    await setToggleState(
      page,
      'button[role="switch"][aria-label="Show Next Ticket Preview Switch"]',
      true
    );

    // Navigate to a conversation
    const hasConversation = await navigateToAnyConversation(page);
    expect(hasConversation).toBe(true);

    // Next Ticket Preview should be visible
    const nextTicketPreview = page.locator('h4:has-text("Next Ticket"), h4:has-text("First Ticket")').first();
    await expect(nextTicketPreview).toBeVisible({ timeout: 10000 });

    // Should have a Switch button
    const switchButton = page.locator('button:has-text("Switch to")');
    await expect(switchButton).toBeVisible();
    
    // Should show customer info
    const customerInfo = page.locator('[class*="text-muted"]').filter({ hasText: /@/ });
    await expect(customerInfo.first()).toBeVisible();
  });

  test("should not show Next Ticket Preview when disabled", async ({ page }) => {
    // Disable the setting
    await page.goto("/settings/preferences");
    await page.waitForLoadState("networkidle");
    
    // Wait for the settings to load
    await page.waitForSelector('text="Preferences"', { timeout: 10000 });
    
    // Disable Next Ticket Preview
    await setToggleState(
      page,
      'button[role="switch"][aria-label="Show Next Ticket Preview Switch"]',
      false
    );
    
    // Wait for the setting to be saved
    await waitForSettingSaved(page);

    // Navigate to a conversation
    const hasConversation = await navigateToAnyConversation(page);
    
    if (!hasConversation) {
      test.skip();
      return;
    }

    // Next Ticket Preview should NOT be visible
    const nextTicketPreview = page.locator('h4:has-text("Next Ticket"), h4:has-text("First Ticket")');
    await expect(nextTicketPreview).not.toBeVisible();
    
    // Switch button should NOT be visible
    const switchButton = page.locator('button:has-text("Switch to")');
    await expect(switchButton).not.toBeVisible();
  });

  test("should navigate to next conversation when Switch button is clicked", async ({ page }) => {
    // First ensure we have enough conversations
    await ensureMinimumConversations(page, 2);

    // Enable the feature
    await page.goto("/settings/preferences");
    await page.waitForLoadState("networkidle");
    
    // Wait for the settings to load
    await page.waitForSelector('text="Preferences"', { timeout: 10000 });
    
    // Enable Next Ticket Preview
    await setToggleState(
      page,
      'button[role="switch"][aria-label="Show Next Ticket Preview Switch"]',
      true
    );

    // Navigate to first conversation
    const hasConversation = await navigateToAnyConversation(page);
    expect(hasConversation).toBe(true);

    // Get initial URL
    const initialUrl = page.url();
    
    // Wait for Next Ticket Preview to load
    const nextTicketPreview = page.locator('h4:has-text("Next Ticket"), h4:has-text("First Ticket")').first();
    await expect(nextTicketPreview).toBeVisible({ timeout: 10000 });

    // Click Switch button
    const switchButton = page.locator('button:has-text("Switch to")');
    await expect(switchButton).toBeVisible();
    await switchButton.click();

    // Should briefly show "Switching..." text
    const switchingButton = page.locator('button:has-text("Switching...")');
    // Don't fail if we miss the brief state change
    await switchingButton.waitFor({ state: "visible", timeout: 500 }).catch(() => {});

    // Wait for navigation
    await page.waitForLoadState("networkidle");
    
    // URL should have changed
    await page.waitForURL((url) => url.toString() !== initialUrl, { timeout: 5000 });
    
    const newUrl = page.url();
    expect(newUrl).not.toBe(initialUrl);
    expect(newUrl).toMatch(/\/(mine|unassigned|all|assigned)\?id=/);
  });

  test("should not show Next Ticket Preview with only one conversation", async ({ page }) => {
    const conversationCount = await getTotalConversationCount(page);
    
    // Skip test if we have multiple conversations (can't test this scenario)
    if (conversationCount > 1) {
      test.skip();
      return;
    }

    // Enable the setting
    await page.goto("/settings/preferences");
    await page.waitForLoadState("networkidle");
    
    // Wait for the settings to load
    await page.waitForSelector('text="Preferences"', { timeout: 10000 });
    
    // Enable Next Ticket Preview
    await setToggleState(
      page,
      'button[role="switch"][aria-label="Show Next Ticket Preview Switch"]',
      true
    );

    // Navigate to the single conversation
    const hasConversation = await navigateToAnyConversation(page);
    
    if (!hasConversation) {
      test.skip();
      return;
    }

    // Next Ticket Preview should NOT be visible (only one conversation)
    const nextTicketPreview = page.locator('h4:has-text("Next Ticket"), h4:has-text("First Ticket")');
    await expect(nextTicketPreview).not.toBeVisible();
  });
});