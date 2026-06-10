/**
 * Sons suaves do bolão (Web Audio API — sem ficheiros).
 * Só tocam se não estiverem silenciados; o contexto acorda no primeiro clique.
 */
(function () {
  const STORAGE_KEY = "bolao-sound-muted";

  let ctx = null;
  let master = null;
  let muted = localStorage.getItem(STORAGE_KEY) === "1";

  function getCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.12;
      master.connect(ctx.destination);
      return ctx;
    } catch {
      return null;
    }
  }

  function resume() {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    return c;
  }

  /** Oscilador curto ligado ao master. */
  function blip(when, freq, dur, type, peak) {
    const c = getCtx();
    if (!c || !master) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0009, when + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }

  function playIfAllowed(fn) {
    if (muted) return;
    const c = resume();
    if (!c) return;
    try {
      fn(c.currentTime);
    } catch {
      /* silêncio em browsers restritivos */
    }
  }

  function playNav() {
    playIfAllowed((t) => {
      blip(t, 587.33, 0.09, "sine", 0.85); // D5
      blip(t + 0.07, 783.99, 0.11, "sine", 0.65); // G5
    });
  }

  function playSubTab() {
    playIfAllowed((t) => {
      blip(t, 698.46, 0.055, "triangle", 0.45); // F5
    });
  }

  function playRefresh() {
    playIfAllowed((t) => {
      blip(t, 440, 0.05, "sine", 0.5);
      blip(t + 0.045, 554.37, 0.07, "sine", 0.55); // C#5
    });
  }

  function playSheetOk() {
    playIfAllowed((t) => {
      blip(t, 392, 0.075, "sine", 0.55);
      blip(t + 0.055, 523.25, 0.085, "sine", 0.6);
      blip(t + 0.11, 659.25, 0.1, "sine", 0.5);
    });
  }

  function playSheetError() {
    playIfAllowed((t) => {
      blip(t, 220, 0.14, "triangle", 0.45);
      blip(t + 0.12, 164.81, 0.16, "triangle", 0.4);
    });
  }

  /** Dois tons ao reativar o som (após setMuted(false)). */
  function playWelcomeUnmute() {
    playIfAllowed((t) => {
      blip(t, 523.25, 0.07, "sine", 0.5);
      blip(t + 0.08, 659.25, 0.09, "sine", 0.45);
    });
  }

  function setMuted(value) {
    muted = Boolean(value);
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    syncToggleButton();
  }

  function isMuted() {
    return muted;
  }

  let toggleBtn = null;

  function syncToggleButton() {
    if (!toggleBtn) return;
    toggleBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    toggleBtn.textContent = muted ? "🔇" : "🔊";
    toggleBtn.setAttribute(
      "aria-label",
      muted ? "Sons desligados — clicar para ativar" : "Sons ligados — clicar para silenciar"
    );
    toggleBtn.title = muted ? "Ativar sons suaves" : "Silenciar sons";
  }

  function initToggle(buttonId) {
    toggleBtn = document.getElementById(buttonId);
    if (!toggleBtn || toggleBtn.dataset.bound) return;
    toggleBtn.dataset.bound = "1";
    syncToggleButton();
    toggleBtn.addEventListener("click", () => {
      if (muted) {
        setMuted(false);
        resume();
        playWelcomeUnmute();
      } else {
        setMuted(true);
        syncToggleButton();
      }
    });
  }

  window.BolaoSounds = {
    playNav,
    playSubTab,
    playRefresh,
    playSheetOk,
    playSheetError,
    setMuted,
    isMuted,
    initToggle,
  };
})();
