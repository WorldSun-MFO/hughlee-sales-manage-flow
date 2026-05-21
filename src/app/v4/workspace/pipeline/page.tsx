import { getSnapshot } from '@/lib/v4/data';
import { PipelineView } from '@/components/v4/views/PipelineView';

export const dynamic = 'force-dynamic';

export default async function WorkspacePipelinePage() {
  const snap = await getSnapshot();
  return <PipelineView snapshot={snap} base="/v4/workspace" />;
}
