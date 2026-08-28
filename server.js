require("dotenv").config();

const path = require("path");
const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { Server } = require("socket.io");

const { initDb } = require("./src/db");
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const messageRoutes = require("./src/routes/messages");
const initSocket = require("./src/socket");

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in .env — copy .env.example to .env first.");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

app.use(express.static(path.join(__dirname, "public")));

// Any unmatched non-API route falls back to the login page (simple SPA-ish routing)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Centralized error handler (e.g. multer file-size/type errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Something went wrong." });
});

initSocket(io);

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await initDb(); // connects to RDS and creates tables if they don't exist yet
  } catch (err) {
    console.error("Could not connect to the database. Check your DB_* settings in .env.");
    console.error(err.message);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Pulse chat server running at http://localhost:${PORT}`);
  });
}

start();
