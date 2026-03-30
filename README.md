
# Powerful Search Home

一个美观、现代化且高度可自定义的**浏览器新标签页 / 个性化主页**。

支持快速搜索、常用链接管理、自定义背景图片上传与实时调整，带来丝滑的使用体验。

![](./image_github/image1.png)
![](./image_github/image2.png)

## 功能特性

- **智能搜索**：支持 Google 与 Bing 快速切换，一键新标签页打开
- **快捷链接管理**：添加、编辑、删除常用网站，支持网站图标或自定义 Emoji 图标 + 分类标签
- **自定义背景**：
  - 上传本地图片
  - 实时调整模糊程度与亮度（暗度）
  - **渐进式加载**：列表中先显示缩略图，加载完成后自动切换为高清 display 图
  - 支持删除已上传图片
- **数据持久化**：所有设置保存在服务器端（不再依赖浏览器本地存储）
- **响应式设计**：适配桌面与平板，深色现代 UI + 星空粒子背景
- **额外小功能**：随机页面图标、一键键盘聚焦搜索（`/` 键）

## 快速开始

### 方式1：使用 Docker
项目根目录已包含以下 docker-compose.yml：
```yaml
version: '3.8'

services:
  search-home:
    image: theysh0303/search-home:latest
    container_name: search-home
    ports:
      - "39421:39421"          # 宿主机端
    restart: unless-stopped            # 容器意外退出后自动重启
```
关键说明：
端口：默认映射宿主机的 39421 端口，访问地址为 http://你的服务器IP:39421
重启策略：unless-stopped 是生产环境推荐设置
#### 使用 compose 构建并启动
```sh
docker compose up -d --build
```

### 方式2：使用 Node.js
### 1. 克隆项目

```bash
git clone https://github.com/THEysh/home.git
cd home
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务器

```bash
npm start
```

### 4. 访问应用

打开浏览器访问：

**http://localhost:39421**

推荐将此地址设置为浏览器新标签页（New Tab）首页。

## 项目结构

```
.
├── index.html              # 主页面（前端全部代码）
├── server.js               # Express 后端服务器（或 app.js）
├── uploads/                # 上传图片目录（自动创建）
│   ├── originals/          # 原始图片
│   ├── display/            # 处理后的显示图（最大2560px）
│   └── thumbs/             # 缩略图（~360px）
├── links.json              # 快捷链接数据
├── background.json         # 背景设置（当前图片、模糊、亮度）
├── emoji_data.json         # Emoji 数据
└── package.json
```

## 技术栈

- **前端**：纯原生 HTML + CSS + JavaScript（无框架，轻量高性能）
- **后端**：Node.js + Express
- **图片处理**：Sharp（生成缩略图 + display 图）
- **文件上传**：Multer
- **样式**：现代玻璃拟态（Glassmorphism） + 自定义变量

## API 接口

| 方法   | 路径                    | 描述                     |
|--------|-------------------------|--------------------------|
| GET    | `/api/links`            | 获取所有快捷链接         |
| POST   | `/api/links`            | 保存链接列表             |
| GET    | `/api/background`       | 获取当前背景设置         |
| POST   | `/api/background`       | 保存背景设置             |
| POST   | `/api/upload`           | 上传图片（自动生成缩略图）|
| GET    | `/api/images`           | 获取已上传图片列表       |
| DELETE | `/api/upload/:filename` | 删除指定图片             |
| GET    | `/api/emojis`           | 获取 Emoji 分组数据      |

## 开发与自定义

- **修改默认链接**：编辑 `links.json` 或 `server.js` 中的 `defaultLinks`
- **调整图片处理参数**：在 `server.js` 中修改 `DISPLAY_MAX_WIDTH`、`THUMB_WIDTH`、`OUTPUT_QUALITY`
- **添加新搜索引擎**：在前端 `engines` 对象中扩展
- **开发模式**：推荐直接用 `http://localhost:39421` 访问（避免 Live Server 端口不一致问题）

## 已知特性 / 优化点

- 背景图片列表采用 **Masonry 三列布局** + **渐进式加载**（Thumb → Display）
- 所有图片上传后自动生成缩略图与优化后的显示图，提升加载速度
- 支持键盘快捷键（`/` 聚焦搜索，`Esc` 关闭弹窗）

## 许可证

MIT License

---

