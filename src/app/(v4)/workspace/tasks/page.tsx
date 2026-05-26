import { getSnapshot, getCurrentProfile } from '@/lib/v4/data';
import { TasksView } from '@/components/v4/views/TasksView';

export const dynamic = 'force-dynamic';

export default async function WorkspaceTasksPage() {
  const [snap, profile] = await Promise.all([getSnapshot(), getCurrentProfile()]);
  return <TasksView snapshot={snap} base="/workspace" profile={profile} />;
}
