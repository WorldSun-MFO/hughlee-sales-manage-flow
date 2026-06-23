'use client';

// ============================================================
// 新增案件按鈕 + Drawer 表單
// ============================================================
// ClientsListView / PipelineView 都會用到。獨立元件讓父層 view 維持
// server component(只負責抓 snapshot)。
//
// 預設值:
//   - stage = L1
//   - rm_id = 當前登入者(由 createDeal 內 supabase.auth.getUser 自動拿)
//   - first_contact = 今天
//
// 必填:name + aum_usd
// 建立成功後 router.push 到新 deal 的詳情頁。
// ============================================================
import { useLayoutEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Check } from 'lucide-react';
import { createDeal } from '@/lib/v4/mutations';
import { Drawer } from '@/components/v4/Drawer';
import { cn } from '@/lib/v4/utils';
import type { Profile, Tier } from '@/lib/v4/types';

const TIER_OPTIONS: Array<{ value: Tier; label: string }> = [
  { value: 'SSS', label: 'SSS · 旗艦 Flagship' },
  { value: 'S', label: 'S · 高階 Premier' },
  { value: 'A', label: 'A · 中階 Advanced' },
  { value: 'B', label: 'B · 初階 Entry' },
  { value: 'C', label: 'C · 基礎 Foundation' },
];

export function AddDealButton({
  base, isFixtures, profile, profiles,
}: {
  base: '/workspace' | '/hub';
  isFixtures: boolean;
  profile: Profile | null;
  profiles: Profile[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [aum, setAum] = useState<string>('');
  const [tier, setTier] = useState<Tier | ''>('');
  const [product, setProduct] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [expectedPayment, setExpectedPayment] = useState('');
  const [rmId, setRmId] = useState(profile?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // AUM 千分位:state(aum)永遠只存純數字,顯示時才加逗號;送出用 Number(aum)。
  const aumInputRef = useRef<HTMLInputElement>(null);
  const caretDigitsRef = useRef<number | null>(null);
  const aumDisplay = aum ? Number(aum).toLocaleString('en-US') : '';

  // 插入逗號會讓游標跳位(頓挫感的來源)。做法:change 時記下「游標左邊有
  // 幾個數字」,重繪後在 useLayoutEffect(繪製前、不閃)把游標還原到第 N 個
  // 數字之後 —— 不管逗號怎麼增減,游標都停在使用者剛打的數字旁。
  useLayoutEffect(() => {
    const el = aumInputRef.current;
    const want = caretDigitsRef.current;
    if (!el || want == null) return;
    let pos = 0;
    let seen = 0;
    while (pos < el.value.length && seen < want) {
      if (/\d/.test(el.value[pos])) seen += 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
    caretDigitsRef.current = null;
  }, [aum]);

  // 可指派的 RM 名單(對齊 deals_insert RLS:admin=全部、team_lead=自己團隊、rm=只能自己)
  const role = profile?.role;
  const assignable = !profile ? []
    : role === 'admin' ? profiles
      : role === 'team_lead' ? profiles.filter((p) => p.id === profile.id || (!!profile.team_id && p.team_id === profile.team_id))
        : [profile];
  const canPickRm = (role === 'admin' || role === 'team_lead') && assignable.length > 1;

  function reset() {
    setName(''); setAum(''); setTier(''); setProduct(''); setNextStep(''); setTargetDate(''); setExpectedPayment('');
    setRmId(profile?.id ?? ''); setErr(null);
  }

  async function submit() {
    if (!name.trim() || !aum || busy) return;
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }
    const aumNum = Number(aum);
    if (Number.isNaN(aumNum) || aumNum < 0) { setErr('AUM 必須是正數'); return; }
    setBusy(true); setErr(null);
    try {
      const newId = await createDeal({
        name: name.trim(),
        aum_usd: aumNum,
        tier: tier || null,
        product: product.trim() || null,
        next_step: nextStep.trim() || null,
        target_close_date: targetDate || null,
        expected_payment_date: expectedPayment || null,
        rm_id: rmId || undefined,   // 未選/RM 角色 → undefined → createDeal fallback 當前使用者
      });
      reset();
      setOpen(false);
      // 跳到新案件詳情頁
      router.push(`${base}/clients/${newId}` as never);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isFixtures}
        title={isFixtures ? 'fixtures 模式無法新增' : '新增案件'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper transition hover:bg-graphite',
          isFixtures && 'cursor-not-allowed opacity-50',
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        新增案件
      </button>

      <Drawer
        open={open}
        onClose={() => { setOpen(false); reset(); }}
        title="新增案件"
      >
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="grid gap-4"
        >
          <Field label="案件名稱 (必填)" hint="格式建議:公司 — 客戶稱呼,例如「宏遠家族 — 陳董」">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="客戶 / 案件名稱"
              className="w-full rounded-md border border-ink/15 bg-cream/40 px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
            />
          </Field>

          <Field label="AUM (USD, 必填)" hint="客戶總可投資資產(美元)">
            <input
              ref={aumInputRef}
              type="text"
              inputMode="numeric"
              value={aumDisplay}
              onChange={(e) => {
                const el = e.target;
                const caret = el.selectionStart ?? el.value.length;
                // 記住游標左邊的數字個數,供上面的 useLayoutEffect 還原游標
                caretDigitsRef.current = el.value.slice(0, caret).replace(/\D/g, '').length;
                setAum(el.value.replace(/\D/g, ''));
              }}
              required
              placeholder="例如 5,000,000"
              className="w-full rounded-md border border-ink/15 bg-cream/40 px-3 py-2 font-v4-mono text-sm text-ink focus:border-ink/40 focus:outline-none"
            />
          </Field>

          {canPickRm && (
            <Field label="指派 RM" hint={role === 'admin' ? '管理員可指派給任何成員' : '可指派給你團隊內的成員'}>
              <select
                value={rmId}
                onChange={(e) => setRmId(e.target.value)}
                className="w-full rounded-md border border-ink/15 bg-cream/40 px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
              >
                {assignable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.full_name || p.email) + (p.id === profile?.id ? '' : '')}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Tier" hint="可空,之後再依 AUM 校準">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier | '')}
              className="w-full rounded-md border border-ink/15 bg-cream/40 px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
            >
              <option value="">(暫不設)</option>
              {TIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="主要產品方向" hint="例如:香港分紅保險 + HSBC 3000萬級">
            <input
              type="text"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="(可選)"
              className="w-full rounded-md border border-ink/15 bg-cream/40 px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
            />
          </Field>

          <Field label="下一步" hint="第一個要做的具體動作">
            <textarea
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              rows={3}
              placeholder="例如:寄確認信、加 LINE,做會前蒐集"
              className="w-full resize-vertical rounded-md border border-ink/15 bg-cream/40 px-3 py-2 text-sm leading-6 text-ink focus:border-ink/40 focus:outline-none"
            />
          </Field>

          <Field label="目標成交日" hint="可空">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="rounded-md border border-ink/15 bg-cream/40 px-3 py-2 font-v4-mono text-sm text-ink focus:border-ink/40 focus:outline-none"
            />
          </Field>

          <Field label="預計收款日" hint="可空">
            <input
              type="date"
              value={expectedPayment}
              onChange={(e) => setExpectedPayment(e.target.value)}
              className="rounded-md border border-ink/15 bg-cream/40 px-3 py-2 font-v4-mono text-sm text-ink focus:border-ink/40 focus:outline-none"
            />
          </Field>

          {err && <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-sm text-claret">{err}</div>}

          <div className="grid gap-2 rounded-md border border-ink/10 bg-cream/40 p-3 text-xs text-ink/65">
            <div><span className="label-caps text-ink/45">自動帶入</span></div>
            <ul className="grid gap-0.5 font-v4-mono text-[11px]">
              <li>· stage = L1(線索)</li>
              {!canPickRm && <li>· RM = 你自己</li>}
              <li>· 首次接觸 = 今天</li>
              <li>· MEDDIC 8 個分數 = 全部 0(進詳情頁再給分)</li>
            </ul>
          </div>

          <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-2 border-t border-ink/10 bg-paper/95 px-6 py-3 backdrop-blur">
            <button
              type="button"
              onClick={() => { setOpen(false); reset(); }}
              className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink/75 hover:border-ink/30 hover:text-ink"
            >取消</button>
            <button
              type="submit"
              disabled={busy || !name.trim() || !aum}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-graphite disabled:cursor-not-allowed disabled:bg-ink/30"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Check className="h-4 w-4" strokeWidth={2} />}
              {busy ? '建立中…' : '建立並進入'}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="label-caps text-ink/55">{label}</span>
      {children}
      {hint && <span className="font-v4-mono text-[10.5px] text-ink/45">{hint}</span>}
    </label>
  );
}
