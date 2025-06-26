import { NextRequest, NextResponse } from "next/server";
import { generateConversationSummary } from "@/lib/ai/summarization";
import { getConversationBySlugAndMailbox } from "@/lib/data/conversation";
import { getMailboxBySlug } from "@/lib/data/mailbox";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { mailboxSlug } = body;

    if (!mailboxSlug) {
      return NextResponse.json({ error: "Mailbox slug is required" }, { status: 400 });
    }

    const mailbox = await getMailboxBySlug(mailboxSlug);
    if (!mailbox) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    const conversation = await getConversationBySlugAndMailbox(slug, mailbox.id);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const summary = await generateConversationSummary(conversation.id, mailbox);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    captureExceptionAndLog(error);

    return NextResponse.json({ error: "Failed to generate conversation summary" }, { status: 500 });
  }
}
