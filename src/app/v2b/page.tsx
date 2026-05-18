import { V2BWorkspace } from '@/components/v2b/V2BWorkspace';
import { getV2WorkspaceData } from '@/components/v2/data';

// 第二個設計方向原型。沿用 /v2 的隔離假資料與型別，
// 才能與 /v2 做 apples-to-apples 的並排比較。不讀 Supabase、不碰正式系統。
export const dynamic = 'force-static';

export default function V2BStandalonePage() {
  const data = getV2WorkspaceData();

  return (
    <V2BWorkspace
      deals={data.deals}
      profile={data.profile}
      profiles={data.profiles}
      settings={data.settings}
      tasks={data.tasks}
      painPoints={data.painPoints}
      marketIntel={data.marketIntel}
    />
  );
}
