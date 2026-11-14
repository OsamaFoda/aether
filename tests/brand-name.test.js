// timeout: 60
// Firefox's own words name the browser Astrelle, even in a build still branded with the old name
// "Aether": window titles and the label Astrelle's own pages show in the address bar. (Not yet the
// private window's page: it's localized in a content process, which can't read ui/.)
const wait = ms => new Promise(r => setTimeout(r, ms));
const system = Services.scriptSecurityManager.getSystemPrincipal();
const tab = gBrowser.selectedTab = gBrowser.addTab("about:astrelle", { triggeringPrincipal: system });
await wait(2000);
const windowTitle = document.title;
const pageLabel = document.getElementById("identity-icon-label").value;
gBrowser.removeTab(tab);
const other = OpenBrowserWindow({ private: true });
await new Promise(r => other.addEventListener("load", r, { once: true }));
await wait(2500);
const privateTitle = other.document.title;
const browser = other.gBrowser.selectedBrowser;
const privatePage = await new Promise(resolve => {
  browser.messageManager.addMessageListener("text", m => resolve(m.data));
  browser.messageManager.loadFrameScript("data:,sendAsyncMessage('text', content.document.body.innerText)", false);
  setTimeout(() => resolve(""), 5000);
});
other.close();
const says = text => /Astrelle/.test(text) && !/Aether/.test(text);
return {
  ok: says(windowTitle) && says(pageLabel) && says(privateTitle),
  windowTitle,
  pageLabel,
  privateTitle,
  privatePage: privatePage.match(/[^.\n]*(Aether|Astrelle)[^.\n]*/)?.[0] ?? privatePage.slice(0, 120),
};
