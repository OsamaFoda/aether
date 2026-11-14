// timeout: 90
// Sip's budget can be removed in Settings (an empty or 0 budget is no budget, as in Sip's own
// options), and the renewal day is saved with no budget too.
const wait = ms => new Promise(r => setTimeout(r, ms));
const { ExtensionStorageIDB } = ChromeUtils.importESModule("resource://gre/modules/ExtensionStorageIDB.sys.mjs");
const stored = async () => {
  const policy = WebExtensionPolicy.getByID("sip@osama.local");
  const db = await ExtensionStorageIDB.open(ExtensionStorageIDB.getStoragePrincipal(policy.extension));
  const { settings } = await db.get(["settings"]);
  return { budgetGB: settings?.budgetGB, resetDay: settings?.resetDay };
};
const tab = gBrowser.addTrustedTab("about:astrelle");
gBrowser.selectedTab = tab;
await wait(3000);
let doc = tab.linkedBrowser.contentDocument;
const type = async (id, value) => {
  const field = doc.getElementById(id);
  field.focus();
  field.value = value;
  field.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
  field.blur();
  await wait(1000);
};
if (!doc.getElementById("sip-on").checked) {
  doc.getElementById("sip-on").click();
  await wait(4500);
}
await type("budget-gb", "42");
const set = await stored();
await type("budget-gb", "");
const cleared = await stored();
await type("budget-gb", "0");
await type("reset-day", "15");
const day = await stored();
tab.linkedBrowser.reload();
await wait(3500);
doc = tab.linkedBrowser.contentDocument;
const field = doc.getElementById("budget-gb").value;
return {
  ok: set.budgetGB === 42 && cleared.budgetGB === 0 && day.budgetGB === 0 && day.resetDay === 15 && field === "",
  set, cleared, day, field,
};
