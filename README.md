# A.lab | 解題實驗室(Next.js + Vercel 版)

由原 Streamlit 程式移植,可直接部署到 Vercel。

## 部署步驟
1. 把這個資料夾推到 GitHub,在 Vercel 匯入專案(Framework 自動偵測為 Next.js)。
2. Vercel 專案 → Storage / Marketplace → 安裝 **Upstash Redis**,連到此專案(會自動注入 `KV_REST_API_URL`、`KV_REST_API_TOKEN`)。
3. Settings → Environment Variables 設定:
   - `GEMINI_API_KEY`、`OPENAI_API_KEY`(至少一組)
   - `SESSION_SECRET`(長隨機字串,`openssl rand -base64 32`)
   - `ADMIN_USERNAME`、`ADMIN_PASSWORD`(第一次登入時自動建立管理員)
4. Deploy。

## 本機開發
```
cp .env.example .env.local   # 填入各項金鑰
npm install
npm run dev
```
