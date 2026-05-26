import { getDealQuestions } from '@/lib/v4/data';
import { QuestionsClient } from './QuestionsClient';

export async function QuestionsSection({ dealId, isFixtures }: { dealId: string; isFixtures: boolean }) {
  const questions = await getDealQuestions(dealId);
  return <QuestionsClient dealId={dealId} questions={questions} isFixtures={isFixtures} />;
}
