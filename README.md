# 沃勝 MEDDIC Pipeline

> 網頁版 MEDDPICC 資格評分 + Pipeline Tracker,給 10 人銷售團隊共用,手機可用,即時同步。

## 特色

- **Google 登入**(Supabase Auth)
- **MEDDIC 評分卡**:8 項 × 0–10,自動算總分與建議階段
- **L1–L7 七階段漏斗**:視覺化 + KPI + 加權預測
- **階段退出 checklist**:每階段的關鍵問題,全勾才能推進
- **痛點 → 商品** 即時對應建議
- **紅旗警示**:EB 未確認、總分過低、30+ 天未更新
- **即時同步**(Supabase Realtime):團隊成員編輯,其他人即時看到
- **權限**:RM 只看自己的;管理員看全部
- **完全響應式**:手機、平板、桌機都順

## 部署

看 [DEPLOYMENT.md](./DEPLOYMENT.md) — 20–30 分鐘完成。

## 本地開發

```bash
cp .env.local.example .env.local
# 填入 Supabase URL 與 anon key
npm install
npm run dev
# 打開 http://localhost:3000
```

## 技術棧

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + Realtime + RLS)
- Vercel (deploy)

成本:$0 / 月(Supabase Free + Vercel Hobby,10 人規模內)

## 架構

```
src/
├── app/
│   ├── page.tsx                    # Server: auth check + fetch deals → Dashboard
│   ├── login/page.tsx              # Google sign-in button
│   ├── auth/callback/route.ts      # OAuth exchange
│   └── layout.tsx
├── components/
│   ├── Dashboard.tsx               # Client: state + realtime + KPIs + funnel + list
│   ├── DealDetail.tsx              # Drawer: MEDDIC + checklist + comments
│   ├── NewDealModal.tsx
│   └── SettingsModal.tsx
├── lib/
│   ├── supabase/{client,server}.ts
│   ├── constants.ts                # STAGES, MEDDIC, CHECKLIST, PAIN_MATRIX
│   ├── types.ts
│   └── utils.ts                    # fmtMoney, totalScore, redFlag, recommendStage
└── middleware.ts                   # redirect unauthenticated

supabase/
├── schema.sql                      # Tables + triggers + RLS + Realtime pub
└── seed.sql                        # 6 existing customers
```
