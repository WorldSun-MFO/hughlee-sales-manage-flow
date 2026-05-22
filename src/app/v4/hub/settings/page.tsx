import { getSnapshot, getCurrentProfile, getSettings } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { SettingsView } from '@/components/v4/views/SettingsView';

export const dynamic = 'force-dynamic';

export default async function HubSettingsPage() {
  const [snap, profile, settings] = await Promise.all([
    getSnapshot(),
    getCurrentProfile(),
    getSettings(),
  ]);
  return (
    <>
      <HubTopBar pageLabel="設定" source={snap.source} />
      <div className="mx-auto max-w-[1240px]">
        <SettingsView snapshot={snap} currentProfile={profile} settings={settings} />
      </div>
    </>
  );
}
