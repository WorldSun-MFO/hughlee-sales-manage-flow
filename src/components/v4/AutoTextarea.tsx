'use client';

// ============================================================
// 依內容自動長高的 textarea
// ============================================================
// 不出現內部捲軸,文字越多框越高、刪字會縮回。
// 高度下限交給呼叫端用 className 的 min-h-[...] 控制
// (CSS min-height 會蓋過較小的 inline height,所以短內容也有最低高度)。
// ============================================================
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/v4/utils';

export function AutoTextarea({
  value,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';                  // 先歸零才量得到真實 scrollHeight
    el.style.height = `${el.scrollHeight}px`;  // 撐到剛好容納內容
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={cn('resize-none overflow-hidden', className)}
      {...rest}
    />
  );
}
