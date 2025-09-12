# 部署到 Vercel（方案 B：带无服务代理）

## 1) 环境变量（仅服务端可见）
Vercel → Project → Settings → Environment Variables：
- `ALAPI_BASE = https://v3.alapi.cn`
- `ALAPI_TOKEN = 你的真实 token`

## 2) 导入仓库 & 构建
- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`

## 3) 前端设置
部署后在线上页面的“设置”，把 **ALAPI 基址** 改为你的域名根：
```
https://<your-project>.vercel.app
```
（前端无需填写 token，后端 Edge 函数使用 `ALAPI_TOKEN`）

## 4) 本地调试（可选）
```bash
npm i -g vercel
vercel dev   # http://localhost:3000
```
此时将 **ALAPI 基址** 改成 `http://localhost:3000`，即可走本地代理。
