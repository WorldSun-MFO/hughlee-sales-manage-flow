import { Suspense } from 'react';
import { getSnapshot } from '@/lib/v4/data';
import { TodayView } from '@/components/v4/views/TodayView';
import { TodaySkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

async function TodayData() {
  const snap = await getSnapshot();
  return <TodayView snapshot={snap} base="/workspace" />;
}

export default function WorkspaceTodayPage() {
  // streaming:頁面外殼立刻回,資料在 Suspense 內邊抓邊補(先看到骨架)
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayData />
    </Suspense>
  );
}
