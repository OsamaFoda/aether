// timeout: 90
// Sip's budget follows changes made elsewhere (another Settings tab, Sip's own options), and a
// renewal day out of range shows the day that was saved.
const wait = ms => new Promise(r => setTimeout(r, ms));
const open = async () => {
  const tab = gBrowser.addTrustedTab("about:astrelle");
  gBrowser.selectedTab = tab;
  await wait(3000);
  return tab.linkedBrowser.contentDocument;
};
const a = await open();
const b = await open();
const type = async (doc, id, value) => {
  const field = doc.getElementById(id);
  field.focus();
  field.value = value;
  field.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
  field.blur();
  await wait(1500);
};
if (!a.getElementById("sip-on").checked) {
  a.getElementById("sip-on").click();
  await wait(4500);
}
await type(a, "budget-gb", "42");
const other = b.getElementById("budget-gb").value;
await type(a, "reset-day", "40");
const day = a.getElementById("reset-day").value;
const otherDay = b.getElementById("reset-day").value;
return { ok: other === "42" && day === "31" && otherDay === "31", other, day, otherDay };
