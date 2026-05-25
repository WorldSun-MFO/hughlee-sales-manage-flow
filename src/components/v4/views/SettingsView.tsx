'use client';

// ============================================================
// V4 設定頁 — 取代 placeholder 的真實 admin UI
// ============================================================
// 4 個區塊:
//   1. My Profile      — 所有人:顯示自己 email / role / 團隊(read-only)
//   2. App Settings    — admin 只:stage_probs / red_flag 編輯
//   3. Teams           — admin 只:列表 + 新增 + rename + 刪除
//   4. Members         — admin 只:列表 + 改 role / team_id / full_name
//
// 不做的(留給既有 / Dashboard 設定 modal 或 Phase 4):
//   - Ban/unban member(走 /api/admin/ban-user)
//   - 產生一次性登入連結(走 /api/admin/login-link)
//   - Pain points 編輯
//   - Tier config 細節編輯(只用 read-only 顯示)
// ============================================================
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Settings as SettingsIcon, Users, Shield, Trash2, Check, Ban, RotateCcw, Link as LinkIcon, Copy } from 'lucide-react';
import type { Profile, Role, StageId, Snapshot } from '@/lib/v4/types';
import type { SettingsRow, MemberStatusMap } from '@/lib/v4/data';
import { STAGES } from '@/lib/v4/constants';
import { cn } from '@/lib/v4/utils';
import {
  updateSettings, createTeam, renameTeam, deleteTeam, patchProfile,
  banMember, unbanMember, generateLoginLink,
} from '@/lib/v4/mutations';
import { InlineText, InlineSelect } from '@/components/v4/InlineEdit';
import { RealtimeRefresher } from '@/components/v4/RealtimeRefresher';

const ROLE_LABEL: Record<Role, string> = { rm: 'RM', team_lead: 'Team Lead', admin: 'Admin' };
const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = [
  { value: 'rm', label: 'RM' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'admin', label: 'Admin' },
];

export function SettingsView({
  snapshot, currentProfile, settings, memberStatus = {},
}: {
  snapshot: Snapshot;
  currentProfile: Profile | null;
  settings: SettingsRow | null;
  memberStatus?: MemberStatusMap;
}) {
  const isAdmin = currentProfile?.role === 'admin';
  const isFixtures = snapshot.source === 'fixtures';

  return (
    <div className="grid gap-10 px-4 py-6 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
      <RealtimeRefresher isFixtures={isFixtures} tables={['settings', 'teams', 'profiles']} />

      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Settings</div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
          設定
        </h1>
        <p className="max-w-2xl text-base leading-7 text-ink/65">
          {isAdmin ? '管理員視角:可改全站配置、團隊與成員。' : '一般視角:只顯示自己的 profile;團隊 / 成員 / 全站設定須 admin。'}
        </p>
      </header>

      {/* 1. My Profile */}
      <section className="grid gap-3">
        <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
          <Shield className="h-3 w-3" strokeWidth={2} /> 我的資料
        </div>
        {currentProfile ? (
          <div className="grid gap-3 rounded-md border border-ink/10 bg-paper p-5">
            <Row label="Email" value={currentProfile.email} mono />
            <Row label="姓名" value={currentProfile.full_name ?? '—'} />
            <Row label="角色" value={<span className="font-v4-mono font-semibold text-ink">{ROLE_LABEL[currentProfile.role]}</span>} />
            <Row label="團隊" value={snapshot.teams.find((t) => t.id === currentProfile.team_id)?.name ?? '— 無團隊'} />
            <Row label="RM code" value={currentProfile.rm_code ?? '—'} mono />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-ink/15 bg-paper/60 px-4 py-6 text-center text-sm text-ink/45">
            無法取得 profile。{isFixtures && '(fixtures 模式)'}
          </div>
        )}
      </section>

      {/* 2. App Settings */}
      {isAdmin && settings && <AppSettingsSection settings={settings} isFixtures={isFixtures} />}

      {/* 3. Teams */}
      {isAdmin && <TeamsSection snapshot={snapshot} isFixtures={isFixtures} />}

      {/* 4. Members */}
      {isAdmin && <MembersSection snapshot={snapshot} isFixtures={isFixtures} memberStatus={memberStatus} />}

      {!isAdmin && (
        <div className="rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-10 text-center text-sm text-ink/45">
          全站設定 / 團隊 / 成員管理需要 admin 權限。
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-ink/8 pb-2 last:border-b-0 last:pb-0 sm:grid-cols-[120px_1fr] sm:items-center sm:gap-3">
      <span className="label-caps text-ink/45">{label}</span>
      <span className={cn('text-sm text-ink/85 break-words', mono && 'font-v4-mono numeric')}>{value}</span>
    </div>
  );
}

// ============================================================
// 2. App Settings
// ============================================================
function AppSettingsSection({ settings, isFixtures }: { settings: SettingsRow; isFixtures: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function saveStageProb(stage: StageId, percent: number) {
    setBusy(`stage-${stage}`); setErr(null);
    try {
      await updateSettings({
        stage_probs: { ...settings.stage_probs, [stage]: Math.max(0, Math.min(100, percent)) } as Record<StageId, number>,
      });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  async function saveRedFlag(key: 'ebScore' | 'totalScore' | 'staleDays' | 'contactWarnDays', value: number) {
    setBusy(`rf-${key}`); setErr(null);
    try {
      await updateSettings({ red_flag: { ...settings.red_flag, [key]: value } });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <section className="grid gap-3">
      <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
        <SettingsIcon className="h-3 w-3" strokeWidth={2} /> 全站設定
      </div>
      {err && <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">{err}</div>}

      <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
        <div className="label-caps text-ink/45">階段加權機率 (%)</div>
        <div className="grid gap-1.5">
          {STAGES.map((s) => (
            <div key={s.id} className="grid grid-cols-[40px_1fr_auto] items-center gap-2 border-b border-ink/8 py-1.5 last:border-b-0 sm:grid-cols-[40px_1fr_90px] sm:gap-3">
              <span className={`stage-${s.id} rounded-sm px-1.5 py-0.5 text-center font-v4-mono text-[11px] font-bold`}>{s.id}</span>
              <span className="truncate text-sm text-ink/65">{s.name}</span>
              <ProbInput
                value={settings.stage_probs[s.id] ?? 0}
                busy={busy === `stage-${s.id}`}
                disabled={isFixtures}
                onSave={(v) => saveStageProb(s.id, v)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
        <div className="label-caps text-ink/45">紅旗門檻</div>
        <RedFlagRow label="E 分數低於" value={settings.red_flag.ebScore} suffix="分 → 紅旗" busy={busy === 'rf-ebScore'} disabled={isFixtures} onSave={(v) => saveRedFlag('ebScore', v)} />
        <RedFlagRow label="總分低於" value={settings.red_flag.totalScore} suffix="分 → 紅旗" busy={busy === 'rf-totalScore'} disabled={isFixtures} onSave={(v) => saveRedFlag('totalScore', v)} />
        <RedFlagRow label="未更新超過" value={settings.red_flag.staleDays} suffix="天 → 紅旗" busy={busy === 'rf-staleDays'} disabled={isFixtures} onSave={(v) => saveRedFlag('staleDays', v)} />
        <RedFlagRow label="未聯繫警示" value={settings.red_flag.contactWarnDays ?? 14} suffix="天前提醒" busy={busy === 'rf-contactWarnDays'} disabled={isFixtures} onSave={(v) => saveRedFlag('contactWarnDays', v)} />
      </div>

      <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
        <div className="label-caps text-ink/45">Tier 與聯繫週期(唯讀)</div>
        <ul className="grid gap-1.5">
          {settings.tier_config.tiers.map((t) => (
            <li key={t.key} className="grid grid-cols-[48px_1fr] items-center gap-x-3 gap-y-1 border-b border-ink/8 py-1.5 text-sm last:border-b-0 sm:grid-cols-[60px_1fr_auto_auto] sm:gap-3 lg:grid-cols-[60px_1fr_140px_140px]">
              <span className="font-v4-mono font-bold text-ink">{t.key}</span>
              <span className="truncate text-ink/75">{t.name}</span>
              <span className="col-start-2 font-v4-mono text-xs text-ink/55 numeric sm:col-start-auto sm:text-sm sm:text-right lg:text-left">AUM ≥ ${(t.aum_min / 1_000_000).toFixed(1)}M</span>
              <span className="col-start-2 font-v4-mono text-xs text-ink/55 numeric sm:col-start-auto sm:text-sm sm:text-right lg:text-left">{t.contact_days} 天聯繫一次</span>
            </li>
          ))}
        </ul>
        <div className="mt-1 font-v4-mono text-[10.5px] text-ink/45">Tier 細節編輯目前在 / 設定 modal 內</div>
      </div>
    </section>
  );
}

function ProbInput({ value, busy, disabled, onSave }: { value: number; busy: boolean; disabled: boolean; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number"
        min={0}
        max={100}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { const n = Number(draft); if (!Number.isNaN(n) && n !== value) onSave(n); }}
        disabled={busy || disabled}
        className="w-16 rounded-sm border border-ink/15 bg-cream/40 px-2 py-0.5 font-v4-mono text-sm text-ink focus:border-ink/40 focus:outline-none"
      />
      <span className="font-v4-mono text-xs text-ink/45">%</span>
      {busy && <Loader2 className="h-3 w-3 animate-spin text-ink/55" strokeWidth={2} />}
    </div>
  );
}

function RedFlagRow({ label, value, suffix, busy, disabled, onSave }: { label: string; value: number; suffix: string; busy: boolean; disabled: boolean; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-ink/8 py-1.5 last:border-b-0 sm:grid-cols-[1fr_auto_auto]">
      <span className="text-sm text-ink/65">{label}</span>
      <input
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { const n = Number(draft); if (!Number.isNaN(n) && n !== value) onSave(n); }}
        disabled={busy || disabled}
        className="w-20 rounded-sm border border-ink/15 bg-cream/40 px-2 py-0.5 font-v4-mono text-sm text-ink focus:border-ink/40 focus:outline-none"
      />
      <span className="col-span-2 inline-flex w-auto items-center gap-1 font-v4-mono text-xs text-ink/65 sm:col-span-1 sm:w-32">{suffix}{busy && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />}</span>
    </div>
  );
}

// ============================================================
// 3. Teams
// ============================================================
function TeamsSection({ snapshot, isFixtures }: { snapshot: Snapshot; isFixtures: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [delBusyId, setDelBusyId] = useState<string | null>(null);

  async function add() {
    if (!newName.trim() || busy) return;
    setBusy(true); setErr(null);
    try { await createTeam(newName.trim()); setNewName(''); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  async function rm(id: string) {
    const team = snapshot.teams.find((t) => t.id === id);
    if (!team) return;
    if (!confirm(`刪除團隊「${team.name}」?成員的 team_id 會變 null,案件不受影響。`)) return;
    setDelBusyId(id);
    try { await deleteTeam(id); }
    catch (e) { alert(`刪除失敗:${(e as Error).message}`); }
    finally { setDelBusyId(null); }
  }

  return (
    <section className="grid gap-3">
      <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
        <Users className="h-3 w-3" strokeWidth={2} /> 團隊 · {snapshot.teams.length}
      </div>
      {err && <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">{err}</div>}
      <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
        <ul className="grid gap-1.5">
          {snapshot.teams.map((t) => {
            const memberCount = snapshot.profiles.filter((p) => p.team_id === t.id).length;
            return (
              <li key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-ink/8 pb-2 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_auto_auto]">
                <InlineText
                  value={t.name}
                  onSave={async (next) => { await renameTeam(t.id, next); }}
                  isFixtures={isFixtures}
                  displayClassName="font-v4-serif text-base font-semibold text-ink"
                />
                <span className="col-start-1 row-start-2 font-v4-mono text-xs text-ink/55 numeric sm:col-start-2 sm:row-start-1">{memberCount} 位成員</span>
                <button
                  type="button"
                  onClick={() => rm(t.id)}
                  disabled={delBusyId === t.id || isFixtures}
                  className="col-start-2 row-start-1 grid h-7 w-7 place-items-center rounded-sm text-ink/40 transition hover:bg-claret/10 hover:text-claret disabled:cursor-not-allowed sm:col-start-3"
                  title="刪除團隊"
                >
                  {delBusyId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex items-center gap-2 border-t border-ink/10 pt-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新團隊名稱"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            disabled={busy || isFixtures}
            className="flex-1 rounded-md border border-ink/15 bg-cream/40 px-3 py-1.5 text-sm text-ink focus:border-ink/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={add}
            disabled={!newName.trim() || busy || isFixtures}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-paper hover:bg-graphite disabled:bg-ink/30 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2} />}
            新增
          </button>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 4. Members
// ============================================================
function MembersSection({
  snapshot, isFixtures, memberStatus,
}: {
  snapshot: Snapshot; isFixtures: boolean; memberStatus: MemberStatusMap;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function changeRole(id: string, role: Role | null) {
    if (!role) return;
    setErr(null);
    try { await patchProfile(id, { role }); }
    catch (e) { setErr((e as Error).message); }
  }
  async function changeTeam(id: string, teamId: string | null) {
    setErr(null);
    try { await patchProfile(id, { team_id: teamId || null }); }
    catch (e) { setErr((e as Error).message); }
  }
  async function changeName(id: string, name: string) {
    setErr(null);
    try { await patchProfile(id, { full_name: name }); }
    catch (e) { setErr((e as Error).message); }
  }

  return (
    <section className="grid gap-3">
      <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
        <Users className="h-3 w-3" strokeWidth={2} /> 成員 · {snapshot.profiles.length}
      </div>
      {err && <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">{err}</div>}
      <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
        <ul className="grid gap-2">
          {snapshot.profiles.map((p) => (
            <li key={p.id}>
              <MemberRow
                profile={p}
                teams={snapshot.teams}
                status={memberStatus[p.id]}
                isFixtures={isFixtures}
                onChangeName={(v) => changeName(p.id, v)}
                onChangeRole={(v) => changeRole(p.id, v)}
                onChangeTeam={(v) => changeTeam(p.id, v)}
                onChanged={() => undefined}
              />
            </li>
          ))}
        </ul>
        <div className="mt-2 grid gap-1 border-t border-ink/10 pt-3 font-v4-mono text-[10.5px] text-ink/45">
          <div className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-forest" strokeWidth={2.5} /> 點欄位直接改 · realtime 同步</div>
          <div className="inline-flex items-center gap-1.5"><Ban className="h-3 w-3 text-claret" strokeWidth={2} /> 停用 = 軟撤銷,對方無法登入但資料保留,可隨時復原</div>
          <div className="inline-flex items-center gap-1.5"><LinkIcon className="h-3 w-3 text-cobalt" strokeWidth={2} /> 一次性登入連結讓對方不經 Google 也能進系統,適合 onboarding</div>
        </div>
      </div>
    </section>
  );
}

function MemberRow({
  profile, teams, status, isFixtures,
  onChangeName, onChangeRole, onChangeTeam, onChanged,
}: {
  profile: Profile;
  teams: { id: string; name: string }[];
  status: { has_auth: boolean; banned: boolean } | undefined;
  isFixtures: boolean;
  onChangeName: (v: string) => Promise<void>;
  onChangeRole: (v: Role | null) => Promise<void>;
  onChangeTeam: (v: string | null) => Promise<void>;
  onChanged: () => void;
}) {
  const banned = status?.banned ?? false;
  const [busy, setBusy] = useState<null | 'ban' | 'unban' | 'link'>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  async function doBan() {
    if (busy || isFixtures) return;
    const typed = window.prompt(
      `確定停用「${profile.full_name || profile.email}」的登入?\n` +
      `對方會立即被踢出且無法再登入(資料保留、可日後復原)。\n\n` +
      `請輸入對方 email 確認:`,
    );
    if (typed == null) return;
    if (typed.trim().toLowerCase() !== profile.email.toLowerCase()) {
      alert('輸入的 email 不符,已取消');
      return;
    }
    setBusy('ban');
    try { await banMember(profile.email); onChanged(); }
    catch (e) { alert(`停用失敗:${(e as Error).message}`); }
    finally { setBusy(null); }
  }
  async function doUnban() {
    if (busy || isFixtures) return;
    if (!confirm(`復原「${profile.full_name || profile.email}」的登入?對方將可重新登入。`)) return;
    setBusy('unban');
    try { await unbanMember(profile.email); onChanged(); }
    catch (e) { alert(`復原失敗:${(e as Error).message}`); }
    finally { setBusy(null); }
  }
  async function doGenLink() {
    if (busy || isFixtures) return;
    setBusy('link'); setLinkErr(null); setLink(null);
    try {
      const url = await generateLoginLink(profile.email);
      setLink(url);
    } catch (e) { setLinkErr((e as Error).message); }
    finally { setBusy(null); }
  }
  async function copyLink() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); }
    catch { /* noop */ }
  }

  return (
    <div className={cn('grid gap-2 rounded-md border px-4 py-3 transition', banned ? 'border-claret/20 bg-claret/5' : 'border-ink/10 bg-paper')}>
      {/* 手機 (< sm):卡片堆疊;sm+:橫向 5 欄表格 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px_110px_auto] sm:items-center md:grid-cols-[1fr_120px_120px_120px_auto] lg:grid-cols-[1fr_140px_140px_140px_auto]">
        {/* Name + email + badges — 手機跟桌機都跨第一格,但桌機含 rm_code 之外 */}
        <div className="flex items-start justify-between gap-2 min-w-0 sm:block">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <InlineText
                value={profile.full_name ?? ''}
                onSave={onChangeName}
                isFixtures={isFixtures}
                placeholder="(未命名)"
                displayClassName="font-v4-serif text-sm font-semibold text-ink"
              />
              {banned && <span className="rounded-sm bg-claret/15 px-1.5 py-0.5 font-v4-mono text-[10px] font-bold text-claret">已停用</span>}
              {status && !status.has_auth && !banned && <span className="rounded-sm bg-brass/15 px-1.5 py-0.5 font-v4-mono text-[10px] font-bold text-brass">未啟用</span>}
            </div>
            <div className="mt-0.5 truncate font-v4-mono text-[11px] text-ink/55">{profile.email}</div>
            {/* 手機:rm_code 顯示在 email 下方 */}
            <div className="mt-1 font-v4-mono text-[11px] text-ink/45 sm:hidden">
              <span className="label-caps text-ink/40">RM code</span> <span className="ml-1 text-ink/65">{profile.rm_code ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* RM code — 桌機才獨立成欄 (md+) */}
        <span className="hidden font-v4-mono text-xs text-ink/55 md:inline">{profile.rm_code ?? '—'}</span>

        {/* Role */}
        <div className="grid grid-cols-[80px_1fr] items-center gap-2 sm:block">
          <span className="label-caps text-ink/45 sm:hidden">角色</span>
          <InlineSelect<Role>
            value={profile.role}
            options={ROLE_OPTIONS}
            onSave={onChangeRole}
            isFixtures={isFixtures}
            renderDisplay={(v) => <span className="font-v4-mono text-xs font-semibold text-ink">{v ? ROLE_LABEL[v] : '—'}</span>}
          />
        </div>

        {/* Team */}
        <div className="grid grid-cols-[80px_1fr] items-center gap-2 sm:block">
          <span className="label-caps text-ink/45 sm:hidden">團隊</span>
          <InlineSelect<string>
            value={profile.team_id}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
            onSave={onChangeTeam}
            isFixtures={isFixtures}
            renderDisplay={(v) => <span className="font-v4-mono text-xs text-ink/75">{teams.find((t) => t.id === v)?.name ?? '— 無'}</span>}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 border-t border-ink/8 pt-2 sm:justify-start sm:border-t-0 sm:pt-0">
          <button
            type="button"
            onClick={doGenLink}
            disabled={busy !== null || isFixtures}
            title="產生一次性登入連結"
            className="grid h-8 w-8 place-items-center rounded-sm text-cobalt/70 transition hover:bg-cobalt/10 hover:text-cobalt disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7"
          >
            {busy === 'link' ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <LinkIcon className="h-3.5 w-3.5" strokeWidth={2} />}
          </button>
          {banned ? (
            <button
              type="button"
              onClick={doUnban}
              disabled={busy !== null || isFixtures}
              title="復原登入"
              className="grid h-8 w-8 place-items-center rounded-sm text-forest/70 transition hover:bg-forest/10 hover:text-forest disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7"
            >
              {busy === 'unban' ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={doBan}
              disabled={busy !== null || isFixtures}
              title="停用登入"
              className="grid h-8 w-8 place-items-center rounded-sm text-ink/40 transition hover:bg-claret/10 hover:text-claret disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7"
            >
              {busy === 'ban' ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Ban className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
          )}
        </div>
      </div>

      {link && (
        <div className="grid gap-1.5 rounded-md border border-cobalt/25 bg-cobalt/5 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="label-caps text-cobalt">一次性登入連結(複製給對方,連結進站即登入)</span>
            <button
              type="button"
              onClick={() => setLink(null)}
              className="font-v4-mono text-[10.5px] text-ink/45 hover:text-ink"
            >關閉</button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-cobalt/20 bg-paper px-2.5 py-1.5 font-v4-mono text-xs text-ink/85 focus:border-cobalt/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={copyLink}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition',
                linkCopied ? 'bg-forest text-paper' : 'bg-ink text-paper hover:bg-graphite',
              )}
            >
              {linkCopied ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <Copy className="h-3 w-3" strokeWidth={2} />}
              {linkCopied ? '已複製' : '複製'}
            </button>
          </div>
        </div>
      )}
      {linkErr && <div className="rounded-md border border-claret/30 bg-claret/5 px-2.5 py-1.5 text-xs text-claret">{linkErr}</div>}
    </div>
  );
}
