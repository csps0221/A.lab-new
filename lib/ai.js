import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const GEMINI_KEY = () => (process.env.GEMINI_API_KEY || '').trim();
const OPENAI_KEY = () => (process.env.OPENAI_API_KEY || '').trim();

const DEPTH_DESC = {
  '精簡解答': '請提供最直觀的核心觀念與必要的重點計算步驟,語言精煉不贅述。',
  '標準詳解': '請提供完整的推理過程、步驟拆解、公式推導與概念說明,適合常規學習觀看。',
  '深度解析': '請提供極其詳細的引申觀念、原理探討、易錯陷阱提醒以及多維度的邏輯剖析。',
};

// 每次呼叫都「先」告訴 AI 解說深淺,再給題目
export const depthLine = (depth) => `【本次解說深度:${depth}】${DEPTH_DESC[depth] || ''}(深度只影響呈現的詳盡程度,解題方式與答案必須與其他深度完全一致)`;

export function buildSystemPrompt(subject, depth, allowed) {
  const restrict = allowed?.length
    ? `\n3. 【科目限制】本使用者只被允許詢問以下科目:${allowed.join('、')}。若題目內容明顯不屬於這些科目,請不要解題,只回傳 {"off_topic": true}。`
    : '';
  return `你是一位專業嚴謹的【${subject}】領域萬能AI導師。

【第一步:先確認本次的解說深淺】
${depthLine(depth)}

【一致性規則(最重要)】
解說深度只決定「最後怎麼呈現」,完全不可以影響解題本身。無論深度是精簡、標準或深度,你都必須:
1. 用同樣嚴謹、完整的推理方式,把題目確實解對(先完整解完並檢查答案無誤);
2. 最終答案(ans)與每個選項的對錯(is_correct)必須與其他深度完全一致;
3. 解完之後,才依上面的解說深度,整理成 reasoning 與 options_analysis 的詳略。

請針對使用者提出的問題進行【${subject}】領域精準解答。
請嚴格回傳JSON格式(不要包裹在 markdown codeblock 中):
{
  "ans": "正確答案選項或簡短最終結果",
  "reasoning": "步驟清晰、邏輯嚴謹的詳細觀念推導過程",
  "options_analysis": [
    {"option": "(A)", "is_correct": true, "text": "(A) 敘述內容", "explanation": "針對選項A的具體對錯分析與說明"},
    {"option": "(B)", "is_correct": false, "text": "(B) 敘述內容", "explanation": "針對選項B的具體對錯分析與說明"}
  ]
}
說明:
1. 若題目包含選擇題選項(如A, B, C, D, E等),請務必填充 options_analysis 陣列,逐一評估每個選項的正確與否(is_correct: true/false)並給出簡要解析。若非選擇題或無具體選項,options_analysis 可為空陣列。
2. 公式請使用 LaTeX,行內用 $...$、獨立一行用 $$...$$。因為輸出是 JSON,LaTeX 的反斜線必須寫成雙反斜線(例如 \\\\frac{a}{b})。請以繁體中文回答。${restrict}`;
}

function parseJson(raw) {
  let s = (raw || '').replace(/```json|```/g, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try {
    return JSON.parse(s);
  } catch {
    // 容錯:把 LaTeX 的單反斜線補成合法跳脫
    return JSON.parse(s.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTransient = (e) => /503|UNAVAILABLE|429|RESOURCE_EXHAUSTED|overloaded|high demand|timeout|fetch failed/i.test(String(e?.message || e));

// 同一個引擎重試幾次;遇到「太忙」類暫時性錯誤時,先等一下再試
async function attempt(run, tries) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await run(); } catch (e) {
      last = e;
      if (i < tries - 1) await sleep(isTransient(e) ? 1500 : 300);
    }
  }
  throw last;
}

// 依序嘗試:管理員選的 Gemini 模型 → 備用 Gemini 模型 → OpenAI
async function runChain(chain) {
  if (!chain.length) throw new Error('目前沒有可用的 AI 引擎(未設定金鑰或已被管理員關閉)');
  const errs = [];
  for (let i = 0; i < chain.length; i++) {
    try { return await attempt(chain[i], i === 0 ? 2 : 1); } catch (e) { errs.push(e); }
  }
  // 優先回報「不是模型停用」的錯誤,才看得出真正原因(例如太忙、金鑰問題)
  throw errs.find((e) => !/404|NOT_FOUND|no longer available/i.test(String(e?.message || e))) || errs[0];
}

export function friendlyError(e) {
  const m = String(e?.message || e);
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(m)) return 'AI 目前使用人數太多(Google 端暫時忙碌),請等 1~2 分鐘後再按一次「開始解題」。';
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(m)) return 'AI 呼叫次數或額度已達上限,請稍後再試,或請管理員檢查金鑰額度。';
  if (/404|NOT_FOUND|no longer available/i.test(m)) return '選用的 AI 模型已停用或不存在,請管理員到後台「AI 設定」把 Gemini 模型換成 gemini-3.8-flash。';
  if (/API key|permission|401|403/i.test(m)) return 'AI 金鑰無效或沒有權限,請管理員檢查 API Key 設定。';
  return `AI 呼叫失敗:${m.slice(0, 200)}`;
}

function geminiModels(cfg) {
  const main = cfg.selected_gemini_model;
  const backups = ['gemini-3.8-flash', 'gemini-3.6-flash'].filter((m) => m !== main);
  return [main, ...backups];
}

export async function ocrImages(images, extra, subject, cfg) {
  const prompt = `這是一道【${subject}】科目的題目。請詳細轉錄圖片中的所有題目文字、選項與公式。補充文字描述:\n${extra || '無'}`;
  const chain = [];
  if (GEMINI_KEY() && cfg.enable_gemini) {
    for (const model of geminiModels(cfg)) {
      chain.push(async () => {
        const ai = new GoogleGenAI({ apiKey: GEMINI_KEY() });
        const r = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [...images.map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })), { text: prompt }] }],
        });
        return (r.text || '').trim();
      });
    }
  }
  if (OPENAI_KEY() && cfg.enable_openai) {
    chain.push(async () => {
      const client = new OpenAI({ apiKey: OPENAI_KEY() });
      const r = await client.chat.completions.create({
        model: 'gpt-4o-mini', // 圖片辨識備援需使用支援視覺的模型
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          ...images.map((d) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${d}` } })),
        ] }],
      });
      return (r.choices[0].message.content || '').trim();
    });
  }
  return chain.length ? runChain(chain) : '';
}

export async function solve(question, subject, depth, cfg, allowed) {
  const sys = buildSystemPrompt(subject, depth, allowed);
  const userMsg = `${depthLine(depth)}\n\n【${subject}】題目需求與描述:\n${question}`;
  const toResult = (raw) => {
    const d = parseJson(raw);
    if (d.off_topic === true) return { off_topic: true };
    return {
      ans: d.ans || '無解答',
      reasoning: d.reasoning || '無解析內容',
      options_analysis: Array.isArray(d.options_analysis) ? d.options_analysis : [],
    };
  };
  const chain = [];
  if (GEMINI_KEY() && cfg.enable_gemini) {
    for (const model of geminiModels(cfg)) {
      chain.push(async () => {
        const ai = new GoogleGenAI({ apiKey: GEMINI_KEY() });
        const r = await ai.models.generateContent({
          model,
          contents: userMsg,
          config: { systemInstruction: sys, responseMimeType: 'application/json' },
        });
        return toResult(r.text);
      });
    }
  }
  if (OPENAI_KEY() && cfg.enable_openai) {
    chain.push(async () => {
      const client = new OpenAI({ apiKey: OPENAI_KEY() });
      const r = await client.chat.completions.create({
        model: cfg.selected_openai_model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      });
      return toResult(r.choices[0].message.content);
    });
  }
  return runChain(chain);
}

export const MAX_FOLLOWUPS = 3;

export async function followup(record, question, cfg) {
  const sys = `你是一位專業嚴謹的【${record.subject}】領域AI導師,正在回答學生對「同一道題目」的追問。
規則:
1. 只回答與這道題目相關的追問(觀念、步驟、選項、計算、延伸理解)。若問題與此題無關,只回覆「請針對這題提問」。
2. 以繁體中文回答,簡潔清楚;公式請用 LaTeX,行內 $...$、獨立一行 $$...$$。
3. 直接輸出回答內容,不要輸出 JSON。`;
  const ctx = `【原題目】\n${String(record.question || record.note || '').slice(0, 4000)}\n\n【先前AI解答】\n答案:${record.ans}\n推導:${String(record.reasoning || '').slice(0, 4000)}`;
  const hist = (record.followups || []).map((f) => `學生追問:${f.q}\nAI回答:${f.a}`).join('\n\n');
  const userMsg = `${ctx}\n\n${hist ? `【先前追問】\n${hist}\n\n` : ''}【學生這次的追問】\n${question}`;
  const nonEmpty = (t) => { if (!t || !String(t).trim()) throw new Error('AI 沒有回覆內容'); return String(t).trim(); };

  const chain = [];
  if (GEMINI_KEY() && cfg.enable_gemini) {
    for (const model of geminiModels(cfg)) {
      chain.push(async () => {
        const ai = new GoogleGenAI({ apiKey: GEMINI_KEY() });
        const r = await ai.models.generateContent({ model, contents: userMsg, config: { systemInstruction: sys } });
        return nonEmpty(r.text);
      });
    }
  }
  if (OPENAI_KEY() && cfg.enable_openai) {
    chain.push(async () => {
      const client = new OpenAI({ apiKey: OPENAI_KEY() });
      const r = await client.chat.completions.create({
        model: cfg.selected_openai_model,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      });
      return nonEmpty(r.choices[0].message.content);
    });
  }
  return runChain(chain);
}
