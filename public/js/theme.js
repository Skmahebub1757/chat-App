(function () {
  const stored = localStorage.getItem("pulse-theme");
  if (stored) document.documentElement.setAttribute("data-theme", stored);

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyIcon() {
    const icon = document.getElementById("themeIcon");
    if (!icon) return;
    if (currentTheme() === "light") {
      icon.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
    } else {
      icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyIcon();
    const btn = document.getElementById("themeToggle");
    btn?.addEventListener("click", () => {
      const next = currentTheme() === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("pulse-theme", next);
      applyIcon();
    });
  });
})();
