"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ListTodo } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ROUTES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Task } from "@/lib/types/database";
import { cn } from "@/lib/utils";

import { completeTask } from "../actions";

export interface OpenTasksProps {
  tasks: Task[];
}

/** The current user's open tasks with a one-tap complete checkbox. */
export function OpenTasks({ tasks }: OpenTasksProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function handleComplete(task: Task) {
    setCompletedIds((prev) => new Set(prev).add(task.id));
    startTransition(async () => {
      const result = await completeTask({ taskId: task.id });
      if ("error" in result) {
        setCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
        toast.error(result.error);
      } else {
        toast.success(`Nice — "${task.title}" is done.`);
      }
    });
  }

  const remaining = tasks.filter((t) => !completedIds.has(t.id));

  if (tasks.length === 0 || remaining.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No open tasks"
        description="Nothing on your plate right now. Tasks you're assigned will show up here."
        className="border-0 py-6 sm:py-8"
        action={
          <Button asChild variant="outline" size="sm" className="max-md:h-11">
            <Link href={ROUTES.tasks}>View all tasks</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="space-y-1">
      {remaining.map((task) => (
        <li key={task.id}>
          <label
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50",
              completedIds.has(task.id) && "opacity-50"
            )}
          >
            <Checkbox
              checked={completedIds.has(task.id)}
              onCheckedChange={(checked) => {
                if (checked === true) handleComplete(task);
              }}
              aria-label={`Mark "${task.title}" as done`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{task.title}</span>
              {task.due_on ? (
                <span className="block text-xs text-muted-foreground">
                  Due {formatDate(task.due_on)}
                </span>
              ) : null}
            </span>
            {task.priority === "high" ? (
              <Badge
                variant="outline"
                className="shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-400"
              >
                High
              </Badge>
            ) : null}
          </label>
        </li>
      ))}
    </ul>
  );
}
