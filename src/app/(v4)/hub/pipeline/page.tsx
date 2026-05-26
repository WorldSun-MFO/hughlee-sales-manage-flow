import { getCurrentProfile, getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { PipelineView } from '@/components/v4/views/PipelineView';

export const dynamic = 'force-dynamic';

export default async function HubPipelinePage() {
  const [snap, profile] = await Promise.all([getSnapshot(), getCurrentProfile()]);
  return (
    <>
      <HubTopBar pageLabel="Pipeline" source={snap.source} profile={profile} />
      <div className="mx-auto max-w-[1240px]">
        <PipelineView snapshot={snap} base="/hub" />
      </div>
    </>
  );
}
