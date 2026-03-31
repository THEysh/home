const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const sharp   = require('sharp');

const app  = express();
const PORT = 39421;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

// ---- Directories ----
const DATA_DIR     = __dirname;
const UPLOADS_DIR  = path.join(DATA_DIR, 'uploads');
const ORIGINALS_DIR = path.join(UPLOADS_DIR, 'originals');
const DISPLAY_DIR  = path.join(UPLOADS_DIR, 'display');
const THUMBS_DIR   = path.join(UPLOADS_DIR, 'thumbs');
const LINKS_FILE      = path.join(DATA_DIR, 'links.json');
const BACKGROUND_FILE = path.join(DATA_DIR, 'background.json');

const DISPLAY_MAX_WIDTH = 2560;
const THUMB_WIDTH       = 360;
const OUTPUT_QUALITY    = 82;

// ---- Static serving ----
app.use('/uploads', express.static(UPLOADS_DIR, {
  etag: true,
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  }
}));
app.use(express.static(__dirname));

// ---- Default data ----
const defaultLinks = [
  { name: "Google",   url: "https://www.google.com",    icon: "🔍", cat: "搜索" },
  { name: "GitHub",   url: "https://github.com",         icon: "💻", cat: "开发" },
  { name: "YouTube",  url: "https://www.youtube.com",   icon: "📺", cat: "娱乐" },
  { name: "Bilibili", url: "https://www.bilibili.com",  icon: "📺", cat: "娱乐" }
];

// ---- Init directories & files ----
function initializeFiles() {
  [UPLOADS_DIR, ORIGINALS_DIR, DISPLAY_DIR, THUMBS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${path.relative(__dirname, dir)}`);
    }
  });

  if (!fs.existsSync(LINKS_FILE)) {
    fs.writeFileSync(LINKS_FILE, JSON.stringify(defaultLinks, null, 2), 'utf8');
    console.log('Created links.json with default links');
  }
  if (!fs.existsSync(BACKGROUND_FILE)) {
    fs.writeFileSync(BACKGROUND_FILE, JSON.stringify({ filename: '', blur: 18, dim: 52 }, null, 2), 'utf8');
    console.log('Created background.json with default values');
  }
}

initializeFiles();

// ---- Helpers ----
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
    displayPath:  path.join(DISPLAY_DIR,   `${baseName}.jpg`),
    thumbPath:    path.join(THUMBS_DIR,    `${baseName}.jpg`)
  };
}

function getImageUrls(filename) {
  const baseName    = getImageBaseName(filename);
  const { displayPath, thumbPath } = getVariantPaths(filename);
  const hasDisplay  = fs.existsSync(displayPath);
  const hasThumb    = fs.existsSync(thumbPath);
  const hasOriginal = fs.existsSync(path.join(ORIGINALS_DIR, filename));

  return {
    originalUrl: hasOriginal ? `/uploads/originals/${filename}` : `/uploads/${filename}`,
    url:         hasDisplay  ? `/uploads/display/${baseName}.jpg`  : `/uploads/${filename}`,
    thumbUrl:    hasThumb    ? `/uploads/thumbs/${baseName}.jpg`
                             : (hasDisplay ? `/uploads/display/${baseName}.jpg` : `/uploads/${filename}`)
  };
}

/**
 * Generate display-size and thumbnail variants using sharp.
 * Directories are always ensured to exist before writing.
 */
async function generateImageVariants(filePath, filename) {
  const { displayPath, thumbPath } = getVariantPaths(filename);

  // Always ensure output directories exist (safe even if already present)
  [DISPLAY_DIR, THUMBS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Create a fresh pipeline from the source file each time to avoid
  // "stream already consumed" errors when cloning.
  const baseOptions = { animated: false };

  // Display version
  await sharp(filePath, baseOptions)
    .rotate()
    .resize({ width: DISPLAY_MAX_WIDTH, withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: OUTPUT_QUALITY })
    .toFile(displayPath);

  // Thumbnail version
  await sharp(filePath, baseOptions)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: 72 })
    .toFile(thumbPath);
}

// ---- Multer config ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ORIGINALS_DIR),
  filename:    (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `image-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|bmp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件（jpg/png/gif/webp/bmp）'));
    }
  }
});

// ==============================
//  API Routes
// ==============================

// Emoji data
const emojiData = require('./emoji_data.json');
app.get('/api/emojis', (req, res) => res.json(emojiData));

// Get links
app.get('/api/links', (req, res) => {
  try {
    const data  = fs.readFileSync(LINKS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Error reading links:', err);
    res.status(500).json({ error: 'Failed to read links' });
  }
});

// Save links
app.post('/api/links', (req, res) => {
  try {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid links data' });
    fs.writeFileSync(LINKS_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving links:', err);
    res.status(500).json({ error: 'Failed to save links' });
  }
});

// Get background settings
app.get('/api/background', (req, res) => {
  try {
    const bg = JSON.parse(fs.readFileSync(BACKGROUND_FILE, 'utf8'));
    res.json({ ...bg, ...(bg.filename ? getImageUrls(bg.filename) : {}) });
  } catch (err) {
    console.error('Error reading background:', err);
    res.status(500).json({ error: 'Failed to read background settings' });
  }
});

// Save background settings
app.post('/api/background', (req, res) => {
  try {
    const { filename, blur, dim, positionX, positionY } = req.body;
    if (filename === undefined || blur === undefined || dim === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const bgData = { filename, blur, dim };
    if (positionX !== undefined) bgData.positionX = positionX;
    if (positionY !== undefined) bgData.positionY = positionY;
    fs.writeFileSync(BACKGROUND_FILE, JSON.stringify(bgData, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving background:', err);
    res.status(500).json({ error: 'Failed to save background settings' });
  }
});

// Upload image
app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { path: filePath, filename } = req.file;

  try {
    await generateImageVariants(filePath, filename);
    console.log(`Processed: ${filename}`);
    res.json({ success: true, filename, ...getImageUrls(filename) });
  } catch (err) {
    // Log the real error for debugging; do NOT delete the original so
    // the image is still accessible even if thumbnail generation failed.
    console.error('Error generating image variants:', err);
    // Return the original upload URL so the frontend still works
    res.json({
      success: true,
      filename,
      warning: 'Thumbnail generation failed, using original.',
      url:      `/uploads/originals/${filename}`,
      thumbUrl: `/uploads/originals/${filename}`,
      originalUrl: `/uploads/originals/${filename}`
    });
  }
});

// List uploaded images
app.get('/api/images', (req, res) => {
  try {
    const originalFiles = fs.existsSync(ORIGINALS_DIR)
      ? fs.readdirSync(ORIGINALS_DIR).filter(isImageFilename)
      : [];
    const legacyFiles = fs.readdirSync(UPLOADS_DIR)
      .filter(f => isImageFilename(f) && fs.statSync(path.join(UPLOADS_DIR, f)).isFile());

    const files = [...new Set([...originalFiles, ...legacyFiles])];
    const images = files.map(f => {
      const origPath   = path.join(ORIGINALS_DIR, f);
      const legacyPath = path.join(UPLOADS_DIR, f);
      const sourcePath = fs.existsSync(origPath) ? origPath : legacyPath;
      return {
        filename: f,
        ...getImageUrls(f),
        uploadedAt: fs.statSync(sourcePath).mtime.getTime()
      };
    }).sort((a, b) => b.uploadedAt - a.uploadedAt);

    res.json(images);
  } catch (err) {
    console.error('Error listing images:', err);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Delete image
app.delete('/api/upload/:filename', (req, res) => {
  try {
    const filename = req.params.filename;

    // Security: prevent path traversal
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const { originalPath, displayPath, thumbPath } = getVariantPaths(filename);
    const legacyPath = path.join(UPLOADS_DIR, filename);

    // Confirm at least one variant exists
    if (!fs.existsSync(originalPath) && !fs.existsSync(legacyPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    [originalPath, displayPath, thumbPath, legacyPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    // Clear background settings if this was the active image
    const bg = JSON.parse(fs.readFileSync(BACKGROUND_FILE, 'utf8'));
    if (bg.filename === filename) {
      bg.filename = '';
      fs.writeFileSync(BACKGROUND_FILE, JSON.stringify(bg, null, 2), 'utf8');
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ---- Error handling middleware ----
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '文件过大（最大 10MB）' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

// ---- Start ----
app.listen(PORT, HOST, () => {
  console.log(`\nServer running at http://${HOST}:${PORT}`);
  console.log('API endpoints:');
  console.log('  GET    /api/links');
  console.log('  POST   /api/links');
  console.log('  GET    /api/background');
  console.log('  POST   /api/background');
  console.log('  GET    /api/images');
  console.log('  POST   /api/upload');
  console.log('  DELETE /api/upload/:filename');
});