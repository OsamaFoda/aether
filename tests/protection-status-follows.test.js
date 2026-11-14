// Protection's status line in Settings doesn't contradict the switch once protection is turned on
// or off elsewhere (the Add-ons page, another Settings tab). A local stand-in add-on with uBlock
// Origin's id, so nothing is downloaded.
const wait = ms => new Promise(r => setTimeout(r, ms));
const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
const { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");
const dir = PathUtils.join(PathUtils.profileDir, "stand-in");
await IOUtils.makeDirectory(dir);
await IOUtils.writeUTF8(PathUtils.join(dir, "manifest.json"), JSON.stringify({
  manifest_version: 2, name: "stand-in", version: "1", browser_specific_settings: { gecko: { id: "uBlock0@raymondhill.net" } },
}));
const addon = await AddonManager.installTemporaryAddon(new FileUtils.File(dir));
const tab = gBrowser.addTrustedTab("about:astrelle");
gBrowser.selectedTab = tab;
await wait(3000);
const doc = tab.linkedBrowser.contentDocument;
const shown = () => {
  const status = doc.getElementById("protection-status");
  return { on: doc.getElementById("protection-on").checked, status: status.hidden ? null : status.textContent };
};
doc.getElementById("protection-on").click();
await wait(1500);
const here = shown();
await addon.enable();
await wait(1000);
const elsewhere = shown();
return {
  ok: here.status === "Protection is off" && elsewhere.on && elsewhere.status !== "Protection is off",
  here, elsewhere,
};
