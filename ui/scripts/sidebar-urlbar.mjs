// Puts the address bar and navigation buttons at the top of the sidebar while tabs are vertical
// and the sidebar is expanded, like Zen and Arc; otherwise they stay in the top toolbar.
// The moving itself is CSS (styles/aether.css, :root[aether-urlbar-in-sidebar]), so Firefox's
// toolbar and address bar code never sees its elements move. This script only decides when,
// and tells the CSS how wide the sidebar and how tall the toolbar are.

const VERTICAL_TABS = "sidebar.verticalTabs";

export function init(win) {
  const doc = win.document;
  const root = doc.documentElement;
  const container = doc.getElementById("sidebar-container");
  const toolbox = doc.getElementById("navigator-toolbox");
  if (!container || !toolbox) return;

  const update = () => {
    const inSidebar =
      Services.prefs.getBoolPref(VERTICAL_TABS, false) &&
      container.hasAttribute("sidebar-launcher-expanded") &&
      !container.hidden;
    root.toggleAttribute("aether-urlbar-in-sidebar", inSidebar);
  };

  const sizes = new win.ResizeObserver(() => {
    root.style.setProperty("--aether-sidebar-width", `${container.getBoundingClientRect().width}px`);
    root.style.setProperty("--aether-toolbox-height", `${toolbox.getBoundingClientRect().height}px`);
  });
  sizes.observe(container);
  sizes.observe(toolbox);

  new win.MutationObserver(update).observe(container, {
    attributes: true,
    attributeFilter: ["sidebar-launcher-expanded", "hidden"],
  });
  Services.prefs.addObserver(VERTICAL_TABS, update);
  win.addEventListener("unload", () => Services.prefs.removeObserver(VERTICAL_TABS, update), { once: true });
  update();
}
