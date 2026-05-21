import { getSnapshot } from '@/lib/v4/data';
import { SettingsView } from '@/components/v4/views/SettingsView';

export const dynamic = 'force-dynamic';

export default async function WorkspaceSettingsPage() {
  const snap = await getSnapshot();
  return <SettingsView snapshot={snap} />;
}
