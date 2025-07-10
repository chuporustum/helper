#!/usr/bin/env tsx
/**
 * Demo script showing the difference between old and new clustering approaches
 * This version shows expected results without requiring AI API calls
 */

// Sample support conversations
const TEST_CONVERSATIONS = [
  // 2FA/Authentication Issues
  { id: 1, subject: "Can't login to my account", issue: "Not receiving 2FA SMS code" },
  { id: 2, subject: "Login problem - no SMS", issue: "2FA SMS not arriving" },
  { id: 3, subject: "Authentication issue", issue: "Two-factor SMS never arrives" },

  // Password reset issues
  { id: 4, subject: "Password reset not working", issue: "Password reset email not received" },
  { id: 5, subject: "No password reset email", issue: "Reset email not arriving" },

  // Specific payment errors
  { id: 6, subject: "Payment failed", issue: "Credit card declined - error 402" },
  { id: 7, subject: "Card declined error 402", issue: "Error 402 on payment" },
  { id: 8, subject: "Payment error", issue: "Error 503 - service unavailable" },

  // Subscription issues
  { id: 9, subject: "Subscription didn't renew", issue: "Auto-renewal failed silently" },
  { id: 10, subject: "Auto renewal failed", issue: "Subscription renewal failed without error" },

  // Download issues
  { id: 11, subject: "Can't download receipts", issue: "PDF downloads fail in browser" },
  { id: 12, subject: "Download problem", issue: "Cannot download PDF files" },

  // Video playback
  { id: 13, subject: "Video issues", issue: "Video stops after 30 seconds" },
  { id: 14, subject: "Playback problem", issue: "Video freezes at 30 second mark" },
];

interface ClusterResult {
  title: string;
  conversations: number[];
  exampleIssues: string[];
}

// OLD APPROACH: General categories with 0.85 similarity threshold
const OLD_APPROACH_CLUSTERS: ClusterResult[] = [
  {
    title: "Login & Authentication Issues",
    conversations: [1, 2, 3, 4, 5], // Groups ALL auth-related issues
    exampleIssues: ["Not receiving 2FA SMS code", "Password reset email not received"],
  },
  {
    title: "Payment Processing Problems",
    conversations: [6, 7, 8], // Groups ALL payment issues regardless of error
    exampleIssues: ["Credit card declined - error 402", "Error 503 - service unavailable"],
  },
  {
    title: "Account & Subscription Issues",
    conversations: [9, 10], // Generic grouping
    exampleIssues: ["Auto-renewal failed silently"],
  },
  {
    title: "Download & Media Issues",
    conversations: [11, 12, 13, 14], // Combines different types of media issues
    exampleIssues: ["PDF downloads fail", "Video stops after 30 seconds"],
  },
];

// NEW APPROACH: Specific problems with 0.92 similarity threshold
const NEW_APPROACH_CLUSTERS: ClusterResult[] = [
  {
    title: "Cannot receive 2FA SMS codes",
    conversations: [1, 2, 3], // Only 2FA SMS issues
    exampleIssues: ["Not receiving 2FA SMS code", "2FA SMS not arriving"],
  },
  {
    title: "Password reset email not arriving",
    conversations: [4, 5], // Only password reset email issues
    exampleIssues: ["Password reset email not received", "Reset email not arriving"],
  },
  {
    title: "Credit card declined error 402",
    conversations: [6, 7], // Specific error code
    exampleIssues: ["Credit card declined - error 402", "Error 402 on payment"],
  },
  {
    title: "Payment service error 503",
    conversations: [8], // Different error = different cluster
    exampleIssues: ["Error 503 - service unavailable"],
  },
  {
    title: "Subscription auto-renewal failing silently",
    conversations: [9, 10], // Specific issue
    exampleIssues: ["Auto-renewal failed silently", "Subscription renewal failed without error"],
  },
  {
    title: "PDF downloads failing in browser",
    conversations: [11, 12], // PDF-specific issues
    exampleIssues: ["PDF downloads fail in browser", "Cannot download PDF files"],
  },
  {
    title: "Video stops playing after 30 seconds",
    conversations: [13, 14], // Video-specific issues
    exampleIssues: ["Video stops after 30 seconds", "Video freezes at 30 second mark"],
  },
];

function printResults() {
  console.log("🧪 Issue Group Clustering Comparison\n");
  console.log(`${"=".repeat(70)}\n`);

  // Old approach
  console.log("📊 OLD APPROACH (General Categories, Threshold: 0.85)");
  console.log("━".repeat(70));
  console.log(`Total Clusters: ${OLD_APPROACH_CLUSTERS.length}`);
  console.log(
    `Average Cluster Size: ${(TEST_CONVERSATIONS.length / OLD_APPROACH_CLUSTERS.length).toFixed(1)} conversations\n`,
  );

  OLD_APPROACH_CLUSTERS.forEach((cluster, i) => {
    console.log(`${i + 1}. "${cluster.title}"`);
    console.log(`   📍 ${cluster.conversations.length} conversations: [${cluster.conversations.join(", ")}]`);
    console.log(`   📝 Includes: ${cluster.exampleIssues.join(" | ")}`);
    console.log();
  });

  // New approach
  console.log("\n📊 NEW APPROACH (Specific Problems, Threshold: 0.92)");
  console.log("━".repeat(70));
  console.log(`Total Clusters: ${NEW_APPROACH_CLUSTERS.length}`);
  console.log(
    `Average Cluster Size: ${(TEST_CONVERSATIONS.length / NEW_APPROACH_CLUSTERS.length).toFixed(1)} conversations\n`,
  );

  NEW_APPROACH_CLUSTERS.forEach((cluster, i) => {
    console.log(`${i + 1}. "${cluster.title}"`);
    console.log(`   📍 ${cluster.conversations.length} conversations: [${cluster.conversations.join(", ")}]`);
    console.log(`   📝 Includes: ${cluster.exampleIssues.join(" | ")}`);
    console.log();
  });

  // Analysis
  console.log("\n🔍 ANALYSIS");
  console.log("━".repeat(70));

  console.log("\n✅ Key Improvements:");
  console.log("1. **More Specific Titles**: 'Cannot receive 2FA SMS codes' vs 'Login & Authentication Issues'");
  console.log("2. **Better Separation**: Password reset emails separated from 2FA issues");
  console.log("3. **Error Code Grouping**: Error 402 and 503 in separate clusters");
  console.log("4. **Actionable Groups**: Each cluster represents a specific problem agents can bulk-handle");
  console.log("5. **Clear Problem Identification**: Titles immediately tell agents what the issue is");

  console.log("\n📊 Metrics Comparison:");
  console.log(
    `• Cluster Count: ${OLD_APPROACH_CLUSTERS.length} → ${NEW_APPROACH_CLUSTERS.length} (+${NEW_APPROACH_CLUSTERS.length - OLD_APPROACH_CLUSTERS.length})`,
  );
  console.log(
    `• Avg Size: ${(TEST_CONVERSATIONS.length / OLD_APPROACH_CLUSTERS.length).toFixed(1)} → ${(TEST_CONVERSATIONS.length / NEW_APPROACH_CLUSTERS.length).toFixed(1)} conversations`,
  );
  console.log(`• Specificity: Low → High`);
  console.log(`• Actionability: Generic → Specific bulk actions possible`);

  console.log("\n💡 Example Use Cases:");
  console.log("• **Old**: 'Login & Authentication Issues' - Agent doesn't know if it's 2FA, password, or account lock");
  console.log("• **New**: 'Cannot receive 2FA SMS codes' - Agent knows exactly what to check and fix");
  console.log("\n• **Old**: 'Payment Processing Problems' - Could be any payment issue");
  console.log("• **New**: 'Credit card declined error 402' - Agent knows it's insufficient funds issue");

  console.log("\n🎯 Result: Support agents can now handle groups of IDENTICAL issues efficiently!");
}

printResults();
