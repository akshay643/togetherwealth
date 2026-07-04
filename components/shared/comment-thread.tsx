"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SetStateAction,
} from "react";
import { MessageCircle, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useRealtimeTable } from "@/hooks/use-realtime";
import type { CommentEntityType } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Profile, WorkspaceMemberWithProfile } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export interface CommentThreadProps {
  entityType: CommentEntityType;
  /** For table="research_comments" this is the research_item_id. */
  entityId: string;
  workspaceId: string;
  currentUserId: string;
  members: WorkspaceMemberWithProfile[];
  className?: string;
  /** Which comments table backs this thread. Defaults to the generic one. */
  table?: "comments" | "research_comments";
}

type ThreadComment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  /** True while an optimistic insert is awaiting the server. */
  optimistic?: boolean;
};

type CommentState = {
  key: string;
  items: ThreadComment[] | null;
};

const COMMENT_COLUMNS = "id, user_id, body, created_at";

export function CommentThread({
  entityType,
  entityId,
  workspaceId,
  currentUserId,
  members,
  className,
  table = "comments",
}: CommentThreadProps) {
  const supabase = useMemo(() => createClient(), []);
  const threadKey = `${table}:${entityType}:${entityId}`;
  const [commentState, setCommentState] = useState<CommentState>(() => ({
    key: threadKey,
    items: null,
  }));
  const comments = commentState.key === threadKey ? commentState.items : null;
  const setComments = useCallback(
    (updater: SetStateAction<ThreadComment[] | null>) => {
      setCommentState((prev) => {
        const current = prev.key === threadKey ? prev.items : null;
        const next =
          typeof updater === "function"
            ? (updater as (
                value: ThreadComment[] | null
              ) => ThreadComment[] | null)(current)
            : updater;

        return { key: threadKey, items: next };
      });
    },
    [threadKey]
  );
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const member of members) map.set(member.user_id, member.profile);
    return map;
  }, [members]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    const loadKey = threadKey;

    async function load() {
      const query =
        table === "research_comments"
          ? supabase
              .from("research_comments")
              .select(COMMENT_COLUMNS)
              .eq("research_item_id", entityId)
              .order("created_at", { ascending: true })
          : supabase
              .from("comments")
              .select(COMMENT_COLUMNS)
              .eq("entity_type", entityType)
              .eq("entity_id", entityId)
              .order("created_at", { ascending: true });

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error("CommentThread load failed:", error.message);
        setCommentState({ key: loadKey, items: [] });
        return;
      }
      setCommentState({ key: loadKey, items: data ?? [] });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, table, entityType, entityId, threadKey]);

  // Live updates from the partner
  const filterColumn =
    table === "research_comments" ? "research_item_id" : "entity_id";
  useRealtimeTable({
    table,
    filter: `${filterColumn}=eq.${entityId}`,
    event: "INSERT",
    onChange: (payload) => {
      const row = payload.new as ThreadComment | null;
      if (!row?.id) return;
      if (
        table === "comments" &&
        typeof payload.new?.entity_type === "string" &&
        payload.new.entity_type !== entityType
      ) {
        return;
      }
      setComments((prev) => {
        if (!prev) return prev;
        if (prev.some((c) => c.id === row.id)) return prev;
        // If this is the echo of our own optimistic insert, replace it.
        const withoutEcho = prev.filter(
          (c) => !(c.optimistic && c.user_id === row.user_id && c.body === row.body)
        );
        return [
          ...withoutEcho,
          {
            id: row.id,
            user_id: row.user_id,
            body: row.body,
            created_at: row.created_at,
          },
        ];
      });
    },
  });

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: ThreadComment = {
      id: tempId,
      user_id: currentUserId,
      body: trimmed,
      created_at: new Date().toISOString(),
      optimistic: true,
    };
    setComments((prev) => [...(prev ?? []), optimistic]);
    setBody("");

    const { data, error } =
      table === "research_comments"
        ? await supabase
            .from("research_comments")
            .insert({
              research_item_id: entityId,
              user_id: currentUserId,
              body: trimmed,
            })
            .select(COMMENT_COLUMNS)
            .single()
        : await supabase
            .from("comments")
            .insert({
              workspace_id: workspaceId,
              user_id: currentUserId,
              entity_type: entityType,
              entity_id: entityId,
              body: trimmed,
            })
            .select(COMMENT_COLUMNS)
            .single();

    if (error || !data) {
      setComments((prev) => prev?.filter((c) => c.id !== tempId) ?? prev);
      setBody(trimmed);
      toast.error("Your comment didn't send. Please try again.");
    } else {
      setComments((prev) => {
        if (!prev) return prev;
        // Realtime may have already delivered the row.
        if (prev.some((c) => c.id === data.id)) {
          return prev.filter((c) => c.id !== tempId);
        }
        return prev.map((c) => (c.id === tempId ? { ...data } : c));
      });
    }
    setSubmitting(false);
  }

  return (
    <section className={cn("space-y-4", className)} aria-label="Comments">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <MessageCircle aria-hidden className="size-4 text-muted-foreground" />
        Comments
        {comments && comments.length > 0 ? (
          <span className="text-muted-foreground tabular-nums">
            ({comments.length})
          </span>
        ) : null}
      </h3>

      {comments === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Start the conversation"
          description="Share a thought or question with your partner — comments stay attached to this item."
          className="py-8"
        />
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const profile = profilesById.get(comment.user_id) ?? null;
            const isOwn = comment.user_id === currentUserId;
            return (
              <li
                key={comment.id}
                className={cn(
                  "flex items-start gap-3",
                  comment.optimistic && "opacity-60"
                )}
              >
                <UserAvatar profile={profile} className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-medium">
                      {isOwn
                        ? "You"
                        : profile?.full_name || profile?.email || "Partner"}
                    </span>
                    <span className="text-muted-foreground">
                      {formatRelativeTime(comment.created_at)}
                    </span>
                  </p>
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
                      isOwn ? "bg-primary/5" : "bg-muted/50"
                    )}
                  >
                    {comment.body}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="Write a comment…"
          rows={2}
          className="min-h-11 flex-1 resize-none"
          aria-label="Write a comment"
          disabled={submitting}
        />
        <Button
          type="submit"
          size="icon-lg"
          className="mb-0.5 size-11 shrink-0"
          disabled={submitting || body.trim().length === 0}
          aria-label="Send comment"
        >
          {submitting ? <Spinner /> : <SendHorizontal aria-hidden />}
        </Button>
      </form>
    </section>
  );
}
