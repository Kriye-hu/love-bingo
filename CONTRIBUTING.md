# 参与贡献

谢谢你想让这张卡更好玩。这个项目**没有构建步骤、没有依赖**，改完刷新浏览器就能看到效果。

## 你可以贡献什么

### 1. 更好的「心动任务」文案

所有默认文案在 `assets/js/data.js`：

- `TASK_LIBRARY` — 随机池（现在是 60 条），制作者点「随机换一批」时从这里抽
- `DEFAULT_TASKS` — 默认卡面上的 24 条
- `DEFAULT_COUPONS` — 默认奖励券
- `TEMPLATES` — 一键模板（异地恋 / 同居日常 / 周年纪念 / 长跑情侣），每套 24 条任务 + 8 张券 + 建议配色

### 2. 新模板

在 `TEMPLATES` 里加一个对象，字段参考现有的四套：
`id` / `name` / `emoji` / `desc` / `theme`（主题 id）/ `center`（中心格，用 `
` 换行）/ `tasks`（24 条）/ `coupons`（8 张）。
注意任务要贴合这一组关系的真实日常，24 条不要重复。

要求：一句一件**当天就能做到**的小事，不超过 20 个汉字，结尾带一个 emoji。
不要写需要花钱、需要出门旅行、或只有一方能完成的事。

### 2. 新主题

在 `assets/js/data.js` 的 `THEMES` 里加一个对象即可，字段参考现有的五套：
`accent` / `accent2` / `bg` / `ink` / `soft` / `faint` / `card` / `border` / `pattern`。

请确认：正文在卡片底色上对比度足够；深色主题把 `dark` 设为 `true`。

### 3. Bug 与想法

开 Issue 时说明：手机型号 / 浏览器版本 / 复现步骤，最好带一张截图。

## 本地开发

```bash
python -m http.server 8080
# 或 npx serve .
```

然后用手机和 Chrome DevTools 的设备模拟各看一遍（推荐 390×844 与 360×640）。

## 改动前请确认

- 不引入运行时依赖；保持「一个静态目录就能跑」
- 不发起任何网络请求（隐私是这个项目的卖点）
- 移动端优先：点击区域 ≥ 40px，不出现横向滚动
- 不破坏 `localStorage` 的旧存档（改结构请在 `store.js` 的 `normalize*` 里兼容）
- 新增文案用中文；代码注释可以中英混排

## 截图流程（可选）

```bash
python -m http.server 8123   # 另开一个终端
node tools/shot.mjs          # 用 Chrome CDP 跑一遍真实交互，截图到 docs/raw
python tools/build_docs.py   # 压成 README 尺寸
```

需要本机安装 Chrome；脚本会启动无头浏览器、真实刮格子、开券、生成海报并检查控制台报错。

### 演示动图

```bash
node tools/demo-gif.mjs      # 录一组帧到 docs/raw/gif
python tools/build_gif.py    # 合成 docs/demo.gif + docs/demo.webp
```

## 提交

一个 PR 只做一件事；标题写清楚改了什么，比如 `feat: 新增「异地恋」任务包`。
如果你不确定值不值得做，先开 Issue 聊聊，避免白写。
