# 沃勝 MEDDIC Pipeline — 部署手冊

預估時間:**20–30 分鐘**。完成後會有一個雲端網址,10 人團隊用 Google 帳號登入即可使用,資料即時同步、手機可用。

---

## 📋 需要準備

- 一個 Google 帳號(建議公司域名,用來當 **管理員**)
- 10 分鐘不被打擾的時間

---

## 🏗 架構圖

```
[使用者 Chrome/Safari]
         ↓ Google 登入
[Vercel] ← Next.js app ← 本 repo
         ↓ query/subscribe
[Supabase] ← Postgres + Auth + Realtime
         ↓ OAuth
[Google Cloud Console] ← OAuth Client
```

---

## 步驟 1 — 建立 Supabase 專案(5 分鐘)

1. 打開 https://supabase.com,用 GitHub 或 Google 登入
2. 點 **New project**:
   - Name: `wosheng-pipeline`
   - Database Password: 隨機產生 → **存到密碼管理器**(之後用不到,但別丟)
   - Region: 選 **Singapore** 或 **Tokyo**(亞洲最近)
   - Plan: **Free**(10 人用綽綽有餘)
3. 等 ~1 分鐘建好
4. 左側選單 → **Project Settings** → **API**,記下兩個值(之後會用到):
   - `Project URL`(例:`https://abcdefg.supabase.co`)
   - `anon public key`(很長的 JWT 字串)

## 步驟 2 — 建立資料表(2 分鐘)

1. 左側選單 → **SQL Editor** → **New query**
2. 打開本 repo 的 `supabase/schema.sql`,**全部複製** 貼到編輯器
3. 按右下 **Run**(或 `⌘Enter`)
4. 底下應該顯示 Success。切到左側 **Table Editor** 確認有 `deals`、`profiles`、`scores` 等表

## 步驟 3 — 設定 Google OAuth(8 分鐘)

這是最繁瑣的一步,照著做就好。

### 3a. Google Cloud Console

1. 打開 https://console.cloud.google.com
2. 點頂部 **選取專案** → **新增專案** → 名稱 `wosheng-pipeline` → 建立
3. 左上漢堡 → **API 和服務** → **OAuth 同意畫面**
   - User type: **外部**(External) → 建立
   - App name: `沃勝 MEDDIC Pipeline`
   - User support email: 你的 email
   - Developer contact: 你的 email
   - Scopes: 直接按下一步(預設即可)
   - Test users: **加入你們 10 位同事的 Gmail**(發布前必要,才能登入測試)
   - 完成 → 點 **發布應用程式**(這樣任何 Gmail 都能登入;若只給測試用戶用則不發布)
4. 左側 **憑證** → **+ 建立憑證** → **OAuth 用戶端 ID**
   - 應用程式類型:**Web 應用程式**
   - 名稱:`Supabase Auth`
   - **已授權的重新導向 URI**:貼入 Supabase 的 callback URL(下一步回來填)
   - 先不要按建立,切到步驟 3b 拿 URL

### 3b. Supabase 拿 callback URL

1. Supabase → **Authentication** → **Providers** → 找到 **Google** → 點開
2. 複製底下那段 **Callback URL (for OAuth)**
   (格式類似 `https://abcdefg.supabase.co/auth/v1/callback`)
3. 回到 Google Cloud Console,貼到 **已授權的重新導向 URI** → **建立**
4. 會跳出一個框,複製 **用戶端 ID** 與 **用戶端密鑰**

### 3c. Supabase 填入 Google 憑證

1. 回 Supabase → **Authentication** → **Providers** → **Google**
2. 打開 **Enable Sign in with Google**
3. 貼入剛剛的 **Client ID** 與 **Client Secret**
4. **Save**

## 步驟 4 — 上傳程式碼到 GitHub(3 分鐘)

1. 在 https://github.com 建一個 **私有** repo,名稱 `wosheng-pipeline`(不要勾 README)
2. 在終端機 cd 到本資料夾後執行:
```bash
cd /Users/hughlee/Downloads/Claude/wosheng-pipeline-v2
git init
git add .
git commit -m "Initial commit: MEDDIC Pipeline v1"
git branch -M main
git remote add origin https://github.com/你的帳號/wosheng-pipeline.git
git push -u origin main
```

## 步驟 5 — 部署到 Vercel(5 分鐘)

1. 打開 https://vercel.com → 用 GitHub 登入
2. **Add New → Project** → 選你剛上傳的 `wosheng-pipeline` repo → **Import**
3. Framework Preset:**Next.js**(自動偵測到)
4. 展開 **Environment Variables**,加入:
   - `NEXT_PUBLIC_SUPABASE_URL` = (步驟 1 記下的 Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (步驟 1 記下的 anon public key)
5. **Deploy**
6. 等 ~2 分鐘,會給你一個 `xxx.vercel.app` 網址

## 步驟 6 — 設定 Google 重新導向給 Vercel 網域(2 分鐘)

1. 複製 Vercel 給的網址(例 `wosheng-pipeline.vercel.app`)
2. 回 Supabase → **Authentication** → **URL Configuration**:
   - **Site URL**:`https://wosheng-pipeline.vercel.app`
   - **Redirect URLs**:加入 `https://wosheng-pipeline.vercel.app/auth/callback`
3. 儲存

## 步驟 7 — 第一次登入 + 升級為管理員(2 分鐘)

1. 打開你的 Vercel 網址,用 **你自己的 Google 帳號** 登入
2. 登入成功後會看到空白的 dashboard(還沒 seed 資料)
3. 回 Supabase → **SQL Editor** → **New query**,執行:
```sql
update public.profiles set role = 'manager' where email = '你自己的@gmail.com';
```
4. 重新整理網頁,右上現在會顯示「管理員 (看全部)」

## 步驟 8 — 邀請團隊 + 匯入 6 位現有客戶(5 分鐘)

1. 把 Vercel 網址傳給 Hugh、Ada、Kenny(你的 3 位 RM),請他們用 Google 登入一次
2. 登入後,回 Supabase → **SQL Editor** 執行:
```sql
select id, email, full_name from public.profiles;
```
   確認 3 個人的 email 都出現
3. 打開本 repo 的 `supabase/seed.sql`,把檔案最上面的 RM email 換成 Hugh/Ada/Kenny **實際登入的 Gmail**
4. 把整個改好的 `seed.sql` 貼到 Supabase SQL Editor → **Run**
5. 重新整理網頁,6 位客戶的資料應該都在了

✅ **完成!**

---

## 🔧 維運小備忘

- **新 RM 加入**:請他用 Google 登入一次,profile 就會自動建立。之後你在網頁上新增案件時可以指派給他。
- **升級管理員**:在 Supabase SQL 執行 `update profiles set role = 'manager' where email = '...';`
- **備份**:Supabase Free 方案每天自動備份 7 天。
- **自訂網域**:Vercel → Project Settings → Domains,可綁自己的網域(如 `pipeline.wosheng.com`)。綁完記得回 Supabase URL Configuration 更新 Site URL 與 Redirect URL。

## 🐛 常見問題

- **登入跳回登入頁**:Supabase URL Configuration 的 Site URL / Redirect URLs 沒設對。
- **看不到任何 deals**:RLS 設的是「RM 只看自己的」,確認你的 role 已升級為 manager,或你帳號名下有 deal。
- **Google 按下去沒反應**:Google Cloud 的 OAuth 同意畫面狀態是不是「測試中」,而你的 Gmail 沒加入 test users。

---

## 部署後升級

之後要改程式碼,只要:
```bash
git add . && git commit -m "..." && git push
```
Vercel 會自動重新部署,通常 1-2 分鐘。
