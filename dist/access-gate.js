(() => {
  "use strict";

  const gate = document.getElementById("access-gate");
  const form = document.getElementById("access-form");
  const input = document.getElementById("access-password");
  const error = document.getElementById("access-error");
  const sessionKey = "study-page-access-session-date";
  const usageKey = "study-page-access-usage";
  const dailyLimit = 2;

  function beijingDate() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return values.year + values.month + values.day;
  }

  function readSessionDate() {
    try {
      return window.sessionStorage.getItem(sessionKey) || "";
    } catch {
      return "";
    }
  }

  function rememberSessionDate(date) {
    try {
      window.sessionStorage.setItem(sessionKey, date);
    } catch {
      // The current page can still be used if browser storage is disabled.
    }
  }

  function clearSessionDate() {
    try {
      window.sessionStorage.removeItem(sessionKey);
    } catch {
      // The gate still closes in the current page if browser storage is disabled.
    }
  }

  function readUsage(date) {
    try {
      const raw = window.localStorage.getItem(usageKey);
      if (!raw) return 0;
      const saved = JSON.parse(raw);
      return saved && saved.date === date && Number.isInteger(saved.uses)
        ? saved.uses
        : 0;
    } catch {
      return null;
    }
  }

  function saveUsage(date, uses) {
    try {
      window.localStorage.setItem(usageKey, JSON.stringify({ date, uses }));
      return true;
    } catch {
      return false;
    }
  }

  async function registerSuccessfulUse(date) {
    const register = () => {
      const uses = readUsage(date);
      if (uses === null) return "storage-error";
      if (uses >= dailyLimit) return "limit";
      return saveUsage(date, uses + 1) ? "registered" : "storage-error";
    };
    if (navigator.locks && navigator.locks.request) {
      return navigator.locks.request("study-page-access-" + date, { mode: "exclusive" }, register);
    }
    return register();
  }

  let unlockedDate = "";
  function unlock(date) {
    unlockedDate = date;
    document.body.classList.add("access-open");
    gate.hidden = true;
  }

  const today = beijingDate();
  if (readSessionDate() === today) unlock(today);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const date = beijingDate();
    const uses = readUsage(date);
    if (uses === null) {
      error.textContent = "此浏览器无法保存使用次数，请允许本地存储后重试。";
      error.hidden = false;
      input.value = "";
      input.focus();
      return;
    }
    if (uses >= dailyLimit) {
      error.textContent = "今天这台设备的密码次数已用完，请明天再来。";
      error.hidden = false;
      input.value = "";
      input.focus();
      return;
    }
    const expected = date.split("").reverse().join("");
    if (input.value === expected) {
      const registration = await registerSuccessfulUse(date);
      if (registration !== "registered") {
        error.textContent = registration === "limit"
          ? "今天这台设备的密码次数已用完，请明天再来。"
          : "此浏览器无法保存使用次数，请允许本地存储后重试。";
        error.hidden = false;
        input.value = "";
        input.focus();
        return;
      }
      rememberSessionDate(date);
      error.hidden = true;
      unlock(date);
      return;
    }
    error.textContent = "密码不正确，请重试。";
    error.hidden = false;
    input.value = "";
    input.focus();
  });

  window.setInterval(() => {
    if (!unlockedDate || beijingDate() === unlockedDate) return;
    unlockedDate = "";
    clearSessionDate();
    document.body.classList.remove("access-open");
    gate.hidden = false;
    error.hidden = true;
    input.value = "";
    input.focus({ preventScroll: true });
  }, 30000);
})();
