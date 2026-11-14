// Notification bars (like "pop-up blocked") are in the theme's colours with an accent stripe, in
// both styles; they kept Firefox's white or grey card and its rainbow stripe.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
const box = gBrowser.getNotificationBox();
const bar = await box.appendNotification("aether-test", {
  label: "Astrelle prevented this site from opening a pop-up window.",
  priority: box.PRIORITY_WARNING_MEDIUM,
}, [{ label: "Options", callback: () => true }]);
await wait(800);
const probe = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
document.documentElement.append(probe);
const colour = value => {
  probe.style.color = value;
  return getComputedStyle(probe).color;
};
const seen = {};
for (const [name, liquid] of [["standard", false], ["frosted", true]]) {
  Services.prefs.setBoolPref("aether.liquidGlass", liquid);
  await wait(800);
  const look = getComputedStyle(bar);
  const stripe = getComputedStyle(bar, "::before");
  seen[name] = {
    background: look.backgroundColor,
    themeMenu: colour("var(--aether-menu)"),
    text: look.color,
    themeText: colour("var(--aether-text)"),
    stripe: stripe.backgroundImage.slice(0, 40),
    stripeColour: stripe.backgroundColor,
    accent: colour("var(--aether-accent)"),
  };
}
probe.remove();
box.removeNotification(bar);
const ok = Object.values(seen).every(s => s.background == s.themeMenu && s.text == s.themeText &&
  s.stripe == "none" && s.stripeColour == s.accent);
return { ok, ...seen };
