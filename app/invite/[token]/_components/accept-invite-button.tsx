"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { acceptInviteAction } from "../actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const [submitting, setSubmitting] = useState(false);

  async function onAccept() {
    setSubmitting(true);
    const result = await acceptInviteAction(token);
    // On success the action redirects to onboarding and never resolves here.
    if (result?.error) {
      toast.error(result.error);
      setSubmitting(false);
    }
  }

  return (
    <Button
      onClick={onAccept}
      disabled={submitting}
      className="h-11 w-full"
    >
      {submitting && <Spinner />}
      {submitting ? "Joining…" : "Accept invite"}
    </Button>
  );
}
