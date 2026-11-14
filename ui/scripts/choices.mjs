// Astrelle's settings as the welcome and the Settings page (about:astrelle) change them. Each choice
// is a preference, applied the moment it's picked. Also the two add-ons they can turn on:
// protection (uBlock Origin, downloaded from Mozilla's add-on site) and Sip (built in), whose
// budget is written into Sip's own storage, as its options page would.

const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
const { ExtensionPermissions } = ChromeUtils.importESModule("resource://gre/modules/ExtensionPermissions.sys.mjs");
const { ExtensionStorageIDB } = ChromeUtils.importESModule("resource://gre/modules/ExtensionStorageIDB.sys.mjs");
import { chosen as chosenIcon } from "./app-icon.mjs";

const DARK = "ui.systemUsesDarkTheme";
const UBLOCK = "uBlock0@raymondhill.net";
const SIP = "sip@osama.local";
// Where protection comes from; a pref so tests can point it at a local file.
const UBLOCK_URL = Services.prefs.getStringPref("aether.welcome.protectionURL",
  "https://addons.mozilla.org/firefox/downloads/latest/ublock-origin/latest.xpi");

// The choices shown as a row of buttons: value <-> preference.
export const CHOICES = {
  theme: {
    get: () => !Services.prefs.prefHasUserValue(DARK) ? "system" : Services.prefs.getIntPref(DARK) ? "dark" : "light",
    set: value => value === "system" ? Services.prefs.clearUserPref(DARK) : Services.prefs.setIntPref(DARK, value === "dark" ? 1 : 0),
  },
  layout: {
    get: () => Services.prefs.getBoolPref("sidebar.verticalTabs", true) ? "sidebar" : "top",
    set: value => Services.prefs.setBoolPref("sidebar.verticalTabs", value === "sidebar"),
  },
  glass: {
    get: () => Services.prefs.getBoolPref("aether.liquidGlass", false) ? "liquid" : "glass",
    set: value => Services.prefs.setBoolPref("aether.liquidGlass", value === "liquid"),
  },
  palette: {
    get: () => Services.prefs.getStringPref("aether.palette", "nebula"),
    set: value => Services.prefs.setStringPref("aether.palette", value),
  },
  icon: {
    get: chosenIcon,
    set: value => Services.prefs.setStringPref("aether.appIcon", value),
  },
  background: {
    get: () => Services.prefs.getStringPref("aether.background", "wallpaper") === "desktop" ? "desktop" : "wallpaper",
    set: value => Services.prefs.setStringPref("aether.background", value),
  },
  lastTab: {
    get: () => Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab", true) ? "close" : "keep",
    set: value => Services.prefs.setBoolPref("browser.tabs.closeWindowWithLastTab", value === "close"),
  },
  newTabs: {
    get: () => Services.prefs.getStringPref("aether.newTabsAt", "top") === "bottom" ? "bottom" : "top",
    set: value => Services.prefs.setStringPref("aether.newTabsAt", value),
  },
};

// "on", "off", or "missing" (not installed).
async function state(id) {
  const addon = await AddonManager.getAddonByID(id);
  return !addon ? "missing" : addon.isActive ? "on" : "off";
}

export const protectionState = () => state(UBLOCK);
export const sipState = () => state(SIP);

export async function setProtection(on) {
  const existing = await AddonManager.getAddonByID(UBLOCK);
  if (!on) {
    await existing?.disable();
    return;
  }
  if (existing) {
    if (!existing.isActive) await existing.enable();
    return;
  }
  const install = await AddonManager.getInstallForURL(UBLOCK_URL, { telemetryInfo: { source: "aether-welcome" } });
  const addon = await new Promise((resolve, reject) => {
    install.addListener({
      onInstallEnded: (_, installed) => resolve(installed),
      onDownloadFailed: () => reject(new Error("download")),
      onInstallFailed: () => reject(new Error("install")),
      onDownloadCancelled: () => reject(new Error("cancelled")),
      onInstallCancelled: () => reject(new Error("cancelled")),
    });
    install.install();
  });
  // Protect private windows too.
  await ExtensionPermissions.add(addon.id, { permissions: ["internal:privateBrowsingAllowed"], origins: [] });
}

export async function setSip(on) {
  const addon = await AddonManager.getAddonByID(SIP);
  if (!addon) return;
  if (on && !addon.isActive) await addon.enable();
  if (!on && addon.isActive) await addon.disable();
}

async function sipStorage() {
  const policy = WebExtensionPolicy.getByID(SIP);
  return policy && ExtensionStorageIDB.open(ExtensionStorageIDB.getStoragePrincipal(policy.extension));
}

// Sip writes its default settings the first time it starts. Wait for them (up to 3 seconds), so
// they can't land on top of a budget written just before.
async function sipSettings(db) {
  for (let tries = 0; tries < 30; tries++) {
    const { settings } = await db.get(["settings"]);
    if (settings) return settings;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return {};
}

// { budgetGB, resetDay } from Sip's settings, while Sip is on.
export async function readSipBudget() {
  const db = await sipStorage();
  if (!db) return {};
  const settings = await sipSettings(db);
  return { budgetGB: settings.budgetGB, resetDay: settings.resetDay };
}

export async function saveSipBudget(budgetGB, resetDay) {
  resetDay = Math.min(Math.max(Math.round(Number(resetDay)) || 1, 1), 31);
  if (!(budgetGB > 0)) return;
  const db = await sipStorage();
  if (!db) return;
  const settings = await sipSettings(db);
  const changes = await db.set({ settings: { ...settings, budgetGB, resetDay } });
  if (changes) ExtensionStorageIDB.notifyListeners(SIP, changes);
}
