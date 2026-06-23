import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentProfile, getDealsLight } from '@/lib/v4/data';
import { CloseDateView } from '@/components/v4/views/CloseDateView';
import { ListPageSkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

// admin 限定:非管理員直接導回工作區(側邊欄也只對 admin 顯示入口,這裡是後端把關)
async function CloseDateData() {
  const deals = await getDealsLight();
  return <CloseDateView deals={deals} base="/workspace" />;
}

export default async function WorkspaceCloseDatesPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') redirect('/workspace');
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <CloseDateData />
    </Suspense>
  );
}
