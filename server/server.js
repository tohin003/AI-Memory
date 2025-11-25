require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');

// DB Adapters
const { createClient } = require('@vercel/postgres');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-this-locally';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// OTP Store
const otpStore = {};

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Database Abstraction
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.STORAGE_URL;
const USE_POSTGRES = !!POSTGRES_URL;
let dbClient;

async function getDb() {
    if (USE_POSTGRES) {
        if (!dbClient) {
            // Use createPool for Vercel/Neon Postgres
            const { createPool } = require('@vercel/postgres');
            dbClient = createPool({ connectionString: POSTGRES_URL });
            // Pool connects automatically on query, no need for explicit .connect()
        }
        return { type: 'pg', client: dbClient };
    } else {
        if (!dbClient) {
            // On Vercel, filesystem is read-only. Use in-memory DB if no Postgres.
            const isVercel = !!process.env.VERCEL;
            const dbPath = isVercel ? ':memory:' : path.resolve(__dirname, 'users.db');

            if (isVercel) {
                console.warn("WARNING: Running on Vercel without Postgres. Using in-memory SQLite. DATA WILL BE LOST ON RESTART.");
            }

            dbClient = new sqlite3.Database(dbPath);
        }
        return { type: 'sqlite', client: dbClient };
    }
}

async function runQuery(text, params = []) {
    const db = await getDb();

    if (db.type === 'pg') {
        // Postgres uses $1, $2...
        // Ensure params are passed correctly
        return await db.client.query(text, params);
    } else {
        // SQLite uses ?
        // Convert $1, $2 to ?
        const sqliteText = text.replace(/\$\d+/g, '?');
        return new Promise((resolve, reject) => {
            if (text.trim().toUpperCase().startsWith('SELECT')) {
                db.client.all(sqliteText, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                db.client.run(sqliteText, params, function (err) {
                    if (err) reject(err);
                    else resolve({ rows: [], insertId: this.lastID }); // Mocking pg response structure slightly
                });
            }
        });
    }
}

async function initDb() {
    try {
        if (USE_POSTGRES) {
            await runQuery(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT,
                    password TEXT NOT NULL
                );
            `);
        } else {
            await runQuery(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT,
                    password TEXT NOT NULL
                );
            `);
        }
        console.log(`Database initialized (${USE_POSTGRES ? 'Postgres' : 'SQLite'}).`);
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
}

initDb();

// Routes
app.get('/', (req, res) => {
    res.send(`AI Memory Auth Server running (${USE_POSTGRES ? 'Postgres' : 'SQLite'}). Time: ${new Date().toISOString()}`);
});

app.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

    try {
        const result = await runQuery('SELECT id FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 };

    console.log(`[OTP] Code for ${email}: ${otp}`);

    if (process.env.EMAIL_USER) {
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'AI Memory - Verify your email',
                text: `Your verification code is: ${otp}`
            });
            res.json({ message: 'OTP sent to email' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to send email' });
        }
    } else {
        res.json({ message: `OTP generated: ${otp} (Email not configured)` });
    }
});

app.post('/signup', async (req, res) => {
    let { email, name, password, otp } = req.body;

    if (email) email = email.trim();
    if (name) name = name.trim();
    if (password) password = password.trim();
    if (otp) otp = otp.trim();

    if (!email || !name || !password || !otp) return res.status(400).json({ error: 'All fields required' });

    const storedOtp = otpStore[email];
    if (!storedOtp || storedOtp.otp !== otp || Date.now() > storedOtp.expires) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    try {
        console.log(`[SIGNUP] Creating user: ${email}, Password: '${password}' (Length: ${password.length})`);
        // Insert
        await runQuery(
            'INSERT INTO users (email, name, password) VALUES ($1, $2, $3)',
            [email, name, password]
        );

        // Fetch back to get ID (SQLite doesn't support RETURNING in all versions easily)
        const result = await runQuery('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        delete otpStore[email];
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET_KEY, { expiresIn: '24h' });

        res.json({ message: 'Signup successful', token, user });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error(err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

app.post('/login', async (req, res) => {
    let { username, email, password } = req.body;

    // Sanitize
    if (username) username = username.trim();
    if (email) email = email.trim();
    if (password) password = password.trim();

    // Support both new "username" field and legacy "email" field
    const identifier = username || email;

    console.log(`[LOGIN ATTEMPT] Identifier: '${identifier}'`);

    if (!identifier || !password) return res.status(400).json({ error: 'Username/Email and password required' });

    try {
        // 1. Find user by identifier (email or name)
        const result = await runQuery(
            'SELECT * FROM users WHERE email = $1 OR name = $1',
            [identifier]
        );

        if (result.rows.length === 0) {
            console.log(`[LOGIN FAILED] User not found: '${identifier}'`);
            return res.status(401).json({ error: 'Invalid credentials (User not found)' });
        }

        const user = result.rows[0];

        // 2. Compare password in JS
        if (user.password !== password) {
            console.log(`[LOGIN FAILED] Password mismatch for '${identifier}'`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log(`[LOGIN SUCCESS] User: ${user.email}`);

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET_KEY, { expiresIn: '24h' });

        res.json({ message: 'Login successful', token, user: { email: user.email, name: user.name } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

app.get('/verify', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        res.json({ valid: true, user });
    });
});

app.listen(PORT, () => {
    console.log(`Auth Server running on http://localhost:${PORT}`);
});

module.exports = app;
