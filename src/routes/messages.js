const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function publicMessage(row, meId) {
  return {
    id: row.id,
    text: row.text,
    fromMe: row.sender_id === meId,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    delivered: !!row.delivered,
    read: !!row.is_read,
    createdAt: row.created_at,
  };
}

// GET /api/messages/:userId — full conversation with that user
router.get("/:userId", async (req, res) => {
  try {
    const otherId = Number(req.params.userId);
    const meId = req.userId;

    const [otherRows] = await pool.query("SELECT id FROM users WHERE id = ?", [otherId]);
    if (!otherRows.length) return res.status(404).json({ error: "User not found." });

    const [rows] = await pool.query(
      `SELECT * FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC, id ASC`,
      [meId, otherId, otherId, meId]
    );

    res.json({ messages: rows.map((r) => publicMessage(r, meId)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while loading messages." });
  }
});

// PATCH /api/messages/:userId/read — mark all messages from that user as read
router.patch("/:userId/read", async (req, res) => {
  try {
    const otherId = Number(req.params.userId);
    const meId = req.userId;
    await pool.query(
      `UPDATE messages SET is_read = 1, delivered = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
      [otherId, meId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

module.exports = router;
