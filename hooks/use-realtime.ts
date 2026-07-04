"use client";

import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface RealtimeChangePayload {
  eventType: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}

export interface UseRealtimeTableOptions {
  /** Table name in the public schema, e.g. "comments". */
  table: string;
  /** Postgres changes filter, e.g. "entity_id=eq.<uuid>". */
  filter?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  onChange: (payload: RealtimeChangePayload) => void;
}

/** Realtime sends `{}` for the missing side of a change — normalize to null. */
function normalizeRow(row: unknown): Record<string, unknown> | null {
  if (row && typeof row === "object" && Object.keys(row).length > 0) {
    return row as Record<string, unknown>;
  }
  return null;
}

/**
 * Subscribe to postgres_changes for a table (public schema). The channel is
 * created on mount and removed on unmount; `onChange` is kept in a ref so a
 * new callback identity never tears down the subscription.
 */
export function useRealtimeTable({
  table,
  filter,
  event = "*",
  onChange,
}: UseRealtimeTableOptions): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const supabase = createClient();
    // Unique topic per subscriber so two components watching the same table
    // never collide on a channel.
    const channelName = `realtime:${table}:${event}:${filter ?? "all"}:${Math.random()
      .toString(36)
      .slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          // supabase-js keys its overloads on literal event types; this cast
          // lets a runtime-chosen event resolve to a single overload.
          event: event as "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          onChangeRef.current({
            eventType: payload.eventType,
            new: normalizeRow(payload.new),
            old: normalizeRow(payload.old),
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter, event]);
}
