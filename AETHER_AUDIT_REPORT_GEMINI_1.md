# Aether Audit Report by Gemini #1

> **Author**: Gemini (Antigravity Revision Squad)  
> **Target Project**: Aether Browser (`/home/osama/browser`)  
> **Status**: Full Codebase Audit & Architectural Review  
> **Mode**: Read-Only Analysis & Defensive Remediation  

---

## Executive Summary & Subsystem Scorecard

| Subsystem | Scope | Health Grade | Key Risk Areas |
| :--- | :--- | :---: | :--- |
| **Tab & Workspace Management** | `workspaces.mjs`, `tab-close.mjs`, `new-tab-position.mjs` | **C-** | Workspace tab destruction on close, multi-window state desync |
| **Privacy & Security** | `peek.mjs`, `boot.sys.mjs`, `aether.cfg` | **C+** | Container context leak in Peek, `xpinstall` release signing failure |
| **Worker & Async Systems** | `thumbnails.mjs`, `thumbnail-worker.js`, `wallpaper.mjs` | **B-** | Promise queue deadlock on worker error, memory leak on unloads |
| **Frontend Rendering & CSS** | `newtab.mjs`, `aether.css`, `palettes.css`, `sidebar-*.css` | **B** | Infinite `requestAnimationFrame` loop, severe WCAG AA contrast failures |
| **Build & Packaging Scripts** | `prepare.sh`, `install_ui.sh`, `mozconfig`, `release.env` | **B+** | Missing `MOZ_REQUIRE_SIGNING=0`, unexpanded glob crashes in `install_ui.sh` |

---

## 1. Critical Severity Vulnerabilities & Architectural Flaws

### 1.1 Critical Tab & Workspace Destruction on Closing Last Tab
- **Files**: `ui/scripts/workspaces.mjs` (lines 65–75), `ui/scripts/tab-close.mjs` (lines 10–24)
- **Vulnerability**:
  In `workspaces.mjs`, tabs belonging to inactive workspaces are hidden using `gBrowser.hideTab(tab)`. In `tab-close.mjs`, `gBrowser._findTabToBlurTo` iterates strictly over `this.visibleTabs`.
  When a user closes the last unpinned tab in an active workspace:
  1. `this.visibleTabs` contains no other candidate tabs.
  2. `_findTabToBlurTo` returns `null` or falls back to Firefox default.
  3. Because `browser.tabs.closeWindowWithLastTab` defaults to `true` in Firefox (and is not disabled in `aether.cfg`), Firefox concludes that the window has no remaining open tabs.
  4. Firefox immediately closes the browser window, **destroying all hidden tabs in all other workspaces without confirmation or session warning**.
- **Remediation**:
  1. Ensure `browser.tabs.closeWindowWithLastTab` is set to `false` in `ui/aether.cfg`.
  2. In `ui/scripts/tab-close.mjs`, before blurring or closing, ensure an empty workspace opens a fresh tab instead of closing the window.

```diff
--- a/ui/aether.cfg
+++ b/ui/aether.cfg
@@ -7,2 +7,3 @@
 defaultPref("browser.tabs.insertAfterCurrent", false);  // new tabs go at the end of the list
+defaultPref("browser.tabs.closeWindowWithLastTab", false); // never destroy window while hidden workspace tabs exist
```

---

### 1.2 Container Tab (Contextual Identity) Privacy Leak in Peek
- **Files**: `ui/scripts/peek.mjs` (lines 64–76, 96–100)
- **Vulnerability**:
  When creating the floating `<browser>` card in `open(url, data)`, `peek.mjs` fails to propagate the originating tab's `userContextId`.
  1. If a user is browsing inside a container tab (e.g., *Personal*, *Work*, *Banking*), Shift-clicking a link opens a `<browser>` in the **default (unpartitioned) container**. This leaks navigation history and cookies into the default profile.
  2. When the user clicks the **"Open in tab"** button:
     ```javascript
     win.openTrustedLinkIn(spec, "tab");
     ```
     `openTrustedLinkIn` is called without `{ userContextId }`, so the newly created tab also loses the container context permanently.
- **Remediation**:
  Retrieve `userContextId` from the active browser and pass it both to the `<browser>` element and to `openTrustedLinkIn`:

```diff
--- a/ui/scripts/peek.mjs
+++ b/ui/scripts/peek.mjs
@@ -17,2 +17,3 @@
       win.aetherPeek.open(data.href, {
+        userContextId: this.manager.browsingContext.top.embedderElement?.getAttribute("usercontextid") || 0,
         triggeringPrincipal: data.triggeringPrincipal,
@@ -72,2 +73,5 @@
     }
+    if (data.userContextId) {
+      browser.setAttribute("usercontextid", data.userContextId);
+    }
     card.append(bar, browser);
@@ -99,3 +103,3 @@
       close();
-      win.openTrustedLinkIn(spec, "tab");
+      win.openTrustedLinkIn(spec, "tab", { userContextId: Number(browser.getAttribute("usercontextid")) || 0 });
     });
```

---

### 1.3 Permanent Worker Deadlock in Wallpaper Thumbnail Generation Queue
- **Files**: `ui/scripts/thumbnails.mjs` (lines 22–38)
- **Vulnerability**:
  The module maintains a single shared singleton `worker` and a sequential promise queue:
  ```javascript
  let worker = null;
  let queue = Promise.resolve();
  ```
  `makeCopy(win, path, copy, frosted)` creates the worker on the first window (`win.ChromeWorker`). If:
  1. That first window is closed, the underlying `ChromeWorker` instance can be severed or garbage collected.
  2. The worker encounters an unhandled exception or termination (e.g. invalid image format, memory pressure), it will never post a message back.
  Because `makeCopy` sets **no `onerror` handler** and has **no timeout**, the promise returned by `makeCopy` never settles. Because `queue = queue.then(...)`, the queue hangs indefinitely, permanently disabling thumbnail generation for all windows until the browser is restarted.
- **Remediation**:
  Add an `error` listener and a safety timeout to `makeCopy` to ensure the promise always settles:

```diff
--- a/ui/scripts/thumbnails.mjs
+++ b/ui/scripts/thumbnails.mjs
@@ -27,10 +27,19 @@
   worker ??= new win.ChromeWorker("chrome://aether/content/settings/thumbnail-worker.js");
   const id = ++asked;
-  return new Promise(resolve => {
+  return new Promise((resolve, reject) => {
+    const timer = win.setTimeout(() => cleanup({ id, ok: false, error: "timeout" }), 15000);
     const answer = ({ data }) => {
       if (data.id !== id) return;
+      cleanup(data);
+    };
+    const fail = err => cleanup({ id, ok: false, error: String(err) });
+    function cleanup(result) {
+      win.clearTimeout(timer);
       worker.removeEventListener("message", answer);
-      resolve(data);
-    };
+      worker.removeEventListener("error", fail);
+      resolve(result);
+    }
     worker.addEventListener("message", answer);
+    worker.addEventListener("error", fail);
     worker.postMessage({ id, path, copy, frosted });
```

---

### 1.4 Unsigned Extension Rejection in Release Builds
- **Files**: `mozconfig` (lines 1–11), `ui/aether.cfg` (line 4)
- **Vulnerability**:
  `mozconfig` enables `--enable-release`. In Mozilla release builds, extension signature enforcement is hardcoded into Gecko C++ core; setting `defaultPref("xpinstall.signatures.required", false)` in `aether.cfg` is ignored by Firefox release binaries unless disabled at compile time.
  Consequently, Aether's bundled unsigned extension (Sip, `sip@osama.local.xpi`) will fail to install or activate with an invalid signature error on release builds.
- **Remediation**:
  Add compile-time environment flags to `mozconfig`:

```diff
--- a/mozconfig
+++ b/mozconfig
@@ -1,4 +1,6 @@
 # Release build of Firefox ESR with our changes. prepare.sh appends the app name.
+export MOZ_REQUIRE_SIGNING=0
+export MOZ_ADDON_SIGNING=0
 ac_add_options --enable-application=browser
```

---

### 1.5 Infinite `requestAnimationFrame` CPU & Battery Drain on New Tab
- **Files**: `ui/newtab/newtab.mjs` (lines 216–231)
- **Vulnerability**:
  In `newtab.mjs`, `placeWallpaper()` calls `requestAnimationFrame(placeWallpaper)` unconditionally at the end of the function.
  Even when `document.hidden` is true (background tab) or when `aether-wallpaper` is disabled, the function reschedules itself 60 to 144 times per second per open New Tab. Having multiple New Tabs open keeps the Gecko render loop active, preventing CPU core package C-states and causing severe battery drain on laptops.
- **Remediation**:
  Only run `requestAnimationFrame` when the document is visible and when the window is moving or resizing:

```diff
--- a/ui/newtab/newtab.mjs
+++ b/ui/newtab/newtab.mjs
@@ -216,9 +216,11 @@
 function placeWallpaper() {
-  if (document.documentElement.hasAttribute("aether-wallpaper") && !document.hidden) {
+  if (document.hidden || !document.documentElement.hasAttribute("aether-wallpaper")) {
+    return;
+  }
   const top = chromeWindow();
+  if (top) {
     const at = [top.mozInnerScreenX - window.mozInnerScreenX, top.mozInnerScreenY - window.mozInnerScreenY,
       top.innerWidth, top.innerHeight].map(n => `${Math.round(n)}px`);
     if (at.join() !== placed) {
       placed = at.join();
       ["--wall-x", "--wall-y", "--wall-w", "--wall-h"].forEach((name, i) => document.documentElement.style.setProperty(name, at[i]));
     }
   }
-  requestAnimationFrame(placeWallpaper);
 }
+document.addEventListener("visibilitychange", () => {
+  if (!document.hidden) placeWallpaper();
+});
+window.addEventListener("resize", placeWallpaper);
```

---

## 2. High Severity Findings

### 2.1 Multi-Window Workspace Tab De-synchronization on Deletion
- **Files**: `ui/scripts/workspaces.mjs` (lines 133–139)
- **Bug**:
  `deleteWorkspace(id)` only queries and reassigns tabs in the current window's `gBrowser`:
  ```javascript
  tabsIn(id).forEach(t => assign(t, rest[0].id));
  ```
  In any other open window containing tabs assigned to the deleted workspace, those tabs remain untouched until the preference observer triggers `apply()`. In `apply()`:
  ```javascript
  if (!known.has(workspaceOf(tab))) assign(tab, current);
  ```
  The tabs in other windows are assigned to `current` (whatever workspace happens to be active in that secondary window) rather than `rest[0].id` (the designated heir workspace confirmed by the user in the prompt).
- **Remediation**:
  Reassign tabs across all windows using `Services.wm.getEnumerator("navigator:browser")`.

---

### 2.2 Gecko Window Leaks (Missing Observer & Listener Teardown)
- **Files**:
  - `ui/scripts/split-view.mjs` (lines 60–71): `gBrowser.addTabsProgressListener` and `keydown` window listeners are added without removal on window `unload`.
  - `ui/scripts/sidebar-urlbar.mjs` (lines 33–39): `ResizeObserver` and `MutationObserver` on `sidebar-container` are never disconnected.
  - `ui/scripts/wallpaper.mjs` (lines 92–94): `dark.addEventListener("change", update)` and `win.addEventListener("activate", update)` are never removed on `unload`.
- **Impact**:
  In Firefox desktop, holding references across chrome windows prevents closed `DOMWindow` objects from being freed, resulting in progressive memory bloat over long browser sessions.
- **Remediation**:
  Store observer references and disconnect them inside the window `unload` handler.

---

### 2.3 Bootstrapping Race Condition on `about:blank` in `boot.sys.mjs`
- **Files**: `ui/boot.sys.mjs` (lines 27–31)
- **Bug**:
  ```javascript
  Services.obs.addObserver(subject => {
    subject.addEventListener("DOMContentLoaded", () => {
      if (subject.location.href === BROWSER_WINDOW) addStyles(subject);
    }, { once: true });
  }, "domwindowopened");
  ```
  When a window opens, Gecko often initializes it with an `about:blank` document. The `{ once: true }` handler triggers on the initial `about:blank` event, fails the `=== BROWSER_WINDOW` check, and is removed. When `browser.xhtml` subsequently loads, the listener is gone and `addStyles(subject)` is never executed, causing an unstyled Firefox UI flash.
- **Remediation**:
  Check `subject.document.readyState` and avoid `{ once: true }` if the document is not yet `BROWSER_WINDOW`.

---

### 2.4 RTL (Right-to-Left) Localization Failure on Private New Tab Button
- **Files**: `ui/scripts/new-tab-position.mjs` (lines 31–32)
- **Bug**:
  ```javascript
  const onPrivate = event => Services.prefs.getBoolPref(VERTICAL_TABS, false) &&
    event.clientX > button.getBoundingClientRect().right - PRIVATE_WIDTH;
  ```
  In RTL locales (Arabic, Hebrew, Persian), the button layout is mirrored: the private browsing split section is located on the **left** edge of the button. Checking `event.clientX > right - 40` results in inversed hit-testing: clicking the regular new-tab area opens a private window, while clicking the private icon does nothing.
- **Remediation**:
  Check `win.getComputedStyle(button).direction === "rtl"` and adjust coordinate calculations.

---

## 3. Medium & Low Severity Findings

### 3.1 WCAG 2.1 Contrast Failures in Light and Dark Modes
- **Files**: `ui/styles/palettes.css` (lines 8–45), `ui/styles/aether.css` (lines 144–155)
- **Issue**:
  - In light mode, accents against the light background `#e3e5fc` fail WCAG AA contrast (Sunset: 2.86:1, Aurora: 3.03:1, Ocean: 3.29:1).
  - In dark mode, white text placed over dark mode accent backgrounds (such as the fullscreen exit button) suffers severe contrast failures: Aurora (1.92:1), Ocean (2.14:1), Sunset (2.26:1), Rose (2.65:1), Nebula (2.98:1).
- **Remediation**:
  Use darker tones for light-mode text accents and set the fullscreen button text color to `var(--aether-text)` or `#000000` over pastel accent backgrounds.

---

### 3.2 Shell Glob Expansion Error in `scripts/install_ui.sh`
- **Files**: `scripts/install_ui.sh` (line 23)
- **Issue**:
  `cp "$UI"/extensions/*.xpi "$INSTALL/distribution/extensions/"`
  If no `.xpi` extensions exist in the `extensions/` directory (e.g. before Sip is built), the wildcard `*.xpi` remains unexpanded under bash defaults. `cp` fails with `No such file or directory`, immediately aborting the installation under `set -e`.
- **Remediation**:
  Use `nullglob` or check if matching files exist before copying.

---

### 3.3 Missing `color-scheme` in `sidebar-pages.css`
- **Files**: `ui/styles/sidebar-pages.css` (lines 6–14)
- **Issue**:
  Line 9 uses `light-dark(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.06))`. In CSS, `light-dark()` only computes the second value if `color-scheme: light dark` is declared on the element or an ancestor. Without this declaration, it always resolves to the light value, causing transparent sidebar panels to look washed out in dark mode.
- **Remediation**:
  Add `color-scheme: light dark;` to `:root` in `sidebar-pages.css`.

---

### 3.4 Packaging / URI Issue in Desktop Launcher Icon Updater
- **Files**: `ui/scripts/app-icon.mjs` (lines 30–31)
- **Issue**:
  `convertChromeURL(...).QueryInterface(Ci.nsIFileURL).file.path`
  If the application is distributed as a packaged `omni.ja` archive, `convertChromeURL` resolves to a `jar:` URI rather than a `file:` URI. Calling `.QueryInterface(Ci.nsIFileURL)` throws an unhandled exception `NS_ERROR_NO_INTERFACE`, breaking icon synchronization.
- **Remediation**:
  Wrap in a try/catch and extract jar contents to a temporary path if necessary.

---

### 3.5 UI Terminology Inconsistency in `liquid-glass.mjs`
- **Files**: `ui/scripts/liquid-glass.mjs` (line 22)
- **Issue**:
  The context menu item is labelled `"Frosted Glass"`, whereas the settings page, welcome page, and comments describe it as `"Liquid Glass"`.
- **Remediation**:
  Align label to `"Liquid Glass"`.

---

## 4. Prioritized Action Checklist for Developers (Claude / Engineers)

1. [ ] **Tab Safety**: Disable `browser.tabs.closeWindowWithLastTab` in `ui/aether.cfg` to prevent total workspace data loss.
2. [ ] **Privacy**: Propagate `userContextId` in `ui/scripts/peek.mjs` to preserve Container isolation.
3. [ ] **Build Stability**: Add `MOZ_REQUIRE_SIGNING=0` and `MOZ_ADDON_SIGNING=0` to `mozconfig`.
4. [ ] **Reliability**: Add timeout & error handler to `ui/scripts/thumbnails.mjs` worker promise queue.
5. [ ] **Performance**: Stop infinite `requestAnimationFrame` loop in `ui/newtab/newtab.mjs`.
6. [ ] **Memory**: Implement clean `unload` teardown for listeners and observers in `ui/scripts/split-view.mjs` and `ui/scripts/sidebar-urlbar.mjs`.
7. [ ] **Accessibility**: Fix contrast ratios for dark mode button labels and light mode accents in `ui/styles/palettes.css`.
