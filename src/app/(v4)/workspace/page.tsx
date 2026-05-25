import { getSnapshot } from '@/lib/v4/data';
import { OverviewView } from '@/components/v4/views/OverviewView';

export const dynamic = 'force-dynamic';

export default async function WorkspaceHome() {
  const snap = await getSnapshot();
  return <OverviewView snapshot={snap} base="/workspace" />;
}
