// Makes the small wallpaper copies for Aether Settings' tiles (settings.mjs), away from the page
// so it stays smooth while they're made: reads a picture, scales it to 320px wide, saves a JPEG.

onmessage = async ({ data: { id, path, copy } }) => {
  try {
    const picture = await createImageBitmap(new Blob([await IOUtils.read(path)]));
    const canvas = new OffscreenCanvas(320, Math.round(320 * picture.height / picture.width));
    canvas.getContext("2d").drawImage(picture, 0, 0, canvas.width, canvas.height);
    picture.close();
    const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
    await IOUtils.makeDirectory(PathUtils.parent(copy));
    await IOUtils.write(copy, new Uint8Array(await jpeg.arrayBuffer()));
    postMessage({ id, ok: true });
  } catch (e) {
    postMessage({ id, ok: false, error: String(e) });
  }
};
