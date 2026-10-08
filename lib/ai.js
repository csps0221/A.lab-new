import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const GEMINI_KEY = () => (process.env.GEMINI_API_KEY || '').trim();
const OPENAI_KEY = () => (process.env.OPENAI_API_KEY || '').trim();

export function buildSystemPrompt(subject, depth) {
  const desc = {
    '精簡解答': '請提供最直觀的核心觀念與必要的重點計算步驟,語言精煉不贅述。',
    '標準詳解': '請提供完整的推理過程、步驟拆解、公式推導與概念說明,適合常規學習觀看。',
    '深度解析': '請提供極其詳細的引申觀念、原理探討、易錯陷阱提醒以及多維度的邏輯剖析。',
  }[depth] || '';
  return `你是一位專業嚴謹的【${subject}】領域萬能AI導師。
本次解題要求深度為:【${depth} (${desc})】。
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
2. 公式請使用 LaTeX,行內用 $...$、獨立一行用 $$...$$。因為輸出是 JSON,LaTeX 的反斜線必須寫成雙反斜線(例如 \\\\frac{a}{b})。請以繁體中文回答。`;
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

export async function ocrImages(images, extra, subject, cfg) {
  const prompt = `這是一道【${subject}】科目的題目。請詳細轉錄圖片中的所有題目文字、選項與公式。補充文字描述:\n${extra || '無'}`;
  if (GEMINI_KEY() && cfg.enable_gemini) {
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY() });
    const r = await ai.models.generateContent({
      model: cfg.selected_gemini_model,
      contents: [{
        role: 'user',
        parts: [...images.map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })), { text: prompt }],
      }],
    });
    return (r.text || '').trim();
  }
  if (OPENAI_KEY() && cfg.enable_openai) {
    const client = new OpenAI({ apiKey: OPENAI_KEY() });
    const r = await client.chat.completions.create({
      model: 'gpt-4o-mini', // 圖片辨識備援需使用支援視覺的模型
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map((d) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${d}` } })),
        ],
      }],
    });
    return (r.choices[0].message.content || '').trim();
  }
  return '';
}

export async function solve(question, subject, depth, cfg) {
  const sys = buildSystemPrompt(subject, depth);
  const userMsg = `【${subject}】題目需求與描述:\n${question}`;
  const providers = [];

  if (GEMINI_KEY() && cfg.enable_gemini) {
    providers.push(async () => {
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY() });
      const r = await ai.models.generateContent({
        model: cfg.selected_gemini_model,
        contents: userMsg,
        config: { systemInstruction: sys, responseMimeType: 'application/json' },
      });
      return r.text;
    });
  }
  if (OPENAI_KEY() && cfg.enable_openai) {
    providers.push(async () => {
      const client = new OpenAI({ apiKey: OPENAI_KEY() });
      const r = await client.chat.completions.create({
        model: cfg.selected_openai_model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      });
      return r.choices[0].message.content;
    });
  }
  if (!providers.length) throw new Error('目前沒有可用的 AI 引擎(未設定金鑰或已被管理員關閉)');

  let lastErr;
  for (const run of providers) {
    for (let i = 0; i < 2; i++) {
      try {
        const d = parseJson(await run());
        return {
          ans: d.ans || '無解答',
          reasoning: d.reasoning || '無解析內容',
          options_analysis: Array.isArray(d.options_analysis) ? d.options_analysis : [],
        };
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw new Error(`AI 呼叫失敗:${lastErr?.message || '未知錯誤'}`);
}
