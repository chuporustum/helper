import { expect, type Page } from "@playwright/test";

// Standard selector for conversation links across all tests
export const CONVERSATION_LINKS_SELECTOR = 'a[href*="/conversations?id="]';

/**
 * Navigate to a conversation, handling cases where there might be no conversations
 * in /mine and checking /unassigned as fallback
 */
export async function navigateToAnyConversation(page: Page): Promise<boolean> {
  // Try /mine first
  await page.goto("/mine");
  await page.waitForLoadState("networkidle");
  
  let conversationLinks = page.locator(CONVERSATION_LINKS_SELECTOR);
  let count = await conversationLinks.count();
  
  if (count === 0) {
    // Try /unassigned
    await page.goto("/unassigned");
    await page.waitForLoadState("networkidle");
    
    conversationLinks = page.locator(CONVERSATION_LINKS_SELECTOR);
    count = await conversationLinks.count();
  }
  
  if (count > 0) {
    await conversationLinks.first().click();
    await page.waitForLoadState("networkidle");
    return true;
  }
  
  return false;
}

/**
 * Get the count of conversations, checking both /mine and /unassigned
 */
export async function getTotalConversationCount(page: Page): Promise<number> {
  // Check /mine
  await page.goto("/mine");
  await page.waitForLoadState("networkidle");
  
  const mineCount = await page.locator(CONVERSATION_LINKS_SELECTOR).count();
  
  // Check /unassigned
  await page.goto("/unassigned");
  await page.waitForLoadState("networkidle");
  
  const unassignedCount = await page.locator(CONVERSATION_LINKS_SELECTOR).count();
  
  return mineCount + unassignedCount;
}

/**
 * Ensure we have at least N conversations available for testing
 */
export async function ensureMinimumConversations(page: Page, minimum: number): Promise<void> {
  const total = await getTotalConversationCount(page);
  
  if (total < minimum) {
    throw new Error(
      `Test requires at least ${minimum} conversations but only ${total} found. ` +
      `Please ensure test data is properly seeded.`
    );
  }
}

/**
 * Wait for a setting to be saved (looking for save indicator to appear and disappear)
 */
export async function waitForSettingSaved(page: Page) {
  // Wait for saving indicator to appear
  const savingIndicator = page.locator('text="Saving"');
  await savingIndicator.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
  
  // Wait for it to disappear (save complete)
  await savingIndicator.waitFor({ state: "hidden", timeout: 5000 });
}

/**
 * Enable or disable a setting toggle
 */
export async function setToggleState(
  page: Page, 
  toggleSelector: string, 
  enabled: boolean
): Promise<void> {
  const toggle = page.locator(toggleSelector).first();
  await expect(toggle).toBeVisible({ timeout: 10000 });
  
  const currentState = await toggle.getAttribute("data-state");
  const isCurrentlyChecked = currentState === "checked";
  
  if (isCurrentlyChecked !== enabled) {
    await toggle.click();
    await waitForSettingSaved(page);
    
    // Verify the state changed
    const newState = await toggle.getAttribute("data-state");
    const isNowChecked = newState === "checked";
    expect(isNowChecked).toBe(enabled);
  }
}