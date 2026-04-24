import { z } from 'zod';

// ====== Feature A: Parse Interaction ======
export const MEDDIC_FIELDS = ['m', 'e', 'd1', 'd2', 'p', 'i', 'c1', 'c2'] as const;
export const STAGES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] as const;

export const ScoreUpdateSchema = z.object({
  field: z.enum(MEDDIC_FIELDS),
  old: z.number().int().min(0).max(10),
  new: z.number().int().min(0).max(10),
  reason: z.string().describe('為什麼分數要這樣改,用一句話講清楚'),
});

export const ParseInteractionResponseSchema = z.object({
  summary: z.string().describe('一句話總結這次對話的重點'),
  score_updates: z.array(ScoreUpdateSchema).describe('建議的 MEDDIC 分數變更,沒有就給空陣列'),
  new_comment: z.string().describe('要加到註解時間軸的文字摘要(含關鍵事實)'),
  next_step_update: z.string().nullable().describe('新的下一步動作;若無變化給 null'),
  question_checkoffs: z.array(z.string()).describe('已釐清的題庫 key (例 m_aum, e_spouse_meet);沒有給空陣列'),
  stage_suggestion: z.enum(STAGES).nullable().describe('若這次對話足以推進階段,建議新階段;否則 null'),
  ask_back: z.array(z.string()).describe('AI 建議 RM 下次要追問的 2-3 個問題(讓 MEDDIC 更完整)'),
});

export type ParseInteractionResponse = z.infer<typeof ParseInteractionResponseSchema>;

// ====== Feature B: Generate Plan ======
export const PlanStepSchema = z.object({
  id: z.string().describe('步驟唯一識別 (s1, s2...)'),
  title: z.string().describe('步驟標題'),
  target_date: z.string().describe('建議完成日期 YYYY-MM-DD'),
  stage_transition: z.string().describe('此步驟要推進的階段轉換,例如 L3→L4;或 L4 內部'),
  focus: z.array(z.string()).describe('核心動作(要做什麼),2-4 條'),
  talking_points: z.array(z.string()).describe('具體話術或提問,2-4 條'),
  risks: z.array(z.string()).describe('這步可能卡關的地方,1-3 條'),
});

export const GeneratePlanResponseSchema = z.object({
  overview: z.string().describe('整體策略分析,說明依目前狀態設計這條路徑的邏輯'),
  feasibility: z.enum(['high', 'medium', 'low']).describe('達成目標日的可行性評估'),
  feasibility_reason: z.string().describe('可行性評估的理由(例:核保至少 8 週,目標日 6 週內屬樂觀)'),
  top_risks: z.array(z.string()).describe('整體 3 個最大風險(不是單步驟的)'),
  steps: z.array(PlanStepSchema).min(3).max(8).describe('分 3-8 步驟(不要過細,每步是一個明確的里程碑)'),
});

export type GeneratePlanResponse = z.infer<typeof GeneratePlanResponseSchema>;
