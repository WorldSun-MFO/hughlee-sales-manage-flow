import { getSnapshot, getCurrentProfile, getSettings, getMemberStatus } from '@/lib/v4/data';
import { SettingsView } from '@/components/v4/views/SettingsView';

export const dynamic = 'force-dynamic';

export default async function WorkspaceSettingsPage() {
  const [snap, profile, settings, memberStatus] = await Promise.all([
    getSnapshot(),
    getCurrentProfile(),
    getSettings(),
    getMemberStatus(),
  ]);
  return (
    <SettingsView
      snapshot={snap}
      currentProfile={profile}
      settings={settings}
      memberStatus={memberStatus}
    />
  );
}
