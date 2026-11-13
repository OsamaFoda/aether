// Aether's welcome (opened once by scripts/welcome.mjs, and again from "Customize Aether…").
// First run walks through light or dark, colours, layout, glass, protection (installs uBlock
// Origin from Mozilla's add-on site) and Sip (the built-in data saver, off unless chosen).
// Opened as welcome.html#customize it shows only the look-and-feel steps. Every choice applies
// at once, and the illustration on the right follows it. This page is part of the browser
// (chrome://), so it can set preferences, install add-ons and write Sip's settings directly.

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
  ? ["theme", "colors", "layout", "glass", "done"]
  : [...document.querySelectorAll(".step")].map(step => step.dataset.step);
const chosen = { protection: false, sip: false };

follow(document, window);

// ---- Moving between steps ----

const stage = $("stage");
const back = $("back");
const dots = document.querySelector(".dots");
const scenes = [...document.querySelectorAll(".scene")];
dots.replaceChildren(...flow.map(() => document.createElement("span")));
let current = null;

// The leaving step slides and blurs away while the next one springs in from the other side;
// the illustrations for the step crossfade on the right.
function show(name, dir = "forward") {
  const incoming = document.querySelector(`.step[data-step="${name}"]`);
  if (incoming === current) return;
  stage.dataset.dir = dir;
  if (current) {
    const leaving = current;
    leaving.setAttribute("leaving", "");
    setTimeout(() => {
      leaving.removeAttribute("leaving");
      if (leaving !== current) leaving.hidden = true;
    }, 300);
  }
  incoming.removeAttribute("leaving");
  incoming.hidden = false;
  current = incoming;

  const index = flow.indexOf(name);
  [...dots.children].forEach((dot, i) => {
    dot.toggleAttribute("current", i === index);
    dot.toggleAttribute("seen", i < index);
  });
  back.hidden = index === 0 || name === "done";
  for (const scene of scenes) scene.toggleAttribute("active", scene.dataset.scenes.split(" ").includes(name));
  // The orbiting planets are SVG animations, which CSS can't pause: run them only while seen.
  const orbits = document.querySelector(".orbits");
  if (name === "hello" && !matchMedia("(prefers-reduced-motion: reduce)").matches) orbits.unpauseAnimations();
  else orbits.pauseAnimations();
  if (name === "done") summarize();
}

function next(from) {
  show(flow[flow.indexOf(from.dataset.step) + 1]);
}

for (const button of document.querySelectorAll("[data-next]")) {
  button.addEventListener("click", () => next(button.closest(".step")));
}

back.addEventListener("click", () => show(flow[flow.indexOf(current.dataset.step) - 1], "back"));

// A quick spring on whatever was just picked.
function pop(element) {
  element.classList.remove("pop");
  void element.offsetWidth;
  element.classList.add("pop");
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
    const value = CHOICES[group.dataset.pref].get();
    for (const button of group.querySelectorAll("[data-value]")) {
      button.setAttribute("aria-pressed", button.dataset.value === value);
    }
  }
  const compact = Services.prefs.getBoolPref("aether.compactMode", false);
  const liquid = CHOICES.glass.get() === "liquid";
  $("compact").checked = compact;
  $("glass-demo").toggleAttribute("liquid", liquid);
  const preview = $("pv");
  preview.dataset.layout = CHOICES.layout.get();
  preview.toggleAttribute("compact", compact);
  preview.toggleAttribute("liquid", liquid);
  $("theme-badge").dataset.theme = CHOICES.theme.get();
}

for (const group of document.querySelectorAll("[data-pref]")) {
  for (const button of group.querySelectorAll("[data-value]")) {
    button.addEventListener("click", () => {
      CHOICES[group.dataset.pref].set(button.dataset.value);
      pop(button);
      refresh();
    });
  }
}

$("compact").addEventListener("change", event => {
  Services.prefs.setBoolPref("aether.compactMode", event.target.checked);
  refresh();
});

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
    $("protect-scene").setAttribute("on", "");
    status.textContent = "Protection is on ✓";
    setTimeout(() => next(step), 900);
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
    step.querySelectorAll("button").forEach(b => (b.disabled = false));
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

// ---- Decoration ----

// Headings appear word by word.
function splitWords(heading) {
  const words = heading.textContent.trim().split(/\s+/);
  heading.replaceChildren(...words.flatMap((text, i) => {
    const word = document.createElement("span");
    word.className = "word";
    word.style.setProperty("--w", i);
    word.textContent = text;
    return i ? [" ", word] : [word];
  }));
}

function decorate() {
  const colours = ["var(--p-glow-1)", "var(--p-glow-2)", "var(--p-glow-3)", "var(--p-accent)"];
  const make = (className, style) => {
    const element = document.createElement("i");
    if (className) element.className = className;
    element.style.cssText = style;
    return element;
  };

  // Stars scattered evenly-but-not-quite around the orb.
  document.querySelector(".stars").replaceChildren(...Array.from({ length: 18 }, (_, i) =>
    make("", `--x: ${(i * 37 + 11) % 94 + 2}%; --y: ${(i * 53 + 7) % 90 + 4}%; --s: ${2 + (i % 3)}px; --d: ${(i * 0.37) % 3}s`)));

  // Feed cards for the glass demo, twice over so the scroll loops without a seam.
  const cards = Array.from({ length: 8 }, (_, i) => {
    const card = make("card", `--c: ${colours[i % 4]}`);
    card.append(document.createElement("b"), document.createElement("span"));
    return card;
  });
  $("feed").replaceChildren(...cards, ...cards.map(card => card.cloneNode(true)));

  // Sparkles for the end, a ring of them in the theme's colours.
  document.querySelector(".sparks").replaceChildren(...Array.from({ length: 14 }, (_, i) =>
    make(i % 2 ? "square" : "", `--a: ${i * (360 / 14)}deg; --r: ${150 + (i % 3) * 32}px; --c: ${colours[i % 4]}`)));
}

if (customizing) {
  document.title = "Customize Aether";
  document.querySelector('[data-step="done"] h1').textContent = "All done";
  document.querySelector('[data-step="done"] .eyebrow').textContent = "Saved";
  $("start").textContent = "Done";
}

document.querySelectorAll(".step h1").forEach(splitWords);
decorate();
refresh();
show(flow[0]);
