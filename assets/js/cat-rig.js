/* cat-rig.js — draws the corner cat's sprite sheet.
 *
 * Loading is async and the caller doesn't wait on it: draw() is a no-op until the sheet arrives,
 * so a slow or failed image can never stall or break the animation loop.
 *
 * Everything works in whole pixels on purpose. The sprite is never rotated and never scaled by a
 * fraction — both resample the grid and turn crisp pixel art to mush. The lean that sells a stroke
 * is a whole-pixel nudge, and expression is a different frame. That's how pixel art has always
 * done it.
 */
window.CatRig = (function () {
  "use strict";

  var img = null, ready = false;

  function load() {
    var art = window.CatArt;
    if (!art || img) return;
    img = new Image();
    img.onload = function () { ready = true; };
    img.onerror = function () { ready = false; };   // stays a no-op; nothing else breaks
    img.src = art.src;
  }

  function size(scale) {
    var art = window.CatArt;
    if (!art) return { w: 0, h: 0 };
    var s = Math.max(1, Math.round(scale || 6));
    return { w: art.frameW * s, h: art.frameH * s };
  }

  /* o: { x, y, scale, frame, dir, dx, dy, alpha }
   *   x, y    ground point the cat sits on, in CSS px (x is its centre)
   *   scale   whole-number pixel size; anything fractional resamples the grid
   *   frame   index into the sheet
   *   dir     -1 mirrors him. An exact mirror is lossless, unlike a rotation.
   *   dx, dy  whole-pixel nudge — the lean, while he's being stroked
   */
  function draw(c, o) {
    var art = window.CatArt;
    if (!ready || !art) return;
    var s = Math.max(1, Math.round(o.scale || 6));
    var f = Math.max(0, Math.min(art.frames - 1, o.frame || 0));
    var w = art.frameW * s, h = art.frameH * s;

    var px = Math.round(o.x - w / 2 + (o.dx || 0));
    var py = Math.round(o.y - h + (o.dy || 0));

    c.save();
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    c.imageSmoothingEnabled = false;                // never interpolate between pixels
    if (o.dir === -1) {                             // mirror about the sprite's own centre
      c.translate(px + w, py);
      c.scale(-1, 1);
      px = 0; py = 0;
    }
    c.drawImage(img,
      f * art.frameW, 0, art.frameW, art.frameH,    // source frame
      px, py, w, h);
    c.restore();
  }

  /* Where the head is, so the pointer can be tested against it. The head sits in the top third
   * of the sprite. */
  function headAt(o) {
    var art = window.CatArt;
    var s = Math.max(1, Math.round(o.scale || 6));
    var h = (art ? art.frameH : 16) * s;
    return {
      x: o.x + (o.dx || 0),
      y: o.y - h + 4 * s + (o.dy || 0),
      r: 5 * s,
    };
  }

  load();
  return { draw: draw, headAt: headAt, size: size, isReady: function () { return ready; } };
})();
