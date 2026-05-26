import { Suspense } from 'react';
import { getSnapshot, getCurrentProfile } from '@/lib/v4/data';
import { TasksView } from '@/components/v4/views/TasksView';
import { TodaySkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

async function TasksData() {
  const [snap, profile] = await Promise.all([getSnapshot(), getCurrentProfile()]);
  return <TasksView snapshot={snap} base="/workspace" profile={profile} />;
}

export default function WorkspaceTasksPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TasksData />
    </Suspense>
  );
}
