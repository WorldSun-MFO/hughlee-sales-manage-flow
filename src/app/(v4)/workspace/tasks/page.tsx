import { getSnapshot } from '@/lib/v4/data';
import { TasksView } from '@/components/v4/views/TasksView';

export const dynamic = 'force-dynamic';

export default async function WorkspaceTasksPage() {
  const snap = await getSnapshot();
  return <TasksView snapshot={snap} base="/workspace" />;
}
