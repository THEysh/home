# Search Home

`Search Home` 是一个基于 `React + Vite + Express` 的主页项目，支持搜索框、快捷链接、背景图片管理，以及本地存储 / 腾讯云 COS 两种图片存储模式。

## 目录说明

项目代码放在根目录和 `src/` 下。

运行时相关内容统一放在 `data/`：

- `data/links.json`
- `data/background.json`
- `data/images.json`
- `data/uploads/`

初始化模板也放在 `data/`：

- `data/links.example.json`
- `data/background.example.json`
- `data/images.example.json`

含义如下：

- `*.example.json`：首次启动时使用的默认模板
- `*.json`：服务实际读写的运行时数据
- `uploads/`：本地模式下的图片目录

## 存储模式

### 本地模式

当未配置 COS 相关环境变量时：

- 背景原图、显示图、缩略图保存在 `data/uploads/`
- 运行时配置保存在 `data/*.json`

### COS 模式

当完整配置以下变量时自动启用：

- `COS_BUCKET`
- `COS_REGION`
- `COS_BASE_URL`
- `COS_SECRET_ID`
- `COS_SECRET_KEY`

当前 COS 逻辑：

- 上传时统一写入 `search-home/` 前缀
- 启动时会扫描 COS 桶中 `search-home/` 前缀下的图片
- `/api/images` 只读取这个前缀下的图片
- `images.json` 只是本地缓存，不再是唯一真相
- 背景图管理列表以 COS 桶实际内容为准

## 环境变量

参考 [`.env.example`](/F:/ysh_loc_office/projects/home/.env.example)：

```env
PORT=39421
COS_BUCKET=
COS_REGION=
COS_BASE_URL=
COS_SECRET_ID=
COS_SECRET_KEY=
COS_IMAGE_PREFIX=search-home/
COS_STYLE_DISPLAY=imageMogr2/auto-orient/thumbnail/1920x>/format/jpg/interlace/1
COS_STYLE_THUMB=imageMogr2/auto-orient/thumbnail/360x>/format/jpg/interlace/1
```

注意：

- `.env` 中不要写成 `PORT = 39421`
- 必须写成 `PORT=39421`
- `docker --env-file` 对空格很敏感，写错会直接导致容器启动失败

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

默认访问地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:39421`

## 首次启动会做什么

服务启动时会自动检查 `data/`。

如果不存在以下文件：

- `data/links.json`
- `data/background.json`
- `data/images.json`

就会自动使用以下模板生成：

- `data/links.example.json`
- `data/background.example.json`
- `data/images.example.json`

如果本地模式下不存在这些目录，也会自动创建：

- `data/uploads/originals`
- `data/uploads/display`
- `data/uploads/thumbs`

## Docker 启动

构建镜像：

```bash
docker build -t theysh0303/search-home:latest .
```

运行容器：

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

说明：

- 容器内默认运行目录是 `/data`
- 即使宿主机没有 `./data`，Docker 也会自动创建
- 服务启动后会自动补齐 `json` 文件和本地上传目录

## Docker Compose

项目已提供 [docker-compose.yml](/F:/ysh_loc_office/projects/home/docker-compose.yml)。

启动：

```bash
docker compose up -d
```

停止：

```bash
docker compose down
```

推荐的 `docker-compose.yml` 关键配置应包含：

- `PORT`
- `DATA_DIR=/data`
- `COS_BUCKET`
- `COS_REGION`
- `COS_BASE_URL`
- `COS_SECRET_ID`
- `COS_SECRET_KEY`
- `COS_IMAGE_PREFIX=search-home/`

以及数据挂载：

```yaml
volumes:
  - ./data:/data
```

## 常用命令

```bash
npm install
npm run server
npm run dev
npm run build
npm start
docker build -t theysh0303/search-home:latest .
docker compose up -d
docker compose down
```

## 当前建议

- 正式运行时只操作 `data/` 目录
- 不要再在项目根目录放运行时的 `links.json`、`background.json`、`images.json`
- 如果启用 COS，建议统一使用 `search-home/` 作为图片前缀

## License

MIT
