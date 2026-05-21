import { getSnapshot } from '@/lib/v4/data';
import { WorkspaceShell } from '@/components/v4/workspace/WorkspaceShell';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const snap = await getSnapshot();
  return <WorkspaceShell source={snap.source}>{children}</WorkspaceShell>;
}
