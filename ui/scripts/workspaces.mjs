// Workspaces: separate sets of tabs (Home, Study, …) you switch between, like Zen.
// Each tab remembers its workspace in the session, so it survives restarts; switching shows that
// workspace's tabs and hides the others. Pinned tabs are shared by every workspace. The switcher
// is a toolbar item, so it rides under the address bar in the sidebar, or sits in the top toolbar.
// Right-click a workspace to rename or delete it (its tabs move, they're never closed), and
// right-click a tab for "Move to Workspace".

const { CustomizableUI } = ChromeUtils.importESModule("moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs");
const { SessionStore } = ChromeUtils.importESModule("resource:///modules/sessionstore/SessionStore.sys.mjs");

const LIST = "aether.workspaces"; // [{ id, name }], shared by all windows
const KEY = "aetherWorkspace"; // session value: a tab's workspace, and a window's active one
const WIDGET = "aether-workspaces";

function workspaces() {
  let list = [];
  try {
    list = JSON.parse(Services.prefs.getStringPref(LIST, "[]"));
  } catch {}
  return list.length ? list : [{ id: "home", name: "Home" }];
}

function saveWorkspaces(list) {
  Services.prefs.setStringPref(LIST, JSON.stringify(list));
}

// One widget for all windows. Windows opened later build its node before their scripts run,
// so the node starts empty and each window's controller fills it in. (getWidget can't tell if
// it exists, since it answers for any id, so creating it a second time just throws.)
try {
  CustomizableUI.createWidget({
    id: WIDGET,
    type: "custom",
    label: "Workspaces",
    defaultArea: CustomizableUI.AREA_NAVBAR,
    overflows: false, // always visible, never tucked into the » menu
    onBuild(doc) {
      const item = doc.createXULElement("toolbaritem");
      item.id = WIDGET;
      item.setAttribute("label", "Workspaces");
      item.setAttribute("removable", "true");
      item.setAttribute("overflows", "false"); // custom widgets don't get this from `overflows`
      doc.defaultView.aetherWorkspaces?.render(item);
      return item;
    },
  });
} catch {
  // Already created this session.
}

export function init(win) {
  const { gBrowser } = win;
  const doc = win.document;

  const active = () => {
    const id = SessionStore.getCustomWindowValue(win, KEY);
    return workspaces().some(w => w.id === id) ? id : workspaces()[0].id;
  };
  const workspaceOf = tab => SessionStore.getCustomTabValue(tab, KEY) || null;
  const assign = (tab, id) => SessionStore.setCustomTabValue(tab, KEY, id);
  const tabsIn = id => gBrowser.tabs.filter(t => !t.pinned && workspaceOf(t) === id);

  // Show the active workspace's tabs and hide the rest. Tabs with no (or a deleted)
  // workspace join the active one.
  function apply() {
    const current = active();
    const known = new Set(workspaces().map(w => w.id));
    for (const tab of gBrowser.tabs) {
      if (tab.pinned) continue;
      if (!known.has(workspaceOf(tab))) assign(tab, current);
      if (workspaceOf(tab) === current) gBrowser.showTab(tab);
      else if (!tab.selected) gBrowser.hideTab(tab);
    }
    render();
  }

  function switchTo(id) {
    if (id === active()) return;
    SessionStore.setCustomWindowValue(win, KEY, id);
    const tabs = tabsIn(id);
    tabs.forEach(t => gBrowser.showTab(t));
    // Land on the tab last used there, or a fresh new tab if the workspace is empty.
    const last = tabs.sort((a, b) => b.lastAccessed - a.lastAccessed)[0];
    if (last) gBrowser.selectedTab = last;
    else win.BrowserCommands.openTab();
    apply();
  }

  function moveTabs(tabs, id) {
    for (const tab of tabs) {
      if (tab.pinned) continue;
      if (tab.selected && id !== active()) {
        const next = gBrowser._findTabToBlurTo(tab, tabs);
        if (next) gBrowser.selectedTab = next;
        else win.BrowserCommands.openTab();
      }
      assign(tab, id);
    }
    apply();
  }

  function create() {
    const name = { value: "" };
    if (!Services.prompt.prompt(win, "New workspace", "Name for the new workspace:", name, null, { value: false })) return;
    const label = name.value.trim();
    if (!label) return;
    const id = `ws-${Date.now().toString(36)}`;
    saveWorkspaces([...workspaces(), { id, name: label }]);
    switchTo(id);
  }

  function rename(id) {
    const list = workspaces();
    const ws = list.find(w => w.id === id);
    const name = { value: ws.name };
    if (!Services.prompt.prompt(win, "Rename workspace", "New name:", name, null, { value: false })) return;
    if (!name.value.trim()) return;
    ws.name = name.value.trim();
    saveWorkspaces(list);
  }

  // Deleting moves the workspace's tabs to the first remaining one; nothing is closed.
  function remove(id) {
    const list = workspaces();
    if (list.length < 2) return;
    const heir = list.find(w => w.id !== id);
    const count = tabsIn(id).length;
    const ok = Services.prompt.confirm(win, "Delete workspace",
      `Delete "${list.find(w => w.id === id).name}"? Its ${count} tab${count === 1 ? "" : "s"} will move to "${heir.name}".`);
    if (ok) deleteWorkspace(id);
  }

  function deleteWorkspace(id) {
    const rest = workspaces().filter(w => w.id !== id);
    if (!rest.length) return;
    if (active() === id) SessionStore.setCustomWindowValue(win, KEY, rest[0].id);
    tabsIn(id).forEach(t => assign(t, rest[0].id));
    saveWorkspaces(rest); // every window re-applies through the pref observer
  }

  // The switcher: one button per workspace, then "+".
  function render(item = doc.getElementById(WIDGET)) {
    if (!item) return;
    const current = active();
    const buttons = workspaces().map(ws => {
      const button = doc.createElement("button");
      button.className = "aether-ws";
      button.textContent = ws.name;
      button.title = `${ws.name} (right-click to rename or delete)`;
      button.toggleAttribute("active", ws.id === current);
      button.addEventListener("click", () => switchTo(ws.id));
      button.addEventListener("contextmenu", event => {
        event.preventDefault();
        event.stopPropagation();
        workspaceMenu(ws.id).openPopupAtScreen(event.screenX, event.screenY, true);
      });
      return button;
    });
    const add = doc.createElement("button");
    add.className = "aether-ws aether-ws-add";
    add.textContent = "+";
    add.title = "New workspace";
    add.addEventListener("click", create);
    item.replaceChildren(...buttons, add);
  }

  let menu = null;
  function workspaceMenu(id) {
    menu?.remove();
    menu = doc.createXULElement("menupopup");
    const item = (label, action, disabled = false) => {
      const entry = doc.createXULElement("menuitem");
      entry.setAttribute("label", label);
      if (disabled) entry.setAttribute("disabled", "true");
      entry.addEventListener("command", action);
      menu.append(entry);
    };
    item("Rename…", () => rename(id));
    item("Delete…", () => remove(id), workspaces().length < 2);
    doc.getElementById("mainPopupSet").append(menu);
    return menu;
  }

  // "Move to Workspace" in the tab right-click menu.
  const tabMenu = doc.getElementById("tabContextMenu");
  const moveMenu = doc.createXULElement("menu");
  moveMenu.setAttribute("label", "Move to Workspace");
  const movePopup = doc.createXULElement("menupopup");
  moveMenu.append(movePopup);
  tabMenu?.prepend(moveMenu);
  tabMenu?.addEventListener("popupshowing", event => {
    if (event.target !== tabMenu) return;
    const tab = win.TabContextMenu.contextTab;
    const tabs = tab?.multiselected ? gBrowser.selectedTabs : [tab];
    moveMenu.hidden = !tab || tab.pinned || workspaces().length < 2;
    movePopup.replaceChildren(...workspaces().filter(w => w.id !== workspaceOf(tab)).map(ws => {
      const entry = doc.createXULElement("menuitem");
      entry.setAttribute("label", ws.name);
      entry.addEventListener("command", () => moveTabs(tabs, ws.id));
      return entry;
    }));
  });

  const container = gBrowser.tabContainer;
  // New tabs join the active workspace.
  container.addEventListener("TabOpen", event => {
    if (!workspaceOf(event.target)) assign(event.target, active());
  });
  container.addEventListener("TabUnpinned", event => assign(event.target, active()));
  // Selecting a tab from another workspace (e.g. "Switch to tab" in the address bar) goes there.
  container.addEventListener("TabSelect", event => {
    const ws = workspaceOf(event.target);
    if (!event.target.pinned && ws && ws !== active() && workspaces().some(w => w.id === ws)) {
      SessionStore.setCustomWindowValue(win, KEY, ws);
      apply();
    }
  });
  // A restored tab (reopening a closed tab, or the session after a restart) takes its saved
  // workspace, unless it's being shown right now, in which case it joins the active one.
  container.addEventListener("SSTabRestoring", event => {
    if (event.target.selected && workspaceOf(event.target) !== active()) assign(event.target, active());
    apply();
  });
  win.addEventListener("SSWindowRestored", apply);

  const onListChange = () => apply();
  Services.prefs.addObserver(LIST, onListChange);
  win.addEventListener("unload", () => Services.prefs.removeObserver(LIST, onListChange), { once: true });

  win.aetherWorkspaces = { render, apply, switchTo, moveTabs, active, workspaceOf, create, remove, deleteWorkspace };
  apply();
}
