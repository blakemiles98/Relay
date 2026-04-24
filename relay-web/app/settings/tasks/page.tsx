"use client";

import { useEffect, useState } from "react";
import { api, type ScheduledTask, type TaskRun } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Play, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  Idle: "secondary",
  Running: "default",
  Success: "default",
  Failed: "destructive",
};

function fmtDuration(s: number | null) {
  if (!s) return "—";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function TasksSettingsPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [running, setRunning] = useState<Set<number>>(new Set());
  const [logTask, setLogTask] = useState<ScheduledTask | null>(null);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => { api.tasks.list().then(setTasks); }, []);

  const categories = [...new Set(tasks.map((t) => t.category))];

  async function runTask(task: ScheduledTask) {
    setRunning((prev) => new Set(prev).add(task.id));
    try {
      await api.tasks.run(task.id);
      toast.success(`${task.name} started.`);
    } catch {
      toast.error("Failed to start task.");
    } finally {
      setRunning((prev) => { const n = new Set(prev); n.delete(task.id); return n; });
    }
  }

  async function toggleEnabled(task: ScheduledTask, enabled: boolean) {
    await api.tasks.update(task.id, { isEnabled: enabled });
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, isEnabled: enabled } : t));
  }

  async function updateCron(task: ScheduledTask, cron: string) {
    await api.tasks.update(task.id, { cronSchedule: cron });
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, cronSchedule: cron } : t));
  }

  async function openLogs(task: ScheduledTask) {
    setLogTask(task);
    const data = await api.tasks.runs(task.id);
    setRuns(data);
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-0">
            {tasks.filter((t) => t.category === category).map((task, i, arr) => (
              <div key={task.id} className={cn("px-6 py-3", i < arr.length - 1 && "border-b border-border")}>
                <div className="flex items-center gap-3">
                  <Switch checked={task.isEnabled} onCheckedChange={(v) => toggleEnabled(task, v)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{task.name}</span>
                      <Badge variant={statusColors[task.lastStatus] as "default" | "secondary" | "destructive" | "outline"} className="text-xs">
                        {task.lastStatus}
                      </Badge>
                    </div>
                    {task.lastRunAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last ran {new Date(task.lastRunAt).toLocaleString()} · {fmtDuration(task.lastDurationSeconds)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpand(task.id)}>
                      {expanded.has(task.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="sm" disabled={running.has(task.id)} onClick={() => runTask(task)}>
                      <Play className="h-3.5 w-3.5 mr-1" />Run
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openLogs(task)}>Logs</Button>
                  </div>
                </div>

                {expanded.has(task.id) && (
                  <div className="mt-3 ml-10 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Cron schedule</span>
                    <Input
                      className="h-7 text-xs font-mono w-40"
                      defaultValue={task.cronSchedule ?? ""}
                      placeholder="0 2 * * *"
                      onBlur={(e) => updateCron(task, e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">Leave blank to disable scheduling.</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Log viewer */}
      <Dialog open={!!logTask} onOpenChange={() => setLogTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Run history — {logTask?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96">
            {runs.length === 0 && <p className="text-muted-foreground text-sm p-4">No runs yet.</p>}
            {runs.map((run) => (
              <div key={run.id} className="border-b border-border p-4 space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant={run.status === "Success" ? "default" : run.status === "Failed" ? "destructive" : "secondary"}>
                    {run.status}
                  </Badge>
                  <span className="text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</span>
                  {run.completedAt && (
                    <span className="text-muted-foreground text-xs">
                      {fmtDuration(Math.floor((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))}
                    </span>
                  )}
                </div>
                {run.log && (
                  <pre className="text-xs font-mono bg-muted rounded p-2 whitespace-pre-wrap text-muted-foreground">
                    {run.log}
                  </pre>
                )}
              </div>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
