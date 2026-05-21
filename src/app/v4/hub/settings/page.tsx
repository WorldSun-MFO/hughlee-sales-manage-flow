import { getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { SettingsView } from '@/components/v4/views/SettingsView';

export const dynamic = 'force-dynamic';

export default async function HubSettingsPage() {
  const snap = await getSnapshot();
  return (
    <>
      <HubTopBar pageLabel="設定" source={snap.source} />
      <div className="mx-auto max-w-[1240px]">
        <SettingsView snapshot={snap} />
      </div>
    </>
  );
}
