import { getSnapshot, getCurrentProfile } from '@/lib/v4/data';
import { WorkspaceShell } from '@/components/v4/workspace/WorkspaceShell';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [snap, profile] = await Promise.all([getSnapshot(), getCurrentProfile()]);
  return (
    <WorkspaceShell source={snap.source} profile={profile}>
      {children}
    </WorkspaceShell>
  );
}
