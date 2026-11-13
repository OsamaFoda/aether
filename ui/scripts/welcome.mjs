// On Aether's first launch, opens the welcome page (ui/welcome/), which offers protection
// (uBlock Origin) and Sip. Sip ships inside Aether but stays off until it's chosen there.
// Shown once per profile: the aether.welcome.shown pref remembers it.

const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");

const PREF = "aether.welcome.shown";
const WELCOME = "chrome://aether/content/welcome/welcome.html";
const SIP = "sip@osama.local";

export async function init(win) {
  if (Services.prefs.getBoolPref(PREF, false)) return;
  Services.prefs.setBoolPref(PREF, true); // before anything async, so a second window doesn't open it too

  const sip = await AddonManager.getAddonByID(SIP);
  if (sip?.isActive) await sip.disable();

  win.gBrowser.selectedTab = win.gBrowser.addTrustedTab(WELCOME);
}
