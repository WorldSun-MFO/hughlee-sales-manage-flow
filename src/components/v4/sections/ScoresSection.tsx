// Server section — 自己抓 scores + notes,渲染 client UI
import { getDealScores } from '@/lib/v4/data';
import { ScoresClient } from './ScoresClient';

export async function ScoresSection({ dealId, isFixtures }: { dealId: string; isFixtures: boolean }) {
  const { scores, notes } = await getDealScores(dealId);
  return <ScoresClient dealId={dealId} scores={scores} notes={notes} isFixtures={isFixtures} />;
}
