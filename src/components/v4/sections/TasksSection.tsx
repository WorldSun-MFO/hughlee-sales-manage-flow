import { getDealTasks, getDealsLight, getProfilesAndTeams, getTierConfig } from '@/lib/v4/data';
import { TasksClient } from './TasksClient';

// 任務區用簡化 snapshot 餵 TaskRow / TaskComposer(它們吃完整 Snapshot 介面)
export async function TasksSection({
  dealId, base, isFixtures,
}: {
  dealId: string;
  base: '/workspace' | '/hub';
  isFixtures: boolean;
}) {
  const [tasks, deals, profilesTeams, tierConfig] = await Promise.all([
    getDealTasks(dealId),
    getDealsLight(),
    getProfilesAndTeams(),
    getTierConfig(),
  ]);
  return (
    <TasksClient
      base={base}
      dealId={dealId}
      tasks={tasks}
      snapshotLite={{
        deals: deals as never,
        profiles: profilesTeams.profiles,
        tasks,
        teams: profilesTeams.teams,
        tierConfig,
        source: isFixtures ? 'fixtures' : 'supabase',
        fetchedAt: new Date().toISOString(),
      }}
      isFixtures={isFixtures}
    />
  );
}
