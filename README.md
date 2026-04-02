# Search Home

`Search Home` 是一个基于 `React + Vite + Express` 的主页项目，支持搜索框、快捷链接、背景图片管理，以及本地存储 / 腾讯云 COS 两种图片存储模式。

## 目录约定

项目代码和示例文件保留在根目录。

运行时数据统一放在 `data/`：

- `data/links.json`
- `data/background.json`
- `data/images.json`
- `data/uploads/`

这意味着：

- 根目录下不再作为正式运行时数据目录
- 本地启动默认读写 `./data`
- Docker 启动默认读写 `/data`

## 存储模式

### 本地模式

当未配置 COS 相关环境变量时：

- 原图、显示图、缩略图保存在 `data/uploads/`
- 背景、链接、图片索引保存在 `data/*.json`

### COS 模式

当完整配置以下环境变量时自动启用：

- `COS_BUCKET`
- `COS_REGION`
- `COS_BASE_URL`
- `COS_SECRET_ID`
- `COS_SECRET_KEY`

当前策略：

- COS 只保存原图
- 后端返回：
  - `thumbUrl`
  - `url`
  - `originalUrl`
- 本地仍保留：
  - `data/links.json`
  - `data/background.json`
  - `data/images.json`

## 环境变量

参考 [`.env.example`](/F:/ysh_loc_office/projects/home/.env.example)

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

说明：

- `PORT`：后端端口，本地和 Docker 共用，默认 `39421`
- `DATA_DIR`：可选。后端运行时数据目录
  - 本地默认：`项目根目录/data`
  - Docker 默认：`/data`

## 本地启动

安装依赖：

```bash
npm install
```

启动后端：

```bash
npm run server
```

启动前端开发服务：

```bash
npm run dev
```

默认访问：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:39421`

## Docker 启动

构建镜像：

```bash
docker build -t theysh0303/search-home:latest .
```

直接运行：

```bash
docker run -d \
  --name search-home \
  --env-file .env \
  -p 39421:39421 \
  -v ${PWD}/data:/data \
  theysh0303/search-home:latest
```

Windows PowerShell：

```powershell
docker run -d `
  --name search-home `
  --env-file .env `
  -p 39421:39421 `
  -v ${PWD}/data:/data `
  theysh0303/search-home:latest
```

## Docker Compose

使用项目自带的 [docker-compose.yml](/F:/ysh_loc_office/projects/home/docker-compose.yml)：

启动：

```bash
docker compose up -d
```

停止：

```bash
docker compose down
```

## 自动初始化与迁移

无论是本地还是 Docker，服务启动时都会自动处理以下情况：

### 1. `data/` 不存在

会自动创建：

- `data/`
- `data/uploads/originals`
- `data/uploads/display`
- `data/uploads/thumbs`

并自动生成：

- `data/links.json`
- `data/background.json`
- `data/images.json`

### 2. 旧版数据还在根目录

如果发现以下旧文件或旧目录仍在项目根目录：

- `links.json`
- `background.json`
- `images.json`
- `uploads/`

服务会在启动时自动迁移到 `data/` 下。

所以服务器无论：

- 没有 `/data` 目录
- 没有 `data/` 挂载目录
- 仍然保留旧版根目录数据

都可以正常启动。

## 默认示例文件

- [links.example.json](/F:/ysh_loc_office/projects/home/links.example.json)
- [background.example.json](/F:/ysh_loc_office/projects/home/background.example.json)
- [images.example.json](/F:/ysh_loc_office/projects/home/images.example.json)

## 常用命令

```bash
npm install
npm run server
npm run dev
npm run build
npm start
docker compose up -d
docker compose down
```

## License

MIT
