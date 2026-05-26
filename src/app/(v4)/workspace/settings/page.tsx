import { Suspense } from 'react';
import { getSnapshot, getCurrentProfile, getSettings, getMemberStatus } from '@/lib/v4/data';
import { SettingsView } from '@/components/v4/views/SettingsView';
import { SettingsSkeleton } from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

async function SettingsData() {
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

export default function WorkspaceSettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsData />
    </Suspense>
  );
}
