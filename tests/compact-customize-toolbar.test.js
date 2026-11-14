// timeout: 90
// Customize Toolbar in compact mode shows the toolbar being customized, where it is with compact
// mode off, so there's somewhere to drag buttons to.
const wait = ms => new Promise(r => setTimeout(r, ms));
const rect = () => {
  const r = document.getElementById("nav-bar").getBoundingClientRect();
  return [r.left, r.top, r.right, r.bottom].map(Math.round);
};
const customized = async () => {
  const entered = new Promise(r => window.addEventListener("customizationready", r, { once: true }));
  gCustomizeMode.enter();
  await entered;
  await wait(1500);
  const navBar = rect();
  const exited = new Promise(r => window.addEventListener("aftercustomization", r, { once: true }));
  gCustomizeMode.exit();
  await exited;
  await wait(1000);
  return navBar;
};
const result = { ok: true };
for (const vertical of [true, false]) {
  Services.prefs.setBoolPref("sidebar.verticalTabs", vertical);
  const r = {};
  for (const compact of [false, true]) {
    Services.prefs.setBoolPref("aether.compactMode", compact);
    await wait(1500);
    r[compact ? "compact" : "off"] = await customized();
  }
  result[vertical ? "vertical" : "top"] = r;
  result.ok &&= r.compact.join() === r.off.join();
}
Services.prefs.setBoolPref("aether.compactMode", false);
return result;
