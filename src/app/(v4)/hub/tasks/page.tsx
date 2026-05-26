import { getCurrentProfile, getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { TasksView } from '@/components/v4/views/TasksView';

export const dynamic = 'force-dynamic';

export default async function HubTasksPage() {
  const [snap, profile] = await Promise.all([getSnapshot(), getCurrentProfile()]);
  return (
    <>
      <HubTopBar pageLabel="我的任務" source={snap.source} profile={profile} />
      <div className="mx-auto max-w-[1240px]">
        <TasksView snapshot={snap} base="/hub" />
      </div>
    </>
  );
}
