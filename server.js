const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 39421;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// Ensure required directories and files exist
const DATA_DIR = __dirname;
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const LINKS_FILE = path.join(DATA_DIR, 'links.json');
const BACKGROUND_FILE = path.join(DATA_DIR, 'background.json');

// Initialize data structures
const defaultLinks = [
  {
    name: "Google",
    url: "https://www.google.com",
    icon: "🔍",
    cat: "搜索"
  },
  {
    name: "GitHub",
    url: "https://github.com",
    icon: "💻",
    cat: "开发"
  },
  {
    name: "YouTube",
    url: "https://www.youtube.com",
    icon: "📺",
    cat: "娱乐"
  },
  {
    name: "Bilibili",
    url: "https://www.bilibili.com",
    icon: "📺",
    cat: "娱乐"
  }
];

// Initialize files if they don't exist
function initializeFiles() {
  // Create uploads directory
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('Created uploads directory');
  }

  // Initialize links.json if not exists
  if (!fs.existsSync(LINKS_FILE)) {
    fs.writeFileSync(LINKS_FILE, JSON.stringify(defaultLinks, null, 2));
    console.log('Created links.json with default links');
  }

  // Initialize background.json if not exists
  if (!fs.existsSync(BACKGROUND_FILE)) {
    fs.writeFileSync(BACKGROUND_FILE, JSON.stringify({ filename: '', blur: 18, dim: 52 }, null, 2));
    console.log('Created background.json with default values');
  }
}

initializeFiles();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    // Accept only image files
    const allowedTypes = /jpeg|jpg|png|gif|webp|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// API Routes

// Get emoji data grouped by category
const emojiData = require('./emoji_data.json');
app.get('/api/emojis', (req, res) => {
  res.json(emojiData);
});

// Get all links
app.get('/api/links', (req, res) => {
  try {
    const data = fs.readFileSync(LINKS_FILE, 'utf8');
    const links = JSON.parse(data);
    res.json(links);
  } catch (error) {
    console.error('Error reading links:', error);
    res.status(500).json({ error: 'Failed to read links' });
  }
});

// Save all links
app.post('/api/links', (req, res) => {
  try {
    const links = req.body;
    if (!Array.isArray(links)) {
      return res.status(400).json({ error: 'Invalid links data' });
    }
    fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
    res.json({ success: true, message: 'Links saved successfully' });
  } catch (error) {
    console.error('Error saving links:', error);
    res.status(500).json({ error: 'Failed to save links' });
  }
});

// Get background settings
app.get('/api/background', (req, res) => {
  try {
    const data = fs.readFileSync(BACKGROUND_FILE, 'utf8');
    const bg = JSON.parse(data);
    res.json(bg);
  } catch (error) {
    console.error('Error reading background:', error);
    res.status(500).json({ error: 'Failed to read background settings' });
  }
});

// Save background settings
app.post('/api/background', (req, res) => {
  try {
    const { filename, blur, dim } = req.body;
    if (filename === undefined || blur === undefined || dim === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const bg = { filename, blur, dim };
    fs.writeFileSync(BACKGROUND_FILE, JSON.stringify(bg, null, 2));
    res.json({ success: true, message: 'Background settings saved successfully' });
  } catch (error) {
    console.error('Error saving background:', error);
    res.status(500).json({ error: 'Failed to save background settings' });
  }
});

// Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return the URL path to the uploaded image
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      url: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 10MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  GET  /api/links`);
  console.log(`  POST /api/links`);
  console.log(`  GET  /api/background`);
  console.log(`  POST /api/background`);
  console.log(`  POST /api/upload`);
});
