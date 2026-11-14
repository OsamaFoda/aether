// Firefox's "Customize sidebar" panel (the gear at the bottom of the sidebar), made to fit Astrelle.
// Its "Expand sidebar on hover" and "Hide tabs and sidebar" are Compact Mode's job here (and
// scripts/compact-mode.mjs keeps the sidebar shown otherwise, so they did nothing), so they make
// way for a Compact mode switch; "Move sidebar to the right" goes, as Astrelle's layout is built
// with the sidebar on the left; and "Manage Astrelle settings" opens Astrelle Settings.
//
// The gear at the bottom of the sidebar opens Astrelle Settings rather than this panel, which is
// reached from there ("Sidebar tools", through window.aetherCustomizeSidebar).

const PAGE = "chrome://browser/content/sidebar/sidebar-customize.html";
const COMPACT = "aether.compactMode";
const STYLE = "chrome://aether/content/styles/customize-sidebar.css";

export function init(win) {
  const sidebar = win.SidebarController;
  for (const name of ["toggle", "show"]) {
    const firefox = sidebar[name];
    sidebar[name] = function (commandID, ...rest) {
      if (commandID === "viewCustomizeSidebar" && !win.aetherCustomizingSidebar) {
        win.switchToTabHavingURI("about:astrelle", true);
        return Promise.resolve();
      }
      return firefox.call(this, commandID, ...rest);
    };
  }
  win.aetherCustomizeSidebar = async () => {
    win.aetherCustomizingSidebar = true;
    try {
      await sidebar.show("viewCustomizeSidebar");
    } finally {
      win.aetherCustomizingSidebar = false;
    }
  };

  // The panel loads in this process, so its events reach the window.
  win.addEventListener("DOMContentLoaded", async event => {
    const doc = event.target;
    if (doc.documentURI !== PAGE) return;
    const view = doc.defaultView;
    await view.customElements.whenDefined("sidebar-customize");
    const panel = doc.querySelector("sidebar-customize");
    await panel.updateComplete;
    const root = panel.shadowRoot;

    // A stylesheet file: the panel's security policy refuses inline styles.
    root.append(Object.assign(doc.createElement("link"), { rel: "stylesheet", href: STYLE }));

    const compact = doc.createElement("moz-checkbox");
    compact.id = "aether-compact-mode";
    compact.setAttribute("label", "Compact mode");
    compact.setAttribute("description", "Hide the sidebar until the mouse reaches the edge of the window (Ctrl+Alt+C)");
    const sync = () => (compact.checked = Services.prefs.getBoolPref(COMPACT, false));
    compact.addEventListener("change", () => Services.prefs.setBoolPref(COMPACT, compact.checked));
    Services.prefs.addObserver(COMPACT, sync);
    view.addEventListener("unload", () => Services.prefs.removeObserver(COMPACT, sync), { once: true });
    sync();
    root.getElementById("vertical-tabs")?.after(compact);

    // Firefox's words name the build's brand, which can still be the old one: say Astrelle.
    const settings = root.querySelector("#manage-settings a");
    if (settings) {
      settings.removeAttribute("data-l10n-id");
      settings.textContent = "Manage Astrelle settings";
    }
    for (const type of ["click", "keydown"]) {
      settings?.addEventListener(type, e => {
        if (type === "keydown" && e.code !== "Enter") return;
        e.preventDefault();
        e.stopImmediatePropagation();
        win.switchToTabHavingURI("about:astrelle", true);
      }, true);
    }
  }, true);
}
