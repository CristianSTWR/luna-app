

const keyEl = document.getElementById("key");
    const btnActivate = document.getElementById("btnActivate");
    const btnClose = document.getElementById("btnClose");
    const msgText = document.getElementById("msgText");
    const dot = document.getElementById("dot");

    function setState(type, text) {
        document.getElementById('msg').style.display = text ? "flex" : "none";
      dot.className = "dot" + (type ? " " + type : "");
      msgText.textContent = text;
      msgText.style.color =
        type === "ok" ? "var(--ok)" :
        type === "bad" ? "var(--bad)" :
        "var(--muted)";
    }

    document.getElementById("key").addEventListener("focus", (e) => {
        setState("", "");
    });


    function normalizeKey(v) {
      return (v || "")
        .toUpperCase()
        .replace(/\s+/g, "")
        .trim();
    }

    async function activate() {
      const licenseKey = normalizeKey(keyEl.value);
      keyEl.value = licenseKey;

      if (!licenseKey || licenseKey.length < 10) {
        setState("bad", "Clave inválida. Revisa y vuelve a intentar.");
        return;
      }

      btnActivate.disabled = true;
      setState("", "Activando…");

      try {
        const res = await window.license.activate(licenseKey);
        if (res?.ok) {
          setState("ok", "Licencia activada. Entrando a la aplicación…");
          setTimeout(() => window.license.finishSuccess(), 500);
        } else {
          setState("bad", res?.msg || "No se pudo activar la licencia.");
        }
      } catch (e) {
        setState("bad", "Error inesperado al activar.");
      } finally {
        btnActivate.disabled = false;
      }
    }

    btnActivate.addEventListener("click", activate);
    btnClose.addEventListener("click", () => window.license.close());
    keyEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") activate();
    });

    ipcMain.on("license:success", () => {
  console.log("[LICENSE] success -> abrir main");
  try { if (licenseWin) licenseWin.close(); } catch {}
  licenseWin = null;

  if (!mainWin) createMainWindow();
});

ipcMain.on("license:close", () => {
  console.log("[LICENSE] close");
  try { if (licenseWin) licenseWin.close(); } catch {}
  licenseWin = null;
});

document.getElementById("loader_close").addEventListener("click", () => {
    window.loader.close();
  });
