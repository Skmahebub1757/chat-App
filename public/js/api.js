/* Shared helpers used by every page */

const Api = (() => {
  async function request(path, { method = "GET", body, isForm = false } = {}) {
    const opts = {
      method,
      credentials: "include",
      headers: {},
    };
    if (body !== undefined) {
      if (isForm) {
        opts.body = body; // FormData — browser sets content-type
      } else {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
    }
    const res = await fetch(`/api${path}`, opts);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const message = data?.error || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  return {
    get: (path) => request(path),
    post: (path, body, opts = {}) => request(path, { method: "POST", body, ...opts }),
    put: (path, body, opts = {}) => request(path, { method: "PUT", body, ...opts }),
    patch: (path, body, opts = {}) => request(path, { method: "PATCH", body, ...opts }),
  };
})();

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function avatarHtml(user, sizeClass = "") {
  if (user?.avatarUrl) {
    return `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.fullName || "")}" />`;
  }
  return escapeHtml(initials(user?.fullName));
}

function formatClockTime(iso) {
  try {
    const d = new Date(iso.replace(" ", "T") + "Z");
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + "Z");
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDayLabel(iso) {
  const d = new Date(iso.replace(" ", "T") + "Z");
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "long", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function showToast(message, type = "info") {
  let stack = document.getElementById("toastStack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity 0.25s ease";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 260);
  }, 3500);
}

function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// Redirect helpers used at the top of each page
async function getCurrentUser() {
  try {
    const { user } = await Api.get("/auth/me");
    return user;
  } catch {
    return null;
  }
}

async function requireAuthOrRedirect() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "/index.html";
    return null;
  }
  return user;
}

async function redirectIfAuthed() {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "/chat.html";
  }
}
