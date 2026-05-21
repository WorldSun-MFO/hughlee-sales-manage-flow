import { getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { TodayView } from '@/components/v4/views/TodayView';

export const dynamic = 'force-dynamic';

export default async function HubTodayPage() {
  const snap = await getSnapshot();
  return (
    <>
      <HubTopBar pageLabel="今日要做" source={snap.source} />
      <div className="mx-auto max-w-[1240px]">
        <TodayView snapshot={snap} base="/v4/hub" />
      </div>
    </>
  );
}
