# Search Home

一个基于 `React + Vite + Express` 的新标签页主页项目，支持搜索、快捷链接管理、背景图上传与裁剪预览。

![](./image_github/image1.png)
![](./image_github/image2.png)

## 功能

- 搜索框支持 `Google` 和 `Bing` 快速切换。
- 快捷链接支持新增、编辑、删除，图标可选站点 favicon 或 Emoji。
- 背景图支持上传、列表选择、删除、模糊/遮罩调节，以及按当前窗口比例拖拽裁剪可视区域。
- 背景、链接和图片元数据均持久化到服务端本地文件。
- 生产环境由 Express 托管 `dist/`，开发环境由 Vite 提供前端热更新。

## 项目结构

```text
.
├─ src/
│  ├─ components/        # 通用 UI 组件
│  ├─ constants/         # 默认配置
│  ├─ features/          # 按功能拆分的前端模块
│  ├─ hooks/             # 自定义 hooks
│  ├─ services/api/      # 前端 API 封装
│  ├─ styles/            # 全局样式
│  └─ utils/             # 工具函数
├─ index.html            # Vite 入口 HTML
├─ vite.config.js        # Vite 配置
├─ server.js             # Express API 与 dist 托管
├─ uploads/              # 本地运行期图片目录（已忽略）
├─ links.json            # 本地快捷链接数据（已忽略）
├─ background.json       # 本地背景配置（已忽略）
├─ links.example.json    # 快捷链接示例配置
├─ background.example.json # 背景配置示例
└─ emoji_data.json       # Emoji 数据
```

## 开发

1. 安装依赖

```bash
npm install
```

2. 启动 Express API

```bash
npm run server
```

3. 另开一个终端启动前端开发服务器

```bash
npm run dev
```

4. 浏览器访问 Vite 地址，默认会把 `/api` 和 `/uploads` 代理到后端。

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`。随后直接运行：

```bash
npm start
```

Express 会继续提供 API，同时托管前端构建产物。

## API

- `GET /api/links`：读取快捷链接
- `POST /api/links`：保存快捷链接
- `GET /api/background`：读取背景配置
- `POST /api/background`：保存背景配置
- `GET /api/images`：读取已上传图片列表
- `POST /api/upload`：上传背景图
- `DELETE /api/upload/:filename`：删除指定图片
- `GET /api/emojis`：读取 Emoji 分类数据

## 说明

- 图片上传后会自动生成 `display` 和 `thumb` 两种派生图。
- 背景裁剪框按当前窗口宽高比计算，并在窗口尺寸变化时自动重算位置。
- `links.json`、`background.json` 和 `uploads/` 属于本地运行期数据，默认不纳入 git。
- 新环境首次启动时，服务端会自动生成缺失的本地数据文件。
