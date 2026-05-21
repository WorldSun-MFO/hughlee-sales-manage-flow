import { getSnapshot } from '@/lib/v4/data';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { AIChatView } from '@/components/v4/views/AIChatView';

export const dynamic = 'force-dynamic';

export default async function HubAIPage() {
  const snap = await getSnapshot();
  return (
    <>
      <HubTopBar pageLabel="AI 助手" source={snap.source} />
      <div className="mx-auto max-w-[1240px]">
        <AIChatView snapshot={snap} base="/v4/hub" />
      </div>
    </>
  );
}
