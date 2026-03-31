const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const app = express();
const PORT = 39421;
const HOST = "0.0.0.0";

app.use(cors());
app.use(express.json());

const DATA_DIR = __dirname;
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const ORIGINALS_DIR = path.join(UPLOADS_DIR, "originals");
const DISPLAY_DIR = path.join(UPLOADS_DIR, "display");
const THUMBS_DIR = path.join(UPLOADS_DIR, "thumbs");
const DIST_DIR = path.join(DATA_DIR, "dist");
const LINKS_FILE = path.join(DATA_DIR, "links.json");
const BACKGROUND_FILE = path.join(DATA_DIR, "background.json");

const DISPLAY_MAX_WIDTH = 2560;
const THUMB_WIDTH = 360;
const OUTPUT_QUALITY = 82;

function logInfo(scope, message, extra) {
  if (extra !== undefined) {
    console.log(`[${scope}] ${message}`, extra);
    return;
  }
  console.log(`[${scope}] ${message}`);
}

function logError(scope, message, error) {
  console.error(`[${scope}] ${message}`);
  if (error) {
    console.error(error.stack || error);
  }
}

app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    etag: true,
    maxAge: "30d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    },
  }),
);

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

const defaultLinks = [
  {
    "id": 1774710500001,
    "name": "GitHub",
    "url": "https://github.com",
    "icon": "🐙",
    "cat": "",
    "useEmoji": true
  },
  {
    "id": 1774710500002,
    "name": "ChatGPT",
    "url": "https://chatgpt.com",
    "icon": "💬",
    "cat": "",
    "useEmoji": true
  },
  {
    "id": 1774710500003,
    "name": "DeepSeek",
    "url": "https://www.deepseek.com",
    "icon": "🐳",
    "cat": "",
    "useEmoji": true
  },
  {
    "id": 1774710500004,
    "name": "哔哩哔哩 (B站)",
    "url": "https://www.bilibili.com",
    "icon": "📺",
    "cat": "",
    "useEmoji": true
  },
  {
    "id": 1774710500005,
    "name": "聚合图床 (Superbed)",
    "url": "https://www.superbed.cn/",
    "icon": "🖼️",
    "cat": "",
    "useEmoji": true
  },
  {
    "id": 1774710500007,
    "name": "超星通行证",
    "url": "https://passport2.chaoxing.com/login?fid=&refer=",
    "icon": "📚",
    "cat": "",
    "useEmoji": true
  }
];

const defaultBackground = {
  filename: "",
  blur: 18,
  dim: 52,
  positionX: 50,
  positionY: 50,
};

function normalizeLinksForStorage(links) {
  if (!Array.isArray(links)) {
    return defaultLinks;
  }

  let nextId = Date.now();
  let changed = false;

  const normalized = links.map((link, index) => {
    const safeLink = link && typeof link === "object" ? link : {};
    const normalizedLink = {
      id:
        typeof safeLink.id === "number" && Number.isFinite(safeLink.id)
          ? safeLink.id
          : nextId + index,
      name: typeof safeLink.name === "string" ? safeLink.name : "",
      url: typeof safeLink.url === "string" ? safeLink.url : "",
      icon: typeof safeLink.icon === "string" ? safeLink.icon : "",
      cat: typeof safeLink.cat === "string" ? safeLink.cat : "",
      useEmoji: Boolean(safeLink.useEmoji),
    };

    if (
      normalizedLink.id !== safeLink.id ||
      normalizedLink.name !== safeLink.name ||
      normalizedLink.url !== safeLink.url ||
      normalizedLink.icon !== safeLink.icon ||
      normalizedLink.cat !== safeLink.cat ||
      normalizedLink.useEmoji !== safeLink.useEmoji
    ) {
      changed = true;
    }

    return normalizedLink;
  });

  return { normalized, changed };
}

function initializeFiles() {
  [UPLOADS_DIR, ORIGINALS_DIR, DISPLAY_DIR, THUMBS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logInfo("init", `Created directory: ${path.relative(__dirname, dir)}`);
    }
  });

  if (!fs.existsSync(LINKS_FILE)) {
    fs.writeFileSync(LINKS_FILE, JSON.stringify(defaultLinks, null, 2), "utf8");
    logInfo("init", "Created links.json with default links");
  } else {
    try {
      const currentLinks = JSON.parse(fs.readFileSync(LINKS_FILE, "utf8"));
      const { normalized, changed } = normalizeLinksForStorage(currentLinks);
      if (changed) {
        fs.writeFileSync(LINKS_FILE, JSON.stringify(normalized, null, 2), "utf8");
        logInfo("init", "Normalized existing links.json structure");
      }
    } catch (error) {
      logError("init", "Failed to normalize existing links.json, resetting to defaults", error);
      fs.writeFileSync(LINKS_FILE, JSON.stringify(defaultLinks, null, 2), "utf8");
      logInfo("init", "Reset links.json to default links");
    }
  }

  if (!fs.existsSync(BACKGROUND_FILE)) {
    fs.writeFileSync(BACKGROUND_FILE, JSON.stringify(defaultBackground, null, 2), "utf8");
    logInfo("init", "Created background.json with default values");
  }
}

initializeFiles();

function isImageFilename(filename) {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filename);
}

function getImageBaseName(filename) {
  return path.parse(filename).name;
}

function getVariantPaths(filename) {
  const baseName = getImageBaseName(filename);
  return {
    originalPath: path.join(ORIGINALS_DIR, filename),
    displayPath: path.join(DISPLAY_DIR, `${baseName}.jpg`),
    thumbPath: path.join(THUMBS_DIR, `${baseName}.jpg`),
  };
}

function getImageUrls(filename) {
  const baseName = getImageBaseName(filename);
  const { displayPath, thumbPath } = getVariantPaths(filename);
  const hasDisplay = fs.existsSync(displayPath);
  const hasThumb = fs.existsSync(thumbPath);
  const hasOriginal = fs.existsSync(path.join(ORIGINALS_DIR, filename));

  return {
    originalUrl: hasOriginal ? `/uploads/originals/${filename}` : `/uploads/${filename}`,
    url: hasDisplay ? `/uploads/display/${baseName}.jpg` : `/uploads/${filename}`,
    thumbUrl: hasThumb
      ? `/uploads/thumbs/${baseName}.jpg`
      : hasDisplay
        ? `/uploads/display/${baseName}.jpg`
        : `/uploads/${filename}`,
  };
}

async function generateImageVariants(filePath, filename) {
  const { displayPath, thumbPath } = getVariantPaths(filename);

  [DISPLAY_DIR, THUMBS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  logInfo("upload", "Generating image variants", {
    filename,
    filePath,
    displayPath,
    thumbPath,
  });

  const baseOptions = { animated: false };

  await sharp(filePath, baseOptions)
    .rotate()
    .resize({ width: DISPLAY_MAX_WIDTH, withoutEnlargement: true, fit: "inside" })
    .jpeg({ quality: OUTPUT_QUALITY })
    .toFile(displayPath);

  logInfo("upload", "Generated display image", { filename, displayPath });

  await sharp(filePath, baseOptions)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true, fit: "inside" })
    .jpeg({ quality: 72 })
    .toFile(thumbPath);

  logInfo("upload", "Generated thumbnail image", { filename, thumbPath });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    logInfo("upload", "Resolved upload destination", {
      originalName: file.originalname,
      destination: ORIGINALS_DIR,
    });
    cb(null, ORIGINALS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `image-${uniqueSuffix}${ext}`;

    logInfo("upload", "Generated upload filename", {
      originalName: file.originalname,
      filename,
    });

    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|bmp/;
    const ext = path.extname(file.originalname).toLowerCase();

    logInfo("upload", "Validating uploaded file", {
      originalName: file.originalname,
      mimeType: file.mimetype,
      extension: ext,
      sizeLimitMB: 10,
    });

    if (allowed.test(ext) && allowed.test(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error("只允许上传图片文件（jpg/png/gif/webp/bmp）。"));
  },
});

const emojiData = require("./emoji_data.json");

app.get("/api/emojis", (req, res) => res.json(emojiData));

app.get("/api/links", (req, res) => {
  try {
    const data = fs.readFileSync(LINKS_FILE, "utf8");
    const parsed = JSON.parse(data);
    const { normalized, changed } = normalizeLinksForStorage(parsed);
    if (changed) {
      fs.writeFileSync(LINKS_FILE, JSON.stringify(normalized, null, 2), "utf8");
      logInfo("links", "Normalized links.json during read");
    }
    res.json(normalized);
  } catch (error) {
    logError("links", "Error reading links", error);
    res.status(500).json({ error: "Failed to read links" });
  }
});

app.post("/api/links", (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      res.status(400).json({ error: "Invalid links data" });
      return;
    }
    fs.writeFileSync(LINKS_FILE, JSON.stringify(req.body, null, 2), "utf8");
    res.json({ success: true });
  } catch (error) {
    logError("links", "Error saving links", error);
    res.status(500).json({ error: "Failed to save links" });
  }
});

app.get("/api/background", (req, res) => {
  try {
    const background = JSON.parse(fs.readFileSync(BACKGROUND_FILE, "utf8"));
    res.json({ ...background, ...(background.filename ? getImageUrls(background.filename) : {}) });
  } catch (error) {
    logError("background", "Error reading background settings", error);
    res.status(500).json({ error: "Failed to read background settings" });
  }
});

app.post("/api/background", (req, res) => {
  try {
    const { filename, blur, dim, positionX, positionY } = req.body;
    if (filename === undefined || blur === undefined || dim === undefined) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const bgData = { filename, blur, dim };
    if (positionX !== undefined) bgData.positionX = positionX;
    if (positionY !== undefined) bgData.positionY = positionY;

    fs.writeFileSync(BACKGROUND_FILE, JSON.stringify(bgData, null, 2), "utf8");
    res.json({ success: true });
  } catch (error) {
    logError("background", "Error saving background settings", error);
    res.status(500).json({ error: "Failed to save background settings" });
  }
});

app.post("/api/upload", upload.single("image"), async (req, res) => {
  logInfo("upload", "Incoming upload request", {
    ip: req.ip,
    contentType: req.headers["content-type"],
    contentLength: req.headers["content-length"],
  });

  if (!req.file) {
    logInfo("upload", "Upload rejected because no file was attached");
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const { path: filePath, filename, originalname, mimetype, size } = req.file;

  logInfo("upload", "File saved to originals directory", {
    filename,
    originalname,
    mimetype,
    size,
    filePath,
    exists: fs.existsSync(filePath),
  });

  try {
    await generateImageVariants(filePath, filename);
    const urls = getImageUrls(filename);
    logInfo("upload", "Upload finished successfully", {
      filename,
      urls,
    });
    res.json({ success: true, filename, ...urls });
  } catch (error) {
    logError("upload", `Error generating image variants for ${filename}`, error);
    const fallback = {
      success: true,
      filename,
      warning: "Thumbnail generation failed, using original image.",
      url: `/uploads/originals/${filename}`,
      thumbUrl: `/uploads/originals/${filename}`,
      originalUrl: `/uploads/originals/${filename}`,
    };
    logInfo("upload", "Returning upload fallback response", fallback);
    res.json(fallback);
  }
});

app.get("/api/images", (req, res) => {
  try {
    const originalFiles = fs.existsSync(ORIGINALS_DIR)
      ? fs.readdirSync(ORIGINALS_DIR).filter(isImageFilename)
      : [];
    const legacyFiles = fs
      .readdirSync(UPLOADS_DIR)
      .filter((filename) => isImageFilename(filename) && fs.statSync(path.join(UPLOADS_DIR, filename)).isFile());

    const files = [...new Set([...originalFiles, ...legacyFiles])];
    const images = files
      .map((filename) => {
        const originalPath = path.join(ORIGINALS_DIR, filename);
        const legacyPath = path.join(UPLOADS_DIR, filename);
        const sourcePath = fs.existsSync(originalPath) ? originalPath : legacyPath;

        return {
          filename,
          ...getImageUrls(filename),
          uploadedAt: fs.statSync(sourcePath).mtime.getTime(),
        };
      })
      .sort((a, b) => b.uploadedAt - a.uploadedAt);

    res.json(images);
  } catch (error) {
    logError("images", "Error listing images", error);
    res.status(500).json({ error: "Failed to list images" });
  }
});

app.delete("/api/upload/:filename", (req, res) => {
  try {
    const { filename } = req.params;

    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    const { originalPath, displayPath, thumbPath } = getVariantPaths(filename);
    const legacyPath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(originalPath) && !fs.existsSync(legacyPath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    [originalPath, displayPath, thumbPath, legacyPath].forEach((filePath) => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    const background = JSON.parse(fs.readFileSync(BACKGROUND_FILE, "utf8"));
    if (background.filename === filename) {
      background.filename = "";
      fs.writeFileSync(BACKGROUND_FILE, JSON.stringify(background, null, 2), "utf8");
    }

    res.json({ success: true });
  } catch (error) {
    logError("upload", "Error deleting file", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

if (fs.existsSync(DIST_DIR)) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
      next();
      return;
    }
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logError("upload", `Multer error: ${error.code}`, error);
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "文件过大，最大支持 10MB。" });
      return;
    }
    res.status(400).json({ error: error.message });
    return;
  }

  if (error) {
    logError("server", "Unhandled request error", error);
    res.status(400).json({ error: error.message });
    return;
  }

  next();
});

app.listen(PORT, HOST, () => {
  console.log(`\nServer running at http://${HOST}:${PORT}`);
  console.log("API endpoints:");
  console.log("  GET    /api/links");
  console.log("  POST   /api/links");
  console.log("  GET    /api/background");
  console.log("  POST   /api/background");
  console.log("  GET    /api/images");
  console.log("  POST   /api/upload");
  console.log("  DELETE /api/upload/:filename");
});
