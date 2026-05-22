'use client';

// ============================================================
// 客戶詳情頁 — v4
// ============================================================
// 變動(Phase 2.3):
//   - 從 server component → client component(因為要 state 控 Drawer)
//   - 底部三顆按鈕從裝飾變功能:
//     · 剛聯繫:Phase 2.4 再做(會打 last_contact_at)
//     · AI 助手:右側 slide-in Drawer 跑 /api/ai/parse-interaction
//     · 推進階段:右側 slide-in Drawer 跑 /api/ai/generate-plan
//   - Drawer 內共用 DealAIPanel / DealPlanPanel(不重抓 deal list,
//     因為 deal 已知)
// ============================================================
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Check, Loader2, Phone, Send, Sparkles, TrendingUp, ListTodo as ListTodoIcon } from 'lucide-react';
import type { ScoreField, Scores, Snapshot, StageId, Tier } from '@/lib/v4/types';
import { STAGE_PROB, STAGES } from '@/lib/v4/constants';
import { cn, contactOverdue, daysSince, fmtMoney, redFlag, totalScore, TIER_STYLES } from '@/lib/v4/utils';
import { Drawer } from '@/components/v4/Drawer';
import { DealAIPanel } from '@/components/v4/DealAIPanel';
import { DealPlanPanel } from '@/components/v4/DealPlanPanel';
import { addComment, createTask, markContacted, patchDeal, patchScores, setScoreNote, splitNextStepIntoTasks, toggleChecklistItem, setDealQuestion } from '@/lib/v4/mutations';
import { TaskRow, TaskComposer } from '@/components/v4/TaskRow';
import { AttachmentChip } from '@/components/v4/AttachmentTray';
import { Paperclip, ChevronRight as ChevronRightIcon, HelpCircle } from 'lucide-react';
import { CHECKLIST, QUESTION_BANK } from '@/lib/constants';
import { InlineText, InlineTextarea, InlineSelect, InlineDate, InlineScore } from '@/components/v4/InlineEdit';

const MEDDIC_LABELS: Array<[keyof Scores, string, string]> = [
  ['m', 'M', 'Metrics'],
  ['e', 'E', 'Economic Buyer'],
  ['d1', 'D₁', 'Decision Criteria'],
  ['d2', 'D₂', 'Decision Process'],
  ['p', 'P', 'Paper Process'],
  ['i', 'I', 'Identify Pain'],
  ['c1', 'C₁', 'Champion'],
  ['c2', 'C₂', 'Competition'],
];

type DrawerKind = 'ai' | 'plan' | null;

export function ClientDetailView({
  snapshot, dealId, base, backHref,
}: {
  snapshot: Snapshot;
  dealId: string;
  base: '/v4/workspace' | '/v4/hub';
  backHref: string;
}) {
  void base;
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactMsg, setContactMsg] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentErr, setCommentErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const deal = snapshot.deals.find((d) => d.id === dealId);
  if (!deal) {
    return (
      <div className="grid place-items-center px-8 py-20">
        <div className="grid gap-3 text-center">
          <div className="font-v4-serif text-3xl text-ink">找不到此客戶</div>
          <Link href={backHref} className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> 返回
          </Link>
        </div>
      </div>
    );
  }

  const tasks = snapshot.tasks.filter((t) => t.deal_id === deal.id);
  const score = totalScore(deal);
  const rf = redFlag(deal);
  const ci = contactOverdue(deal, snapshot.tierConfig);
  const isFixtures = snapshot.source === 'fixtures';

  async function handleMarkContacted() {
    if (contactBusy) return;
    if (isFixtures) { setContactMsg('fixtures 模式無法寫入'); setTimeout(() => setContactMsg(null), 2500); return; }
    setContactBusy(true);
    setContactMsg(null);
    try {
      await markContacted(deal!.id);
      setContactMsg('✓ 已更新最後聯繫時間');
      startTransition(() => router.refresh());
      setTimeout(() => setContactMsg(null), 2500);
    } catch (err) {
      setContactMsg(`失敗:${(err as Error).message}`);
    } finally {
      setContactBusy(false);
    }
  }

  async function handleAddComment() {
    const body = commentText.trim();
    if (!body || commentBusy) return;
    if (isFixtures) { setCommentErr('fixtures 模式無法寫入'); return; }
    setCommentBusy(true);
    setCommentErr(null);
    try {
      await addComment(deal!.id, body);
      setCommentText('');
      startTransition(() => router.refresh());
    } catch (err) {
      setCommentErr((err as Error).message);
    } finally {
      setCommentBusy(false);
    }
  }

  const [splitBusy, setSplitBusy] = useState(false);
  const [splitMsg, setSplitMsg] = useState<string | null>(null);
  async function handleSplitNextStep() {
    if (!deal!.next_step || splitBusy) return;
    if (isFixtures) { setSplitMsg('fixtures 模式無法寫入'); setTimeout(() => setSplitMsg(null), 2500); return; }
    const titles = splitNextStepIntoTasks(deal!.next_step);
    if (titles.length === 0) { setSplitMsg('下一步沒有可拆的內容'); setTimeout(() => setSplitMsg(null), 2500); return; }
    setSplitBusy(true); setSplitMsg(null);
    try {
      for (const title of titles) {
        await createTask({ deal_id: deal!.id, title, priority: 'normal', status: 'todo' });
      }
      setSplitMsg(`✓ 已新增 ${titles.length} 個任務`);
      startTransition(() => router.refresh());
      setTimeout(() => setSplitMsg(null), 2500);
    } catch (err) {
      setSplitMsg(`失敗:${(err as Error).message}`);
    } finally {
      setSplitBusy(false);
    }
  }

  return (
    <div className="grid gap-10 px-8 py-10 lg:px-14 lg:py-14">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 transition hover:text-ink">
          <ArrowLeft className="h-3 w-3" strokeWidth={2} /> {backHref.includes('pipeline') ? '回 Pipeline' : backHref.includes('today') ? '回今日' : '回客戶名冊'}
        </Link>
      </div>

      <header className="grid gap-3">
        <div className="flex items-center gap-2">
          <InlineSelect<Tier>
            value={deal.tier}
            options={[{ value: 'SSS' as Tier, label: 'SSS · 旗艦' }, { value: 'S' as Tier, label: 'S · 高階' }, { value: 'A' as Tier, label: 'A · 中階' }, { value: 'B' as Tier, label: 'B · 初階' }, { value: 'C' as Tier, label: 'C · 基礎' }]}
            onSave={async (next) => { await patchDeal(deal.id, { tier: next }); startTransition(() => router.refresh()); }}
            isFixtures={isFixtures}
            renderDisplay={(v) => v
              ? <span className={`rounded-sm px-2 py-1 font-v4-mono text-[11px] font-bold ${TIER_STYLES[v]}`}>{v}</span>
              : <span className="rounded-sm border border-ink/15 px-2 py-1 font-v4-mono text-[11px] text-ink/45">設 Tier</span>}
          />
          <InlineSelect<StageId>
            value={deal.stage}
            options={STAGES.map((s) => ({ value: s.id, label: `${s.id} · ${s.name}` }))}
            onSave={async (next) => { if (next) { await patchDeal(deal.id, { stage: next }); startTransition(() => router.refresh()); } }}
            isFixtures={isFixtures}
            renderDisplay={(v) => v
              ? <span className={`stage-${v} rounded-sm px-2 py-1 font-v4-mono text-[11px] font-bold`}>{v} · {STAGE_PROB[v]}%</span>
              : <span className="rounded-sm border border-ink/15 px-2 py-1 font-v4-mono text-[11px] text-ink/45">設階段</span>}
          />
          <span className="font-v4-mono text-[11px] text-ink/45 numeric">DEAL · {deal.id.toUpperCase()}</span>
        </div>

        <InlineText
          value={deal.name.replace(/^【範例】/, '')}
          onSave={async (next) => { await patchDeal(deal.id, { name: next }); startTransition(() => router.refresh()); }}
          isFixtures={isFixtures}
          placeholder="(尚未命名)"
          displayClassName="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]"
        />

        <div className="grid grid-cols-[auto_auto] items-center gap-x-4 gap-y-1 font-v4-mono text-sm text-ink/55 lg:grid-cols-[auto_auto_1fr] lg:gap-x-6">
          <span className="label-caps text-ink/45 self-center">產品</span>
          <InlineText
            value={deal.product ?? ''}
            onSave={async (next) => { await patchDeal(deal.id, { product: next || null }); startTransition(() => router.refresh()); }}
            isFixtures={isFixtures}
            placeholder="(未填產品)"
            displayClassName="font-v4-mono text-sm text-ink"
          />
          <span className="font-v4-mono text-xs text-ink/45">RM · {deal.rm?.full_name ?? '—'}</span>
        </div>
      </header>

      {(rf || ci?.status === 'overdue') ? (
        <div className="grid gap-2">
          {rf ? (
            <div className="flex items-center gap-2 rounded-md border border-claret/30 bg-claret/8 px-4 py-3 text-sm font-semibold text-claret">
              <span className="text-base">🚩</span> {rf}
            </div>
          ) : null}
          {ci?.status === 'overdue' ? (
            <div className="flex items-center gap-2 rounded-md border border-brass/40 bg-brass/10 px-4 py-3 text-sm font-semibold text-brass">
              <Phone className="h-4 w-4" strokeWidth={1.75} /> 已逾期 {ci.deltaDays} 天未聯繫
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="AUM" value={fmtMoney(Number(deal.aum_usd))} />
        <Stat label="MEDDIC" value={`${score} / 80`} />
        <Stat label="最後更新" value={`${daysSince(deal.last_updated)} 天前`} />
        <Stat label="最後聯繫" value={deal.last_contact_at ? `${daysSince(deal.last_contact_at)} 天前` : '—'} />
      </section>

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <div className="label-caps text-ink/55">下一步</div>
          {deal.next_step && (
            <button
              type="button"
              onClick={handleSplitNextStep}
              disabled={splitBusy || isFixtures}
              title="把多行下一步拆成獨立任務"
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-paper px-2.5 py-1 font-v4-mono text-[11px] font-semibold text-ink/70 transition hover:border-ink/30 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {splitBusy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <ListTodoIcon className="h-3 w-3" strokeWidth={2} />}
              {splitBusy ? '建立中…' : '拆成任務'}
            </button>
          )}
        </div>
        <div className="rounded-md border border-ink/10 bg-cream/60 p-4">
          <InlineTextarea
            value={deal.next_step}
            onSave={async (next) => { await patchDeal(deal.id, { next_step: next }); startTransition(() => router.refresh()); }}
            isFixtures={isFixtures}
            placeholder="尚未填寫下一步。點擊撰寫..."
            rows={4}
            displayClassName="font-v4-serif text-lg leading-relaxed text-ink"
          />
        </div>
        {splitMsg && <div className="font-v4-mono text-[11px] text-ink/65">{splitMsg}</div>}
        <div className="flex items-center gap-2 font-v4-mono text-xs text-ink/55">
          <Calendar className="h-3 w-3" strokeWidth={2} />
          目標成交
          <InlineDate
            value={deal.target_close_date}
            onSave={async (next) => { await patchDeal(deal.id, { target_close_date: next }); startTransition(() => router.refresh()); }}
            isFixtures={isFixtures}
          />
        </div>
      </section>

      {/* 階段推進 checklist */}
      <StageChecklistSection deal={deal} isFixtures={isFixtures} onChanged={() => startTransition(() => router.refresh())} />

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <div className="label-caps text-ink/55">MEDDIC 評分</div>
          <div className="font-v4-mono text-[10.5px] text-ink/45">點分數改 0–10 · 點「+ 加備註」寫理由</div>
        </div>
        <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
          {MEDDIC_LABELS.map(([k, key, label]) => {
            const v = deal.scores?.[k] ?? 0;
            const tone = v >= 8 ? 'bg-forest' : v >= 5 ? 'bg-brass' : v >= 3 ? 'bg-ink/40' : 'bg-claret/70';
            const noteRow = deal.score_notes?.find((sn) => sn.field === k);
            return (
              <div key={k} className="grid gap-1 rounded-sm border border-ink/8 px-3 py-2">
                <div className="grid grid-cols-[40px_1fr_90px] items-center gap-3">
                  <span className="font-v4-mono text-sm font-bold text-ink">{key}</span>
                  <span className="text-xs text-ink/65">{label}</span>
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-ink/8">
                      <div className={cn('h-full', tone)} style={{ width: `${v * 10}%` }} />
                    </div>
                    <InlineScore
                      value={v}
                      onSave={async (next) => { await patchScores(deal.id, { [k]: next } as Partial<Scores>); startTransition(() => router.refresh()); }}
                      isFixtures={isFixtures}
                    />
                  </div>
                </div>
                <ScoreNoteEditor
                  dealId={deal.id}
                  field={k as ScoreField}
                  initialNote={noteRow?.note ?? ''}
                  isFixtures={isFixtures}
                  onSaved={() => startTransition(() => router.refresh())}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="label-caps text-ink/55">活動紀錄 · {deal.comments?.length ?? 0}</div>

        {/* Comment composer */}
        <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-4">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            placeholder="寫個筆記、補充對話、紀錄一個觀察... Cmd/Ctrl + Enter 送出"
            disabled={commentBusy}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleAddComment(); }
            }}
            className="w-full resize-vertical rounded-md border border-ink/10 bg-cream/40 px-3 py-2 text-sm leading-6 text-ink placeholder:text-ink/40 focus:border-ink/30 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="font-v4-mono text-[10.5px] text-ink/45">{isFixtures ? 'fixtures 模式:寫入會被擋下' : '會以你的身分寫入,RM/隊員都看得到'}</span>
            <button
              type="button"
              onClick={handleAddComment}
              disabled={commentBusy || !commentText.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:bg-ink/25"
            >
              {commentBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Send className="h-3.5 w-3.5" strokeWidth={2} />}
              {commentBusy ? '送出中…' : '送出'}
            </button>
          </div>
          {commentErr && <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">{commentErr}</div>}
        </div>

        {(deal.comments?.length ?? 0) > 0 ? (
          <div className="grid gap-2">
            {deal.comments!
              .slice()
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((c) => {
                const author = snapshot.profiles.find((p) => p.id === c.author_id);
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'rounded-md border px-4 py-3',
                      c.is_system ? 'border-ink/10 bg-ink/2 text-ink/65'
                        : c.is_raw ? 'border-cobalt/25 bg-cobalt/4'
                          : 'border-ink/10 bg-cream/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 font-v4-mono text-[11px] text-ink/45">
                      <span>{author?.full_name ?? (c.is_system ? 'system' : 'ai')}</span>
                      <span className="numeric">{daysSince(c.created_at)} 天前</span>
                    </div>
                    <div className="mt-1 text-sm leading-6 text-ink/85 whitespace-pre-wrap">{c.body}</div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-ink/15 bg-paper/60 px-4 py-6 text-center text-xs text-ink/45">
            還沒有活動紀錄。寫第一則上去 ↑
          </div>
        )}
      </section>

      {/* 待澄清題目 */}
      <DealQuestionsSection deal={deal} isFixtures={isFixtures} onChanged={() => startTransition(() => router.refresh())} />

      {(deal.deal_attachments?.length ?? 0) > 0 && (
        <section className="grid gap-3">
          <div className="label-caps text-ink/55 inline-flex items-center gap-2">
            <Paperclip className="h-3 w-3" strokeWidth={2} />
            附檔 · {deal.deal_attachments!.length}
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {deal.deal_attachments!.map((a) => (
              <AttachmentChip key={a.id} att={a} />
            ))}
          </ul>
          <div className="font-v4-mono text-[10.5px] text-ink/45">點檔名下載 / 預覽(signed URL,1 小時有效)</div>
        </section>
      )}

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <div className="label-caps text-ink/55">任務 · {tasks.length}</div>
          <TaskComposer base={base} snapshot={snapshot} isFixtures={isFixtures} defaultDealId={deal.id} />
        </div>
        {tasks.length > 0 ? (
          <ul className="grid gap-2">
            {tasks.map((t) => (
              <li key={t.id}>
                <TaskRow task={t} snapshot={snapshot} base={base} isFixtures={isFixtures} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-ink/15 bg-paper/60 px-4 py-6 text-center text-xs text-ink/45">
            此客戶沒有任務。上方「+ 新增任務」開始,或按上方「拆成任務」自動拆解 next_step。
          </div>
        )}
      </section>

      {/* 底部固定 action bar */}
      <section className="sticky bottom-0 -mx-8 grid grid-cols-[1fr_1fr_1fr] gap-2 border-t border-ink/10 bg-cream/95 px-8 py-4 backdrop-blur lg:-mx-14 lg:px-14">
        <Action icon={contactBusy ? Loader2 : Phone} iconClass={contactBusy ? 'animate-spin' : undefined} tone="paper" onClick={handleMarkContacted} disabled={contactBusy}>
          {contactBusy ? '更新中…' : '剛聯繫'}
        </Action>
        <Action icon={Sparkles} tone="cobalt" onClick={() => setDrawer('ai')}>AI 助手</Action>
        <Action icon={TrendingUp} tone="forest" onClick={() => setDrawer('plan')}>推進階段</Action>
        {contactMsg && (
          <div className="col-span-3 -mt-1 text-center font-v4-mono text-[11px] text-ink/65">{contactMsg}</div>
        )}
      </section>

      {/* Drawer 容器 — 只有一個,內容依 drawer kind 切換 */}
      <Drawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={
          <span className="inline-flex items-center gap-2">
            {drawer === 'ai' ? <Sparkles className="h-4 w-4 text-cobalt" strokeWidth={1.75} /> : <TrendingUp className="h-4 w-4 text-forest" strokeWidth={1.75} />}
            {drawer === 'ai' ? 'AI 助手' : '推進階段 · 成交規劃'}
          </span>
        }
      >
        {drawer === 'ai' && <DealAIPanel deal={deal} isFixtures={isFixtures} />}
        {drawer === 'plan' && <DealPlanPanel deal={deal} isFixtures={isFixtures} />}
      </Drawer>
    </div>
  );
}

function StageChecklistSection({
  deal, isFixtures, onChanged,
}: {
  deal: { id: string; stage: StageId; stage_checklist?: { item_key: string; checked: boolean }[] };
  isFixtures: boolean;
  onChanged: () => void;
}) {
  const items = CHECKLIST[deal.stage] ?? [];
  if (items.length === 0) return null;
  const checkedCount = items.filter((it) => deal.stage_checklist?.some((c) => c.item_key === it.key && c.checked)).length;
  const allDone = checkedCount === items.length;
  const nextStageIdx = ['L1','L2','L3','L4','L5','L6','L7'].indexOf(deal.stage) + 1;
  const nextStage = (['L1','L2','L3','L4','L5','L6','L7'] as StageId[])[nextStageIdx];

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/55">{deal.stage} → {nextStage ?? '—'} 推進 checklist</div>
        <div className="font-v4-mono text-[11px] text-ink/55 numeric">
          {checkedCount} / {items.length} {allDone && nextStage && '✓ 可推進'}
        </div>
      </div>
      <ul className="grid gap-1 rounded-md border border-ink/10 bg-paper p-4">
        {items.map((it) => {
          const checked = deal.stage_checklist?.some((c) => c.item_key === it.key && c.checked) ?? false;
          return (
            <li key={it.key}>
              <ChecklistRow dealId={deal.id} itemKey={it.key} label={it.label} checked={checked} isFixtures={isFixtures} onChanged={onChanged} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ChecklistRow({
  dealId, itemKey, label, checked, isFixtures, onChanged,
}: {
  dealId: string; itemKey: string; label: string; checked: boolean; isFixtures: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (busy || isFixtures) return;
    setBusy(true);
    try {
      await toggleChecklistItem(dealId, itemKey, !checked);
      onChanged();
    } finally { setBusy(false); }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || isFixtures}
      className="grid w-full grid-cols-[auto_1fr] items-start gap-2 rounded-sm px-1.5 py-1.5 text-left transition hover:bg-cream/40 disabled:cursor-not-allowed"
    >
      <span className={cn(
        'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border transition',
        checked ? 'border-forest bg-forest text-paper' : 'border-ink/30 bg-paper',
      )}>
        {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2.5} /> : checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className={cn('text-sm leading-6', checked ? 'text-ink/55 line-through' : 'text-ink/85')}>{label}</span>
    </button>
  );
}

function DealQuestionsSection({
  deal, isFixtures, onChanged,
}: {
  deal: { id: string; deal_questions?: { question_key: string; answered: boolean; note: string }[] };
  isFixtures: boolean;
  onChanged: () => void;
}) {
  // 從 QUESTION_BANK 拿到所有題目;只顯示已 ask 過的(deal_questions 表裡有 row 的)
  const askedKeys = new Set((deal.deal_questions ?? []).map((q) => q.question_key));
  if (askedKeys.size === 0) return null;
  type BankItem = { key: string; q: string };
  const allBank: Array<{ field: keyof typeof QUESTION_BANK; item: BankItem }> = [];
  for (const [field, items] of Object.entries(QUESTION_BANK)) {
    for (const it of items as BankItem[]) {
      if (askedKeys.has(it.key)) allBank.push({ field: field as keyof typeof QUESTION_BANK, item: it });
    }
  }
  if (allBank.length === 0) return null;

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
          <HelpCircle className="h-3 w-3" strokeWidth={2} /> 待澄清題目 · {allBank.length}
        </div>
        <div className="font-v4-mono text-[10.5px] text-ink/45">勾「已答」+ 補答案內容</div>
      </div>
      <ul className="grid gap-2 rounded-md border border-ink/10 bg-paper p-4">
        {allBank.map(({ field, item }) => {
          const row = (deal.deal_questions ?? []).find((q) => q.question_key === item.key);
          return (
            <li key={item.key}>
              <QuestionRow
                dealId={deal.id}
                field={field}
                item={item}
                answered={row?.answered ?? false}
                note={row?.note ?? ''}
                isFixtures={isFixtures}
                onChanged={onChanged}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function QuestionRow({
  dealId, field, item, answered, note, isFixtures, onChanged,
}: {
  dealId: string;
  field: string;
  item: { key: string; q: string };
  answered: boolean;
  note: string;
  isFixtures: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState(note);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleAnswered() {
    if (busy || isFixtures) return;
    setBusy(true);
    try { await setDealQuestion(dealId, item.key, !answered, note); onChanged(); }
    finally { setBusy(false); }
  }
  async function saveNote() {
    if (busy || isFixtures) return;
    if (draft.trim() === note.trim()) { setEditing(false); return; }
    setBusy(true);
    try { await setDealQuestion(dealId, item.key, answered, draft.trim()); setEditing(false); onChanged(); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-t border-ink/8 pt-2 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={toggleAnswered}
        disabled={busy || isFixtures}
        className={cn(
          'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border transition',
          answered ? 'border-forest bg-forest text-paper' : 'border-ink/30 bg-paper',
        )}
      >
        {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2.5} /> : answered && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <div className="grid gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-v4-mono text-[10px] font-bold uppercase tracking-widest text-ink/55">{field}</span>
          <span className={cn('text-sm leading-6', answered ? 'text-ink/55' : 'text-ink/85')}>{item.q}</span>
        </div>
        {editing ? (
          <div className="grid gap-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              disabled={busy}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveNote(); }
                if (e.key === 'Escape') { setDraft(note); setEditing(false); }
              }}
              placeholder="客戶說了什麼?"
              className="w-full resize-vertical rounded-sm border border-ink/25 bg-cream/40 px-2 py-1 text-xs leading-5 text-ink focus:border-ink/45 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setDraft(note); setEditing(false); }} className="text-[11px] text-ink/55 hover:text-ink">取消</button>
              <button type="button" onClick={saveNote} disabled={busy} className="inline-flex items-center gap-1 rounded-sm bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper hover:bg-graphite disabled:bg-ink/30">
                {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2} /> : null}
                儲存
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => !isFixtures && setEditing(true)}
            disabled={isFixtures}
            className="text-left"
          >
            {note ? (
              <p className="text-xs leading-5 text-ink/65 whitespace-pre-wrap">{note}</p>
            ) : (
              !isFixtures && <span className="font-v4-mono text-[10px] text-ink/35 opacity-60 hover:opacity-100">+ 補答案</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function ScoreNoteEditor({
  dealId, field, initialNote, isFixtures, onSaved,
}: {
  dealId: string;
  field: ScoreField;
  initialNote: string;
  isFixtures: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (draft.trim() === initialNote.trim()) { setEditing(false); return; }
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }
    setBusy(true); setErr(null);
    try { await setScoreNote(dealId, field, draft.trim()); setEditing(false); onSaved(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => !isFixtures && setEditing(true)}
        disabled={isFixtures}
        className={cn(
          'group grid gap-1 text-left',
          !isFixtures && 'hover:bg-cream/40 rounded-sm -mx-1 px-1 py-0.5',
          isFixtures && 'cursor-not-allowed',
        )}
      >
        {initialNote ? (
          <span className="text-[12px] leading-5 text-ink/65 whitespace-pre-wrap">{initialNote}</span>
        ) : (
          !isFixtures && <span className="font-v4-mono text-[10px] font-semibold text-ink/35 opacity-0 transition group-hover:opacity-100">+ 加備註</span>
        )}
      </button>
    );
  }
  return (
    <div className="grid gap-1">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { setDraft(initialNote); setEditing(false); }
        }}
        rows={2}
        autoFocus
        disabled={busy}
        placeholder="這個分數的根據(看到什麼證據、客戶說了什麼...)"
        className="w-full resize-vertical rounded-sm border border-ink/25 bg-cream/40 px-2 py-1 text-xs leading-5 text-ink focus:border-ink/45 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => { setDraft(initialNote); setEditing(false); }} disabled={busy} className="text-[11px] text-ink/55 hover:text-ink">取消</button>
        <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1 rounded-sm bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper hover:bg-graphite disabled:bg-ink/30">
          {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2} /> : null}
          儲存
        </button>
      </div>
      {err && <div className="text-[10px] text-claret">{err}</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
      <div className="label-caps text-ink/45">{label}</div>
      <div className="mt-1 font-v4-mono text-lg font-semibold text-ink numeric">{value}</div>
    </div>
  );
}

function Action({
  icon: Icon, iconClass, tone, children, onClick, disabled, title,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconClass?: string;
  tone: 'paper' | 'forest' | 'cobalt';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const cls = tone === 'forest' ? 'bg-forest text-paper border-forest hover:brightness-110'
    : tone === 'cobalt' ? 'bg-cobalt text-paper border-cobalt hover:brightness-110'
      : 'border-ink/15 bg-paper text-ink hover:border-ink/30';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition',
        cls,
        disabled && 'opacity-60 cursor-not-allowed hover:brightness-100',
      )}
    >
      <Icon className={cn('h-4 w-4', iconClass)} strokeWidth={1.75} />
      {children}
    </button>
  );
}
