// A "Split View" toolbar button for Firefox's own split view: click it to put a second tab beside
// the current one (you pick it from your open tabs, or type an address), and click it again to
// separate them. Also Ctrl+Alt+S. Firefox only offers this from the tab right-click menu.

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

  // Light the button up while the current tab is in a split view.
  const update = () => {
    doc.getElementById(WIDGET)?.toggleAttribute("checked", Boolean(gBrowser.selectedTab?.splitview));
  };
  for (const type of ["TabSelect", "SplitViewCreated", "SplitViewRemoved", "TabSplitViewActivate", "TabSplitViewDeactivate"]) {
    win.addEventListener(type, () => win.setTimeout(update, 0), true);
  }

  win.addEventListener("keydown", event => {
    if (event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey && event.code === "KeyS") {
      event.preventDefault();
      toggle(win);
    }
  }, true);
  update();
}
