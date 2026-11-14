// The Customize sidebar panel's settings link says Astrelle, not the build's internal brand name.
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
const wait = ms => new Promise(r => setTimeout(r, ms));
await window.aetherCustomizeSidebar();
let text = "";
for (let i = 0; i < 40 && !text; i++) {
  await wait(100);
  const panel = document.getElementById("sidebar")?.contentDocument?.querySelector("sidebar-customize");
  text = panel?.shadowRoot?.querySelector("#manage-settings a")?.textContent.trim() ?? "";
}
await wait(1000);
const panel = document.getElementById("sidebar").contentDocument.querySelector("sidebar-customize");
text = panel.shadowRoot.querySelector("#manage-settings a").textContent.trim();
SidebarController.hide();
return { ok: text === "Manage Astrelle settings", text };
