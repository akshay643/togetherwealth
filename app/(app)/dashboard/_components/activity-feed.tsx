import { History } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { formatRelativeTime } from "@/lib/format";
import type { ActivityEvent, Profile } from "@/lib/types/database";

export interface ActivityFeedProps {
  events: ActivityEvent[];
  profilesById: Record<
    string,
    Pick<Profile, "full_name" | "avatar_url" | "email">
  >;
}

/** Compact recent-activity feed for the dashboard. */
export function ActivityFeed({ events, profilesById }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
        <History
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <p className="text-sm text-muted-foreground">
          No activity yet. Changes either of you make will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {events.map((event) => (
        <li
          key={event.id}
          className="flex min-h-11 items-start gap-3 rounded-md px-2 py-1.5"
        >
          <UserAvatar
            profile={profilesById[event.actor_id] ?? null}
            className="mt-0.5 size-7 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">{event.summary}</p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              {formatRelativeTime(event.created_at)}
              {event.visibility === "private" ? (
                <VisibilityBadge visibility="private" />
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
