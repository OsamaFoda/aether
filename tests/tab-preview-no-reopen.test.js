// A tab's hover preview that closed as the mouse left the window doesn't open again when you come
// back: it isn't a menu opened from a button, and nothing would close it then.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("browser.tabs.hoverPreview.enabled", true);
await wait(800);
const tab = gBrowser.addTab("about:blank", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
await wait(1000);
const r = tab.getBoundingClientRect();
const mouse = type => tab.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, clientX: r.left + 40, clientY: r.top + 10, view: window }));
mouse("mouseover");
mouse("mouseenter");
await wait(2000);
const panel = document.getElementById("tab-preview-panel");
const shown = panel.state === "open";
mouse("mouseout");
mouse("mouseleave");
await wait(200);
window.dispatchEvent(new Event("deactivate"));
await wait(1000);
window.dispatchEvent(new Event("activate"));
await wait(1200);
const reopened = panel.state !== "closed";
gBrowser.removeTab(tab);
return { ok: shown && !reopened, shown, reopened };
