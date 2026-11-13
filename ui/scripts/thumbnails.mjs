// Small copies (320px wide) of the wallpapers, for Aether Settings' tiles: the pictures
// themselves are several megabytes each, far too much to decode and draw while scrolling. Made
// once each, by a worker (settings/thumbnail-worker.js), and kept in the profile. Aether makes
// them in the background a little after it starts (scripts/wallpaper.mjs), so the settings page
// finds them ready; it makes any that are missing itself.

const THUMBNAILS = PathUtils.join(PathUtils.profileDir, "aether-thumbnails");
const FOLDER = PathUtils.join(Services.dirsvc.get("Home", Ci.nsIFile).path, "Pictures", "Wallpapers");
const PICTURE = /\.(jpe?g|png|webp|avif|gif)$/i;

// The pictures in ~/Pictures/Wallpapers, as file: URLs.
export async function wallpaperFiles() {
  try {
    return (await IOUtils.getChildren(FOLDER)).sort().filter(path => PICTURE.test(path)).map(path => PathUtils.toFileURI(path));
  } catch {
    return []; // no Wallpapers folder
  }
}

export const wallpaperFolder = FOLDER;

let worker = null;
let asked = 0;
let queue = Promise.resolve(); // one at a time, so making them doesn't hog the computer

function makeCopy(win, path, copy) {
  worker ??= new win.ChromeWorker("chrome://aether/content/settings/thumbnail-worker.js");
  const id = ++asked;
  return new Promise(resolve => {
    const answer = ({ data }) => {
      if (data.id !== id) return;
      worker.removeEventListener("message", answer);
      resolve(data);
    };
    worker.addEventListener("message", answer);
    worker.postMessage({ id, path, copy });
  });
}

// The copy's file: URL (making it first if needed), or null if the picture can't be read.
export function thumbnail(url, win) {
  const job = queue.then(async () => {
    if (!url?.startsWith("file:")) return url;
    try {
      const path = Services.io.newURI(url).QueryInterface(Ci.nsIFileURL).file.path;
      const { lastModified } = await IOUtils.stat(path);
      const key = new Uint8Array(await win.crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${path}|${lastModified}`)));
      const copy = PathUtils.join(THUMBNAILS, `${[...key].map(b => b.toString(16).padStart(2, "0")).join("")}.jpg`);
      if (!(await IOUtils.exists(copy))) {
        const { ok, error } = await makeCopy(win, path, copy);
        if (!ok) throw new Error(error);
      }
      return PathUtils.toFileURI(copy);
    } catch (e) {
      console.error("Aether: wallpaper thumbnail", e);
      return null;
    }
  });
  queue = job;
  return job;
}
