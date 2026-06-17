# 🚀 部署指南 — 恋爱刮刮 Bingo

本文档指导你将游戏发布为**人人可访问的网页**，无需服务器，完全免费。

---

## 方案一：GitHub Pages（推荐，最稳定）

### 前置条件
1. 注册 [GitHub](https://github.com) 账号
2. 下载安装 [Git](https://git-scm.com/downloads)

### 步骤

```bash
# 1. 在 GitHub 新建仓库（例如 love-bingo），不要勾选 README

# 2. 在本地执行
cd D:\workspace\Project11-love-bingo
git init
git add index.html
git commit -m "🎉 初恋刮刮Bingo"

# 3. 关联远程仓库并推送
git remote add origin https://github.com/你的用户名/love-bingo.git
git branch -M main
git push -u origin main

# 4. 启用 GitHub Pages
#    仓库页面 → Settings → Pages → Source 选 "Deploy from branch"
#    Branch 选 main，文件夹选 / (root) → Save
#    等待 1-2 分钟后访问：
#    https://你的用户名.github.io/love-bingo/
```

### 自定义域名（可选）
在仓库 Settings → Pages → Custom domain 填写你的域名，
并在域名 DNS 添加 CNAME 记录指向 `你的用户名.github.io`。

---

## 方案二：Vercel（最快，自动 HTTPS）

### 步骤
1. 注册 [Vercel](https://vercel.com)（可用 GitHub 登录）
2. 点击 **Add New → Project**
3. 导入你的 GitHub 仓库（或直接上传文件夹）
4. Framework Preset 选择 **Other**
5. 点击 **Deploy**，等待几秒即可获得 `https://love-bingo.vercel.app`

### 优点
- 自动 HTTPS
- 全球 CDN 加速
- 支持自定义域名

---

## 方案三：Netlify（拖拽部署）

### 步骤
1. 注册 [Netlify](https://netlify.com)
2. 将 `index.html` 拖拽到 Netlify 的 Sites 页面
3. 几秒后即可获得 `https://随机名称.netlify.app`

### 自定义域名
Site settings → Domain management → Add custom domain

---

## 方案四：本地局域网分享（无需注册）

如果只是想在同一 WiFi 下让朋友访问：

### 使用 Python（无需安装额外工具）
```bash
cd D:\workspace\Project11-love-bingo
python -m http.server 8080
```
然后局域网内访问 `http://你的IP:8080`

### 使用 Node.js（如果已安装）
```bash
npx serve D:\workspace\Project11-love-bingo
```

---

## 方案五：使用在线工具（零代码）

- **CodePen** — 将 index.html 内容粘贴到 codepen.io → Save → 获得公开链接
- **JSFiddle** — 同上，jsfiddle.net
- **GitHub Gist + raw.githack.com** — 创建 Gist → 用 `raw.githack.com` 预览

---

## 方案对比

| 方案 | 难度 | 速度 | HTTPS | 自定义域名 | 持久性 |
|------|:----:|:----:|:----:|:---------:|:-----:|
| GitHub Pages | ⭐⭐ | 快 | ✅ | ✅ | 永久 |
| Vercel | ⭐ | 很快 | ✅ | ✅ | 永久 |
| Netlify | ⭐ | 很快 | ✅ | ✅ | 永久 |
| 局域网分享 | ⭐⭐⭐ | 即时 | ❌ | ❌ | 临时 |
| CodePen | ⭐ | 即时 | ✅ | ❌ | 长期 |

---

## 推荐路线

1. **立即分享** → 用 CodePen 或 Netlify 拖拽部署（2分钟）
2. **长期使用** → GitHub Pages 或 Vercel（10分钟）
3. **自定义域名** → GitHub Pages / Vercel + 域名绑定

---

*更多信息请查看 README.md*