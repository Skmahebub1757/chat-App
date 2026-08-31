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

// When running more than one instance/process (e.g. behind a load balancer), attach the Redis
// adapter so io.to()/broadcast reach sockets connected to *other* instances too. Without this,
// two users chatting who happen to land on different instances will never see each other's
// messages, even though each instance works fine on its own.
async function attachRedisAdapter() {
  if (!process.env.REDIS_URL) {
    console.warn(
      "REDIS_URL not set — running with a single-instance in-memory Socket.IO adapter. " +
        "If you deploy more than one instance/process behind a load balancer, set REDIS_URL " +
        "(e.g. an ElastiCache endpoint) or cross-instance messaging and presence will break."
    );
    return;
  }
  const Redis = require("ioredis");
  const { createAdapter } = require("@socket.io/redis-adapter");

  const tlsOpt = process.env.REDIS_TLS === "true" ? {} : undefined;
  const pubClient = new Redis(process.env.REDIS_URL, { tls: tlsOpt });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (err) => console.error("Redis (adapter pub) error:", err.message));
  subClient.on("error", (err) => console.error("Redis (adapter sub) error:", err.message));

  await Promise.all([
    new Promise((resolve, reject) => pubClient.once("ready", resolve).once("error", reject)),
    new Promise((resolve, reject) => subClient.once("ready", resolve).once("error", reject)),
  ]);

  io.adapter(createAdapter(pubClient, subClient));
  console.log("Socket.IO Redis adapter attached — safe to run multiple instances.");
}

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

  try {
    await attachRedisAdapter();
  } catch (err) {
    console.error("Could not connect to Redis. Check your REDIS_* settings in .env.");
    console.error(err.message);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Pulse chat server running at http://localhost:${PORT}`);
  });
}

start();
