// The sliding tab highlight: when you switch tabs, the selected tab's glass slides over from the
// tab you left, stretching a little along the way like a drop of liquid, and settles. It glides
// beneath the names of the tabs in between. Switched off with the aether.tabLens pref (in Astrelle
// Settings), and still when the computer asks for reduced motion.
//
// The slide and the stretch are two animations (of translate and scale), so the slide follows
// one smooth curve while the stretch swells and relaxes on its own. Neither names an end value:
// each ends on whatever the tab's own style is, so nothing jumps when they finish.

const PREF = "aether.tabLens";
// A soft spring: glides in, overshoots by about 1% and settles (damping 0.82).
const SPRING = `linear(${Array.from({ length: 41 }, (_, i) => {
  const t = i / 40, damping = 0.82, stiffness = 6.1, wobble = stiffness * Math.sqrt(1 - damping ** 2);
  const x = 1 - Math.exp(-damping * stiffness * t) * (Math.cos(wobble * t) + (damping * stiffness / wobble) * Math.sin(wobble * t));
  return i === 40 ? 1 : x.toFixed(4);
}).join(", ")})`;
const SWELL = "cubic-bezier(0.45, 0, 0.55, 1)";

export function init(win) {
  const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)");

  win.gBrowser.tabContainer.addEventListener("TabSelect", event => {
    if (!Services.prefs.getBoolPref(PREF, true) || reducedMotion.matches) return;
    const from = event.detail?.previousTab;
    const to = event.target;
    // Nothing to slide from if that tab is gone or in another workspace.
    if (!from?.isConnected || from.hidden || from === to) return;
    const start = from.querySelector(".tab-background")?.getBoundingClientRect();
    // A tab that's still opening (top tabs) keeps growing, and the scale would grow with it, so
    // its glass starts at its own size.
    const opening = !to.hasAttribute("fadein");
    if (!start?.width) return;

    // Where the tab lands is measured just before the next frame is drawn: right after the switch
    // a new tab can still move to the top of the list (scripts/new-tab-position.mjs), and the tab
    // you closed still takes up its row.
    win.requestAnimationFrame(() => {
      if (!to.selected || !to.isConnected) return;
      const glass = to.querySelector(".tab-background");
      const end = glass?.getBoundingClientRect();
      if (!end?.width) return;

      const dx = start.left - end.left;
      const dy = start.top - end.top;
      const distance = Math.hypot(dx, dy);
      if (distance < 1 || distance > 2000) return;

      // Longer trips stretch more, along the way it travels, and thin out across it.
      const stretch = Math.min(1 + distance / 1200, 1.15);
      const [midX, midY] = Math.abs(dy) > Math.abs(dx) ? [1 / Math.sqrt(stretch), stretch] : [stretch, 1 / Math.sqrt(stretch)];
      const duration = Math.min(380 + distance * 0.35, 620);

      for (const running of glass.getAnimations()) {
        if (running.id === "aether-lens") running.cancel();
      }
      to.setAttribute("aether-lens-moving", "");
      const slide = glass.animate([{ translate: `${dx}px ${dy}px`, offset: 0 }], { id: "aether-lens", duration, easing: SPRING });
      glass.animate([
        { scale: opening ? "1 1" : `${start.width / end.width} ${start.height / end.height}`, easing: SWELL },
        { scale: `${midX} ${midY}`, offset: 0.4, easing: SWELL },
      ], { id: "aether-lens", duration: duration * 0.9 });
      slide.finished.catch(() => {}).finally(() => {
        if (!glass.getAnimations().some(a => a.id === "aether-lens" && a.playState === "running")) {
          to.removeAttribute("aether-lens-moving");
        }
      });
    });
  });
}
