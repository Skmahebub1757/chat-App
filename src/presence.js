// Tracks which userIds currently have an open socket connection.
// A user may have multiple tabs open, so we count connections per user.

const connectionsByUser = new Map(); // userId -> Set<socketId>

function addConnection(userId, socketId) {
  if (!connectionsByUser.has(userId)) connectionsByUser.set(userId, new Set());
  connectionsByUser.get(userId).add(socketId);
  return connectionsByUser.get(userId).size === 1; // true if just came online
}

function removeConnection(userId, socketId) {
  const set = connectionsByUser.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    connectionsByUser.delete(userId);
    return true; // true if just went offline
  }
  return false;
}

function isOnline(userId) {
  return connectionsByUser.has(userId);
}

function onlineUserIds() {
  return [...connectionsByUser.keys()];
}

module.exports = { addConnection, removeConnection, isOnline, onlineUserIds };
