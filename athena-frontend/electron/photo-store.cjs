const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function savePhoto(dataUrl, directory) {
  if (typeof dataUrl !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) {
    throw new Error("A PNG camera image is required.");
  }

  const encoded = dataUrl.slice("data:image/png;base64,".length);
  const bytes = Buffer.from(encoded, "base64");
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < signature.length || bytes.length > 5 * 1024 * 1024 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error("The camera image is invalid or too large.");
  }

  fs.mkdirSync(directory, { recursive: true });
  const filename = `photo-${Date.now()}-${crypto.randomUUID()}.png`;
  const filePath = path.join(directory, filename);
  fs.writeFileSync(filePath, bytes, { flag: "wx" });
  return filePath;
}

module.exports = savePhoto;
