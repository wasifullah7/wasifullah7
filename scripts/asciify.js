/**
 * Turns the portrait into ASCII art for a neofetch-style profile README.
 *
 * Uses the cut-out PNG so the background is transparent and only the subject
 * becomes characters. Character cells are about twice as tall as they are
 * wide, so the image is squashed vertically to compensate before sampling.
 */
const fs = require("fs");
const sharp = require("sharp");

const SRC = process.argv[2];
const COLS = Number(process.argv[3] ?? 46);
const OUT = process.argv[4];

// Dark to light. Denser glyphs carry more ink.
const RAMP = "@%#*+=-:. ";

(async () => {
  const meta = await sharp(SRC).metadata();
  const aspect = (meta.height ?? 1) / (meta.width ?? 1);
  // Cell aspect in the card is LINE_H / CHAR_W = 19 / 8.1, so a character is
  // 2.35 times taller than it is wide. Sampling at 0.5 stretched the portrait.
  const rows = Math.max(1, Math.round((COLS * aspect) / 2.35));

  const { data, info } = await sharp(SRC)
    .resize(COLS, rows, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;
  const lines = [];

  for (let y = 0; y < info.height; y++) {
    let line = "";
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * ch;
      const alpha = data[i + 3] / 255;

      if (alpha < 0.35) {
        line += " ";
        continue;
      }

      const lum =
        (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      // Composite against the dark README background before mapping.
      const shown = lum * alpha;
      const idx = Math.min(
        RAMP.length - 1,
        Math.max(0, Math.round((1 - shown) * (RAMP.length - 1))),
      );
      line += RAMP[idx];
    }
    lines.push(line.replace(/\s+$/, ""));
  }

  // Drop fully blank leading/trailing rows.
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  const art = lines.join("\n");
  if (OUT) fs.writeFileSync(OUT, art);
  console.log(art);
  console.error(`\n${lines.length} rows x ${COLS} cols`);
})();
