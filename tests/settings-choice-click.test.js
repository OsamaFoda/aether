// Clicking a choice in Settings presses it at once (through the preference the page watches),
// including "System" for the theme, which clears its preference rather than setting one.
const wait = ms => new Promise(r => setTimeout(r, ms));
const tab = gBrowser.addTrustedTab("about:astrelle");
gBrowser.selectedTab = tab;
await wait(2500);
const doc = tab.linkedBrowser.contentDocument;
const results = {};
for (const [pref, value] of [["lastTab", "keep"], ["theme", "dark"], ["theme", "system"], ["palette", "ocean"], ["glass", "liquid"], ["layout", "top"]]) {
  doc.querySelector(`[data-pref="${pref}"] [data-value="${value}"]`).click();
  results[`${pref}=${value}`] = doc.querySelector(`[data-pref="${pref}"] [aria-pressed="true"]`)?.dataset.value === value;
}
return { ok: Object.values(results).every(Boolean), results };
