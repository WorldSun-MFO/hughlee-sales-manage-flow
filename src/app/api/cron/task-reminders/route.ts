import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================
// 任務到期提醒寄信(Resend)
// ============================================================
// 每天執行一次:找出「到期日剛好剩 7 天 / 3 天」且未完成的任務,寄 email 給
// 主責人(assignee)+ 所有協作者(participant_ids),限 @wsgfo.com。
// 依收件人彙整(一人一封,列出他所有即將到期的任務)。
//
// 為什麼用寄信而非 Google 行事曆提醒:Google 的事件提醒只送達「事件擁有者」,
// 無法把定時提醒推給與會者(指派對象 / 協作者)。要讓被指派的人準時收到,只能
// 由 CRM 自己寄。
//
// 觸發:沿用 CRON_SECRET(排程器帶 Authorization: Bearer <CRON_SECRET>)。
// 冪等性:靠「到期日剛好等於今天 +7 / +3」這個精確比對 —— 每筆任務一生只會
//   在某一天命中 +7、某一天命中 +3,故 cron「每天跑一次」即每個提醒各寄一次。
//   ⚠️ 一天請勿跑超過一次,否則會重複寄。
// ============================================================

const REMINDER_OFFSETS = [7, 3]; // 到期前幾天提醒
const REMINDER_NOTICE = '如有需要請提前通知後勤部門';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  assignee_id: string | null;
  participant_ids: string[] | null;
}

// 'YYYY-MM-DD' + n 天(以純日曆日計算,不受時區影響)
function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  const svc = createServiceClient();

  // 今天(台灣)+ 目標到期日(今天 +7、+3)
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
  const targets = REMINDER_OFFSETS.map((n) => ({ n, date: addDays(todayStr, n) }));
  const offsetByDate = new Map(targets.map((t) => [t.date, t.n]));

  const { data: tasksData, error } = await svc
    .from('tasks')
    .select('id, title, description, due_date, assignee_id, participant_ids')
    .in('due_date', targets.map((t) => t.date))
    .neq('status', 'done');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tasks = (tasksData ?? []) as TaskRow[];
  if (!tasks.length) {
    return NextResponse.json({ skipped: 'no tasks due', checked: targets.map((t) => t.date) });
  }

  // 解析所有相關成員的 email(限 @wsgfo.com)
  const memberIds = Array.from(new Set(
    tasks.flatMap((t) => [t.assignee_id, ...(t.participant_ids ?? [])]).filter((x): x is string => !!x),
  ));
  const { data: profs } = await svc.from('profiles').select('id, email, full_name').in('id', memberIds);
  const profMap = new Map<string, { email: string; name: string }>();
  for (const p of (profs ?? []) as { id: string; email?: string; full_name?: string | null }[]) {
    if (p.email && p.email.toLowerCase().endsWith('@wsgfo.com')) {
      profMap.set(p.id, { email: p.email, name: p.full_name || p.email });
    }
  }

  // 依收件人彙整:email → { name, items[] }
  type Item = { title: string; description: string | null; due_date: string; daysLeft: number };
  const byRecipient = new Map<string, { name: string; email: string; items: Item[] }>();
  for (const t of tasks) {
    const daysLeft = offsetByDate.get(t.due_date) ?? 0;
    const ids = Array.from(new Set([t.assignee_id, ...(t.participant_ids ?? [])].filter((x): x is string => !!x)));
    for (const id of ids) {
      const prof = profMap.get(id);
      if (!prof) continue;
      const entry = byRecipient.get(prof.email) ?? { name: prof.name, email: prof.email, items: [] };
      entry.items.push({ title: t.title, description: t.description, due_date: t.due_date, daysLeft });
      byRecipient.set(prof.email, entry);
    }
  }

  if (!byRecipient.size) {
    return NextResponse.json({ skipped: 'no @wsgfo recipients', tasks: tasks.length });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_ADDRESS || 'WORLDSUN Pipeline <onboarding@resend.dev>';
  const replyTo = process.env.RESEND_REPLY_TO || 'hughlee@wsgfo.com';

  const results: { email: string; ok: boolean; error?: string; id?: string }[] = [];
  for (const r of byRecipient.values()) {
    r.items.sort((a, b) => a.daysLeft - b.daysLeft || a.due_date.localeCompare(b.due_date));
    try {
      const { data, error: rerr } = await resend.emails.send({
        from,
        to: r.email,
        replyTo,
        subject: `⏰ 任務提醒:你有 ${r.items.length} 個任務即將到期`,
        html: renderEmail(r.name, r.items),
      });
      results.push({ email: r.email, ok: !rerr, error: rerr ? `${rerr.name}: ${rerr.message}` : undefined, id: data?.id });
    } catch (e) {
      results.push({ email: r.email, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({
    sent: results.filter((r) => r.ok).length,
    total: results.length,
    tasks: tasks.length,
    results,
  });
}

function renderEmail(name: string, items: { title: string; description: string | null; due_date: string; daysLeft: number }[]): string {
  const rows = items.map((it) => {
    const badgeColor = it.daysLeft <= 3 ? '#dc2626' : '#d97706';
    const badgeBg = it.daysLeft <= 3 ? '#fee2e2' : '#fef3c7';
    const desc = it.description?.trim()
      ? `<div style="margin-top:4px;font-size:12px;color:#64748b;white-space:pre-wrap;">${esc(it.description.trim())}</div>`
      : '';
    return `<tr><td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
      <div style="display:inline-block;padding:2px 8px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-size:11px;font-weight:700;">${it.daysLeft} 天後到期</div>
      <div style="margin-top:6px;font-size:15px;font-weight:600;color:#0f172a;">${esc(it.title)}</div>
      <div style="margin-top:2px;font-size:12px;color:#94a3b8;">到期日:${esc(it.due_date)}</div>
      ${desc}
    </td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-Hant"><body style="font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;background:#f8fafc;padding:20px 0;">
<table cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
  <tr><td style="padding:22px 28px;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;">
    <h1 style="margin:0;font-size:18px;">⏰ 任務即將到期提醒</h1>
    <div style="font-size:13px;opacity:.85;margin-top:4px;">沃勝聯合家族辦公室 · ${esc(name)}</div>
  </td></tr>
  <tr><td style="padding:20px 28px;">
    <p style="margin:0 0 12px;font-size:14px;color:#475569;">以下任務即將到期,請留意:</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:16px;padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;font-size:13px;font-weight:600;">
      ${esc(REMINDER_NOTICE)}
    </div>
  </td></tr>
  <tr><td style="padding:14px 28px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;">
    自動寄送 · 任務到期前 7 天 / 3 天提醒<br/>
    回覆此 email 直接寄到 ${esc(process.env.RESEND_REPLY_TO || 'hughlee@wsgfo.com')}
  </td></tr>
</table>
</body></html>`;
}
