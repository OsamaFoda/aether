// Peek: Shift+click a link to open it in a floating glass window over the page, like Arc.
// "Open in tab" keeps it, and ✕, Esc or a click outside closes it. Only plain Shift+click on a
// page link changes; Firefox's other ways to open a new window are untouched.

const { ClickHandlerParent } = ChromeUtils.importESModule("resource:///actors/ClickHandlerParent.sys.mjs");
const { E10SUtils } = ChromeUtils.importESModule("resource://gre/modules/E10SUtils.sys.mjs");

// Link clicks from every window arrive in this one class, so it's patched once per session.
if (!ClickHandlerParent.prototype.aetherPeek) {
  const firefoxClick = ClickHandlerParent.prototype.contentAreaClick;
  ClickHandlerParent.prototype.aetherPeek = true;
  ClickHandlerParent.prototype.contentAreaClick = function (data) {
    const plainShift = data.shiftKey && !data.ctrlKey && !data.altKey && !data.metaKey && data.button === 0;
    const win = this.manager.browsingContext.top.embedderElement?.documentGlobal;
    if (plainShift && data.href && win?.aetherPeek) {
      // The page's security context arrives packed for the trip from the content process.
      win.aetherPeek.open(data.href, {
        triggeringPrincipal: data.triggeringPrincipal,
        policyContainer: data.policyContainer ? E10SUtils.deserializePolicyContainer(data.policyContainer) : null,
      });
      return;
    }
    firefoxClick.call(this, data);
  };
}

export function init(win) {
  const doc = win.document;
  let overlay = null;

  function close() {
    if (!overlay) return;
    const closing = overlay;
    overlay = null;
    closing.setAttribute("closing", "");
    win.setTimeout(() => closing.remove(), 180);
  }

  function open(url, data = {}) {
    close();
    overlay = doc.createXULElement("vbox");
    overlay.id = "aether-peek";

    const card = doc.createXULElement("vbox");
    card.className = "aether-peek-card";

    const bar = doc.createXULElement("hbox");
    bar.className = "aether-peek-bar";
    bar.setAttribute("align", "center");
    const title = doc.createXULElement("label");
    title.className = "aether-peek-title";
    title.setAttribute("crop", "end");
    title.setAttribute("flex", "1");
    title.setAttribute("value", url);
    const keep = doc.createElement("button");
    keep.className = "aether-peek-button";
    keep.textContent = "Open in tab";
    const shut = doc.createElement("button");
    shut.className = "aether-peek-button";
    shut.textContent = "✕";
    shut.title = "Close (Esc)";
    bar.append(title, keep, shut);

    const browser = doc.createXULElement("browser");
    for (const [name, value] of Object.entries({
      type: "content",
      remote: "true",
      maychangeremoteness: "true",
      messagemanagergroup: "browsers",
      flex: "1",
    })) {
      browser.setAttribute(name, value);
    }
    card.append(bar, browser);
    overlay.append(card);
    doc.getElementById("browser").append(overlay);

    // Keep the title bar showing where the peek is. A browser outside a tab gets no title
    // events, so update when the address changes and when a page finishes loading.
    const show = () => {
      const page = browser.contentTitle;
      let host = "";
      try { host = browser.currentURI.host; } catch {}
      title.setAttribute("value", page ? `${page} — ${host}` : host || url);
    };
    const progress = {
      QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),
      onLocationChange: show,
      onStateChange(webProgress, request, flags) {
        if (flags & Ci.nsIWebProgressListener.STATE_STOP) show();
      },
    };
    overlay.aetherProgress = progress; // the listener is held weakly; keep it alive with the overlay
    browser.addProgressListener(progress, Ci.nsIWebProgress.NOTIFY_LOCATION | Ci.nsIWebProgress.NOTIFY_STATE_WINDOW);

    keep.addEventListener("click", () => {
      const spec = browser.currentURI?.spec || url;
      close();
      win.openTrustedLinkIn(spec, "tab");
    });
    shut.addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });

    browser.fixupAndLoadURIString(url, {
      triggeringPrincipal: data.triggeringPrincipal ?? Services.scriptSecurityManager.createNullPrincipal({}),
      policyContainer: data.policyContainer,
    });
  }

  win.addEventListener("keydown", event => {
    if (overlay && event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }, true);

  win.aetherPeek = { open, close, get isOpen() { return Boolean(overlay); } };
}
