import { getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { PipelineView } from '@/components/v4/views/PipelineView';

export const dynamic = 'force-dynamic';

export default async function HubPipelinePage() {
  const snap = await getSnapshot();
  return (
    <>
      <HubTopBar pageLabel="Pipeline" source={snap.source} />
      <div className="mx-auto max-w-[1240px]">
        <PipelineView snapshot={snap} base="/v4/hub" />
      </div>
    </>
  );
}
