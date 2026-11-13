// The Liquid Glass setting: a stronger take on Aether's glass, closer to Apple's. The tab list
// scrolls under a glass address bar, and the glass bends what's behind it more, splitting colours
// a little at the edges. Off by default; switch it with "Liquid Glass" in the sidebar and toolbar
// right-click menus. Remembered in the aether.liquidGlass pref. The look is in aether.css.

const PREF = "aether.liquidGlass";
const MENUS = ["toolbar-context-menu", "sidebar-context-menu"];

export function init(win) {
  const doc = win.document;
  const root = doc.documentElement;

  const update = () => root.toggleAttribute("aether-liquid", Services.prefs.getBoolPref(PREF, false));
  const toggle = () => Services.prefs.setBoolPref(PREF, !Services.prefs.getBoolPref(PREF, false));

  for (const id of MENUS) {
    const menu = doc.getElementById(id);
    if (!menu) continue;
    const item = doc.createXULElement("menuitem");
    item.setAttribute("type", "checkbox");
    item.setAttribute("label", "Liquid Glass");
    item.addEventListener("command", toggle);
    menu.prepend(item);
    menu.addEventListener("popupshowing", () => {
      item.setAttribute("checked", Services.prefs.getBoolPref(PREF, false));
    });
  }

  Services.prefs.addObserver(PREF, update);
  win.addEventListener("unload", () => Services.prefs.removeObserver(PREF, update), { once: true });
  update();
}
