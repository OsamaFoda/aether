// A "Split View" toolbar button for Firefox's own split view: click it to put a second tab beside
// the current one, and click it again to separate them. Also Ctrl+Alt+S. Firefox only offers this
// from the tab right-click menu. The new tab is Astrelle's New Tab page, rather than Firefox's own
// page for it, which doesn't look like Astrelle (the address bar still finds your open tabs).

const { CustomizableUI } = ChromeUtils.importESModule("moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs");

const WIDGET = "aether-split-view";

function toggle(win) {
  if (win.gBrowser.selectedTab?.splitview) win.BrowserCommands.separateTabSplitView();
  else win.BrowserCommands.addTabSplitView();
}

try {
  CustomizableUI.createWidget({
    id: WIDGET,
    label: "Split View",
    tooltiptext: "Split View: show two tabs side by side (Ctrl+Alt+S)",
    defaultArea: CustomizableUI.AREA_NAVBAR,
    overflows: false, // always visible, never tucked into the » menu
    onCreated(node) {
      node.setAttribute("overflows", "false");
    },
    onCommand(event) {
      toggle(event.target.ownerDocument.defaultView);
    },
  });
} catch {
  // Already created this session.
}

export function init(win) {
  const { gBrowser } = win;
  const doc = win.document;

  // Firefox's command (browser-commands.js), opening the New Tab page instead of about:opentabs.
  win.BrowserCommands.addTabSplitView = () => {
    const tab = gBrowser.selectedTab;
    if (!tab || tab.hidden || tab.pinned || tab.splitview) return;
    const newTab = gBrowser.addTrustedTab(win.BROWSER_NEW_TAB_URL);
    gBrowser.addTabSplitView([tab, newTab], { insertBefore: tab, trigger: "keyboard_shortcut" });
    gBrowser.selectedTab = newTab;
  };

  // Light the button up while the current tab is in a split view.
  const update = () => {
    doc.getElementById(WIDGET)?.toggleAttribute("checked", Boolean(gBrowser.selectedTab?.splitview));
  };
  // The strip split view puts under a pane, showing its address, is left off Astrelle's own pages,
  // as Firefox leaves it off its own page for picking the second tab (styles/aether.css),
  // rather than reading "chrome resource".
  const ownPage = /^(about:(newtab|home|aether)|chrome:\/\/aether\/)/;
  const tidyFooters = () => {
    for (const footer of doc.querySelectorAll("split-view-footer")) {
      const uri = footer.parentNode.querySelector("browser")?.currentURI?.spec ?? "";
      footer.toggleAttribute("aether-own-page", ownPage.test(uri));
    }
  };
  gBrowser.addTabsProgressListener({ onLocationChange: () => win.setTimeout(tidyFooters, 0) });

  for (const type of ["TabSelect", "SplitViewCreated", "SplitViewRemoved", "TabSplitViewActivate", "TabSplitViewDeactivate"]) {
    win.addEventListener(type, () => win.setTimeout(() => (update(), tidyFooters()), 0), true);
  }

  win.addEventListener("keydown", event => {
    if (event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey && event.code === "KeyS") {
      event.preventDefault();
      toggle(win);
    }
  }, true);
  update();
}
