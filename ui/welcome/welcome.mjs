// Aether's welcome (opened once, on first run, by scripts/welcome.mjs). It walks through light or
// dark, colours, the app icon, layout, glass, what closing the last tab does, protection
// (installs uBlock Origin from Mozilla's add-on site) and Sip (the built-in data saver, off
// unless chosen). Every choice applies at once, and the illustration on the right follows it.
// All of it can be changed later in Aether Settings (about:aether, settings/), which shares the
// choices in scripts/choices.mjs.

import { follow } from "../scripts/palette.mjs";
import { iconURL } from "../scripts/app-icon.mjs";
import { CHOICES, setProtection, setSip, saveSipBudget } from "../scripts/choices.mjs";

const NEW_TAB = "chrome://aether/content/newtab/newtab.html";

const $ = id => document.getElementById(id);
const flow = [...document.querySelectorAll(".step")].map(step => step.dataset.step);
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

// ---- Look and feel ----

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
  const icon = iconURL(CHOICES.icon.get());
  document.querySelector('link[rel="icon"]').href = icon;
  for (const img of document.querySelectorAll(".orb, #icon-hero, #icon-dock")) {
    if (img.src === icon) continue;
    img.src = icon;
    if (img.id) pop(img);
  }
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

$("protection-on").addEventListener("click", async () => {
  const step = $("protection-on").closest(".step");
  const status = $("protection-status");
  const buttons = step.querySelectorAll("button");
  buttons.forEach(b => (b.disabled = true));
  status.hidden = false;
  status.className = "status";
  status.textContent = "Downloading and turning on…";
  try {
    await setProtection(true);
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

for (const [id, on] of [["sip-on", true], ["sip-off", false]]) {
  $(id).addEventListener("click", async () => {
    const step = $(id).closest(".step");
    step.querySelectorAll("button").forEach(b => (b.disabled = true));
    try {
      await setSip(on);
      if (on) await saveSipBudget(Number($("budget-gb").value), $("reset-day").value);
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
  const on = [chosen.protection && "Protection", chosen.sip && "Sip"].filter(Boolean);
  $("summary").textContent = on.length
    ? `${on.join(" and ")} ${on.length > 1 ? "are" : "is"} on. You can change this any time in Aether Settings.`
    : "You can turn on protection or Sip any time in Aether Settings.";
}

$("start").addEventListener("click", () => {
  window.browsingContext.topChromeWindow.openTrustedLinkIn(NEW_TAB, "current");
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

document.querySelectorAll(".step h1").forEach(splitWords);
decorate();
refresh();
show(flow[0]);
