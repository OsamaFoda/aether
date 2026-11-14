// "When the last tab closes" in Settings follows a change made elsewhere (the welcome, another
// Settings tab, about:config).
const wait = ms => new Promise(r => setTimeout(r, ms));
const tab = gBrowser.addTrustedTab("about:astrelle");
gBrowser.selectedTab = tab;
await wait(2500);
const doc = tab.linkedBrowser.contentDocument;
const pressed = () => doc.querySelector('[data-pref="lastTab"] [aria-pressed="true"]')?.dataset.value;
const before = pressed();
Services.prefs.setBoolPref("browser.tabs.closeWindowWithLastTab", false);
await wait(300);
const after = pressed();
return { ok: before === "close" && after === "keep", before, after };
