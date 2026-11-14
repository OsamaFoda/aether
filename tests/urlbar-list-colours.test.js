// The address bar's open list is in the theme's colours, and the selected suggestion (the one
// Enter opens) is in the theme's text colour: in Frosted Glass it was white on pale lavender.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("sidebar.verticalTabs", true);
Services.prefs.setBoolPref("browser.search.suggest.enabled", false);
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
  gURLBar.focus();
  gURLBar.search("astrelle test words");
  await wait(1500);
  const title = document.querySelector(".urlbarView-row[selected] .urlbarView-title");
  seen[name] = {
    open: gURLBar.view.isOpen,
    background: getComputedStyle(document.querySelector("#urlbar > .urlbar-background")).backgroundColor,
    themePanel: colour("var(--aether-panel)"),
    selectedText: title && getComputedStyle(title).color,
    themeText: colour("var(--aether-text)"),
  };
  gURLBar.view.close();
  gBrowser.selectedBrowser.focus();
  await wait(300);
}
probe.remove();
const ok = Object.values(seen).every(s => s.open && s.background == s.themePanel && s.selectedText == s.themeText);
return { ok, ...seen };
