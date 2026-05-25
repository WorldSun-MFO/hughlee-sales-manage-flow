import { getSnapshot } from '@/lib/v4/data';
import { TodayView } from '@/components/v4/views/TodayView';

export const dynamic = 'force-dynamic';

export default async function WorkspaceTodayPage() {
  const snap = await getSnapshot();
  return <TodayView snapshot={snap} base="/workspace" />;
}
