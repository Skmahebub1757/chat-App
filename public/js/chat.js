(async function () {
  const me = await requireAuthOrRedirect();
  if (!me) return;

  // ---------- DOM refs ----------
  const meAvatar = document.getElementById("meAvatar");
  const meName = document.getElementById("meName");
  const meHandle = document.getElementById("meHandle");
  const searchInput = document.getElementById("searchInput");
  const userListEl = document.getElementById("userList");
  const sidebar = document.getElementById("sidebar");
  const chatPanel = document.getElementById("chatPanel");
  const emptyState = document.getElementById("emptyState");
  const conversationView = document.getElementById("conversationView");
  const chatAvatar = document.getElementById("chatAvatar");
  const chatName = document.getElementById("chatName");
  const chatStatus = document.getElementById("chatStatus");
  const messagesScroll = document.getElementById("messagesScroll");
  const typingLabel = document.getElementById("typingLabel");
  const composerForm = document.getElementById("composerForm");
  const messageInput = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const backBtn = document.getElementById("backBtn");

  // ---------- State ----------
  let users = [];
  let activeUser = null;
  const onlineIds = new Set();
  let typingStopTimer = null;
  let iAmTyping = false;
  let partnerTypingTimer = null;

  // ---------- "Me" card ----------
  meAvatar.innerHTML = avatarHtml(me);
  meName.textContent = me.fullName;
  meHandle.textContent = `@${me.username}`;

  // ---------- Socket setup ----------
  const socket = io({ withCredentials: true });

  socket.on("connect_error", () => {
    showToast("Connection lost. Trying to reconnect…", "error");
  });

  socket.on("presence:list", ({ userIds }) => {
    onlineIds.clear();
    userIds.forEach((id) => onlineIds.add(id));
    renderUsers();
    updateActiveHeaderStatus();
  });

  socket.on("presence:online", ({ userId }) => {
    onlineIds.add(userId);
    renderUsers();
    updateActiveHeaderStatus();
  });

  socket.on("presence:offline", ({ userId }) => {
    onlineIds.delete(userId);
    renderUsers();
    updateActiveHeaderStatus();
  });

  socket.on("message:new", (msg) => {
    const otherId = msg.fromMe ? msg.receiverId : msg.senderId;
    upsertLastMessage(otherId, msg);

    if (activeUser && otherId === activeUser.id) {
      appendMessage(msg);
      scrollToBottom();
      socket.emit("messages:read", { senderId: activeUser.id });
    } else {
      bumpUnread(otherId);
      const sender = users.find((u) => u.id === otherId);
      showToast(`${sender?.fullName || "New message"}: ${msg.text.slice(0, 60)}`);
    }
    renderUsers();
  });

  socket.on("typing:start", ({ userId }) => {
    if (!activeUser || userId !== activeUser.id) return;
    typingLabel.textContent = `${activeUser.fullName.split(" ")[0]} is typing…`;
    clearTimeout(partnerTypingTimer);
    partnerTypingTimer = setTimeout(() => (typingLabel.textContent = ""), 3000);
  });

  socket.on("typing:stop", ({ userId }) => {
    if (!activeUser || userId !== activeUser.id) return;
    typingLabel.textContent = "";
  });

  socket.on("messages:read", ({ by }) => {
    if (!activeUser || by !== activeUser.id) return;
    document.querySelectorAll(".msg-row.mine .msg-ticks").forEach((el) => el.classList.add("read"));
  });

  // ---------- Load & render user list ----------
  async function loadUsers(search = "") {
    try {
      const { users: list } = await Api.get(`/users${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      users = list;
      renderUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function renderUsers() {
    if (users.length === 0) {
      userListEl.innerHTML = `<div class="user-list-empty">No people found.</div>`;
      return;
    }
    userListEl.innerHTML = users
      .map((u) => {
        const online = onlineIds.has(u.id);
        const active = activeUser?.id === u.id;
        const preview = u.lastMessage
          ? `${u.lastMessage.fromMe ? "You: " : ""}${escapeHtml(u.lastMessage.text)}`
          : "Say hello 👋";
        const unread = u.unreadCount > 0;
        return `
          <button class="user-row ${active ? "active" : ""}" data-id="${u.id}">
            <div class="avatar">
              ${avatarHtml(u)}
              <span class="status-dot ${online ? "online" : ""}"></span>
            </div>
            <div class="user-row-body">
              <div class="user-row-top">
                <span class="user-row-name">${escapeHtml(u.fullName)}</span>
                <span class="user-row-time">${u.lastMessage ? formatRelativeTime(u.lastMessage.createdAt) : ""}</span>
              </div>
              <div class="user-row-bottom">
                <span class="user-row-preview ${unread ? "unread" : ""}">${preview}</span>
                ${unread ? `<span class="unread-badge">${u.unreadCount > 9 ? "9+" : u.unreadCount}</span>` : ""}
              </div>
            </div>
          </button>`;
      })
      .join("");

    userListEl.querySelectorAll(".user-row").forEach((row) => {
      row.addEventListener("click", () => {
        const id = Number(row.dataset.id);
        const user = users.find((u) => u.id === id);
        if (user) selectUser(user);
      });
    });
  }

  function upsertLastMessage(userId, msg) {
    const u = users.find((x) => x.id === userId);
    if (!u) {
      loadUsers(searchInput.value.trim());
      return;
    }
    u.lastMessage = { text: msg.text, fromMe: msg.fromMe, createdAt: msg.createdAt };
  }

  function bumpUnread(userId) {
    const u = users.find((x) => x.id === userId);
    if (u) u.unreadCount = (u.unreadCount || 0) + 1;
  }

  function updateActiveHeaderStatus() {
    if (!activeUser) return;
    const online = onlineIds.has(activeUser.id);
    chatStatus.textContent = online ? "Online" : "Offline";
    chatStatus.classList.toggle("online", online);
  }

  // ---------- Selecting a conversation ----------
  async function selectUser(user) {
    activeUser = user;
    emptyState.style.display = "none";
    conversationView.style.display = "flex";
    chatAvatar.innerHTML = `${avatarHtml(user)}<span class="status-dot ${onlineIds.has(user.id) ? "online" : ""}"></span>`;
    chatName.textContent = user.fullName;
    updateActiveHeaderStatus();
    typingLabel.textContent = "";
    messageInput.value = "";

    // Mobile: show chat panel over sidebar
    sidebar.classList.add("hide-mobile");
    chatPanel.classList.remove("hide-mobile");

    renderUsers();
    messagesScroll.innerHTML = `
      <div class="skeleton-row"><div class="skeleton-block" style="width:100%;height:38px;border-radius:14px;"></div></div>
      <div class="skeleton-row"><div class="skeleton-block" style="width:60%;height:38px;border-radius:14px;margin-left:auto;"></div></div>
      <div class="skeleton-row"><div class="skeleton-block" style="width:80%;height:38px;border-radius:14px;"></div></div>
    `;

    try {
      const { messages } = await Api.get(`/messages/${user.id}`);
      renderMessages(messages);
      scrollToBottom();

      const target = users.find((u) => u.id === user.id);
      if (target) target.unreadCount = 0;
      renderUsers();

      await Api.patch(`/messages/${user.id}/read`);
      socket.emit("messages:read", { senderId: user.id });
    } catch (err) {
      messagesScroll.innerHTML = "";
      showToast(err.message, "error");
    }

    messageInput.focus();
  }

  backBtn?.addEventListener("click", () => {
    sidebar.classList.remove("hide-mobile");
    chatPanel.classList.add("hide-mobile");
  });

  // ---------- Rendering messages ----------
  function renderMessages(list) {
    messagesScroll.innerHTML = "";
    let lastDay = null;
    list.forEach((msg) => {
      const day = formatDayLabel(msg.createdAt);
      if (day !== lastDay) {
        const divider = document.createElement("div");
        divider.className = "day-divider";
        divider.textContent = day;
        messagesScroll.appendChild(divider);
        lastDay = day;
      }
      appendMessage(msg, { skipScroll: true });
    });
  }

  function appendMessage(msg, opts = {}) {
    const row = document.createElement("div");
    row.className = `msg-row ${msg.fromMe ? "mine" : "theirs"}`;

    const ticks = msg.fromMe
      ? `<span class="msg-ticks ${msg.read ? "read" : ""}">${readTickSvg()}</span>`
      : "";

    row.innerHTML = `
      <div>
        <div class="msg-bubble">${escapeHtml(msg.text)}</div>
        <div class="msg-meta">${formatClockTime(msg.createdAt)}${ticks}</div>
      </div>
    `;
    messagesScroll.appendChild(row);
    if (!opts.skipScroll) scrollToBottom();
  }

  function readTickSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m2 12 5 5L20 4"/><path d="m9 17 2 2L22 8"/></svg>`;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesScroll.scrollTop = messagesScroll.scrollHeight;
    });
  }

  // ---------- Sending messages ----------
  composerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage();
  });

  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
    handleTyping();
  });

  function handleTyping() {
    if (!activeUser) return;
    if (!iAmTyping) {
      iAmTyping = true;
      socket.emit("typing:start", { receiverId: activeUser.id });
    }
    clearTimeout(typingStopTimer);
    typingStopTimer = setTimeout(() => {
      iAmTyping = false;
      socket.emit("typing:stop", { receiverId: activeUser.id });
    }, 1500);
  }

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !activeUser) return;

    sendBtn.disabled = true;
    socket.emit("message:send", { receiverId: activeUser.id, text }, (res) => {
      sendBtn.disabled = false;
      if (!res?.ok) {
        showToast(res?.error || "Message failed to send.", "error");
        return;
      }
      appendMessage(res.message);
      scrollToBottom();
      upsertLastMessage(activeUser.id, res.message);
      renderUsers();
    });

    messageInput.value = "";
    messageInput.style.height = "auto";
    clearTimeout(typingStopTimer);
    if (iAmTyping) {
      iAmTyping = false;
      socket.emit("typing:stop", { receiverId: activeUser.id });
    }
  }

  // ---------- Search ----------
  searchInput.addEventListener(
    "input",
    debounce(() => loadUsers(searchInput.value.trim()), 250)
  );

  // ---------- Init ----------
  await loadUsers();
})();
