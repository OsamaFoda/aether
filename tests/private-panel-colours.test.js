// A private window's sidebar panels are purple like the window, not the chosen colour theme's.
Services.prefs.setStringPref("aether.palette", "sunset");
const wait = ms => new Promise(r => setTimeout(r, ms));
const accent = (w, d) => w.getComputedStyle(d.documentElement).getPropertyValue("--p-accent").trim();
const pw = OpenBrowserWindow({ private: true });
await new Promise(r => pw.addEventListener("load", r, { once: true }));
await wait(1000);
const out = {};
for (const id of ["viewHistorySidebar", "viewBookmarksSidebar"]) {
  await pw.SidebarController.show(id);
  await wait(800);
  const panel = pw.document.getElementById("sidebar").contentDocument;
  out[id] = { window: accent(pw, pw.document), panel: accent(panel.defaultView, panel) };
}
pw.close();
await SidebarController.show("viewHistorySidebar");
await wait(800);
const panel = document.getElementById("sidebar").contentDocument;
out.normal = { window: accent(window, document), panel: accent(panel.defaultView, panel) };
Services.prefs.clearUserPref("aether.palette");
const ok = Object.values(out).every(o => o.window && o.window === o.panel) && out.normal.window !== out.viewHistorySidebar.window;
return { ok, ...out };
