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

const DISPLAY_MAX_WIDTH = 1920;
const THUMB_WIDTH = 360;
const OUTPUT_QUALITY = 82;
const IMAGE_STATUS = {
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
};
const imageProcessingState = new Map();
const imageProcessingQueue = [];
let activeImageTask = null;

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
enqueuePendingImagesOnStartup();

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
  const { displayPath, thumbPath, originalPath } = getVariantPaths(filename);
  const hasDisplay = fs.existsSync(displayPath);
  const hasThumb = fs.existsSync(thumbPath);
  const hasOriginal = fs.existsSync(originalPath);
  const originalUrl = hasOriginal ? `/uploads/originals/${filename}` : `/uploads/${filename}`;
  const displayUrl = hasDisplay ? `/uploads/display/${baseName}.jpg` : "";
  const thumbUrl = hasThumb ? `/uploads/thumbs/${baseName}.jpg` : "";

  return {
    originalUrl,
    url: displayUrl,
    thumbUrl,
  };
}

function getImageStatus(filename) {
  const { displayPath, thumbPath, originalPath } = getVariantPaths(filename);
  const taskState = imageProcessingState.get(filename);

  if (taskState?.status === IMAGE_STATUS.FAILED) {
    return {
      status: IMAGE_STATUS.FAILED,
      errorMessage: taskState.errorMessage || "",
    };
  }

  if (fs.existsSync(originalPath) && fs.existsSync(displayPath) && fs.existsSync(thumbPath)) {
    if (taskState?.status !== IMAGE_STATUS.READY) {
      imageProcessingState.set(filename, {
        status: IMAGE_STATUS.READY,
        errorMessage: "",
      });
    }

    return {
      status: IMAGE_STATUS.READY,
      errorMessage: "",
    };
  }

  if (taskState) {
    return {
      status: taskState.status,
      errorMessage: taskState.errorMessage || "",
    };
  }

  if (fs.existsSync(originalPath)) {
    return {
      status: IMAGE_STATUS.PROCESSING,
      errorMessage: "",
    };
  }

  return {
    status: IMAGE_STATUS.READY,
    errorMessage: "",
  };
}

function buildImageRecord(filename, sourcePath) {
  return {
    filename,
    ...getImageUrls(filename),
    ...getImageStatus(filename),
    uploadedAt: fs.statSync(sourcePath).mtime.getTime(),
  };
}

function scheduleNextImageTask() {
  if (activeImageTask || !imageProcessingQueue.length) {
    return;
  }

  activeImageTask = imageProcessingQueue.shift();
  setImmediate(async () => {
    const task = activeImageTask;
    if (!task) {
      return;
    }

    try {
      logInfo("upload", "Starting queued image processing task", {
        filename: task.filename,
        remainingQueueLength: imageProcessingQueue.length,
      });
      await generateImageVariants(task.filePath, task.filename);
      imageProcessingState.set(task.filename, {
        status: IMAGE_STATUS.READY,
        errorMessage: "",
      });
      logInfo("upload", "Completed queued image processing task", { filename: task.filename });
    } catch (error) {
      imageProcessingState.set(task.filename, {
        status: IMAGE_STATUS.FAILED,
        errorMessage: error.message || "Image processing failed",
      });
      logError("upload", `Queued image processing failed for ${task.filename}`, error);
    } finally {
      activeImageTask = null;
      scheduleNextImageTask();
    }
  });
}

function enqueueImageProcessing(filename, filePath) {
  const duplicateTask =
    activeImageTask?.filename === filename ||
    imageProcessingQueue.some((task) => task.filename === filename);

  imageProcessingState.set(filename, {
    status: IMAGE_STATUS.PROCESSING,
    errorMessage: "",
  });

  if (duplicateTask) {
    logInfo("upload", "Skipped duplicate image processing enqueue", { filename });
    return;
  }

  imageProcessingQueue.push({ filename, filePath });
  logInfo("upload", "Queued image processing task", {
    filename,
    queueLength: imageProcessingQueue.length,
  });
  scheduleNextImageTask();
}

function enqueuePendingImagesOnStartup() {
  if (!fs.existsSync(ORIGINALS_DIR)) {
    return;
  }

  fs.readdirSync(ORIGINALS_DIR)
    .filter(isImageFilename)
    .forEach((filename) => {
      const { originalPath, displayPath, thumbPath } = getVariantPaths(filename);
      if (fs.existsSync(displayPath) && fs.existsSync(thumbPath)) {
        imageProcessingState.set(filename, {
          status: IMAGE_STATUS.READY,
          errorMessage: "",
        });
        return;
      }

      enqueueImageProcessing(filename, originalPath);
    });
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
    if (!background.filename) {
      res.json(background);
      return;
    }

    const { originalPath } = getVariantPaths(background.filename);
    if (!fs.existsSync(originalPath)) {
      res.json(background);
      return;
    }

    res.json({
      ...background,
      ...buildImageRecord(background.filename, originalPath),
    });
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

app.post("/api/upload", upload.single("image"), (req, res) => {
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
    enqueueImageProcessing(filename, filePath);
    const image = buildImageRecord(filename, filePath);
    logInfo("upload", "Upload accepted for async processing", {
      filename,
      status: image.status,
    });
    res.json({ success: true, ...image });
  } catch (error) {
    logError("upload", `Error queueing image processing for ${filename}`, error);
    const fallback = {
      success: true,
      filename,
      warning: "Image processing queue failed, using original image.",
      originalUrl: `/uploads/originals/${filename}`,
      url: "",
      thumbUrl: "",
      status: IMAGE_STATUS.FAILED,
      errorMessage: error.message || "Image processing queue failed",
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

        return buildImageRecord(filename, sourcePath);
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
    const queuedIndex = imageProcessingQueue.findIndex((task) => task.filename === filename);
    if (queuedIndex >= 0) {
      imageProcessingQueue.splice(queuedIndex, 1);
    }
    imageProcessingState.delete(filename);

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
