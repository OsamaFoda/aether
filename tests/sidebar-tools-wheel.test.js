// A mouse wheel's notch (line or page units) scrolls the sidebar's tools row by a tool or more, as a touchpad's pixels do.
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1200);
const main = document.querySelector("sidebar-main");
await main.updateComplete;
Services.prefs.setStringPref("sidebar.main.tools", "aichat,syncedtabs,history,bookmarks,passwords");
main.style.width = "150px";
document.getElementById("sidebar-container").style.width = "150px";
await wait(800);
const row = main.shadowRoot.querySelector(".tools-and-extensions");
const rr = row.getBoundingClientRect();
const wheel = async (mode, dy) => {
  row.scrollLeft = 0;
  await wait(150);
  window.windowUtils.sendWheelEvent(rr.left + 10, rr.top + rr.height / 2, 0, dy, 0, mode, 0, 0, mode ? dy : 0, 0);
  await wait(500);
  return Math.round(row.scrollLeft);
};
const out = { overflow: row.scrollWidth - row.clientWidth, pixel: await wheel(0, 40), line: await wheel(1, 3), page: await wheel(2, 1) };
const enough = Math.min(32, out.overflow);
return { ok: out.overflow > 0 && out.pixel >= enough && out.line >= enough && out.page >= enough, ...out };
