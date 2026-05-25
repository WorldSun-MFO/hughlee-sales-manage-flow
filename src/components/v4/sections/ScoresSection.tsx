// Server section — 自己抓 scores + notes + 實戰題庫進度,渲染 client UI
import { getDealScores, getDealQuestions } from '@/lib/v4/data';
import { ScoresClient } from './ScoresClient';

export async function ScoresSection({ dealId, isFixtures }: { dealId: string; isFixtures: boolean }) {
  const [{ scores, notes }, questions] = await Promise.all([
    getDealScores(dealId),
    getDealQuestions(dealId),
  ]);
  return (
    <ScoresClient
      dealId={dealId}
      scores={scores}
      notes={notes}
      questions={questions}
      isFixtures={isFixtures}
    />
  );
}
