(async function () {
  await redirectIfAuthed();

  const form = document.getElementById("registerForm");
  const errorBox = document.getElementById("formError");
  const submitBtn = document.getElementById("submitBtn");
  const avatarInput = document.getElementById("avatarInput");
  const avatarPreview = document.getElementById("avatarPreview");

  function setError(msg) {
    if (!msg) {
      errorBox.classList.remove("visible");
      errorBox.textContent = "";
      return;
    }
    errorBox.textContent = msg;
    errorBox.classList.add("visible");
  }

  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile picture must be under 5MB.");
      avatarInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      avatarPreview.innerHTML = `<img src="${reader.result}" alt="Preview" />`;
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");

    const fullName = document.getElementById("fullName").value.trim();
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!fullName || !username || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    const formData = new FormData();
    formData.append("fullName", fullName);
    formData.append("username", username);
    formData.append("email", email);
    formData.append("password", password);
    if (avatarInput.files?.[0]) {
      formData.append("avatar", avatarInput.files[0]);
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Creating account…';

    try {
      await Api.post("/auth/register", formData, { isForm: true });
      window.location.href = "/chat.html";
    } catch (err) {
      setError(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
    }
  });
})();
