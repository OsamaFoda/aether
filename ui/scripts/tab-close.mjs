// Closing the tab you're on takes you back to the tab you used before it, instead of Firefox's
// choice (the tab that opened it, or the next one in the list). An explicit successor set by a
// Firefox feature or an add-on still wins, and if no other tab has ever been used, Firefox
// chooses as usual.

export function init(win) {
  const gBrowser = win.gBrowser;
  const firefoxChoice = gBrowser._findTabToBlurTo;

  gBrowser._findTabToBlurTo = function (aTab, aExcludeTabs = []) {
    if (!aTab.selected || (aTab.successor && !aExcludeTabs.includes(aTab.successor))) {
      return firefoxChoice.call(this, aTab, aExcludeTabs);
    }
    const exclude = new Set(aExcludeTabs).add(aTab);
    if (win.FirefoxViewHandler?.tab) exclude.add(win.FirefoxViewHandler.tab);

    let previous = null;
    for (const tab of this.visibleTabs) {
      if (exclude.has(tab) || tab.closing) continue;
      if (!previous || tab.lastAccessed > previous.lastAccessed) previous = tab;
    }
    return previous?.lastAccessed > 0 ? previous : firefoxChoice.call(this, aTab, aExcludeTabs);
  };
}
