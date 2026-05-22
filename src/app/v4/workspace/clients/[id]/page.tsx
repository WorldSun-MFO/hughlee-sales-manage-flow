// ============================================================
// /v4/workspace/clients/[id] — 客戶詳情(streaming)
// ============================================================
// 設計:
//   - 抓 deal core(單列,快)→ 阻塞渲染,Shell + Header 立刻就位
//   - 其他 sections 各自包 Suspense,各跑各的並行 fetch
//   - 任一 section 慢都不會擋 header 顯示,使用者可以馬上互動
// ============================================================
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getDealCore, getTierConfig } from '@/lib/v4/data';
import { IS_DEMO } from '@/lib/demo';
import { ClientDetailShell } from '@/components/v4/sections/Shell';
import { HeaderClient } from '@/components/v4/sections/HeaderClient';
import { NextStepClient } from '@/components/v4/sections/NextStepClient';
import { StatsRow, AlertsRow } from '@/components/v4/sections/StatsRow';
import { ChecklistSection } from '@/components/v4/sections/ChecklistSection';
import { QuestionsSection } from '@/components/v4/sections/QuestionsSection';
import { ScoresSection } from '@/components/v4/sections/ScoresSection';
import { CommentsSection } from '@/components/v4/sections/CommentsSection';
import { TasksSection } from '@/components/v4/sections/TasksSection';
import { AttachmentsSection } from '@/components/v4/sections/AttachmentsSection';
import { DealAmmoSection } from '@/components/v4/DealAmmoSection';
import {
  ChecklistSkeleton, ScoresSkeleton, CommentsSkeleton, TasksSkeleton,
  AttachmentsSkeleton, AmmoSkeleton,
} from '@/components/v4/skeletons';

export const dynamic = 'force-dynamic';

export default async function WorkspaceClientDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [deal, tierConfig] = await Promise.all([
    getDealCore(id),
    getTierConfig(),
  ]);
  const isFixtures = IS_DEMO || !deal;

  if (!deal) {
    return (
      <div className="grid place-items-center px-8 py-20">
        <div className="grid gap-3 text-center">
          <div className="font-v4-serif text-3xl text-ink">找不到此客戶</div>
          <Link href="/v4/workspace/clients" className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> 返回
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ClientDetailShell deal={deal} backHref="/v4/workspace/clients" isFixtures={isFixtures}>
      <HeaderClient deal={deal} isFixtures={isFixtures} />
      <AlertsRow deal={deal} tierConfig={tierConfig} />
      <StatsRow deal={deal} />
      <NextStepClient deal={deal} isFixtures={isFixtures} />

      <Suspense fallback={<ChecklistSkeleton />}>
        <ChecklistSection dealId={id} stage={deal.stage} isFixtures={isFixtures} />
      </Suspense>

      <Suspense fallback={<ScoresSkeleton />}>
        <ScoresSection dealId={id} isFixtures={isFixtures} />
      </Suspense>

      <Suspense fallback={null}>
        <QuestionsSection dealId={id} isFixtures={isFixtures} />
      </Suspense>

      <Suspense fallback={<AmmoSkeleton />}>
        <DealAmmoSection dealId={id} isFixtures={isFixtures} />
      </Suspense>

      <Suspense fallback={<AttachmentsSkeleton />}>
        <AttachmentsSection dealId={id} />
      </Suspense>

      <Suspense fallback={<CommentsSkeleton />}>
        <CommentsSection dealId={id} isFixtures={isFixtures} />
      </Suspense>

      <Suspense fallback={<TasksSkeleton />}>
        <TasksSection dealId={id} base="/v4/workspace" isFixtures={isFixtures} />
      </Suspense>
    </ClientDetailShell>
  );
}
