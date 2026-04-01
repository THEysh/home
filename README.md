# Search Home

`Search Home` 是一个基于 `React + Vite + Express` 的主页项目，包含搜索框、快捷链接、背景图片管理和本地/COS 两种图片存储模式。

## 项目特性

- 搜索引擎切换
- 快捷链接管理
- 背景图片上传、裁剪、切换
- 支持本地文件存储
- 支持腾讯云 COS 存储原图
- Docker / Docker Compose 部署

## 技术栈

- 前端：React、Vite
- 后端：Express
- 图片处理：Sharp
- 对象存储：腾讯云 COS（可选）

## 运行要求

- Node.js 18+
- npm 9+
- Docker（可选）
- Docker Compose（可选）

## 环境变量

项目根目录可创建 `.env` 文件；本地运行 `npm run server` 和 Docker 运行都会自动读取。

参考模板见 [`.env.example`](/F:/ysh_loc_office/projects/home/.env.example)：

```env
PORT=39421
COS_BUCKET=
COS_REGION=
COS_BASE_URL=
COS_SECRET_ID=
COS_SECRET_KEY=
COS_STYLE_DISPLAY=imageMogr2/auto-orient/thumbnail/1920x>/format/jpg/interlace/1
COS_STYLE_THUMB=imageMogr2/auto-orient/thumbnail/360x>/format/jpg/interlace/1
```

### 环境变量说明

- `PORT`：后端端口，本地和 Docker 都会使用，默认 `39421`
- `COS_BUCKET`：腾讯云 COS 存储桶名称
- `COS_REGION`：COS 地域，例如 `ap-chongqing`
- `COS_BASE_URL`：COS 访问域名，例如 `https://xxx.cos.ap-chongqing.myqcloud.com`
- `COS_SECRET_ID`：COS 密钥 ID
- `COS_SECRET_KEY`：COS 密钥 Key
- `COS_STYLE_DISPLAY`：显示图样式参数
- `COS_STYLE_THUMB`：缩略图样式参数

## 存储模式

### 1. 本地存储模式

当 `.env` 中未填写 COS 相关配置时，项目使用本地存储：

- 上传图片保存到 `uploads/`
- 数据文件保存在：
  - `links.json`
  - `background.json`
  - `images.json`

### 2. COS 存储模式

当 `.env` 中完整填写以下配置时，项目自动切换为 COS 模式：

- `COS_BUCKET`
- `COS_REGION`
- `COS_BASE_URL`
- `COS_SECRET_ID`
- `COS_SECRET_KEY`

当前实现策略：

- COS 只上传原图
- 后端返回三类地址：
  - `thumbUrl`：基于 COS 样式生成的缩略图地址
  - `url`：基于 COS 样式生成的显示图地址
  - `originalUrl`：原图地址
- 首页背景优先使用原图
- 背景管理列表可使用 `thumbUrl` / `url`
- 浏览器缓存时间为 30 天

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端

```bash
npm run server
```

默认访问地址：

- `http://localhost:39421`

如果 `.env` 中填写了 COS 配置，本地运行后端时也会直接上传到 COS。

### 3. 启动前端开发服务器

```bash
npm run dev
```

默认访问地址：

- `http://localhost:5173`

Vite 开发环境会把 `/api` 和 `/uploads` 请求转发到后端。

### 4. 本地完整开发方式

先启动后端，再启动前端：

```bash
npm run server
npm run dev
```

## 生产构建

### 构建前端

```bash
npm run build
```

### 启动生产服务

```bash
npm start
```

默认访问地址：

- `http://localhost:39421`

## Docker 部署

### 1. 构建镜像

```bash
docker build -t theysh0303/search-home:latest .
```

### 2. 直接运行

```bash
docker run -d \
  --name search-home \
  --env-file .env \
  -p 39421:39421 \
  -v ${PWD}/data:/data \
  theysh0303/search-home:latest
```

Windows PowerShell 示例：

```powershell
docker run -d `
  --name search-home `
  --env-file .env `
  -p 39421:39421 `
  -v ${PWD}/data:/data `
  theysh0303/search-home:latest
```

### 3. Docker 数据目录说明

容器启动后会使用 `/data` 作为持久化目录；推荐将宿主机的 `./data` 挂载到容器的 `/data`。

如果对应文件不存在，容器会自动初始化：

- `data/links.json`
- `data/background.json`
- `data/images.json`
- `data/uploads/`

初始化规则：

- `links.json` 不存在：从 `links.example.json` 生成
- `background.json` 不存在：从 `background.example.json` 生成
- `images.json` 不存在：从 `images.example.json` 生成

这也是为了避免直接挂载 `./links.json:/app/links.json` 时，宿主机文件不存在被 Docker 误创建为目录的问题。

## Docker Compose

项目已提供 [docker-compose.yml](/F:/ysh_loc_office/projects/home/docker-compose.yml)。

### 启动

```bash
docker compose up -d
```

### 停止

```bash
docker compose down
```

### Compose 行为说明

- 默认端口取自 `.env` 中的 `PORT`，未设置时为 `39421`
- 默认挂载 `./data:/data`
- 如果未填写 COS 配置，使用本地存储
- 如果填写了 COS 配置，上传图片时使用 COS

## 图片访问策略

### 本地模式

- 原图、显示图、缩略图都在本地 `uploads/` 下
- 静态资源响应带有 30 天缓存头

### COS 模式

- COS 保存原图
- `thumbUrl` 和 `url` 使用 COS 样式规则按需生成
- `originalUrl` 为原图地址
- 浏览器依赖缓存减少重复拉取

## 默认数据文件

以下示例文件会参与首次初始化：

- [links.example.json](/F:/ysh_loc_office/projects/home/links.example.json)
- [background.example.json](/F:/ysh_loc_office/projects/home/background.example.json)
- [images.example.json](/F:/ysh_loc_office/projects/home/images.example.json)

## 常用命令

```bash
npm install
npm run dev
npm run server
npm run build
npm start
docker compose up -d
docker compose down
```

## API 概览

| Method | Path | 说明 |
| --- | --- | --- |
| `GET` | `/api/emojis` | 获取 Emoji 数据 |
| `GET` | `/api/links` | 获取快捷链接 |
| `POST` | `/api/links` | 保存快捷链接 |
| `GET` | `/api/background` | 获取背景配置 |
| `POST` | `/api/background` | 保存背景配置 |
| `GET` | `/api/images` | 获取背景图片列表 |
| `POST` | `/api/upload` | 上传背景图片 |
| `DELETE` | `/api/upload/:filename` | 删除背景图片 |

## License

MIT
