import { TasksApp } from "@/components/clinic/tasks-app";
import { MissedCallSettings } from "@/components/clinic/missed-call-settings";
import { getMissedCallSettings } from "@/actions/missed-call-settings";

export const metadata = { title: "Tarefas" };
export const dynamic = "force-dynamic";

/** Tarefas da recepção: criadas à mão, pelo Chat (?c=<conversa>) ou pelas automações. */
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const missedCall = await getMissedCallSettings();
  return (
    <>
      {missedCall.canConfigure && (
        <MissedCallSettings enabled={missedCall.enabled} sentToday={missedCall.sentToday} tasksToday={missedCall.tasksToday} />
      )}
      <TasksApp conversationId={c ?? null} />
    </>
  );
}
