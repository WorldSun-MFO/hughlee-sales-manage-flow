import { getCurrentProfile, getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { AIChatView } from '@/components/v4/views/AIChatView';

export const dynamic = 'force-dynamic';

export default async function HubAIPage() {
  const [snap, profile] = await Promise.all([getSnapshot(), getCurrentProfile()]);
  return (
    <>
      <HubTopBar pageLabel="AI 助手" source={snap.source} profile={profile} />
      <div className="mx-auto max-w-[1240px]">
        <AIChatView snapshot={snap} base="/hub" />
      </div>
    </>
  );
}
