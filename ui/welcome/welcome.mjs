// Aether's welcome (opened once by scripts/welcome.mjs, and again from "Customize Aether…").
// First run walks through light or dark, layout, glass, colours, protection (installs uBlock
// Origin from Mozilla's add-on site) and Sip (the built-in data saver, off unless chosen).
// Opened as welcome.html#customize it shows only the look-and-feel steps. Every choice applies
// at once. This page is part of the browser (chrome://), so it can set preferences, install
// add-ons and write Sip's settings directly.

const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
const { ExtensionPermissions } = ChromeUtils.importESModule("resource://gre/modules/ExtensionPermissions.sys.mjs");
const { ExtensionStorageIDB } = ChromeUtils.importESModule("resource://gre/modules/ExtensionStorageIDB.sys.mjs");
import { follow } from "../scripts/palette.mjs";

const UBLOCK = "uBlock0@raymondhill.net";
const SIP = "sip@osama.local";
// Where protection comes from; a pref so tests can point it at a local file.
const UBLOCK_URL = Services.prefs.getStringPref("aether.welcome.protectionURL",
  "https://addons.mozilla.org/firefox/downloads/latest/ublock-origin/latest.xpi");
const NEW_TAB = "chrome://aether/content/newtab/newtab.html";
const DARK = "ui.systemUsesDarkTheme";

const $ = id => document.getElementById(id);
const customizing = location.hash === "#customize";
const flow = customizing
  ? ["theme", "layout", "glass", "colors", "done"]
  : [...document.querySelectorAll(".step")].map(step => step.dataset.step);
const chosen = { protection: false, sip: false };

follow(document, window);

// ---- Moving between steps ----

const dots = document.querySelector(".dots");
dots.replaceChildren(...flow.map(() => document.createElement("span")));

function show(name) {
  for (const step of document.querySelectorAll(".step")) step.hidden = step.dataset.step !== name;
  [...dots.children].forEach((dot, i) => dot.toggleAttribute("current", flow[i] === name));
  if (name === "done") summarize();
}

function next(from) {
  show(flow[flow.indexOf(from.dataset.step) + 1]);
}

for (const button of document.querySelectorAll("[data-next]")) {
  button.addEventListener("click", () => next(button.closest(".step")));
}

// ---- Look and feel: each choice is a preference, applied as soon as it's picked ----

const CHOICES = {
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
};

function refresh() {
  for (const group of document.querySelectorAll("[data-pref]")) {
    const current = CHOICES[group.dataset.pref].get();
    for (const button of group.querySelectorAll("[data-value]")) {
      button.setAttribute("aria-pressed", button.dataset.value === current);
    }
  }
  $("glass-demo").toggleAttribute("liquid", CHOICES.glass.get() === "liquid");
  $("compact").checked = Services.prefs.getBoolPref("aether.compactMode", false);
}

for (const group of document.querySelectorAll("[data-pref]")) {
  for (const button of group.querySelectorAll("[data-value]")) {
    button.addEventListener("click", () => {
      CHOICES[group.dataset.pref].set(button.dataset.value);
      refresh();
    });
  }
}

$("compact").addEventListener("change", event => Services.prefs.setBoolPref("aether.compactMode", event.target.checked));

// ---- Protection: uBlock Origin ----

async function installProtection() {
  const existing = await AddonManager.getAddonByID(UBLOCK);
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

$("protection-on").addEventListener("click", async () => {
  const step = $("protection-on").closest(".step");
  const status = $("protection-status");
  const buttons = step.querySelectorAll("button");
  buttons.forEach(b => (b.disabled = true));
  status.hidden = false;
  status.className = "status";
  status.textContent = "Downloading and turning on…";
  try {
    await installProtection();
    chosen.protection = true;
    status.textContent = "Protection is on ✓";
    setTimeout(() => next(step), 700);
  } catch (e) {
    console.error("Aether welcome: protection", e);
    status.className = "status error";
    status.textContent = "Couldn't download it. Check your connection and try again, or skip for now.";
    buttons.forEach(b => (b.disabled = false));
  }
});

// ---- Sip ----

async function setSip(on) {
  const addon = await AddonManager.getAddonByID(SIP);
  if (!addon) return;
  if (on && !addon.isActive) await addon.enable();
  if (!on && addon.isActive) await addon.disable();
  if (on) await saveBudget();
}

// Writes the budget into Sip's own settings, as its options page would, and tells Sip.
async function saveBudget() {
  const budgetGB = Number($("budget-gb").value);
  const resetDay = Math.min(Math.max(Math.round(Number($("reset-day").value)) || 1, 1), 31);
  if (!(budgetGB > 0)) return;
  const policy = WebExtensionPolicy.getByID(SIP);
  if (!policy) return;
  const db = await ExtensionStorageIDB.open(ExtensionStorageIDB.getStoragePrincipal(policy.extension));
  const { settings = {} } = await db.get(["settings"]);
  const changes = await db.set({ settings: { ...settings, budgetGB, resetDay } });
  if (changes) ExtensionStorageIDB.notifyListeners(SIP, changes);
}

for (const [id, on] of [["sip-on", true], ["sip-off", false]]) {
  $(id).addEventListener("click", async () => {
    const step = $(id).closest(".step");
    step.querySelectorAll("button").forEach(b => (b.disabled = true));
    try {
      await setSip(on);
      chosen.sip = on;
    } catch (e) {
      console.error("Aether welcome: Sip", e);
    }
    next(step);
  });
}

// ---- Done ----

function summarize() {
  if (customizing) {
    $("summary").textContent = "Your changes are saved.";
    return;
  }
  const on = [chosen.protection && "Protection", chosen.sip && "Sip"].filter(Boolean);
  $("summary").textContent = on.length
    ? `${on.join(" and ")} ${on.length > 1 ? "are" : "is"} on. You can change this any time in Add-ons (Ctrl+Shift+A).`
    : "You can turn on protection or Sip any time in Add-ons (Ctrl+Shift+A).";
}

$("start").addEventListener("click", () => {
  const win = window.browsingContext.topChromeWindow;
  const tab = win.gBrowser.getTabForBrowser(window.browsingContext.embedderElement);
  if (customizing && tab && win.gBrowser.tabs.length > 1) win.gBrowser.removeTab(tab);
  else win.openTrustedLinkIn(NEW_TAB, "current");
});

if (customizing) {
  document.title = "Customize Aether";
  document.querySelector('[data-step="done"] h1').textContent = "All done";
  $("start").textContent = "Done";
}

refresh();
show(flow[0]);
