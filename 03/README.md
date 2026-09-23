# 体素 · 中国古典建筑群（Three.js Voxel）

Minecraft 体素块风格的中式古典建筑群 3D 场景，纯 Three.js 实现，浏览器打开即可观看。

## 运行方式

```bash
npm install           # 安装依赖（three + vite + vite-plugin-singlefile）
npm run dev           # 开发模式，默认 http://localhost:5173
npm run build         # 生产构建，输出 dist/
npm run build:single  # 单文件构建，输出 dist-single/index.html（双击即开）
npm run preview       # 预览生产构建
```

页面打开即进入场景：相机缓慢自动环绕展示全貌，点击拖拽后即交还控制
（拖拽旋转 / 滚轮缩放 / 右键平移）。

## 场景内容

中轴对称院落布局，动线 **山门 → 前庭 → 主殿**：

| 建筑 | 位置 | 形制 |
|---|---|---|
| 主殿 | 中轴北端核心 | **重檐庑殿顶**，黄琉璃瓦，须弥座台基 + 石栏杆 + 三出台阶 |
| 东/西配殿 | 主殿前方两侧，面朝中轴 | **歇山顶**（带山墙），绿琉璃瓦 |
| 山门 | 围墙南面正门 | **庑殿顶**，青瓦，三门贯通（前后开门） |
| 钟楼 / 鼓楼 | 前院东西对峙 | 两层楼阁，**攒尖顶**，二层分别悬钟（金）、置鼓（朱） |
| 宝塔 | 后院西北隅 | 五层密檐方塔，绿瓦红身，金刹 |

环境与细部：

- 体素铺装中轴主路、东西横路、三处广场；草地随机点缀（固定种子）
- 红墙灰瓦围墙（南面留山门豁口）、沿路灯笼杆（红灯自发光）、石狮两对、松柏若干
- 晨昏氛围：黄昏渐变天空（Canvas 纹理）、低角度暖色平行光 + 4096 阴影贴图、
  冷色补光拉开暗部层次、雾景

## 技术要点

- **体素引擎** `src/voxel.js`：以坐标哈希收集方块（同坐标后写覆盖先写，便于墙面开门窗），
  `build()` 时按「颜色 ± 自发光」分组合并为 `InstancedMesh`——全场约 1.5 万体素
  仅 ~40 个 draw call，实测约 60 FPS（要求 ≥30 FPS）。
- **参数化中式形制** `src/buildings.js`：
  - 屋顶生成器：`hipRoof` 庑殿（四面收分 + 正脊鸱吻）、`xieshanRoof` 歇山
    （下部四坡收分 + 上部悬山 + 山墙填充）、`pyramidalRoof` 攒尖（收分宝顶）
  - 檐口平板带深色剪边，每层檐角 +1 起翘模拟**飞檐翘角**；重檐由两层檐口叠加
  - 构件：台基（底部收分）、踏跺、栏杆（南面留口）、檐柱（每 3 格）、红墙、
    斗拱层（双层交错小斗）、门（带门楣横披窗）、直棂窗
- **光影**：`PCFSoftShadowMap` + ACES 色调映射；方向光 `normalBias` 消除体素阴影痤疮。

## 发布

产物是**纯静态**的：`src/` 与 `index.html` 中没有任何外部请求（无 CDN、无 Web 字体、
无 API、无后端、无环境变量），`dist/` 上传即用，也可离线或部署在内网。

`vite.config.js` 设 `base: './'`，产物以**相对路径** `./assets/*` 引用资源，
因此三种发布形态都可用（均已实测）：

| 形态 | 命令 | 说明 |
|---|---|---|
| 静态托管 · 根路径 | `npm run build` | Vercel / Netlify / 对象存储根目录，dist 内容直接作 webroot |
| 静态托管 · 任意子路径 | `npm run build` | GitHub Pages 项目页、Nginx `location /voxel/`、OSS 子目录 —— 相对路径不会 404 |
| 单文件分发 | `npm run build:single` | 产出 1 个约 506 kB 的 `dist-single/index.html`，**双击即开**（无 ES module 跨域限制），可微信 / 邮件传 |

> 注意：ES module 在 `file://` 下会被 CORS 拦截，所以普通 `dist/` 不能直接双击打开，
> 需要免服务器分发时请用 `build:single`。

健壮性：页面带启动占位层；WebGL 初始化失败或上下文丢失时会给出可读的中文提示
而不是一块纯灰；已内置内联 SVG favicon 与 og / description 元信息。

## 项目结构

```
├── index.html              # 入口页面（HUD + FPS 计数 + 启动占位 + 降级提示）
├── vite.config.js          # base:'./' 相对路径，支持任意子路径部署
├── vite.single.config.js   # 单文件构建（JS/CSS 全内联）
├── package.json
└── src/
    ├── main.js         # 渲染器 / 相机 / 灯光 / 晨昏天空 / 主循环
    ├── voxel.js        # VoxelWorld：体素收集 + InstancedMesh 合并渲染
    ├── palette.js      # 中式配色（红墙、琉璃黄/青/绿瓦、木构）
    ├── buildings.js    # 参数化建筑构件与单体（殿/山门/钟鼓楼/塔/小品）
    └── scene.js        # 院落布局（中轴对称：围墙、道路、建筑群、园林）
```

## 实测运行结果

- `npm run build` 通过（Vite 6，`dist/` 产物 gzip ≈128 kB）；
  `npm run build:single` 产出单文件 `dist-single/index.html`（506 kB / gzip 130 kB）
- dev server 实测：15,364 体素，33 个 InstancedMesh 分组，稳定 **58–61 FPS**，阴影与自发光灯笼正常
- 已用无头浏览器截图核验：中轴正立面、主殿特写、环绕视角构图均正确；
  根路径 / 子路径 / `file://` 单文件三种发布形态均实测可渲染
- 修复记录：原先缺 `vite.config.js`，Vite 默认 `base:'/'` 生成绝对路径 `/assets/*`，
  导致部署到任意子路径或用 `file://` 打开时白屏；现已改为相对路径并补单文件构建
