import { TasksApp } from "@/components/clinic/tasks-app";

export const metadata = { title: "Tarefas" };
export const dynamic = "force-dynamic";

/** Tarefas da recepção: criadas à mão, pelo Chat (?c=<conversa>) ou pelas automações. */
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  return <TasksApp conversationId={c ?? null} />;
}
