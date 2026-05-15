import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Vercel Cron 觸發,每週日台北時間 09:00。
 * vercel.json 設 `0 1 * * 0` (UTC 週日 01:00 = 台北 09:00)
 * 寄給所有 admin + team_lead 一份 pipeline 健康度週報。
 */
export async function GET(req: Request) {
  // Vercel Cron 會帶 Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  // 用 service role 跑(繞 RLS),只有 server side 用得到
  // 退而求其次:沒有 service role 時用 anon key,但 RLS 會擋 → 確保有 service role
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: { getAll() { return []; }, setAll() {} },
  });

  try {
    // 1. 取所有 deals + scores + rm
    const { data: deals } = await supabase
      .from('deals')
      .select('id, name, rm_id, aum_usd, stage, tier, next_step, last_contact_at, last_updated, scores(*), rm:profiles!deals_rm_id_fkey(full_name)');

    // 2. 取所有 tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status, assignee_id, due_date, deal_id');

    // 3. 取收件人(admin + team_lead)
    const { data: recipients } = await supabase
      .from('profiles')
      .select('email, full_name, role')
      .in('role', ['admin', 'team_lead']);

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ skipped: 'no recipients' });
    }

    const stats = computeStats(deals ?? [], tasks ?? []);
    const html = renderEmail(stats);

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.RESEND_FROM_ADDRESS || 'WORLDSUN Pipeline <onboarding@resend.dev>';
    const replyTo = process.env.RESEND_REPLY_TO || 'hughlee@wsgfo.com';

    const results: Array<{ email: string; ok: boolean; error?: string }> = [];
    for (const r of recipients) {
      try {
        await resend.emails.send({
          from: fromAddress,
          to: r.email,
          replyTo,
          subject: `📊 WORLDSUN Pipeline 週報 · ${stats.dateRange}`,
          html: html.replace('{{NAME}}', r.full_name || r.email),
        });
        results.push({ email: r.email, ok: true });
      } catch (err) {
        results.push({ email: r.email, ok: false, error: (err as Error).message });
      }
    }

    return NextResponse.json({ sent: results.filter(r => r.ok).length, total: results.length, results });
  } catch (err) {
    console.error('[weekly-report] error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

interface DealRow {
  id: string; name: string; rm_id: string; aum_usd: number; stage: string;
  tier: string | null; next_step: string | null;
  last_contact_at: string | null; last_updated: string;
  scores: { m: number; e: number; d1: number; d2: number; p: number; i: number; c1: number; c2: number } | null;
  rm: { full_name: string } | null;
}

interface TaskRow { id: string; title: string; status: string; assignee_id: string | null; due_date: string | null; deal_id: string | null }

interface Stats {
  dateRange: string;
  totalAum: number;
  activeDeals: number;
  newDeals: number;          // 過去 7 天新增
  closedWon: number;         // 過去 7 天 Closed Won
  l4PlusCount: number;
  staleContactCount: number;
  overdueTasks: number;
  topPriorityDeals: Array<{ name: string; stage: string; tier: string | null; reason: string }>;
  stageBreakdown: Record<string, { count: number; aum: number }>;
}

function computeStats(deals: DealRow[], tasks: TaskRow[]): Stats {
  const now = Date.now();
  const oneWeekAgo = now - 7 * 86400000;
  const total = deals.filter(d => d.stage !== 'L7');
  const totalAum = total.reduce((s, d) => s + Number(d.aum_usd ?? 0), 0);
  const newDeals = deals.filter(d => new Date(d.last_updated).getTime() > oneWeekAgo).length;
  const closedWon = deals.filter(d => d.stage === 'L7' && new Date(d.last_updated).getTime() > oneWeekAgo).length;
  const l4Plus = deals.filter(d => ['L4','L5','L6'].includes(d.stage)).length;
  const staleContact = deals.filter(d => {
    if (d.stage === 'L7') return false;
    if (!d.last_contact_at) return false;
    const days = (now - new Date(d.last_contact_at).getTime()) / 86400000;
    return days >= 14;
  }).length;
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date).getTime() < now).length;

  const stageBreakdown: Record<string, { count: number; aum: number }> = {};
  for (const s of ['L1','L2','L3','L4','L5','L6','L7']) {
    stageBreakdown[s] = { count: 0, aum: 0 };
  }
  for (const d of deals) {
    stageBreakdown[d.stage].count++;
    stageBreakdown[d.stage].aum += Number(d.aum_usd ?? 0);
  }

  // 重要案件(L4+ 或紅旗)
  const topPriorityDeals = total
    .filter(d => ['L4','L5','L6'].includes(d.stage))
    .sort((a, b) => Number(b.aum_usd) - Number(a.aum_usd))
    .slice(0, 5)
    .map(d => ({
      name: d.name,
      stage: d.stage,
      tier: d.tier,
      reason: d.next_step ?? '無下一步',
    }));

  const today = new Date();
  const weekStart = new Date(today.getTime() - 7 * 86400000);
  const fmt = (dt: Date) => `${dt.getMonth() + 1}/${dt.getDate()}`;

  return {
    dateRange: `${fmt(weekStart)}–${fmt(today)}`,
    totalAum, activeDeals: total.length, newDeals, closedWon,
    l4PlusCount: l4Plus, staleContactCount: staleContact, overdueTasks,
    topPriorityDeals, stageBreakdown,
  };
}

function fmtMoney(n: number): string {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n;
}

function renderEmail(s: Stats): string {
  const stageRows = ['L1','L2','L3','L4','L5','L6','L7']
    .map(st => `<tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;"><b>${st}</b></td><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:right;">${s.stageBreakdown[st].count} 件</td><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#475569;">${fmtMoney(s.stageBreakdown[st].aum)}</td></tr>`)
    .join('');

  const priorityRows = s.topPriorityDeals.length === 0
    ? `<tr><td style="padding:8px;color:#94a3b8;text-align:center;" colspan="3">無 L4+ 案件</td></tr>`
    : s.topPriorityDeals.map(d => `<tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;"><b>${d.name}</b><br/><span style="font-size:11px;color:#94a3b8;">${d.tier ?? '?'} · ${d.stage}</span></td><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">${d.reason}</td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-Hant"><body style="font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;background:#f8fafc;padding:20px 0;">
<table cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
  <tr><td style="padding:24px 32px;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;">
    <h1 style="margin:0;font-size:20px;">📊 WORLDSUN Pipeline 週報</h1>
    <div style="font-size:13px;opacity:.85;margin-top:4px;">沃勝聯合家族辦公室 · {{NAME}}</div>
    <div style="font-size:11px;opacity:.7;margin-top:4px;">期間:${s.dateRange}</div>
  </td></tr>

  <tr><td style="padding:24px 32px;">
    <h2 style="margin:0 0 12px;font-size:14px;color:#475569;">📈 本週概況</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px;background:#f1f5f9;border-radius:8px;text-align:center;width:33%;">
          <div style="font-size:11px;color:#64748b;">Pipeline 總 AUM</div>
          <div style="font-size:20px;font-weight:bold;color:#0f172a;margin-top:2px;">${fmtMoney(s.totalAum)}</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:8px;background:#f1f5f9;border-radius:8px;text-align:center;width:33%;">
          <div style="font-size:11px;color:#64748b;">活躍案件</div>
          <div style="font-size:20px;font-weight:bold;color:#0f172a;margin-top:2px;">${s.activeDeals} 件</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:8px;background:#f1f5f9;border-radius:8px;text-align:center;width:33%;">
          <div style="font-size:11px;color:#64748b;">本週成交</div>
          <div style="font-size:20px;font-weight:bold;color:#059669;margin-top:2px;">${s.closedWon} 件</div>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:8px;background:${s.staleContactCount > 0 ? '#fef3c7' : '#f1f5f9'};border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#64748b;">🔔 14+ 天未聯繫</div>
          <div style="font-size:20px;font-weight:bold;color:${s.staleContactCount > 0 ? '#d97706' : '#94a3b8'};margin-top:2px;">${s.staleContactCount} 件</div>
        </td>
        <td></td>
        <td style="padding:8px;background:${s.overdueTasks > 0 ? '#fee2e2' : '#f1f5f9'};border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#64748b;">⚠️ 逾期任務</div>
          <div style="font-size:20px;font-weight:bold;color:${s.overdueTasks > 0 ? '#dc2626' : '#94a3b8'};margin-top:2px;">${s.overdueTasks} 件</div>
        </td>
        <td></td>
        <td style="padding:8px;background:#f1f5f9;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#64748b;">L4+ 高品質</div>
          <div style="font-size:20px;font-weight:bold;color:#4f46e5;margin-top:2px;">${s.l4PlusCount} 件</div>
        </td>
      </tr>
    </table>

    <h2 style="margin:24px 0 8px;font-size:14px;color:#475569;">📊 漏斗階段分佈</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;">
      <thead><tr style="background:#f8fafc;color:#64748b;font-size:11px;">
        <th style="padding:8px 12px;text-align:left;">階段</th>
        <th style="padding:8px 12px;text-align:right;">件數</th>
        <th style="padding:8px 12px;text-align:right;">AUM</th>
      </tr></thead>
      <tbody>${stageRows}</tbody>
    </table>

    <h2 style="margin:24px 0 8px;font-size:14px;color:#475569;">🎯 本週要關注的 L4+ 案件 (Top 5)</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;">
      <thead><tr style="background:#f8fafc;color:#64748b;font-size:11px;">
        <th style="padding:8px 12px;text-align:left;">客戶</th>
        <th style="padding:8px 12px;text-align:left;">下一步</th>
      </tr></thead>
      <tbody>${priorityRows}</tbody>
    </table>

    <div style="margin-top:24px;text-align:center;">
      <a href="https://hughlee-sales-manage-flow.vercel.app" style="display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">打開 Pipeline 系統 →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;">
    自動寄送 · 每週日 09:00 台北時間 · 寄給 Admin + Team Lead<br/>
    回覆此 email 直接寄到 ${process.env.RESEND_REPLY_TO || 'hughlee@wsgfo.com'}
  </td></tr>
</table>
</body></html>`;
}
