import { getSnapshot } from '@/lib/v4/data';
import { ClientDetailView } from '@/components/v4/views/ClientDetailView';

export const dynamic = 'force-dynamic';

export default async function WorkspaceClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const snap = await getSnapshot();
  const { id } = await params;
  return <ClientDetailView snapshot={snap} dealId={id} base="/v4/workspace" backHref="/v4/workspace/clients" />;
}
