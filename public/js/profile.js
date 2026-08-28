(async function () {
  let me = await requireAuthOrRedirect();
  if (!me) return;

  const profileAvatar = document.getElementById("profileAvatar");
  const profileName = document.getElementById("profileName");
  const profileHandle = document.getElementById("profileHandle");
  const profileJoined = document.getElementById("profileJoined");
  const avatarUpload = document.getElementById("avatarUpload");

  const profileForm = document.getElementById("profileForm");
  const editFullName = document.getElementById("editFullName");
  const editUsername = document.getElementById("editUsername");
  const editEmail = document.getElementById("editEmail");
  const profileError = document.getElementById("profileError");
  const profileSuccess = document.getElementById("profileSuccess");

  const passwordForm = document.getElementById("passwordForm");
  const passwordError = document.getElementById("passwordError");
  const passwordSuccess = document.getElementById("passwordSuccess");

  const logoutBtn = document.getElementById("logoutBtn");

  function renderMe() {
    profileAvatar.innerHTML = avatarHtml(me);
    profileName.textContent = me.fullName;
    profileHandle.textContent = `@${me.username}`;
    const joined = new Date(me.createdAt.replace(" ", "T") + "Z");
    profileJoined.textContent = `Joined ${joined.toLocaleDateString([], { month: "long", year: "numeric" })}`;
    editFullName.value = me.fullName;
    editUsername.value = me.username;
    editEmail.value = me.email;
  }
  renderMe();

  function setBox(el, msg, ok = false) {
    document.querySelectorAll(".form-error.visible, .form-success.visible").forEach((box) => {
      if (box !== el) {
        box.classList.remove("visible");
      }
    });
    if (!msg) {
      el.classList.remove("visible");
      return;
    }
    el.textContent = msg;
    el.classList.add("visible");
  }

  // ---------- Avatar upload ----------
  avatarUpload.addEventListener("change", async () => {
    const file = avatarUpload.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Profile picture must be under 5MB.", "error");
      return;
    }
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const { user } = await Api.put("/users/me", formData, { isForm: true });
      me = user;
      renderMe();
      showToast("Profile picture updated.");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // ---------- Profile details ----------
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setBox(profileError, "");
    setBox(profileSuccess, "");

    try {
      const { user } = await Api.put("/users/me", {
        fullName: editFullName.value.trim(),
        username: editUsername.value.trim(),
        email: editEmail.value.trim(),
      });
      me = user;
      renderMe();
      setBox(profileSuccess, "Profile updated successfully.", true);
    } catch (err) {
      setBox(profileError, err.message);
    }
  });

  // ---------- Password change ----------
  passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setBox(passwordError, "");
    setBox(passwordSuccess, "");

    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword !== confirmPassword) {
      setBox(passwordError, "New passwords don't match.");
      return;
    }

    try {
      await Api.put("/users/me/password", { currentPassword, newPassword });
      setBox(passwordSuccess, "Password updated successfully.", true);
      passwordForm.reset();
    } catch (err) {
      setBox(passwordError, err.message);
    }
  });

  // ---------- Logout ----------
  logoutBtn.addEventListener("click", async () => {
    try {
      await Api.post("/auth/logout");
    } finally {
      window.location.href = "/index.html";
    }
  });
})();
