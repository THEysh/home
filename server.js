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
  { name: "Google", url: "https://www.google.com", icon: "\u{1F50D}", cat: "搜索" },
  { name: "GitHub", url: "https://github.com", icon: "\u{1F419}", cat: "开发" },
  { name: "YouTube", url: "https://www.youtube.com", icon: "\u{1F4FA}", cat: "娱乐" },
  { name: "Bilibili", url: "https://www.bilibili.com", icon: "\u{1F3AC}", cat: "娱乐" },
];

const defaultBackground = {
  filename: "",
  blur: 18,
  dim: 52,
  positionX: 50,
  positionY: 50,
};

function initializeFiles() {
  [UPLOADS_DIR, ORIGINALS_DIR, DISPLAY_DIR, THUMBS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${path.relative(__dirname, dir)}`);
    }
  });

  if (!fs.existsSync(LINKS_FILE)) {
    fs.writeFileSync(LINKS_FILE, JSON.stringify(defaultLinks, null, 2), "utf8");
    console.log("Created links.json with default links");
  }

  if (!fs.existsSync(BACKGROUND_FILE)) {
    fs.writeFileSync(BACKGROUND_FILE, JSON.stringify(defaultBackground, null, 2), "utf8");
    console.log("Created background.json with default values");
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ORIGINALS_DIR),
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
    cb(new Error("只允许上传图片文件（jpg/png/gif/webp/bmp）。"));
  },
});

const emojiData = require("./emoji_data.json");

app.get("/api/emojis", (req, res) => res.json(emojiData));

app.get("/api/links", (req, res) => {
  try {
    const data = fs.readFileSync(LINKS_FILE, "utf8");
    res.json(JSON.parse(data));
  } catch (error) {
    console.error("Error reading links:", error);
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
    console.error("Error saving links:", error);
    res.status(500).json({ error: "Failed to save links" });
  }
});

app.get("/api/background", (req, res) => {
  try {
    const background = JSON.parse(fs.readFileSync(BACKGROUND_FILE, "utf8"));
    res.json({ ...background, ...(background.filename ? getImageUrls(background.filename) : {}) });
  } catch (error) {
    console.error("Error reading background:", error);
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
    console.error("Error saving background:", error);
    res.status(500).json({ error: "Failed to save background settings" });
  }
});

app.post("/api/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const { path: filePath, filename } = req.file;

  try {
    await generateImageVariants(filePath, filename);
    console.log(`Processed: ${filename}`);
    res.json({ success: true, filename, ...getImageUrls(filename) });
  } catch (error) {
    console.error("Error generating image variants:", error);
    res.json({
      success: true,
      filename,
      warning: "Thumbnail generation failed, using original image.",
      url: `/uploads/originals/${filename}`,
      thumbUrl: `/uploads/originals/${filename}`,
      originalUrl: `/uploads/originals/${filename}`,
    });
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
    console.error("Error listing images:", error);
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
    console.error("Error deleting file:", error);
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
      res.status(400).json({ error: "文件过大，最大支持 10MB。" });
      return;
    }
    res.status(400).json({ error: error.message });
    return;
  }

  if (error) {
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
