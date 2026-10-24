# 🚀 部署指南 · 恋爱刮刮 Bingo

这是一个**纯静态站点**：没有构建步骤、没有后端、没有依赖，把一个目录丢上去就能跑。
下面的方案都是免费的，选一个即可。

---

## 方案一：GitHub Pages（推荐）

### 用自带的工作流（最省事）

仓库里已经放了 `.github/workflows/pages.yml`，推到默认分支（`main` 或 `master`）就会自动部署。

1. 把代码推到 GitHub 仓库的 `main` 分支。
2. 打开仓库 **Settings → Pages**，把 **Source** 设为 **GitHub Actions**。
3. 等 Actions 跑完（约 30 秒），访问：

   ```
   https://你的用户名.github.io/仓库名/
   ```

### 不用 Actions 也行

**Settings → Pages → Source: Deploy from a branch**，Branch 选默认分支（`main` / `master`），目录选 `/ (root)`，保存即可。
整个项目使用相对路径，放在子路径（如 `/love-bingo/`）下同样正常。

### 自定义域名（可选）

Settings → Pages → Custom domain 填写域名，并在 DNS 添加 CNAME 指向 `你的用户名.github.io`。
HTTPS 勾上即可。

---

## 方案二：Vercel

1. 用 GitHub 登录 [vercel.com](https://vercel.com) → **Add New → Project**。
2. 导入仓库，Framework Preset 选 **Other**。
3. Build Command 留空，Output Directory 留空，**Deploy**。

得到 `https://xxx.vercel.app`。以后每次 push 自动更新。

---

## 方案三：Netlify

1. 登录 [netlify.com](https://netlify.com) → **Add new site → Import an existing project**。
2. 选 GitHub 仓库，Build command 留空，Publish directory 填 `.`。
3. Deploy。或者直接把整个文件夹拖进 Netlify Drop。

---

## 方案四：局域网 / 本地演示

```bash
# 在项目根目录
python -m http.server 8080
# 或
npx serve .
```

手机和电脑连同一个 WiFi，用电脑的局域网 IP 访问，例如 `http://192.168.1.8:8080`。
第一次分享给 TA 时，这种方式最快。

---

## 部署后需要确认的几件事

| 检查项 | 说明 |
|---|---|
| **HTTPS** | PWA 安装、剪贴板复制、系统分享都要求 https（localhost 除外） |
| **路径** | 所有资源都是相对路径，部署在子目录也没问题 |
| **OG 图** | `index.html` 里 `og:image` 写死了 `https://kriye-hu.github.io/love-bingo/assets/og-image.png`，换成你的域名 |
| **Web Share** | 需在手机上用 https 打开；桌面 Chrome 会回退成复制链接 |
| **离线缓存** | 更新代码后如果页面没变，是 Service Worker 缓存；改 `sw.js` 里的 `VERSION` 即可强制更新 |
| **分享链接** | 用部署后的域名生成，`#c=` 后面的内容不会发给服务器，隐私安全 |

---

## 常见问题

**页面空白？**
用浏览器控制台看是否 404：多半是直接双击 `index.html` 打开了模块或路径大小写不一致。

**改了代码但手机上没变？**
Service Worker 的缓存策略是「先用缓存、后台更新」，刷新两次或改 `sw.js` 的 `VERSION`。

**手机装不上？**
iOS 必须用 Safari；微信内置浏览器不支持安装，请用「在浏览器中打开」。

**能多人同时用同一张卡吗？**
可以，但进度各自独立存在各自手机上，目前不做云端同步。

---

*更多说明见 [README.md](README.md)*
