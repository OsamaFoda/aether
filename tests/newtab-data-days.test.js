// timeout: 45
// The New Tab page's data card says "1 day", not "1 days", on the last day of Sip's billing period.
// A stand-in add-on with Sip's id holds the data, so the check needs no copy of Sip.
const wait = ms => new Promise(r => setTimeout(r, ms));
const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
const { ExtensionStorageIDB } = ChromeUtils.importESModule("resource://gre/modules/ExtensionStorageIDB.sys.mjs");
const dir = PathUtils.join(PathUtils.profileDir, "sip-stand-in");
await IOUtils.writeJSON(PathUtils.join(dir, "manifest.json"), {
  manifest_version: 2, name: "Sip stand-in", version: "1.0",
  permissions: ["storage"],
  browser_specific_settings: { gecko: { id: "sip@osama.local" } },
});
await AddonManager.installTemporaryAddon(await IOUtils.getFile(dir));
await wait(1000);
const policy = WebExtensionPolicy.getByID("sip@osama.local");
const db = await ExtensionStorageIDB.open(ExtensionStorageIDB.getStoragePrincipal(policy.extension));
const now = new Date();
const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const pad = n => String(n).padStart(2, "0");
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// The period resets tomorrow, so today is its last day.
await db.set({ settings: { budgetGB: 10, resetDay: tomorrow.getDate() }, days: { [key(now)]: { total: 150 * 1024 * 1024 } } });
BrowserCommands.openTab();
await wait(1500);
const doc = gBrowser.selectedBrowser.contentWindow.document;
const period = doc.getElementById("period").textContent;
return { ok: !doc.getElementById("data").hidden && /· 1 day$/.test(period), period };
