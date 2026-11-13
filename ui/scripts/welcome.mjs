// On Aether's first launch, opens the welcome page (ui/welcome/), which sets up the look and offers
// protection (uBlock Origin) and Sip. Sip ships inside Aether but stays off until it's chosen
// there. Shown once per profile (the aether.welcome.shown pref); after that, "Customize Aether…"
// in the sidebar and toolbar right-click menus reopens its look-and-feel steps.

const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");

const PREF = "aether.welcome.shown";
const WELCOME = "chrome://aether/content/welcome/welcome.html";
const SIP = "sip@osama.local";
const MENUS = ["toolbar-context-menu", "sidebar-context-menu"];

export async function init(win) {
  const doc = win.document;
  for (const id of MENUS) {
    const menu = doc.getElementById(id);
    if (!menu) continue;
    const item = doc.createXULElement("menuitem");
    item.setAttribute("label", "Customize Aether…");
    item.addEventListener("command", () => {
      win.gBrowser.selectedTab = win.gBrowser.addTrustedTab(`${WELCOME}#customize`);
    });
    menu.prepend(item);
  }

  if (Services.prefs.getBoolPref(PREF, false)) return;
  Services.prefs.setBoolPref(PREF, true); // before anything async, so a second window doesn't open it too

  const sip = await AddonManager.getAddonByID(SIP);
  if (sip?.isActive) await sip.disable();

  win.gBrowser.selectedTab = win.gBrowser.addTrustedTab(WELCOME);
}
