import { getSnapshot } from '@/lib/v4/data';
import { PlanView } from '@/components/v4/views/PlanView';

export const dynamic = 'force-dynamic';

export default async function WorkspacePlanPage() {
  const snap = await getSnapshot();
  return <PlanView snapshot={snap} base="/v4/workspace" />;
}
