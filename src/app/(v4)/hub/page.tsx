import { getCurrentProfile, getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { HubHome } from '@/components/v4/hub/HubHome';

export const dynamic = 'force-dynamic';

export default async function HubHomePage() {
  const [snap, profile] = await Promise.all([getSnapshot(), getCurrentProfile()]);
  return (
    <>
      <HubTopBar source={snap.source} profile={profile} />
      <HubHome snapshot={snap} />
    </>
  );
}
