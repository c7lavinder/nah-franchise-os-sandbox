export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge — list all knowledge documents
 * POST /api/knowledge — create a new knowledge document
 * PUT /api/knowledge — update an existing knowledge document
 * DELETE /api/knowledge — deactivate a knowledge document
 *
 * Leadership only for writes. All authenticated users can read.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { embedKBDoc } from "@/lib/rag/embedder";
import type { KnowledgeCategory } from "@/types/database";

const VALID_CATEGORIES: KnowledgeCategory[] = [
  // Pillar 1: More Leads
  "marketing",
  "lead_generation",
  // Pillar 2: Better Conversion
  "pipeline",
  "objections",
  "fdd",
  "ideal_candidate",
  "competitors",
  "conversion_playbook",
  // Pillar 3: Faster Onboarding
  "training",
  "franchisee_playbook",
  "onboarding_ops",
  // Pillar 4: More Houses
  "coaching",
  "territory",
  "industry",
  "deal_execution",
  // Cross-cutting
  "brand",
  "operations",
  "business_planning",
  "governance",
  "contact-notes",
];

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data });
}

export async function POST(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const supabase = createServerClient();

  const body = await request.json();
  const { title, category, content, priority } = body as {
    title: string;
    category: KnowledgeCategory;
    content: string;
    priority?: number;
  };

  if (!title || !category || !content) {
    return NextResponse.json({ error: "title, category, and content are required" }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Rough token estimate (4 chars per token)
  const tokenCount = Math.ceil(content.length / 4);

  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      title,
      category,
      content,
      priority: priority ?? 5,
      token_count: tokenCount,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Embed for RAG retrieval (non-blocking)
  void embedKBDoc(data.id).catch((err) => {
    console.error(`Failed to embed KB doc ${data.id}:`, err instanceof Error ? err.message : String(err));
  });

  return NextResponse.json({ document: data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const supabase = createServerClient();

  const body = await request.json();
  const { id, title, category, content, priority, is_active } = body as {
    id: string;
    title?: string;
    category?: KnowledgeCategory;
    content?: string;
    priority?: number;
    is_active?: boolean;
  };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (category !== undefined) updates.category = category;
  if (content !== undefined) {
    updates.content = content;
    updates.token_count = Math.ceil(content.length / 4);
  }
  if (priority !== undefined) updates.priority = priority;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase.from("knowledge_documents").update(updates).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-embed if content changed (non-blocking)
  if (content !== undefined) {
    void embedKBDoc(data.id).catch((err) => {
      console.error(`Failed to re-embed KB doc ${data.id}:`, err instanceof Error ? err.message : String(err));
    });
  }

  return NextResponse.json({ document: data });
}

export async function DELETE(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const supabase = createServerClient();

  const body = await request.json();
  const { id } = body as { id: string };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Soft delete — mark as inactive
  const { error } = await supabase.from("knowledge_documents").update({ is_active: false }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
