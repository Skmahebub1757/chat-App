const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const upload = require("../upload");
const { signToken, requireAuth } = require("../middleware/auth");

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

// POST /api/auth/register
router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;

    if (!fullName?.trim() || !username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: "Full name, username, email and password are all required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, "");
    if (!/^[a-z0-9_.]{3,20}$/.test(cleanUsername)) {
      return res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, dots or underscores." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const [existingRows] = await pool.query(
      "SELECT id FROM users WHERE email = ? OR username = ?",
      [cleanEmail, cleanUsername]
    );
    if (existingRows.length) {
      return res.status(409).json({ error: "An account with that email or username already exists." });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, avatar_url)
       VALUES (?, ?, ?, ?, ?)`,
      [fullName.trim(), cleanUsername, cleanEmail, passwordHash, avatarUrl]
    );

    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
    const user = rows[0];
    const token = signToken(user.id);
    res.cookie("token", token, COOKIE_OPTS);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while creating your account." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier?.trim() || !password) {
      return res.status(400).json({ error: "Please enter your email/username and password." });
    }

    const id = identifier.trim().toLowerCase();
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1",
      [id, id]
    );
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Incorrect email/username or password." });
    }

    const token = signToken(user.id);
    res.cookie("token", token, COOKIE_OPTS);
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while logging you in." });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", { ...COOKIE_OPTS, maxAge: undefined });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.userId]);
    if (!rows.length) return res.status(404).json({ error: "User not found." });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

module.exports = router;
