const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { spawn } = require('child_process');
let multer;
try { multer = require('multer'); } catch (e) { console.warn('multer not installed; upload route will be disabled until installed'); }
const fs = require('fs');
const path = require('path');
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (e) { console.warn("nodemailer not installed; send-mail route will be disabled until installed"); }
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini AI (guard missing key)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  } catch (e) {
    console.error('Failed to initialize Gemini AI:', e.message || e);
  }
} else {
  console.warn('GEMINI_API_KEY not set. /api/chat will return a fallback response.');
}

// Initialize SQLite database
const sqliteDb = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    // Create users table if it doesn't exist
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for PDF upload (only if multer is available)
let upload = null;
if (multer) {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      const timestamp = Date.now();
      const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
      cb(null, `${timestamp}_${safeOriginal}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  };

  upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
}

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

// Session configuration
app.use(session({
  secret: process.env.SECRET_KEY || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers && req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : null;
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    sqliteDb.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      sqliteDb.run('INSERT INTO users (username, password) VALUES (?, ?)', 
        [username, hashedPassword], function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          res.status(201).json({ message: 'User registered successfully' });
        });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    sqliteDb.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Create JWT token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET || 'your-jwt-secret',
        { expiresIn: '24h' }
      );

      // Set session
      req.session.userId = user.id;

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error logging out' });
    }
    res.json({ message: 'Logout successful' });
  });
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    sqliteDb.get('SELECT id, username, createdAt FROM users WHERE id = ?', [req.user.userId], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!genAI) {
      return res.status(503).json({ error: 'Chat service unavailable (missing GEMINI_API_KEY)' });
    }

    // Use Gemini AI
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent([
      "You are a helpful assistant. Please provide clear and concise responses.",
      message
    ]);

    const botResponse = result.response.text();

    res.json({
      response: botResponse,
      user_message: message
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error processing chat request' });
  }
});

// Upload resume (PDF only), extract text using Python, save as <username>.txt
app.post('/api/upload-resume', authenticateToken, (req, res) => {
  if (!upload) {
    return res.status(503).json({ error: "Upload service unavailable. Please install 'multer' and restart the server." });
  }
  upload.single('resume')(req, res, (err) => {
    if (err) {
      const msg = err.message || 'Upload error';
      return res.status(400).json({ error: msg });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Resume PDF file is required' });
    }

    const inputPdfPath = req.file.path;
    const outputTxtPath = path.join(uploadsDir, `${req.user.username}.txt`);

    // Spawn Python script to extract text
    const pythonExecutable = process.env.PYTHON_EXEC || (process.platform === 'win32' ? 'py' : 'python');
    const scriptPath = path.join(__dirname, 'extract_pdf.py');
    const pyProcess = spawn(pythonExecutable, [scriptPath, inputPdfPath, req.user.username, outputTxtPath], { shell: process.platform === 'win32', env: { ...process.env, PYTHONWARNINGS: 'ignore' } });

    let stderr = '';
    let stdout = '';
    pyProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pyProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python extraction failed:', stderr || stdout);
        return res.status(500).json({ error: 'Failed to process resume PDF' });
      }
      const trimmed = (stdout || '').trim();
      if (trimmed.startsWith('DB_EXISTS')) {
        const pathMsg = trimmed.replace('DB_EXISTS', '').trim();
        return res.json({ message: `Database already exists for this user.`, dbPath: pathMsg });
      }
      if (trimmed.startsWith('DB_CREATED')) {
        const pathMsg = trimmed.replace('DB_CREATED', '').trim();
        return res.json({ message: 'Resume processed and database created successfully.', dbPath: pathMsg });
      }
      if (trimmed.startsWith('DB_SKIPPED')) {
        const pathMsg = trimmed.replace('DB_SKIPPED', '').trim();
        return res.json({ message: 'Resume processed. Vector DB skipped (missing LangChain packages).', dbPath: pathMsg });
      }
      return res.json({ message: 'Resume processed successfully' });
    });
  });
});

// Generate email content using Python agent
app.post('/api/generate-email', authenticateToken, (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    const preferred = process.env.PYTHON_EXEC || (process.platform === 'win32' ? 'py' : 'python');
    const alternate = preferred === 'py' ? 'python' : 'py';
    const scriptPath = path.join(__dirname, 'generate_email.py');

    const runOnce = (pythonExecutable, onDone) => {
      const py = spawn(pythonExecutable, [scriptPath, req.user.username, topic], {
        shell: process.platform === 'win32',
        env: { ...process.env, PYTHONWARNINGS: 'ignore' }
      });
      let stdout = '';
      let stderr = '';
      py.stdout.on('data', (d) => { stdout += d.toString(); });
      py.stderr.on('data', (d) => { stderr += d.toString(); });
      py.on('close', (code) => {
        let parsed = null;
        try {
          parsed = JSON.parse(stdout);
        } catch (_) {
          const match = stdout && stdout.match(/\{[\s\S]*\}\s*$/);
          if (match) {
            try { parsed = JSON.parse(match[0]); } catch (_) { parsed = null; }
          }
        }
        onDone({ code, stdout, stderr, parsed });
      });
    };

    runOnce(preferred, (first) => {
      if (first.parsed && !first.parsed.error) {
        return res.json({ subject: first.parsed.subject, body: first.parsed.body, dbPath: first.parsed.dbPath });
      }
      runOnce(alternate, (second) => {
        if (second.parsed && !second.parsed.error) {
          return res.json({ subject: second.parsed.subject, body: second.parsed.body, dbPath: second.parsed.dbPath });
        }
        const msg = (first.stderr || first.stdout || second.stderr || second.stdout || 'Failed to generate email content');
        console.error('generate-email failed:', msg);
        return res.status(500).json({ error: 'Failed to generate email content' });
      });
    });
  } catch (e) {
    console.error('generate-email route error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Send mail with generated content using Python Gmail sender
app.post('/api/send-mail', authenticateToken, async (req, res) => { if (!nodemailer) { /* nodemailer optional, but we use Python sender here */ }
  try {
    const { receiverEmail, topic, subject: subjectIn, body: bodyIn } = req.body;
    if (!receiverEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail)) {
      return res.status(400).json({ error: 'A valid receiverEmail is required' });
    }

    const dbPath = path.join(__dirname, 'chroma_dbs', req.user.username);
    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'No Chroma DB found. Please upload and process the resume first.' });
    }

    let subject = subjectIn;
    let body = bodyIn;
    if (!subject || !body) {
      const preferred = process.env.PYTHON_EXEC || (process.platform === 'win32' ? 'py' : 'python');
      const scriptPath = path.join(__dirname, 'generate_email.py');
      const py = spawn(preferred, [scriptPath, req.user.username, topic || ''], { shell: process.platform === 'win32', env: { ...process.env, PYTHONWARNINGS: 'ignore' } });
      let stdout = '';
      let stderr = '';
      await new Promise((resolve) => {
        py.stdout.on('data', (d) => { stdout += d.toString(); });
        py.stderr.on('data', (d) => { stderr += d.toString(); });
        py.on('close', () => resolve());
      });
      try {
        const match = stdout && stdout.match(/\{[\s\S]*\}\s*$/);
        const data = match ? JSON.parse(match[0]) : JSON.parse(stdout || '{}');
        if (data.error) {
          return res.status(400).json({ error: data.error });
        }
        subject = data.subject;
        body = data.body;
      } catch (e) {
        console.error('generate-email parse error:', e, stdout, stderr);
        return res.status(500).json({ error: 'Failed to generate email content' });
      }
    }

    const senderEmail = process.env.GMAIL_SENDER;
    const appPassword = process.env.GMAIL_APP_PASSWORD;
    if (!senderEmail || !appPassword) {
      return res.status(400).json({ error: 'Email sending not configured. Set GMAIL_SENDER and GMAIL_APP_PASSWORD in .env' });
    }

    const pythonExec = process.env.PYTHON_EXEC || (process.platform === 'win32' ? 'py' : 'python');
    const sendScript = path.join(__dirname, 'email_sender.py');
    const sendProc = spawn(pythonExec, [sendScript, senderEmail, appPassword, receiverEmail, subject, body], { shell: process.platform === 'win32', env: { ...process.env, PYTHONWARNINGS: 'ignore' } });

    let sendOut = '';
    let sendErr = '';
    sendProc.stdout.on('data', (d) => { sendOut += d.toString(); });
    sendProc.stderr.on('data', (d) => { sendErr += d.toString(); });
    sendProc.on('close', (code) => {
      if (code !== 0) {
        console.error('email_sender failed:', sendErr || sendOut);
        return res.status(500).json({ error: 'Failed to send email' });
      }
      return res.json({ message: 'Email sent successfully', subject, body });
    });
  } catch (error) {
    console.error('Send mail error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

// Return Chroma DB path and existence for the logged-in user
app.get('/api/db-info', authenticateToken, (req, res) => {
  try {
    const dbPath = path.join(__dirname, 'chroma_dbs', req.user.username);
    const exists = fs.existsSync(dbPath);
    return res.json({ dbPath, exists });
  } catch (e) {
    console.error('db-info error:', e);
    return res.status(500).json({ error: 'Failed to get DB info' });
  }
});

app.get('/api/check-auth', (req, res) => {
  if (req.session.userId) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
