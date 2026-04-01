const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const COS = require("cos-nodejs-sdk-v5");

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
const IMAGES_FILE = path.join(DATA_DIR, "images.json");

const DISPLAY_MAX_WIDTH = 1920;
const THUMB_WIDTH = 360;
const OUTPUT_QUALITY = 82;
const IMAGE_CACHE_CONTROL = "public, max-age=2592000, immutable";
const IMAGE_STATUS = {
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
};

const COS_BUCKET = process.env.COS_BUCKET || "";
const COS_REGION = process.env.COS_REGION || "";
const COS_SECRET_ID = process.env.COS_SECRET_ID || "";
const COS_SECRET_KEY = process.env.COS_SECRET_KEY || "";
const COS_BASE_URL =
  process.env.COS_BASE_URL ||
  (COS_BUCKET && COS_REGION
    ? `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`
    : "");
const COS_STYLE_DISPLAY =
  process.env.COS_STYLE_DISPLAY || "imageMogr2/auto-orient/thumbnail/1920x>/format/jpg/interlace/1";
const COS_STYLE_THUMB =
  process.env.COS_STYLE_THUMB || "imageMogr2/auto-orient/thumbnail/360x>/format/jpg/interlace/1";

const isCosEnabled = Boolean(
  COS_BUCKET && COS_REGION && COS_SECRET_ID && COS_SECRET_KEY && COS_BASE_URL,
);
const cosClient = isCosEnabled
  ? new COS({
      SecretId: COS_SECRET_ID,
      SecretKey: COS_SECRET_KEY,
    })
  : null;

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
      res.setHeader("Cache-Control", IMAGE_CACHE_CONTROL);
    },
  }),
);

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

const defaultLinks = [
  {
    id: 1774710500001,
    name: "GitHub",
    url: "https://github.com",
    icon: "",
    cat: "",
    useEmoji: true,
  },
  {
    id: 1774710500002,
    name: "ChatGPT",
    url: "https://chatgpt.com",
    icon: "",
    cat: "",
    useEmoji: true,
  },
  {
    id: 1774710500003,
    name: "DeepSeek",
    url: "https://www.deepseek.com",
    icon: "",
    cat: "",
    useEmoji: true,
  },
  {
    id: 1774710500004,
    name: "\u54d4\u54e9\u54d4\u54e9 (B\u7ad9)",
    url: "https://www.bilibili.com",
    icon: "",
    cat: "",
    useEmoji: true,
  },
  {
    id: 1774710500005,
    name: "\u805a\u5408\u56fe\u5e8a (Superbed)",
    url: "https://www.superbed.cn/",
    icon: "",
    cat: "",
    useEmoji: true,
  },
  {
    id: 1774710500007,
    name: "\u8d85\u661f\u901a\u884c\u8bc1",
    url: "https://passport2.chaoxing.com/login?fid=&refer=",
    icon: "",
    cat: "",
    useEmoji: true,
  },
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
    return { normalized: defaultLinks, changed: true };
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

function normalizeImagesIndex(items) {
  if (!Array.isArray(items)) {
    return { normalized: [], changed: true };
  }

  let changed = false;
  const normalized = items
    .map((item) => {
      const safeItem = item && typeof item === "object" ? item : {};
      const filename = typeof safeItem.filename === "string" ? safeItem.filename : "";
      const uploadedAt =
        typeof safeItem.uploadedAt === "number" && Number.isFinite(safeItem.uploadedAt)
          ? safeItem.uploadedAt
          : Date.now();

      if (!filename) {
        changed = true;
        return null;
      }

      if (filename !== safeItem.filename || uploadedAt !== safeItem.uploadedAt) {
        changed = true;
      }

      return { filename, uploadedAt };
    })
    .filter(Boolean);

  return { normalized, changed };
}

function readJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readImagesIndex() {
  const payload = readJsonFile(IMAGES_FILE, []);
  const { normalized, changed } = normalizeImagesIndex(payload);
  if (changed) {
    fs.writeFileSync(IMAGES_FILE, JSON.stringify(normalized, null, 2), "utf8");
  }
  return normalized;
}

function saveImagesIndex(items) {
  fs.writeFileSync(IMAGES_FILE, JSON.stringify(items, null, 2), "utf8");
}

function upsertImageIndex(filename, uploadedAt = Date.now()) {
  const images = readImagesIndex().filter((item) => item.filename !== filename);
  images.unshift({ filename, uploadedAt });
  saveImagesIndex(images);
}

function removeImageFromIndex(filename) {
  const images = readImagesIndex().filter((item) => item.filename !== filename);
  saveImagesIndex(images);
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
      const { normalized, changed } = normalizeLinksForStorage(readJsonFile(LINKS_FILE, []));
      if (changed) {
        fs.writeFileSync(LINKS_FILE, JSON.stringify(normalized, null, 2), "utf8");
        logInfo("init", "Normalized existing links.json structure");
      }
    } catch (error) {
      logError("init", "Failed to normalize existing links.json, resetting to defaults", error);
      fs.writeFileSync(LINKS_FILE, JSON.stringify(defaultLinks, null, 2), "utf8");
    }
  }

  if (!fs.existsSync(BACKGROUND_FILE)) {
    fs.writeFileSync(BACKGROUND_FILE, JSON.stringify(defaultBackground, null, 2), "utf8");
    logInfo("init", "Created background.json with default values");
  }

  if (!fs.existsSync(IMAGES_FILE)) {
    fs.writeFileSync(IMAGES_FILE, "[]", "utf8");
    logInfo("init", "Created images.json");
  } else {
    const { normalized, changed } = normalizeImagesIndex(readJsonFile(IMAGES_FILE, []));
    if (changed) {
      fs.writeFileSync(IMAGES_FILE, JSON.stringify(normalized, null, 2), "utf8");
      logInfo("init", "Normalized images.json structure");
    }
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

function encodeObjectKey(key) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function appendCosStyle(url, styleValue) {
  if (!styleValue) {
    return url;
  }
  return `${url}?${styleValue}`;
}

function getCosImageUrls(filename) {
  const originalUrl = `${COS_BASE_URL}/${encodeObjectKey(filename)}`;
  return {
    originalUrl,
    url: appendCosStyle(originalUrl, COS_STYLE_DISPLAY),
    thumbUrl: appendCosStyle(originalUrl, COS_STYLE_THUMB),
  };
}

function getLocalImageUrls(filename) {
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

function getImageUrls(filename) {
  return isCosEnabled ? getCosImageUrls(filename) : getLocalImageUrls(filename);
}

function getImageStatus(filename) {
  if (isCosEnabled) {
    return {
      status: IMAGE_STATUS.READY,
      errorMessage: "",
    };
  }

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

function buildImageRecord(filename, sourcePathOrUploadedAt) {
  const uploadedAt =
    typeof sourcePathOrUploadedAt === "number"
      ? sourcePathOrUploadedAt
      : fs.statSync(sourcePathOrUploadedAt).mtime.getTime();

  return {
    filename,
    ...getImageUrls(filename),
    ...getImageStatus(filename),
    uploadedAt,
  };
}

function scheduleNextImageTask() {
  if (isCosEnabled || activeImageTask || !imageProcessingQueue.length) {
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
  if (isCosEnabled) {
    return;
  }

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
  if (isCosEnabled || !fs.existsSync(ORIGINALS_DIR)) {
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

enqueuePendingImagesOnStartup();

async function generateImageVariants(filePath, filename) {
  const { displayPath, thumbPath } = getVariantPaths(filename);

  [DISPLAY_DIR, THUMBS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const baseOptions = { animated: false };

  await sharp(filePath, baseOptions)
    .rotate()
    .resize({ width: DISPLAY_MAX_WIDTH, withoutEnlargement: true, fit: "inside" })
    .jpeg({ quality: OUTPUT_QUALITY })
    .toFile(displayPath);

  await sharp(filePath, baseOptions)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true, fit: "inside" })
    .jpeg({ quality: 72 })
    .toFile(thumbPath);
}

function uploadFileToCos(filePath, filename, mimetype) {
  return new Promise((resolve, reject) => {
    cosClient.putObject(
      {
        Bucket: COS_BUCKET,
        Region: COS_REGION,
        Key: filename,
        Body: fs.createReadStream(filePath),
        ContentType: mimetype,
        CacheControl: IMAGE_CACHE_CONTROL,
      },
      (error, data) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(data);
      },
    );
  });
}

function deleteFileFromCos(filename) {
  return new Promise((resolve, reject) => {
    cosClient.deleteObject(
      {
        Bucket: COS_BUCKET,
        Region: COS_REGION,
        Key: filename,
      },
      (error, data) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(data);
      },
    );
  });
}

function removeLocalFileIfExists(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ORIGINALS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `image-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|bmp/;
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowed.test(ext) && allowed.test(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error("Only image files are allowed."));
  },
});

const emojiData = require("./emoji_data.json");

function getLocalImages() {
  const originalFiles = fs.existsSync(ORIGINALS_DIR)
    ? fs.readdirSync(ORIGINALS_DIR).filter(isImageFilename)
    : [];
  const legacyFiles = fs.existsSync(UPLOADS_DIR)
    ? fs
        .readdirSync(UPLOADS_DIR)
        .filter(
          (filename) =>
            isImageFilename(filename) && fs.statSync(path.join(UPLOADS_DIR, filename)).isFile(),
        )
    : [];

  const files = [...new Set([...originalFiles, ...legacyFiles])];
  return files
    .map((filename) => {
      const originalPath = path.join(ORIGINALS_DIR, filename);
      const legacyPath = path.join(UPLOADS_DIR, filename);
      const sourcePath = fs.existsSync(originalPath) ? originalPath : legacyPath;
      return buildImageRecord(filename, sourcePath);
    })
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}

function getCosImages() {
  return readImagesIndex()
    .map((item) => buildImageRecord(item.filename, item.uploadedAt))
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}

app.get("/api/emojis", (req, res) => res.json(emojiData));

app.get("/api/links", (req, res) => {
  try {
    const { normalized, changed } = normalizeLinksForStorage(readJsonFile(LINKS_FILE, []));
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
    const background = readJsonFile(BACKGROUND_FILE, defaultBackground);
    if (!background.filename) {
      res.json(background);
      return;
    }

    if (isCosEnabled) {
      const matching = readImagesIndex().find((item) => item.filename === background.filename);
      if (!matching) {
        res.json(background);
        return;
      }

      res.json({
        ...background,
        ...buildImageRecord(background.filename, matching.uploadedAt),
      });
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

app.post("/api/upload", upload.single("image"), async (req, res) => {
  logInfo("upload", "Incoming upload request", {
    ip: req.ip,
    contentType: req.headers["content-type"],
    contentLength: req.headers["content-length"],
    storage: isCosEnabled ? "cos" : "local",
  });

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const { path: filePath, filename, originalname, mimetype, size } = req.file;

  logInfo("upload", "File received", {
    filename,
    originalname,
    mimetype,
    size,
  });

  try {
    if (isCosEnabled) {
      await uploadFileToCos(filePath, filename, mimetype);
      removeLocalFileIfExists(filePath);
      upsertImageIndex(filename, Date.now());
      const image = buildImageRecord(filename, Date.now());
      logInfo("upload", "Uploaded image to COS", {
        filename,
        originalUrl: image.originalUrl,
      });
      res.json({ success: true, ...image });
      return;
    }

    enqueueImageProcessing(filename, filePath);
    const image = buildImageRecord(filename, filePath);
    res.json({ success: true, ...image });
  } catch (error) {
    logError("upload", `Error handling upload for ${filename}`, error);
    res.status(500).json({ error: error.message || "Failed to upload image" });
  }
});

app.get("/api/images", (req, res) => {
  try {
    res.json(isCosEnabled ? getCosImages() : getLocalImages());
  } catch (error) {
    logError("images", "Error listing images", error);
    res.status(500).json({ error: "Failed to list images" });
  }
});

app.delete("/api/upload/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    if (isCosEnabled) {
      await deleteFileFromCos(filename);
      removeImageFromIndex(filename);
    } else {
      const { originalPath, displayPath, thumbPath } = getVariantPaths(filename);
      const legacyPath = path.join(UPLOADS_DIR, filename);

      if (!fs.existsSync(originalPath) && !fs.existsSync(legacyPath)) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      [originalPath, displayPath, thumbPath, legacyPath].forEach((filePath) => {
        removeLocalFileIfExists(filePath);
      });

      const queuedIndex = imageProcessingQueue.findIndex((task) => task.filename === filename);
      if (queuedIndex >= 0) {
        imageProcessingQueue.splice(queuedIndex, 1);
      }
      imageProcessingState.delete(filename);
    }

    const background = readJsonFile(BACKGROUND_FILE, defaultBackground);
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
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File is too large. The limit is 10MB." });
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
  logInfo("init", "Server started", {
    host: HOST,
    port: PORT,
    storage: isCosEnabled ? "cos" : "local",
    cosBucket: isCosEnabled ? COS_BUCKET : "",
    cosRegion: isCosEnabled ? COS_REGION : "",
  });
});
