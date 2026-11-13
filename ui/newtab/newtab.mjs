// Aether's new tab page: a search box, shortcuts (most visited, with pins and removals that
// stick) and today's data use from Sip. This page is part of the browser (chrome://), so it can
// read history and Sip's storage directly; everything it shows from sites is set as text.

const { NewTabUtils } = ChromeUtils.importESModule("resource://gre/modules/NewTabUtils.sys.mjs");
const { ExtensionStorageIDB } = ChromeUtils.importESModule("resource://gre/modules/ExtensionStorageIDB.sys.mjs");
const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
import { follow } from "../scripts/palette.mjs";
import { iconURL } from "../scripts/app-icon.mjs";

const PINNED = "aether.newtab.pinned"; // [{ url, title }]
const HIDDEN = "aether.newtab.hidden"; // [url]
const SHORTCUTS = 8;
const SIP = "sip@osama.local";

const $ = id => document.getElementById(id);

document.querySelector('link[rel="icon"]').href = iconURL(); // the app icon picked in the welcome
const chromeWindow = () => window.browsingContext.topChromeWindow;

function readList(pref) {
  try {
    return JSON.parse(Services.prefs.getStringPref(pref, "[]"));
  } catch {
    return [];
  }
}

function writeList(pref, list) {
  Services.prefs.setStringPref(pref, JSON.stringify(list));
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function open(url, event) {
  const where = event && (event.button === 1 || event.ctrlKey || event.metaKey) ? "tab" : "current";
  chromeWindow().openTrustedLinkIn(url, where);
}

// ---- Search ----

// Firefox's own address-or-search decision, so "node.js tutorial" is a search and
// "localhost:8000" an address, exactly as in the address bar.
function destination(text) {
  const flags = Ci.nsIURIFixup.FIXUP_FLAG_ALLOW_KEYWORD_LOOKUP | Ci.nsIURIFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS;
  return Services.uriFixup.getFixupURIInfo(text, flags).preferredURI.spec;
}

$("search").addEventListener("submit", event => {
  event.preventDefault();
  const text = $("query").value.trim();
  if (text) open(destination(text));
});

// ---- Shortcuts ----

async function shortcuts() {
  const pinned = readList(PINNED);
  const hidden = new Set(readList(HIDDEN));
  const taken = new Set(pinned.map(s => s.url));
  let top = [];
  try {
    top = await NewTabUtils.activityStreamLinks.getTopSites({ numItems: 24 });
  } catch (e) {
    console.error("Aether new tab: top sites", e);
  }
  const visited = top
    .filter(s => s.url && !hidden.has(s.url) && !taken.has(s.url))
    .map(s => ({ url: s.url, title: s.title || hostOf(s.url) }));
  return [...pinned.map(s => ({ ...s, pinned: true })), ...visited].slice(0, SHORTCUTS);
}

async function hasIcon(url) {
  try {
    return Boolean(await PlacesUtils.favicons.getFaviconForPage(Services.io.newURI(url)));
  } catch {
    return false;
  }
}

function togglePin(site) {
  const pinned = readList(PINNED).filter(s => s.url !== site.url);
  if (!site.pinned) pinned.push({ url: site.url, title: site.title });
  writeList(PINNED, pinned);
  renderShortcuts();
}

function remove(site) {
  writeList(PINNED, readList(PINNED).filter(s => s.url !== site.url));
  writeList(HIDDEN, [...new Set([...readList(HIDDEN), site.url])]);
  renderShortcuts();
}

async function renderShortcuts() {
  const sites = await shortcuts();
  const template = $("tile").content;
  $("shortcuts").replaceChildren(...sites.map(site => {
    const tile = template.firstElementChild.cloneNode(true);
    tile.toggleAttribute("pinned", Boolean(site.pinned));

    const link = tile.querySelector(".link");
    link.title = site.url;
    link.addEventListener("click", event => open(site.url, event));
    link.addEventListener("auxclick", event => { if (event.button === 1) open(site.url, event); });

    const icon = tile.querySelector(".icon");
    const letter = tile.querySelector(".letter");
    letter.textContent = (hostOf(site.url)[0] || "?").toUpperCase();
    const showLetter = () => { icon.hidden = true; letter.hidden = false; };
    icon.addEventListener("error", showLetter);
    // Firefox draws a generic globe for sites with no saved icon; show the site's letter instead.
    hasIcon(site.url).then(found => { if (found) icon.src = `page-icon:${site.url}`; else showLetter(); });

    tile.querySelector(".title").textContent = site.title;
    const pin = tile.querySelector(".pin");
    pin.textContent = "📌";
    pin.title = site.pinned ? "Unpin" : "Pin";
    pin.addEventListener("click", () => togglePin(site));
    tile.querySelector(".remove").addEventListener("click", () => remove(site));
    return tile;
  }));
  $("no-shortcuts").hidden = sites.length > 0;
}

// ---- Data use, from Sip ----
// These few helpers follow Sip's lib.js (same dates and units), which can't be imported here.

const MB = 1024 * 1024;
const GB = 1024 * MB;

function dayKey(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function clampedDate(year, month, day) {
  return new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));
}

function billingPeriod(now, resetDay) {
  const day = Math.min(Math.max(Math.round(resetDay) || 1, 1), 31);
  let start = clampedDate(now.getFullYear(), now.getMonth(), day);
  if (now < start) start = clampedDate(now.getFullYear(), now.getMonth() - 1, day);
  const end = clampedDate(start.getFullYear(), start.getMonth() + 1, day);
  return { start, end, daysLeft: Math.max(1, Math.ceil((end - now) / 86400000)) };
}

function formatBytes(n) {
  if (n < 1000) return `${n} B`;
  if (n < 1000 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1000 * MB) return `${(n / MB).toFixed(n < 10 * MB ? 1 : 0)} MB`;
  return `${(n / GB).toFixed(n < 100 * GB ? 2 : 1)} GB`;
}

async function renderData() {
  const policy = WebExtensionPolicy.getByID(SIP);
  if (!policy) return;
  let stored;
  try {
    const db = await ExtensionStorageIDB.open(ExtensionStorageIDB.getStoragePrincipal(policy.extension));
    stored = await db.get(["days", "settings"]);
  } catch (e) {
    console.error("Aether new tab: Sip data", e);
    return;
  }
  const days = stored.days || {};
  const settings = { budgetGB: 0, resetDay: 1, ...stored.settings };
  const now = new Date();
  const today = days[dayKey(now)]?.total || 0;
  const period = billingPeriod(now, settings.resetDay);
  const [from, to] = [dayKey(period.start), dayKey(period.end)];
  const used = Object.entries(days).reduce((sum, [key, day]) => key >= from && key < to ? sum + day.total : sum, 0);
  const budget = settings.budgetGB * GB;

  $("today").textContent = formatBytes(today);
  $("budget").hidden = !budget;
  $("no-budget").hidden = Boolean(budget);
  if (budget) {
    const left = Math.max(0, budget - used);
    const ratio = Math.min(1, used / budget);
    $("bar-fill").style.width = `${ratio * 100}%`;
    $("bar-fill").className = ratio >= 0.9 ? "danger" : ratio >= 0.75 ? "warn" : "";
    $("period").textContent = `${formatBytes(left)} left of ${settings.budgetGB} GB · ${period.daysLeft} days`;
    $("safe").textContent = `Safe today: ${formatBytes(Math.round(Math.max(0, (left + today) / period.daysLeft - today)))}`;
  } else {
    $("period-only").textContent = `This period: ${formatBytes(used)}`;
  }
  $("data").hidden = false;
}

follow(document, window);
renderShortcuts();
renderData();
