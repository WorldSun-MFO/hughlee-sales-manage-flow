/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,

  // ============================================================
  // Client-side router cache(staleTimes)
  // ============================================================
  // Next.js 15 內建。控制「在路由間切換時,已造訪過的頁面在 client 端
  // 保留多久不重抓 server」。
  //
  //   dynamic: 60  → 動態頁(force-dynamic 的全 v4 路由 / 主 Dashboard)
  //                  client cache 60 秒。60 秒內回頭點之前的頁 = 0ms(不重抓)
  //                  主工作頁(今日/任務/客戶…)都有 RealtimeRefresher,
  //                  DB 一變就 router.refresh() 失效快取,所以拉長不會看到舊資料
  //   static: 180  → 靜態頁(/login、/demo-gate)cache 3 分鐘
  //
  // 失效時機(全自動,不需手動處理):
  //   - mutation 後呼叫的 router.refresh() → 該路由 cache 立刻失效
  //   - RealtimeRefresher 偵測到 DB 變動 → router.refresh()
  //   - 30 秒過 → cache 自然 stale,下次造訪重抓
  //   - hard reload (F5) → 整個 client cache 清空
  //
  // 為什麼設 30 秒不是更長:
  //   多人協作場景下,沒設 realtime 訂閱的頁面(例如 /v4/.../market)
  //   超過 30 秒不刷新就會看到舊資料。30 秒是「夠快回頭體驗」和「最大
  //   容忍多人不同步」的平衡點。
  // ============================================================
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
  },
};
export default nextConfig;
