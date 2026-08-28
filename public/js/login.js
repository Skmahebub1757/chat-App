(async function () {
  await redirectIfAuthed();

  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("formError");
  const submitBtn = document.getElementById("submitBtn");

  function setError(msg) {
    if (!msg) {
      errorBox.classList.remove("visible");
      errorBox.textContent = "";
      return;
    }
    errorBox.textContent = msg;
    errorBox.classList.add("visible");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");

    const identifier = document.getElementById("identifier").value.trim();
    const password = document.getElementById("password").value;

    if (!identifier || !password) {
      setError("Please fill in both fields.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Logging in…';

    try {
      await Api.post("/auth/login", { identifier, password });
      window.location.href = "/chat.html";
    } catch (err) {
      setError(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
    }
  });
})();
