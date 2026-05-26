import { getCurrentProfile } from '@/lib/v4/data';
import { IS_DEMO } from '@/lib/demo';
import { WorkspaceShell } from '@/components/v4/workspace/WorkspaceShell';

// layout 包住每一頁,只需要當前使用者(side bar 顯示名稱/角色)。
// 不再抓 getSnapshot() —— 那會在每次換頁阻塞拉「整包」deals/profiles/tasks/teams,
// 而 WorkspaceShell 其實只用 profile、忽略 source(見該元件 void _source)。
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <WorkspaceShell source={IS_DEMO ? 'fixtures' : 'supabase'} profile={profile}>
      {children}
    </WorkspaceShell>
  );
}
