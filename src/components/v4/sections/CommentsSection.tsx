import { getDealComments, getProfilesAndTeams } from '@/lib/v4/data';
import { CommentsClient } from './CommentsClient';

export async function CommentsSection({ dealId, isFixtures }: { dealId: string; isFixtures: boolean }) {
  // 兩個 fetcher 並行
  const [comments, profilesTeams] = await Promise.all([
    getDealComments(dealId),
    getProfilesAndTeams(),
  ]);
  return <CommentsClient dealId={dealId} comments={comments} profiles={profilesTeams.profiles} isFixtures={isFixtures} />;
}
