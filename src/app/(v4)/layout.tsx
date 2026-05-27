import type { Metadata } from 'next';

// V4 平台路由群組的共用 layout。
// 用 .v4-root 包住一切,把 v4 設計 token(paper 底色 / 土系 stage 配色 /
// Fraunces+IBM Plex 字體棧)作用域在此分支內,完全不影響 / 與 /market 等既有路由。

export const metadata: Metadata = {
  title: 'WORLDSUN V4 — Layout Studies',
  description: 'MEDDIC pipeline layout proposals (Hub / Workspace)',
};

export default function V4Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="v4-root font-v4-sans antialiased text-ink">
      {children}
    </div>
  );
}
