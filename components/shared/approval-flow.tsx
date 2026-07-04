"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Ban, Check, CircleSlash, Clock, Handshake, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ROUTES,
  type ApprovalActionType,
  type ApprovalStatus,
} from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Approval, Json } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<ApprovalActionType, string> = {
  delete_shared_goal: "Delete a shared goal",
  edit_shared_budget: "Edit the shared budget",
  mark_debt_paid: "Mark a debt as paid off",
  change_split_rules: "Change expense split rules",
  delete_shared_document: "Delete a shared document",
};

const STATUS_META: Record<
  ApprovalStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  pending: {
    label: "Waiting for partner",
    icon: Clock,
    className: "text-muted-foreground",
  },
  approved: {
    label: "Approved",
    icon: Check,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  rejected: {
    label: "Declined",
    icon: X,
    className: "text-amber-600 dark:text-amber-400",
  },
  canceled: {
    label: "Canceled",
    icon: Ban,
    className: "text-muted-foreground",
  },
};

// ---------------------------------------------------------------------------
// RequestApprovalDialog
// ---------------------------------------------------------------------------

export interface RequestApprovalDialogProps {
  workspaceId: string;
  currentUserId: string;
  actionType: ApprovalActionType;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  trigger: React.ReactNode;
  title: string;
  description: string;
  onRequested?: () => void;
}

/**
 * Dialog that files an approval request for a sensitive shared change and
 * notifies the partner. The change itself should only be applied once the
 * partner approves.
 */
export function RequestApprovalDialog({
  workspaceId,
  currentUserId,
  actionType,
  entityType,
  entityId,
  payload,
  trigger,
  title,
  description,
  onRequested,
}: RequestApprovalDialogProps) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const trimmedNote = note.trim();
      const { error } = await supabase.from("approvals").insert({
        workspace_id: workspaceId,
        requested_by: currentUserId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId ?? null,
        // Callers pass plain serializable objects; Json is structurally the same.
        payload: (payload ?? {}) as unknown as Json,
        note: trimmedNote || null,
      });
      if (error) {
        console.error("RequestApprovalDialog insert failed:", error.message);
        toast.error("The request didn't send. Please try again.");
        return;
      }

      // Notify the other member(s) — best effort.
      const { data: partners } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .neq("user_id", currentUserId);
      if (partners && partners.length > 0) {
        const { error: notifyError } = await supabase
          .from("notifications")
          .insert(
            partners.map((partner) => ({
              user_id: partner.user_id,
              workspace_id: workspaceId,
              type: "approval.requested",
              title: `Approval requested: ${ACTION_LABELS[actionType]}`,
              body: trimmedNote || description,
              link: ROUTES.activity,
            }))
          );
        if (notifyError) {
          console.error(
            "RequestApprovalDialog notify failed:",
            notifyError.message
          );
        }
      }

      toast.success("Sent to your partner for approval");
      setNote("");
      setOpen(false);
      onRequested?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approval-note">Add a note (optional)</Label>
            <Textarea
              id="approval-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you'd like to make this change…"
              rows={3}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : <Handshake aria-hidden />}
              Ask partner to approve
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ApprovalCard
// ---------------------------------------------------------------------------

export interface ApprovalCardProps {
  approval: Approval;
  currentUserId: string;
  requesterName: string;
  onDecided?: () => void;
}

/**
 * A pending/decided approval. The partner (not the requester) can approve or
 * decline; the requester sees the status and can cancel while pending.
 */
export function ApprovalCard({
  approval,
  currentUserId,
  requesterName,
  onDecided,
}: ApprovalCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<ApprovalStatus>(approval.status);
  const [pendingAction, setPendingAction] = useState<
    "approved" | "rejected" | "canceled" | null
  >(null);

  const isRequester = approval.requested_by === currentUserId;
  const actionLabel = ACTION_LABELS[approval.action_type];
  const statusMeta = STATUS_META[status];
  const StatusIcon = statusMeta.icon;

  async function decide(decision: "approved" | "rejected") {
    if (pendingAction) return;
    setPendingAction(decision);
    try {
      const { error } = await supabase
        .from("approvals")
        .update({
          status: decision,
          decided_by: currentUserId,
          decided_at: new Date().toISOString(),
        })
        .eq("id", approval.id)
        .eq("status", "pending");
      if (error) {
        console.error("ApprovalCard decide failed:", error.message);
        toast.error("That didn't save. Please try again.");
        return;
      }

      const { error: notifyError } = await supabase
        .from("notifications")
        .insert({
          user_id: approval.requested_by,
          workspace_id: approval.workspace_id,
          type: `approval.${decision}`,
          title:
            decision === "approved"
              ? `Your partner approved: ${actionLabel}`
              : `Your partner declined: ${actionLabel}`,
          body: null,
          link: ROUTES.activity,
        });
      if (notifyError) {
        console.error("ApprovalCard notify failed:", notifyError.message);
      }

      setStatus(decision);
      toast.success(
        decision === "approved" ? "Approved" : "Declined — no changes made"
      );
      onDecided?.();
    } finally {
      setPendingAction(null);
    }
  }

  async function cancel() {
    if (pendingAction) return;
    setPendingAction("canceled");
    try {
      const { error } = await supabase
        .from("approvals")
        .update({
          status: "canceled",
          decided_by: currentUserId,
          decided_at: new Date().toISOString(),
        })
        .eq("id", approval.id)
        .eq("status", "pending");
      if (error) {
        console.error("ApprovalCard cancel failed:", error.message);
        toast.error("That didn't save. Please try again.");
        return;
      }
      setStatus("canceled");
      toast.success("Request canceled");
      onDecided?.();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="rounded-lg bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
        >
          <Handshake className="size-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="text-sm leading-tight font-medium">{actionLabel}</p>
            <Badge
              variant="outline"
              className={cn("gap-1", statusMeta.className)}
            >
              <StatusIcon aria-hidden />
              {statusMeta.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Requested by {isRequester ? "you" : requesterName} ·{" "}
            {formatRelativeTime(approval.created_at)}
          </p>
          {approval.note ? (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed break-words whitespace-pre-wrap">
              {approval.note}
            </p>
          ) : null}
        </div>
      </div>

      {status === "pending" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          {isRequester ? (
            <>
              <p className="flex-1 text-xs text-muted-foreground">
                Your partner will see this and can approve or decline.
              </p>
              <Button
                variant="ghost"
                onClick={cancel}
                disabled={pendingAction !== null}
              >
                {pendingAction === "canceled" ? (
                  <Spinner />
                ) : (
                  <CircleSlash aria-hidden />
                )}
                Cancel request
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => decide("approved")}
                disabled={pendingAction !== null}
              >
                {pendingAction === "approved" ? (
                  <Spinner />
                ) : (
                  <Check aria-hidden />
                )}
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => decide("rejected")}
                disabled={pendingAction !== null}
              >
                {pendingAction === "rejected" ? (
                  <Spinner />
                ) : (
                  <X aria-hidden />
                )}
                Decline
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
