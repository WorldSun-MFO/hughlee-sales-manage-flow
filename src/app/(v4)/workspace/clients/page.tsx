import { getSnapshot } from '@/lib/v4/data';
import { ClientsListView } from '@/components/v4/views/ClientsListView';

export const dynamic = 'force-dynamic';

export default async function WorkspaceClientsPage() {
  const snap = await getSnapshot();
  return <ClientsListView snapshot={snap} base="/workspace" />;
}
