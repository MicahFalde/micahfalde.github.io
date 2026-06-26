// Client-side password gate for Jadon's Math.
// Content is AES-256-GCM encrypted; the password derives the key (PBKDF2-SHA256).
// One unlock per browser session (sessionStorage), shared across all pages.
(async function () {
  const ITER = 150000;
  const enc = new TextEncoder();
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function deriveKey(pw, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  async function decryptPayload(pw) {
    const raw = b64ToBytes(window.JM_PAYLOAD);
    const salt = raw.slice(0, 16);
    const iv = raw.slice(16, 28);
    const data = raw.slice(28); // ciphertext + 16-byte GCM tag
    const key = await deriveKey(pw, salt);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(pt);
  }

  function render(html) {
    document.getElementById("content").innerHTML = html;
    const gate = document.getElementById("gate");
    gate.classList.remove("show");
    gate.style.display = "none";
  }

  async function attempt(pw, fromStore) {
    try {
      const html = await decryptPayload(pw);
      sessionStorage.setItem("jm_pw", pw);
      render(html);
      return true;
    } catch (e) {
      sessionStorage.removeItem("jm_pw");
      if (!fromStore) {
        const m = document.getElementById("gate-msg");
        if (m) m.textContent = "Wrong password — try again.";
      }
      return false;
    }
  }

  const saved = sessionStorage.getItem("jm_pw");
  if (saved && (await attempt(saved, true))) return;

  const gate = document.getElementById("gate");
  gate.classList.add("show");
  const form = document.getElementById("gate-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    attempt(document.getElementById("gate-pw").value, false);
  });
  document.getElementById("gate-pw").focus();
})();
