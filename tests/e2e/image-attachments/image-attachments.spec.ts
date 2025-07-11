import { expect, test } from "@playwright/test";

test.describe("Image Attachments E2E", () => {
  test("should upload and attach images in chat widget", async ({ page }) => {
    // Navigate to the chat widget settings page
    await page.goto("/mailboxes/gumroad/settings/chat");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // First, ensure the chat widget is enabled by checking the switch
    const chatVisibilitySection = page.locator('text="Chat Icon Visibility"').locator("..");
    const chatSwitch = chatVisibilitySection.locator('button[role="switch"]');

    // Check if the switch is already enabled, if not, click it
    const switchState = await chatSwitch.getAttribute("data-state");
    if (switchState === "unchecked") {
      await chatSwitch.click();
      await page.waitForTimeout(2000);
    }

    // Now look for the widget icon that should appear after enabling
    const widgetIcon = page.locator(".helper-widget-icon");
    await expect(widgetIcon).toBeVisible({ timeout: 15000 });

    // Click to open the widget
    await widgetIcon.click();
    await page.waitForTimeout(2000);

    // Now find the chat input - it should be visible after opening the widget
    const chatInput = page.locator('textarea[aria-label="Ask a question"]');
    await expect(chatInput).toBeVisible({ timeout: 15000 });

    // Find the attachment button (paperclip icon)
    const attachButton = page.locator('label[aria-label="Attach images"]');
    await expect(attachButton).toBeVisible();

    // Create a small test image file
    const imageBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "base64",
    );

    // Upload the image file via the hidden file input
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles({
      name: "test-image.png",
      mimeType: "image/png",
      buffer: imageBuffer,
    });

    // Wait a moment for the file to be processed
    await page.waitForTimeout(1000);

    // Verify the attachment appears in the preview
    // Look for the filename in the attachment preview
    await expect(page.getByText("test-image.png")).toBeVisible({ timeout: 5000 });

    // Type a message
    await chatInput.fill("Here is an image attachment for testing");

    // Submit the message
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Verify the message was sent - look for the message content in the conversation
    await expect(page.getByText("Here is an image attachment for testing")).toBeVisible({ timeout: 15000 });

    console.log("✅ Image attachment uploaded and message sent successfully");
  });

  test("should support multiple image formats", async ({ page }) => {
    // Navigate to the chat widget settings page
    await page.goto("/mailboxes/gumroad/settings/chat");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // First, ensure the chat widget is enabled by checking the switch
    const chatVisibilitySection = page.locator('text="Chat Icon Visibility"').locator("..");
    const chatSwitch = chatVisibilitySection.locator('button[role="switch"]');

    // Check if the switch is already enabled, if not, click it
    const switchState = await chatSwitch.getAttribute("data-state");
    if (switchState === "unchecked") {
      await chatSwitch.click();
      await page.waitForTimeout(2000);
    }

    // Now look for the widget icon that should appear after enabling
    const widgetIcon = page.locator(".helper-widget-icon");
    await expect(widgetIcon).toBeVisible({ timeout: 15000 });

    // Click to open the widget
    await widgetIcon.click();
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea[aria-label="Ask a question"]');
    await expect(chatInput).toBeVisible({ timeout: 15000 });

    // Test PNG format
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "base64",
    );

    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: pngBuffer,
    });

    // Verify PNG appears
    await expect(page.getByText("test.png")).toBeVisible({ timeout: 5000 });

    // Test JPEG format
    const jpegBuffer = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
      "base64",
    );

    await fileInput.setInputFiles({
      name: "test.jpg",
      mimeType: "image/jpeg",
      buffer: jpegBuffer,
    });

    // Verify JPEG appears
    await expect(page.getByText("test.jpg")).toBeVisible({ timeout: 5000 });

    // Send message with multiple formats
    await chatInput.fill("Testing multiple image formats");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("Testing multiple image formats")).toBeVisible({ timeout: 15000 });

    console.log("✅ Multiple image formats supported");
  });
});
