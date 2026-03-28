# Powerful Search Home

一个美观的个性化主页，支持搜索、常用链接管理和自定义背景图片。

## 功能特性

- **搜索引擎切换**：支持 Google 和 Bing 搜索
- **常用链接管理**：添加、编辑、删除常用网站链接，支持自定义图标和分类
- **背景图片**：上传自定义背景图片，调整模糊和暗度效果
- **数据持久化**：使用后端服务器保存数据，不再依赖浏览器本地存储

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

```bash
npm start
```

### 3. 访问应用

打开浏览器访问：http://localhost:39421

## 技术栈

- **前端**：原生 HTML/CSS/JavaScript
- **后端**：Node.js + Express
- **文件上传**：Multer

## API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/links` | 获取所有链接 |
| POST | `/api/links` | 保存链接列表 |
| GET | `/api/background` | 获取背景设置 |
| POST | `/api/background` | 保存背景设置 |
| POST | `/api/upload` | 上传图片 |

## 数据存储

- `links.json` - 链接数据
- `background.json` - 背景设置（文件名、模糊度、暗度）
- `uploads/` - 上传的图片目录

## 开发

如需修改默认的链接数据，直接编辑 `server.js` 中的 `defaultLinks` 数组，或修改 `links.json` 文件。

## 许可证

MIT
