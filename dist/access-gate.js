(() => {
  "use strict";

  const gate = document.getElementById("access-gate");
  const form = document.getElementById("access-form");
  const input = document.getElementById("access-password");
  const error = document.getElementById("access-error");
  const storageKey = "study-page-access-date";

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

  function readAccessDate() {
    try {
      return window.sessionStorage.getItem(storageKey) || "";
    } catch {
      return "";
    }
  }

  function rememberAccessDate(date) {
    try {
      window.sessionStorage.setItem(storageKey, date);
    } catch {
      // The current page can still be used if browser storage is disabled.
    }
  }

  function clearAccessDate() {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // The gate still closes in the current page if browser storage is disabled.
    }
  }

  let unlockedDate = "";
  function unlock(date) {
    unlockedDate = date;
    document.body.classList.add("access-open");
    gate.hidden = true;
  }

  const today = beijingDate();
  if (readAccessDate() === today) unlock(today);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const date = beijingDate();
    const expected = date.split("").reverse().join("");
    if (input.value === expected) {
      rememberAccessDate(date);
      error.hidden = true;
      unlock(date);
      return;
    }
    error.hidden = false;
    input.value = "";
    input.focus();
  });

  window.setInterval(() => {
    if (!unlockedDate || beijingDate() === unlockedDate) return;
    unlockedDate = "";
    clearAccessDate();
    document.body.classList.remove("access-open");
    gate.hidden = false;
    error.hidden = true;
    input.value = "";
    input.focus({ preventScroll: true });
  }, 30000);
})();
