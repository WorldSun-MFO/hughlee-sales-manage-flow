import { HeaderSkeleton } from '@/components/v4/skeletons';
export default function Loading() {
  return (
    <main className="mx-auto max-w-[1240px] px-6 pt-14 pb-16 lg:px-10">
      <HeaderSkeleton />
      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <div className="h-72 rounded-md border border-ink/10 bg-paper animate-pulse" />
        <div className="h-72 rounded-md border border-ink/10 bg-paper animate-pulse" />
      </div>
    </main>
  );
}
