// /hub/clients/[id] — 客戶詳情(streaming)。同 workspace 版,只是外面套 HubTopBar
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCurrentProfile, getDealCore, getTierConfig, getProfilesAndTeams } from '@/lib/v4/data';
import { IS_DEMO } from '@/lib/demo';
import { HubTopBar } from '@/components/v4/hub/HubTopBar';
import { ClientDetailShell } from '@/components/v4/sections/Shell';
import { HeaderClient } from '@/components/v4/sections/HeaderClient';
import { NextStepClient } from '@/components/v4/sections/NextStepClient';
import { StatsRow, AlertsRow } from '@/components/v4/sections/StatsRow';
import { StagePromptSection } from '@/components/v4/sections/StagePromptSection';
import { LastContactSection } from '@/components/v4/sections/LastContactSection';
import { SavedPlanSection } from '@/components/v4/sections/SavedPlanSection';
import { ChecklistSection } from '@/components/v4/sections/ChecklistSection';
import { PainMatrixSection } from '@/components/v4/sections/PainMatrixSection';
import { CommentsSection } from '@/components/v4/sections/CommentsSection';
import { TasksSection } from '@/components/v4/sections/TasksSection';
import { AttachmentsSection } from '@/components/v4/sections/AttachmentsSection';
import { DealAmmoSection } from '@/components/v4/DealAmmoSection';
import { DeleteDealButton } from '@/components/v4/sections/DeleteDealButton';
import {
  ChecklistSkeleton, CommentsSkeleton, TasksSkeleton,
  AttachmentsSkeleton, AmmoSkeleton,
} from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

export default async function HubClientDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [deal, tierConfig, profile, profilesTeams] = await Promise.all([
    getDealCore(id),
    getTierConfig(),
    getCurrentProfile(),
    getProfilesAndTeams(),
  ]);
  const isFixtures = IS_DEMO || !deal;

  if (!deal) {
    return (
      <>
        <HubTopBar pageLabel="找不到客戶" source={isFixtures ? 'fixtures' : 'supabase'} profile={profile} />
        <div className="mx-auto max-w-[1240px] grid place-items-center px-8 py-20">
          <div className="grid gap-3 text-center">
            <div className="font-v4-serif text-3xl text-ink">找不到此客戶</div>
            <Link href="/hub/clients" className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 hover:text-ink">
              <ArrowLeft className="h-3 w-3" /> 返回
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HubTopBar pageLabel={deal.name.replace(/^【範例】/, '')} source={isFixtures ? 'fixtures' : 'supabase'} profile={profile} />
      <div className="mx-auto max-w-[1240px]">
        <ClientDetailShell deal={deal} backHref="/hub/clients" isFixtures={isFixtures}>
          <HeaderClient deal={deal} isFixtures={isFixtures} profile={profile} profiles={profilesTeams.profiles} />
          <AlertsRow deal={deal} tierConfig={tierConfig} />
          <StatsRow deal={deal} />
          <StagePromptSection stage={deal.stage} />
          <NextStepClient deal={deal} isFixtures={isFixtures} />
          <LastContactSection deal={deal} tierConfig={tierConfig} isFixtures={isFixtures} />

          <Suspense fallback={null}>
            <SavedPlanSection dealId={id} isFixtures={isFixtures} />
          </Suspense>

          <Suspense fallback={<ChecklistSkeleton />}>
            <ChecklistSection dealId={id} stage={deal.stage} isFixtures={isFixtures} />
          </Suspense>

          {/* MEDDPICC 評分 + 實戰題庫已移至「今日 → MEDDPICC」tab */}

          <Suspense fallback={<AmmoSkeleton />}>
            <DealAmmoSection dealId={id} isFixtures={isFixtures} />
          </Suspense>

          <Suspense fallback={null}>
            <PainMatrixSection />
          </Suspense>

          <Suspense fallback={<AttachmentsSkeleton />}>
            <AttachmentsSection dealId={id} />
          </Suspense>

          <Suspense fallback={<CommentsSkeleton />}>
            <CommentsSection dealId={id} isFixtures={isFixtures} />
          </Suspense>

          <Suspense fallback={<TasksSkeleton />}>
            <TasksSection dealId={id} base="/hub" isFixtures={isFixtures} />
          </Suspense>

          <DeleteDealButton dealId={id} dealName={deal.name} base="/hub" isFixtures={isFixtures} />
        </ClientDetailShell>
      </div>
    </>
  );
}
