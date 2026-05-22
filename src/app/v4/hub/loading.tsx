import { HeaderSkeleton } from '@/components/v4/skeletons';
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1240px] px-6 py-12 lg:px-10 lg:py-16">
      <HeaderSkeleton />
      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-44 rounded-md border border-ink/10 bg-paper animate-pulse" />
        ))}
      </div>
    </div>
  );
}
