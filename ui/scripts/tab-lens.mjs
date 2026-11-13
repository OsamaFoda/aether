// The sliding tab highlight: when you switch tabs, the selected tab's glass slides over from the
// tab you left, stretching a little along the way like a drop of liquid, and settles with a
// spring. It passes over the tabs in between like a lens. Switched off with the aether.tabLens
// pref (in Aether Settings), and still when the computer asks for reduced motion.

const PREF = "aether.tabLens";
// A soft spring, so the slide can be seen: it reaches the new tab a little before half way,
// overshoots it by about 7% and settles (damping 0.65).
const SPRING = `linear(${Array.from({ length: 41 }, (_, i) => {
  const t = i / 40, damping = 0.65, stiffness = 7.1, wobble = stiffness * Math.sqrt(1 - damping ** 2);
  const x = 1 - Math.exp(-damping * stiffness * t) * (Math.cos(wobble * t) + (damping * stiffness / wobble) * Math.sin(wobble * t));
  return i === 40 ? 1 : x.toFixed(4);
}).join(", ")})`;

export function init(win) {
  const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)");

  win.gBrowser.tabContainer.addEventListener("TabSelect", event => {
    if (!Services.prefs.getBoolPref(PREF, true) || reducedMotion.matches) return;
    const from = event.detail?.previousTab;
    const to = event.target;
    // Nothing to slide from if that tab is gone or in another workspace.
    if (!from?.isConnected || from.hidden || from === to) return;
    const start = from.querySelector(".tab-background")?.getBoundingClientRect();
    const glass = to.querySelector(".tab-background");
    const end = glass?.getBoundingClientRect();
    if (!start?.width || !end?.width) return;

    const dx = start.left - end.left;
    const dy = start.top - end.top;
    const distance = Math.hypot(dx, dy);
    if (distance < 1 || distance > 2000) return;

    // Longer trips stretch more, along the way it travels, and thin out across it.
    const stretch = Math.min(1 + distance / 700, 1.3);
    const [midX, midY] = Math.abs(dy) > Math.abs(dx) ? [1 / Math.sqrt(stretch), stretch] : [stretch, 1 / Math.sqrt(stretch)];

    to.setAttribute("aether-lens-moving", "");
    glass.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${start.width / end.width}, ${start.height / end.height})` },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45}px) scale(${midX}, ${midY})`, offset: 0.3 },
      { transform: "none" },
    ], { duration: Math.min(340 + distance * 0.5, 680), easing: SPRING })
      .finished.catch(() => {}).finally(() => to.removeAttribute("aether-lens-moving"));
  });
}
