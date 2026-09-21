# Voxel Chinese Architecture

一组以 **Three.js** 手工堆砌的中国古典建筑群体素（voxel / Minecraft 方块风）场景，外加两个独立的
单文件前端作品（动画、海报）。

四个体素场景是同一主题的连续迭代：都采用中轴对称院落布局、程序化生成屋顶形制、
浏览器打开即自动推镜入场，无需后端、无需 API Key。

---

## 目录

| 目录 | 作品 | 技术 | 说明 |
|---|---|---|---|
| [`01/`](01/) | **紫微宫 · 体素中式古典建筑群** | Three.js + Vite | 8 座建筑；晨曦 / 正午 / 黄昏 / 夜阑四时辰预设；约 10.7 万体素、单材质渲染。含 4 张实测截图 |
| [`02/voxel-chinese-temple/`](02/voxel-chinese-temple/) | **紫微宫 · 体素中式古典建筑群**（Voxel Chinese Temple） | Three.js + Vite | 7 座建筑（主殿 / 山门 / 东西配殿 / 钟鼓楼 / 宝塔）；支持打包成**单个 HTML 文件**双击即可打开 |
| [`03/`](03/) | **体素 · 中国古典建筑群** | Three.js + Vite | 5 座建筑；黄昏渐变天空、4096 阴影贴图 |
| [`04/voxel-chinese-courtyard/`](04/voxel-chinese-courtyard/) | **体素中式古建群 · Voxel Chinese Courtyard** | Three.js + Vite | 7 座建筑，`src/` 拆分最细（12 个模块）；含可检验的完成定义自检 |
| [`动画/`](动画/) | **Halftone Flow · 半调流场** | 单文件 HTML | 4.7 KB，零依赖、零外部请求，浏览器直接打开 |
| [`城市瞬间海报/`](城市瞬间海报/) | **城市瞬间 · New Street Scenes** | 单文件 HTML | 自包含 HTML，另附 PDF 与预览 PNG |

---

## 运行方式

四个体素项目都是标准的 Vite 工程，各自独立：

```bash
cd 01                        # 或 02/voxel-chinese-temple、03、04/voxel-chinese-courtyard
npm install
npm run dev                  # 开发模式
npm run build                # 生产构建 → dist/
npm run preview              # 预览构建产物
```

> 构建产物 `dist/`、`dist-single/` 与依赖 `node_modules/` 均不入库（见 [`.gitignore`](.gitignore)），
> 拉取后需自行 `npm install`。

`动画/index.html` 与 `城市瞬间海报/城市瞬间_海报.html` 无需构建，直接用浏览器打开即可。

环境：Node 18+，无需后端、无需任何 API Key。

---

## 说明

- 本仓库为上述作品的归档集合，各子项目保留自己的 `README.md`、`docs/` 截图与 `.gitignore`。
- `04/` 目录下原有的独立 git 历史未随本仓库迁移；归档时的完整历史备份存放在仓库之外。
