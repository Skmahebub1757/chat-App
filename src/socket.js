const cookie = require("cookie");
const { pool } = require("./db");
const { verifyToken } = require("./middleware/auth");
const presence = require("./presence");

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

function initSocket(io) {
  // Authenticate every socket connection using the same JWT cookie used by the REST API
  io.use((socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie || "";
      const cookies = cookie.parse(raw);
      const token = cookies.token;
      if (!token) return next(new Error("unauthorized"));
      const decoded = verifyToken(token);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);

    const justCameOnline = await presence.addConnection(userId);
    if (justCameOnline) {
      socket.broadcast.emit("presence:online", { userId });
    }
    // Tell the newly-connected client who else is online right now
    socket.emit("presence:list", { userIds: await presence.onlineUserIds() });

    // --- Send a message ---
    socket.on("message:send", async (payload, ack) => {
      try {
        const receiverId = Number(payload?.receiverId);
        const text = (payload?.text || "").trim();

        if (!receiverId || !text) {
          return ack?.({ ok: false, error: "Message text cannot be empty." });
        }
        if (text.length > 4000) {
          return ack?.({ ok: false, error: "Message is too long." });
        }

        const [receiverRows] = await pool.query("SELECT id FROM users WHERE id = ?", [receiverId]);
        if (!receiverRows.length) {
          return ack?.({ ok: false, error: "That user no longer exists." });
        }

        const delivered = (await presence.isOnline(receiverId)) ? 1 : 0;
        const [result] = await pool.query(
          `INSERT INTO messages (sender_id, receiver_id, text, delivered) VALUES (?, ?, ?, ?)`,
          [userId, receiverId, text, delivered]
        );

        const [rows] = await pool.query("SELECT * FROM messages WHERE id = ?", [result.insertId]);
        const row = rows[0];

        io.to(`user:${receiverId}`).emit("message:new", publicMessage(row, receiverId));
        ack?.({ ok: true, message: publicMessage(row, userId) });
      } catch (err) {
        console.error(err);
        ack?.({ ok: false, error: "Could not send message. Please try again." });
      }
    });

    // --- Typing indicators ---
    socket.on("typing:start", ({ receiverId }) => {
      if (!receiverId) return;
      io.to(`user:${receiverId}`).emit("typing:start", { userId });
    });
    socket.on("typing:stop", ({ receiverId }) => {
      if (!receiverId) return;
      io.to(`user:${receiverId}`).emit("typing:stop", { userId });
    });

    // --- Read receipts ---
    socket.on("messages:read", async ({ senderId }) => {
      try {
        const otherId = Number(senderId);
        if (!otherId) return;
        await pool.query(
          `UPDATE messages SET is_read = 1, delivered = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
          [otherId, userId]
        );
        io.to(`user:${otherId}`).emit("messages:read", { by: userId });
      } catch (err) {
        console.error(err);
      }
    });

    // --- Disconnect ---
    socket.on("disconnect", async () => {
      const justWentOffline = await presence.removeConnection(userId);
      if (justWentOffline) {
        socket.broadcast.emit("presence:offline", { userId });
      }
    });
  });
}

module.exports = initSocket;
