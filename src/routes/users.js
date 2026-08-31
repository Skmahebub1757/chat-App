const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const upload = require("../upload");
const { requireAuth } = require("../middleware/auth");
const presence = require("../presence");

const router = express.Router();
router.use(requireAuth);

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

// GET /api/users?search=
// Returns every other user, each with online status, last message preview and unread count.
router.get("/", async (req, res) => {
  try {
    const search = (req.query.search || "").trim().toLowerCase();
    const meId = req.userId;

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id != ? ORDER BY full_name ASC",
      [meId]
    );

    const filtered = search
      ? rows.filter(
          (u) =>
            u.full_name.toLowerCase().includes(search) ||
            u.username.toLowerCase().includes(search) ||
            u.email.toLowerCase().includes(search)
        )
      : rows;

    const result = await Promise.all(
      filtered.map(async (u) => {
        const [lastMsgRows] = await pool.query(
          `SELECT text, sender_id, created_at FROM messages
           WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
           ORDER BY created_at DESC, id DESC LIMIT 1`,
          [meId, u.id, u.id, meId]
        );
        const [unreadRows] = await pool.query(
          `SELECT COUNT(*) AS n FROM messages
           WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
          [u.id, meId]
        );
        const lastMsg = lastMsgRows[0];

        return {
          ...publicUser(u),
          online: await presence.isOnline(u.id),
          lastMessage: lastMsg
            ? { text: lastMsg.text, fromMe: lastMsg.sender_id === meId, createdAt: lastMsg.created_at }
            : null,
          unreadCount: unreadRows[0].n,
        };
      })
    );

    result.sort((a, b) => {
      const at = a.lastMessage?.createdAt || "";
      const bt = b.lastMessage?.createdAt || "";
      if (at && bt) return at < bt ? 1 : -1;
      if (at) return -1;
      if (bt) return 1;
      return 0;
    });

    res.json({ users: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while loading users." });
  }
});

// PUT /api/users/me — update profile fields (and optionally avatar)
router.put("/me", upload.single("avatar"), async (req, res) => {
  try {
    const meId = req.userId;
    const [currentRows] = await pool.query("SELECT * FROM users WHERE id = ?", [meId]);
    const current = currentRows[0];
    if (!current) return res.status(404).json({ error: "User not found." });

    const fullName = req.body.fullName?.trim() || current.full_name;
    const email = req.body.email?.trim().toLowerCase() || current.email;
    let username = current.username;

    if (req.body.username?.trim()) {
      username = req.body.username.trim().toLowerCase().replace(/\s+/g, "");
      if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
        return res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, dots or underscores." });
      }
    }

    const [clashRows] = await pool.query(
      "SELECT id FROM users WHERE (email = ? OR username = ?) AND id != ?",
      [email, username, meId]
    );
    if (clashRows.length) {
      return res.status(409).json({ error: "That email or username is already taken." });
    }

    const avatarUrl = req.file ? `/uploads/${req.file.filename}` : current.avatar_url;

    await pool.query(
      `UPDATE users SET full_name = ?, username = ?, email = ?, avatar_url = ? WHERE id = ?`,
      [fullName, username, email, avatarUrl, meId]
    );

    const [updatedRows] = await pool.query("SELECT * FROM users WHERE id = ?", [meId]);
    res.json({ user: publicUser(updatedRows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while updating your profile." });
  }
});

// PUT /api/users/me/password — change password
router.put("/me/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Please provide your current and new password." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.userId]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while changing your password." });
  }
});

module.exports = router;
