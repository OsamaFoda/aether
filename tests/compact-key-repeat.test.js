// Holding Ctrl+Alt+C a moment too long switches compact mode once, not on and off with every
// repeat of the key.
const wait = ms => new Promise(r => setTimeout(r, ms));
Services.prefs.setBoolPref("aether.compactMode", false);
await wait(500);
const states = [];
for (let i = 0; i < 6; i++) {
  document.documentElement.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ctrlKey: true, altKey: true,
    key: "c", code: "KeyC", repeat: i > 0 }));
  states.push(Services.prefs.getBoolPref("aether.compactMode"));
  await wait(40);
}
Services.prefs.setBoolPref("aether.compactMode", false);
return { ok: states.every(s => s), states };
