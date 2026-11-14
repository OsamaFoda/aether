// The chosen wallpaper tile shows keyboard focus: its selection ring would otherwise hide the
// focus ring, so tabbing onto it changed nothing on screen.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("aether.liquidGlass", true);
const tab = gBrowser.addTrustedTab("about:astrelle");
gBrowser.selectedTab = tab;
await wait(3000);
const doc = tab.linkedBrowser.contentDocument;
const tile = doc.querySelector('#wallpapers [aria-pressed="true"]');
const look = () => {
  const style = doc.defaultView.getComputedStyle(tile);
  return `${style.outline} ${style.outlineOffset} | ${style.boxShadow}`;
};
const unfocused = look();
Services.focus.setFocus(tile, Services.focus.FLAG_BYKEY);
await wait(300);
const focusVisible = tile.matches(":focus-visible");
const focused = look();
return { ok: focusVisible && focused !== unfocused, focusVisible, unfocused, focused };
