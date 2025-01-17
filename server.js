// server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CSRF Protection
const csrfProtection = csrf({ cookie: true });

// Create necessary directories
['uploads', 'submissions'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Multer setup for encrypted file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// Generate CSRF Token
app.get('/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Handle File Upload with Encryption
app.post('/submit', csrfProtection, upload.single('file'), (req, res) => {
    const { name, email, genre } = req.body;
    const file = req.file;

    if (!name || !email || !genre || !file) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const submissionId = crypto.randomUUID();
    const filePath = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;

    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(process.env.ENCRYPTION_PASSWORD, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const input = fs.createReadStream(file.path);
    const output = fs.createWriteStream(`uploads/${file.filename}.enc`);
    input.pipe(cipher).pipe(output);

    const submissionEntry = {
        id: submissionId,
        name,
        email,
        genre,
        filepath: `/download/${submissionId}`,
        iv: iv.toString('hex')
    };

    fs.writeFileSync(`submissions/${submissionId}.json`, JSON.stringify(submissionEntry));
    fs.unlinkSync(file.path);

    res.json({ message: 'Submission successful!', id: submissionId });
});

// Secure Download Route
app.get('/download/:id', (req, res) => {
    const submissionId = req.params.id;
    const submissionPath = `submissions/${submissionId}.json`;

    if (!fs.existsSync(submissionPath)) {
        return res.status(404).send('File not found.');
    }

    const submission = JSON.parse(fs.readFileSync(submissionPath));
    const iv = Buffer.from(submission.iv, 'hex');
    const key = crypto.scryptSync(process.env.ENCRYPTION_PASSWORD, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

    const encryptedFilePath = `uploads/${submissionId}.enc`;
    const input = fs.createReadStream(encryptedFilePath);
    res.setHeader('Content-Disposition', `attachment; filename="${submissionId}"`);
    input.pipe(decipher).pipe(res);
});

// Load Submissions
app.get('/submissions', (req, res) => {
    const files = fs.readdirSync('submissions');
    const submissions = files.map(file => JSON.parse(fs.readFileSync(`submissions/${file}`)));
    res.json(submissions);
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
