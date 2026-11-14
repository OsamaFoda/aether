// Makes the small wallpaper copies for Astrelle Settings' tiles (settings.mjs), away from the page
// so it stays smooth while they're made: reads a picture, scales it to 320px wide, saves a JPEG.

onmessage = async ({ data: { id, path, copy, frosted } }) => {
  try {
    const picture = await createImageBitmap(new Blob([await IOUtils.read(path)]));
    const canvas = new OffscreenCanvas(320, Math.round(320 * picture.height / picture.width));
    const context = canvas.getContext("2d");
    if (frosted) {
      // Shrunk to a few dozen pixels and smoothly stretched back: the picture as if through
      // frosted glass, without the cost of blurring it on every frame.
      let tiny = picture;
      while (tiny.width > 24) { // halving each time, so every pixel of the picture counts
        const half = new OffscreenCanvas(Math.max(24, Math.round(tiny.width / 2)), Math.max(1, Math.round(tiny.height / 2)));
        half.getContext("2d").drawImage(tiny, 0, 0, half.width, half.height);
        tiny = half;
      }
      context.imageSmoothingQuality = "high";
      context.filter = "blur(6px)";
      context.drawImage(tiny, -24, -24, canvas.width + 48, canvas.height + 48); // past the edges, which a blur fades
    } else {
      context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    }
    picture.close();
    const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
    await IOUtils.makeDirectory(PathUtils.parent(copy));
    await IOUtils.write(copy, new Uint8Array(await jpeg.arrayBuffer()));
    postMessage({ id, ok: true });
  } catch (e) {
    postMessage({ id, ok: false, error: String(e) });
  }
};
