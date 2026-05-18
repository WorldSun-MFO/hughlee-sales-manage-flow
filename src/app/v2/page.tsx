import { V2Workspace } from '@/components/v2/V2Workspace';
import { getV2WorkspaceData } from '@/components/v2/data';

export const dynamic = 'force-static';

export default function V2StandalonePage() {
  const data = getV2WorkspaceData();

  return (
    <V2Workspace
      initialDeals={data.deals}
      profile={data.profile}
      allProfiles={data.profiles}
      painPoints={data.painPoints}
      teams={data.teams}
      tasks={data.tasks}
      marketIntel={data.marketIntel}
      settings={data.settings}
    />
  );
}
