import { getSnapshot } from '@/lib/v4/data';
import { AIChatView } from '@/components/v4/views/AIChatView';

export const dynamic = 'force-dynamic';

export default async function WorkspaceAIPage() {
  const snap = await getSnapshot();
  return <AIChatView snapshot={snap} base="/v4/workspace" />;
}
