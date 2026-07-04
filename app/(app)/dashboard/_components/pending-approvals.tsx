"use client";

import { useRouter } from "next/navigation";
import { Handshake } from "lucide-react";

import { ApprovalCard } from "@/components/shared/approval-flow";
import type { Approval } from "@/lib/types/database";

export interface PendingApprovalsProps {
  approvals: Approval[];
  currentUserId: string;
  requesterNames: Record<string, string>;
}

/**
 * Amber-tinted banner listing approval requests waiting on the current user.
 * Refreshes the page data after a decision so the dashboard stays in sync.
 */
export function PendingApprovals({
  approvals,
  currentUserId,
  requesterNames,
}: PendingApprovalsProps) {
  const router = useRouter();

  if (approvals.length === 0) return null;

  return (
    <section
      id="pending-approvals"
      aria-label="Pending approvals"
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Handshake
          aria-hidden
          className="size-4 text-amber-600 dark:text-amber-400"
        />
        <h2 className="text-sm font-medium">
          {approvals.length === 1
            ? "Your partner is waiting on your approval"
            : `${approvals.length} requests are waiting on your approval`}
        </h2>
      </div>
      <div className="space-y-3">
        {approvals.map((approval) => (
          <ApprovalCard
            key={approval.id}
            approval={approval}
            currentUserId={currentUserId}
            requesterName={
              requesterNames[approval.requested_by] ?? "Your partner"
            }
            onDecided={() => router.refresh()}
          />
        ))}
      </div>
    </section>
  );
}
