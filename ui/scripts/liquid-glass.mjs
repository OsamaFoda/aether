// The Liquid Glass setting: see-through glass, closer to Apple's. The window lets the desktop
// show through the sidebar and toolbar, with clear pills and edges that catch the light; the
// other choice is Standard. Off by default; switch it in the welcome, Astrelle Settings, or "Liquid
// Glass" in the sidebar and toolbar right-click menus. Remembered in the aether.liquidGlass pref.
// The look is in aether.css.

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
    item.setAttribute("label", "Frosted Glass");
    item.addEventListener("command", toggle);
    menu.prepend(item);
    menu.addEventListener("popupshowing", () => {
      item.toggleAttribute("checked", Services.prefs.getBoolPref(PREF, false));
    });
  }

  Services.prefs.addObserver(PREF, update);
  win.addEventListener("unload", () => Services.prefs.removeObserver(PREF, update), { once: true });
  update();
}
