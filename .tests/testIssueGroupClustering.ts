#!/usr/bin/env tsx
/**
 * Test script to compare current vs proposed issue group clustering approaches
 * This helps validate that our changes produce more specific, actionable groups
 */
import { cosineSimilarity } from "ai";
import { generateCompletion, generateEmbedding, GPT_4O_MINI_MODEL } from "@/lib/ai/core";

// Sample support conversations representing common scenarios
const TEST_CONVERSATIONS = [
  // 2FA/Authentication Issues (should cluster together with new approach)
  {
    id: 1,
    subject: "Can't login to my account",
    messages: [
      { role: "user", text: "I'm trying to login but I'm not receiving the 2FA code via SMS" },
      { role: "agent", text: "I can help you with that. Are you sure your phone number is correct?" },
      { role: "user", text: "Yes, it's the same number I've always used" },
      { role: "agent", text: "Let me resend the code. Please check your SMS now." },
    ],
  },
  {
    id: 2,
    subject: "Login problem - no SMS",
    messages: [
      { role: "user", text: "The 2FA SMS isn't coming through when I try to sign in" },
      { role: "agent", text: "I'll help you resolve this. Can you confirm your phone number?" },
      { role: "user", text: "It's correct, I checked multiple times" },
      { role: "agent", text: "I've triggered a new SMS code. It should arrive shortly." },
    ],
  },
  {
    id: 3,
    subject: "Authentication issue",
    messages: [
      { role: "user", text: "I need help, the two-factor authentication SMS never arrives" },
      { role: "agent", text: "Sorry to hear that. Let me check your account settings." },
      { role: "user", text: "I've been waiting for 10 minutes" },
      { role: "agent", text: "I've manually sent a new code. Please check now." },
    ],
  },

  // Password reset email issues (should cluster together)
  {
    id: 4,
    subject: "Password reset not working",
    messages: [
      { role: "user", text: "I requested a password reset but the email never came" },
      { role: "agent", text: "Let me check if the email was sent. What email address?" },
      { role: "user", text: "john@example.com - I've checked spam too" },
      { role: "agent", text: "I see the issue. I'm resending the password reset email now." },
    ],
  },
  {
    id: 5,
    subject: "No password reset email",
    messages: [
      { role: "user", text: "The password reset email isn't arriving in my inbox" },
      { role: "agent", text: "I'll investigate this. Have you checked your spam folder?" },
      { role: "user", text: "Yes, nothing there either" },
      { role: "agent", text: "I've sent a new password reset link. Check your email." },
    ],
  },

  // Specific payment errors (should cluster by error code)
  {
    id: 6,
    subject: "Payment failed",
    messages: [
      { role: "user", text: "My credit card was declined with error code 402" },
      { role: "agent", text: "Error 402 indicates insufficient funds. Can you try another card?" },
      { role: "user", text: "But I have money in my account" },
      { role: "agent", text: "Sometimes banks flag transactions. Contact your bank to approve it." },
    ],
  },
  {
    id: 7,
    subject: "Card declined error 402",
    messages: [
      { role: "user", text: "Getting error 402 when trying to pay with my card" },
      { role: "agent", text: "This error means the payment was declined by your bank." },
      { role: "user", text: "What should I do?" },
      { role: "agent", text: "Please contact your bank or try a different payment method." },
    ],
  },

  // Different payment error (should NOT cluster with 402 errors)
  {
    id: 8,
    subject: "Payment error",
    messages: [
      { role: "user", text: "My payment fails with error 503 - service unavailable" },
      { role: "agent", text: "Error 503 is a temporary server issue. Please try again in a few minutes." },
      { role: "user", text: "I've tried 3 times already" },
      { role: "agent", text: "Our payment system is experiencing issues. It should be resolved soon." },
    ],
  },

  // Subscription renewal issues
  {
    id: 9,
    subject: "Subscription didn't renew",
    messages: [
      { role: "user", text: "My subscription was supposed to auto-renew but it didn't happen" },
      { role: "agent", text: "Let me check your subscription status." },
      { role: "user", text: "It just expired without any notification" },
      { role: "agent", text: "I see the renewal failed silently. I'll manually renew it for you." },
    ],
  },
  {
    id: 10,
    subject: "Auto renewal failed",
    messages: [
      { role: "user", text: "The automatic renewal of my subscription failed without any error" },
      { role: "agent", text: "I apologize for this issue. Checking your account now." },
      { role: "user", text: "I only noticed when I lost access" },
      { role: "agent", text: "The renewal failed due to a system issue. I'm fixing it now." },
    ],
  },
];

// Old embedding prompt (general categories)
const OLD_EMBEDDING_PROMPT = `You will be given a support conversation between a customer and a support agent. Your task is to summarize this conversation while removing any sensitive or personally identifiable information. 

Follow these steps to create the summary:
1. Extract specific details: product names, purchase information, account details, transaction data
2. Identify the main question or issue the customer was experiencing
3. Determine the solution or resolution provided by the support agent
4. Remove any specific names, email addresses, amounts, phone numbers, account numbers, or other personally identifiable information

Format your response as:
Summary: [Your summary here focusing on concrete details]
Agent Action: [Action taken by agent, if any]
User Action: [Action needed from user, if any]`;

// New embedding prompt (specific problems)
const NEW_EMBEDDING_PROMPT = `You will be given a support conversation between a customer and a support agent. Your task is to extract the SPECIFIC problem and create a summary for clustering similar issues.

CRITICAL: Focus on the EXACT, SPECIFIC problem - not general categories.

Good examples of specific problems:
- "Cannot receive 2FA SMS code"
- "Credit card declined with error 402"
- "Password reset email not arriving"

Follow these steps:
1. Identify the SPECIFIC problem or error the customer reported
2. Extract any error messages, codes, or specific symptoms
3. Note the exact action the user was trying to perform
4. Capture the specific resolution or workaround provided

Format your response as:
Problem: [Specific issue in 5-10 words]
Details: [Technical details and symptoms]
Solution: [Specific resolution]
Action: [Required action to fix]`;

// Old title prompt (general categories)
const OLD_TITLE_PROMPT = `You are tasked with generating a concise, categorical title for a group of similar support conversations. 

Create a title that:
1. Describes the general category/type of issue
2. Is 2-6 words long
3. Represents what multiple similar conversations would be about

Examples: "Login & Authentication Issues", "Payment Processing Problems", "Account Access Problems"

Return ONLY the title, nothing else.`;

// New title prompt (specific issues)
const NEW_TITLE_PROMPT = `You are generating a title for a group of SIMILAR, SPECIFIC issues that support agents will handle together.

CRITICAL: Create SPECIFIC, ACTIONABLE titles that describe the EXACT problem - not general categories.

Examples of GOOD specific titles:
- "Cannot receive 2FA SMS codes"
- "Password reset email not arriving"
- "Credit card declined error 402"

The summary will contain a "Problem:" line - use this as the basis for your title.

Return ONLY the title, nothing else.`;

interface ClusteringResult {
  approach: string;
  clusters: {
    title: string;
    conversationIds: number[];
    samples: string[];
  }[];
  totalClusters: number;
  averageClusterSize: number;
  specificity: "high" | "medium" | "low";
}

async function generateEmbeddingForConversation(
  conversation: (typeof TEST_CONVERSATIONS)[0],
  systemPrompt: string,
): Promise<{ embedding: number[]; text: string }> {
  const messagesFormatted = conversation.messages
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.text}`)
    .join("\n");

  const prompt = `Conversation:\n${messagesFormatted}`;

  const { text } = await generateCompletion({
    system: systemPrompt,
    prompt,
    functionId: "test-embedding-generation",
    model: GPT_4O_MINI_MODEL,
  });

  const embedding = await generateEmbedding(text, "test-embedding", { skipCache: true });

  return { embedding, text };
}

async function clusterConversations(
  embeddings: { id: number; embedding: number[]; text: string }[],
  threshold: number,
  titlePrompt: string,
): Promise<ClusteringResult["clusters"]> {
  const clusters: {
    title: string;
    conversationIds: number[];
    samples: string[];
    embedding: number[];
  }[] = [];

  for (const conv of embeddings) {
    let bestMatch: { index: number; similarity: number } | null = null;

    // Find best matching cluster
    for (let i = 0; i < clusters.length; i++) {
      const similarity = cosineSimilarity(conv.embedding, clusters[i].embedding);
      if (similarity >= threshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { index: i, similarity };
        }
      }
    }

    if (bestMatch) {
      // Add to existing cluster
      clusters[bestMatch.index].conversationIds.push(conv.id);
      clusters[bestMatch.index].samples.push(conv.text);
    } else {
      // Create new cluster
      const { text: title } = await generateCompletion({
        system: titlePrompt,
        prompt: conv.text,
        functionId: "test-title-generation",
        model: GPT_4O_MINI_MODEL,
      });

      clusters.push({
        title: title.trim().replace(/^["']|["']$/g, ""),
        conversationIds: [conv.id],
        samples: [conv.text],
        embedding: conv.embedding,
      });
    }
  }

  return clusters.map(({ title, conversationIds, samples }) => ({
    title,
    conversationIds,
    samples: samples.slice(0, 2), // Keep first 2 samples
  }));
}

function evaluateSpecificity(clusters: ClusteringResult["clusters"]): "high" | "medium" | "low" {
  const genericTerms = ["issues", "problems", "questions", "help", "support", "general", "various", "multiple"];
  const specificTerms = ["error", "cannot", "failed", "not working", "404", "402", "503", "SMS", "email", "code"];

  let genericCount = 0;
  let specificCount = 0;

  for (const cluster of clusters) {
    const titleLower = cluster.title.toLowerCase();
    genericCount += genericTerms.filter((term) => titleLower.includes(term)).length;
    specificCount += specificTerms.filter((term) => titleLower.includes(term)).length;
  }

  const ratio = specificCount / (genericCount + specificCount);
  if (ratio > 0.7) return "high";
  if (ratio > 0.3) return "medium";
  return "low";
}

async function runClusteringTest(): Promise<void> {
  console.log("🧪 Testing Issue Group Clustering Approaches\n");
  console.log("=" * 50);

  // Test old approach
  console.log("\n📊 OLD APPROACH (General Categories)");
  console.log("Similarity Threshold: 0.85");
  console.log("Generating embeddings...");

  const oldEmbeddings = await Promise.all(
    TEST_CONVERSATIONS.map((conv) =>
      generateEmbeddingForConversation(conv, OLD_EMBEDDING_PROMPT).then((result) => ({ id: conv.id, ...result })),
    ),
  );

  const oldClusters = await clusterConversations(oldEmbeddings, 0.85, OLD_TITLE_PROMPT);
  const oldResult: ClusteringResult = {
    approach: "Old (General Categories)",
    clusters: oldClusters,
    totalClusters: oldClusters.length,
    averageClusterSize: TEST_CONVERSATIONS.length / oldClusters.length,
    specificity: evaluateSpecificity(oldClusters),
  };

  console.log("\n📈 OLD APPROACH RESULTS:");
  console.log(`Total Clusters: ${oldResult.totalClusters}`);
  console.log(`Average Cluster Size: ${oldResult.averageClusterSize.toFixed(1)}`);
  console.log(`Specificity: ${oldResult.specificity}`);
  console.log("\nClusters:");
  oldResult.clusters.forEach((cluster, i) => {
    console.log(`\n${i + 1}. "${cluster.title}" (${cluster.conversationIds.length} conversations)`);
    console.log(`   IDs: ${cluster.conversationIds.join(", ")}`);
  });

  // Test new approach
  console.log("\n\n📊 NEW APPROACH (Specific Problems)");
  console.log("Similarity Threshold: 0.92");
  console.log("Generating embeddings...");

  const newEmbeddings = await Promise.all(
    TEST_CONVERSATIONS.map((conv) =>
      generateEmbeddingForConversation(conv, NEW_EMBEDDING_PROMPT).then((result) => ({ id: conv.id, ...result })),
    ),
  );

  const newClusters = await clusterConversations(newEmbeddings, 0.92, NEW_TITLE_PROMPT);
  const newResult: ClusteringResult = {
    approach: "New (Specific Problems)",
    clusters: newClusters,
    totalClusters: newClusters.length,
    averageClusterSize: TEST_CONVERSATIONS.length / newClusters.length,
    specificity: evaluateSpecificity(newClusters),
  };

  console.log("\n📈 NEW APPROACH RESULTS:");
  console.log(`Total Clusters: ${newResult.totalClusters}`);
  console.log(`Average Cluster Size: ${newResult.averageClusterSize.toFixed(1)}`);
  console.log(`Specificity: ${newResult.specificity}`);
  console.log("\nClusters:");
  newResult.clusters.forEach((cluster, i) => {
    console.log(`\n${i + 1}. "${cluster.title}" (${cluster.conversationIds.length} conversations)`);
    console.log(`   IDs: ${cluster.conversationIds.join(", ")}`);
  });

  // Comparison
  console.log("\n\n🔍 COMPARISON ANALYSIS");
  console.log("=" * 50);
  console.log(`\nCluster Count:`);
  console.log(`  Old: ${oldResult.totalClusters} clusters (broader groups)`);
  console.log(`  New: ${newResult.totalClusters} clusters (more specific groups)`);
  console.log(
    `  Change: ${(((newResult.totalClusters - oldResult.totalClusters) / oldResult.totalClusters) * 100).toFixed(0)}% more clusters`,
  );

  console.log(`\nSpecificity:`);
  console.log(`  Old: ${oldResult.specificity}`);
  console.log(`  New: ${newResult.specificity}`);

  console.log(`\nActionability:`);
  const oldActionable = oldResult.clusters.filter(
    (c) =>
      c.title.toLowerCase().includes("cannot") ||
      c.title.toLowerCase().includes("error") ||
      c.title.toLowerCase().includes("failed"),
  ).length;
  const newActionable = newResult.clusters.filter(
    (c) =>
      c.title.toLowerCase().includes("cannot") ||
      c.title.toLowerCase().includes("error") ||
      c.title.toLowerCase().includes("failed"),
  ).length;
  console.log(`  Old: ${oldActionable}/${oldResult.totalClusters} clusters have actionable titles`);
  console.log(`  New: ${newActionable}/${newResult.totalClusters} clusters have actionable titles`);

  // Expected improvements
  console.log("\n\n✅ EXPECTED IMPROVEMENTS");
  console.log("1. More specific cluster titles (e.g., 'Cannot receive 2FA SMS codes' vs 'Authentication Issues')");
  console.log("2. Better grouping of identical problems (all 2FA SMS issues together)");
  console.log("3. Separation of different error codes (402 vs 503)");
  console.log("4. More actionable titles for support staff");
  console.log("5. Easier bulk resolution of similar issues");

  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    oldApproach: oldResult,
    newApproach: newResult,
    improvements: {
      clusterSpecificity: `${oldResult.specificity} → ${newResult.specificity}`,
      actionableTitles: `${oldActionable}/${oldResult.totalClusters} → ${newActionable}/${newResult.totalClusters}`,
      averageClusterSize: `${oldResult.averageClusterSize.toFixed(1)} → ${newResult.averageClusterSize.toFixed(1)}`,
    },
  };

  console.log("\n\n📄 Full results saved to: test-results.json");
  await Bun.write("test-results.json", JSON.stringify(results, null, 2));
}

// Run the test
runClusteringTest().catch(console.error);
