# Family Wallet Map Module — Technical Specification

**Status**: Draft v1.0
**Author**: Hugh Lee
**Reviewers**: Johnson (Dev), Abbie (COO)
**Last Updated**: 2025-05-16

---

## 1. Background & Purpose

### 1.1 Why we are building this

The current `deals` table captures transaction-level data following MEDDPICC methodology. However, our actual sales motion is **family-level**, not deal-level:

- A single high-net-worth family may close multiple deals over years (HK par insurance → FCN → SN → trust setup)
- 80%+ of incremental revenue comes from cross-selling existing families, not new logo acquisition
- The "soft intelligence" (家族議題, 競爭對手關係, 推測財富, entry points) currently lives only in Hugh and Davie's heads, not in the system
- When an RM leaves, this intelligence is lost

### 1.2 Success criteria

- **3 months post-launch**: 80%+ of A-tier and B-tier families have a maintained wallet map
- **Weekly Monday standup**: Wallet maps are the primary reference document, not the deal pipeline
- **Q3 revenue target**: At least 30% of new closings can be traced to a wallet map "Entry Point" that was documented before the closing

### 1.3 Out of scope (Phase 1)

- Cross-deal aggregation reports
- Search by family attributes
- Family relationship graph
- Automated reminders via email/LINE
- Mobile-optimized editing

These may be revisited in Phase 2.

---

## 2. Design Philosophy

### 2.1 Why Phase 1 is intentionally minimal

We are deliberately **not** building a normalized `family_accounts` table in Phase 1. Reasoning:

1. We don't yet know which wallet map fields will be queried vs. just read
2. Building proper normalization requires 3+ weeks of dev time
3. Phase 1 just needs a place to dump structured Markdown text so the team starts capturing intelligence today

**Rule**: Ship Phase 1 in 1-2 weeks. Decide on Phase 2 only after 4-8 weeks of real usage data.

### 2.2 Important architectural notes (verified against this repo)

- Deal detail UI is `src/components/DealDetail.tsx` (SPA-style, imported by Dashboard.tsx). There is **no** `/deals/[id]` route. The wallet map section must be added inside DealDetail.tsx.
- RLS for wallet map must reuse the existing `can_access_deal()` function (defined in `migration_8_teams.sql` and onwards), not introduce a new permission model.
- The authoritative deals RLS is from migration_8 onwards; `schema.sql:178` is outdated. Do not reference schema.sql for permission logic.

---

## 3. Phase 1 Specification

### 3.1 Database changes

Migration file: `supabase/migration_14_family_wallet_map.sql`


```sql
-- Add wallet map fields to existing deals table
ALTER TABLE deals
ADD COLUMN family_wallet_map_md TEXT,
ADD COLUMN family_wallet_map_last_reviewed_at TIMESTAMPTZ,
ADD COLUMN family_wallet_map_updated_at TIMESTAMPTZ DEFAULT now();

-- Index for "stale wallet maps" query
CREATE INDEX idx_deals_wallet_map_review
ON deals (family_wallet_map_last_reviewed_at)
WHERE family_wallet_map_md IS NOT NULL;

-- Auto-update updated_at on wallet map content change
CREATE OR REPLACE FUNCTION update_wallet_map_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.family_wallet_map_md IS DISTINCT FROM OLD.family_wallet_map_md THEN
    NEW.family_wallet_map_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wallet_map_timestamp
BEFORE UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION update_wallet_map_timestamp();

-- Audit log table
CREATE TABLE wallet_map_audit_log (
  id BIGSERIAL PRIMARY KEY,
  deal_id UUID REFERENCES deals(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT CHECK (action IN ('view', 'edit', 'mark_reviewed')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wallet_audit_deal_user
ON wallet_map_audit_log (deal_id, user_id, created_at DESC);
```



### 3.2 Row-Level Security (RLS)

**Critical**: Reuse the existing `can_access_deal()` function. Do not write new policies from scratch.

The existing RLS on `deals` table (from migration_8_teams.sql onwards) already protects all columns including the new wallet map fields. No new policies needed on `deals` table itself.

For `wallet_map_audit_log`:


```sql
ALTER TABLE wallet_map_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own audit entries
CREATE POLICY "audit_log_insert_own"
ON wallet_map_audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can read audit entries for deals they can access
CREATE POLICY "audit_log_select_via_deal_access"
ON wallet_map_audit_log FOR SELECT
USING (can_access_deal(deal_id));
```



### 3.3 Frontend specification

#### 3.3.1 Location

Add a new section inside `src/components/DealDetail.tsx`. Default collapsed. Auto-expanded if the deal has wallet map content.

#### 3.3.2 Section header


```
🔒 家族客戶情報 (Family Wallet Map)                  [展開 ▼]
高度敏感資料 — 不可外傳、不可截圖、不可下載
最後更新:YYYY-MM-DD  |  最後審視:X 天前  [標記為已審視 ✓]
```



Staleness indicator:
- ≤30 days: 綠色「X 天前」
- 31-60 days: 黃底「⚠️ X 天未審視」
- 60+ days: 紅底「🔴 已 X 天未審視 — 請更新」

#### 3.3.3 Editor

Use `@uiw/react-md-editor` (to be installed in Step 3.2). Side-by-side preview. No image upload. No external link auto-fetch.

On first open (if `family_wallet_map_md` is NULL), populate with the template from §3.4.

Save on blur AND on explicit Save button.

#### 3.3.4 Watermark

CSS-based overlay when section is expanded:


```css
.wallet-map-section {
  position: relative;
}

.wallet-map-section::before {
  content: "CONFIDENTIAL — " attr(data-user-email) " — " attr(data-timestamp);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 32px;
  color: rgba(0, 0, 0, 0.05);
  pointer-events: none;
  z-index: 1;
  white-space: nowrap;
  user-select: none;
}

@media print {
  .wallet-map-section { display: none; }
}
```



#### 3.3.5 Disabled features

- No print
- No export
- No public links
- No copy-to-clipboard buttons

### 3.4 Markdown template


```markdown
## 1. 家族結構
- 第一代:
- 第二代:
- 第三代:
- 配偶/其他:

## 2. 已知財富來源與規模
- 主業:
- 不動產:
- 已知金融資產:
- 業外:

## 3. 已成交(我們拿到的份額)
- 

## 4. 已知未成交(提過但卡住)
- 

## 5. 推測但未驗證(情報缺口)
- 

## 6. 家族議題(軟性線索)
- 

## 7. Next 90 天的 Entry Point
- 主軸打法:
- 第一步:
- 第二步:
- 第三步:
- 預估增量營收貢獻:

## 8. 風險標記
- 

## 9. 上次接觸 / 下次接觸
- 上次:
- 下次:
- 接觸頻率目標:
```


### 3.5 Audit logging

Write to `wallet_map_audit_log` on:
- `view`: when section expanded
- `edit`: on save
- `mark_reviewed`: on review button click

Use Supabase server action or RPC, not direct client write.

---

## 4. Open Questions (resolved)

1. **Who counts as a family needing a wallet map?** Every deal closed in last 24 months OR currently in pipeline above USD 1M.
2. **Dennis's permission scope**: Only deals he is the referrer on.
3. **RM leaves company**: Wallet map ownership transfers to Hugh by default.
4. **Anonymized training view**: Phase 2 consideration, not now.

---

## 5. Usage Policy

Before launch, all RMs sign acknowledgment of:
- Confidential level: highest, equivalent to KYC data
- No screenshots, no copy to LINE/WhatsApp/Email
- No export
- Always lock screen when away from desk
- First violation: written warning + 1-on-1
- Repeat or major violation: termination + legal action

---

## 6. Rollout Plan

| Week | Owner | Action |
|---|---|---|
| 1-2 | Johnson | DB migration, RLS, frontend section |
| 3 | Hugh+Abbie | UAT, finalize policy |
| 4 | All | Production deploy, policy signed |
| 5-8 | Davie | Populate 10-25 wallet maps |
| 9 | Hugh+Abbie | Review usage, decide Phase 2 |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| RM screenshots and leaks | Policy + audit log + watermark + termination clause |
| Davie ignores system | Mandatory Monday standup uses system |
| Over-engineering Phase 1 | Spec intentionally minimal |
| Phase 1 blocks Phase 2 | Markdown blob is migratable |

---

## 8. Definition of Done

- [ ] migration_14_family_wallet_map.sql executed
- [ ] Audit log RLS policies deployed and tested
- [ ] Frontend editor section live in DealDetail.tsx
- [ ] Watermark visible when expanded
- [ ] Staleness indicator working
- [ ] Audit log capturing all three event types
- [ ] Usage policy signed by Hugh, Davie, Dennis
- [ ] At least 5 real wallet maps created
- [ ] Hugh used "stale wallet maps" view in Monday standup

---

**End of Spec**
