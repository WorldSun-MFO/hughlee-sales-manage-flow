// ============================================================
// V4 Skeleton 元件庫 — 給 <Suspense fallback> 和 loading.tsx 用
// ============================================================
// 設計原則:
//   - 跟對應實際內容的 layout 一致(高度、間距、欄位數)
//   - 用 animate-pulse + ink/8 灰塊
//   - 純展示,不接資料,server-renderable
// ============================================================
import { cn } from '@/lib/v4/utils';

function Bar({ className }: { className?: string }) {
  return <div className={cn('h-3 rounded-sm bg-ink/8 animate-pulse', className)} />;
}

function Block({ className }: { className?: string }) {
  return <div className={cn('rounded-md bg-ink/5 animate-pulse', className)} />;
}

// ============================================================
// Header skeleton(/ 標題列)
// ============================================================
export function HeaderSkeleton() {
  return (
    <header className="grid gap-3">
      <Bar className="w-20" />
      <Bar className="h-12 w-3/4 max-w-xl" />
      <Bar className="h-3 w-1/2 max-w-md" />
    </header>
  );
}

// ============================================================
// 列表頁:案件 list 骨架(Pipeline / Clients)
// ============================================================
export function DealListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[60px_1fr_140px_120px] items-center gap-4 rounded-md border border-ink/10 bg-paper p-4">
          <Block className="h-9 w-12" />
          <div className="grid gap-2">
            <Bar className="w-2/3" />
            <Bar className="w-1/3 h-2" />
          </div>
          <Bar className="w-20" />
          <Bar className="w-16" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 今日:優先客戶 + 任務骨架
// ============================================================
export function TodaySkeleton() {
  return (
    <div className="grid gap-12 px-8 py-10 lg:px-14 lg:py-14">
      <HeaderSkeleton />
      <section className="grid gap-4">
        <Bar className="w-32" />
        <DealListSkeleton rows={4} />
      </section>
      <section className="grid gap-4">
        <Bar className="w-32" />
        <div className="grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-3 rounded-md border border-ink/10 bg-paper px-4 py-3">
              <Block className="h-4 w-4 rounded-sm" />
              <Bar className="w-2/3" />
              <Bar className="w-16" />
              <Bar className="w-12" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 詳情頁 sections
// ============================================================
export function DealHeaderSkeleton() {
  return (
    <header className="grid gap-3">
      <div className="flex items-center gap-2">
        <Block className="h-6 w-12" />
        <Block className="h-6 w-20" />
        <Bar className="w-24" />
      </div>
      <Bar className="h-12 w-2/3 max-w-2xl" />
      <Bar className="w-1/3" />
    </header>
  );
}

export function StatsRowSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-md border border-ink/10 bg-paper p-4">
          <Bar className="w-12 h-2 mb-2" />
          <Bar className="w-20 h-4" />
        </div>
      ))}
    </section>
  );
}

export function ScoresSkeleton() {
  return (
    <section className="grid gap-3">
      <Bar className="w-32" />
      <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[40px_1fr_90px] items-center gap-3 border border-ink/8 rounded-sm px-3 py-2">
            <Bar className="w-6" />
            <Bar className="w-1/2" />
            <Bar className="w-16" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ChecklistSkeleton() {
  return (
    <section className="grid gap-3">
      <Bar className="w-40" />
      <div className="grid gap-1 rounded-md border border-ink/10 bg-paper p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr] items-center gap-2 py-1.5">
            <Block className="h-4 w-4 rounded-sm" />
            <Bar className="w-3/4" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function CommentsSkeleton() {
  return (
    <section className="grid gap-3">
      <Bar className="w-32" />
      <Block className="h-24 w-full" />
      <div className="grid gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-md border border-ink/10 bg-cream/40 p-3">
            <div className="flex justify-between mb-2">
              <Bar className="w-20 h-2" />
              <Bar className="w-16 h-2" />
            </div>
            <Bar className="w-full mb-1" />
            <Bar className="w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function TasksSkeleton() {
  return (
    <section className="grid gap-3">
      <Bar className="w-24" />
      <div className="grid gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[24px_1fr_auto_auto_auto] items-center gap-3 rounded-md border border-ink/10 bg-paper px-4 py-3">
            <Block className="h-5 w-5 rounded-sm" />
            <Bar className="w-2/3" />
            <Bar className="w-12" />
            <Bar className="w-12" />
            <Block className="h-5 w-5 rounded-sm" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function AttachmentsSkeleton() {
  return (
    <section className="grid gap-3">
      <Bar className="w-20" />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Block key={i} className="h-7 w-32" />
        ))}
      </div>
    </section>
  );
}

export function AmmoSkeleton() {
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <Bar className="w-32" />
        <Block className="h-7 w-28" />
      </div>
    </section>
  );
}

// ============================================================
// 整體 skeleton 組合 — loading.tsx 用
// ============================================================
export function ClientDetailSkeleton() {
  return (
    <div className="grid gap-10 px-8 py-10 lg:px-14 lg:py-14">
      <Bar className="w-24" />
      <DealHeaderSkeleton />
      <StatsRowSkeleton />
      <section className="grid gap-3">
        <Bar className="w-16" />
        <Block className="h-24 w-full" />
      </section>
      <ChecklistSkeleton />
      <ScoresSkeleton />
      <CommentsSkeleton />
      <TasksSkeleton />
    </div>
  );
}

export function ListPageSkeleton() {
  return (
    <div className="grid gap-10 px-8 py-10 lg:px-14 lg:py-14">
      <HeaderSkeleton />
      <DealListSkeleton rows={10} />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="grid gap-10 px-8 py-10 lg:px-14 lg:py-14">
      <HeaderSkeleton />
      {Array.from({ length: 3 }).map((_, i) => (
        <section key={i} className="grid gap-3">
          <Bar className="w-32" />
          <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="grid grid-cols-[120px_1fr] items-center gap-3 py-2">
                <Bar className="w-20 h-2" />
                <Bar className="w-2/3" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
