/* entrance.js — "bat swarm" entrance.
 * When the boot screen's scan meter fills, a swarm of bats bursts out and sweeps across the
 * viewport. Each bat *carves* the dark veil away as it flies, so the page is uncovered in the
 * shape of their flight paths rather than behind a straight wipe. All art is drawn on canvas.
 *
 * Two layers: a veil canvas that never clears (holes punched with destination-out accumulate),
 * and a swarm canvas above it that clears each frame. A pre-rendered radial brush keeps the
 * carving to one drawImage per stamp; positions are interpolated between frames so fast bats
 * leave a continuous swath instead of a dotted line.
 *
 * Perf: reduced resolution and a 30fps cap on phones. Honours prefers-reduced-motion.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktop = window.matchMedia("(min-width: 768px)").matches;

  var PURPLE = "#a855f7";
  var PINK = "#f0abfc";
  var VEIL = "#080610";                  // must match #boot's background in effects.css

  // One bat centred on (0,0); `flap` (0..1) drives the wingbeat.
  function batPath(ctx, size, flap) {
    var w = size, lift = (flap - 0.5) * size * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(w * 0.5, -lift - w * 0.25, w, -lift * 0.3);
    ctx.quadraticCurveTo(w * 0.72, lift * 0.25 + w * 0.12, w * 0.55, -lift * 0.1 + w * 0.05);
    ctx.quadraticCurveTo(w * 0.42, lift * 0.3 + w * 0.22, w * 0.22, w * 0.12);
    ctx.closePath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-w * 0.5, -lift - w * 0.25, -w, -lift * 0.3);
    ctx.quadraticCurveTo(-w * 0.72, lift * 0.25 + w * 0.12, -w * 0.55, -lift * 0.1 + w * 0.05);
    ctx.quadraticCurveTo(-w * 0.42, lift * 0.3 + w * 0.22, -w * 0.22, w * 0.12);
    ctx.closePath();
    ctx.ellipse(0, w * 0.04, w * 0.2, w * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft round brush, rendered once and scaled per stamp. Only its alpha matters — the veil is
  // erased with destination-out, so the fill colour is irrelevant.
  var BRUSH_R = 64;
  function makeBrush() {
    var b = document.createElement("canvas");
    b.width = b.height = BRUSH_R * 2;
    var g = b.getContext("2d");
    var grad = g.createRadialGradient(BRUSH_R, BRUSH_R, 0, BRUSH_R, BRUSH_R, BRUSH_R);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(0.5, "rgba(0,0,0,0.95)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, BRUSH_R * 2, BRUSH_R * 2);
    return b;
  }

  function makeLayer(z, W, H, RES) {
    var c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    Object.assign(c.style, {
      position: "fixed", inset: "0", zIndex: String(z), pointerEvents: "none",
    });
    c.width = Math.round(W * RES);
    c.height = Math.round(H * RES);
    c.style.width = "100%";
    c.style.height = "100%";
    document.body.appendChild(c);
    var ctx = c.getContext("2d");
    if (ctx && RES !== 1) ctx.scale(RES, RES);
    return { el: c, ctx: ctx };
  }

  function run() {
    var boot = document.getElementById("boot");
    if (reduce) { if (boot) boot.classList.add("boot-skip"); return; }
    if (!boot || boot.classList.contains("boot-skip")) { if (boot) boot.style.display = "none"; return; }

    var W = window.innerWidth, H = window.innerHeight;
    var RES = desktop ? 1 : 0.8;
    var VEIL_RES = desktop ? 0.8 : 0.65;   // the veil is only a soft mask — lower res, cheaper carve,
                                           // which offsets running the hunt during the reveal
    var veil = makeLayer(9999, W, H, VEIL_RES);
    var swarm = makeLayer(10000, W, H, RES);
    if (!veil.ctx || !swarm.ctx) {
      veil.el.remove(); swarm.el.remove();
      boot.classList.add("boot-skip");
      return;
    }
    var vctx = veil.ctx, sctx = swarm.ctx;

    // Hand the backdrop over from #boot to the veil canvas. Same colour, so there's no flash.
    vctx.fillStyle = VEIL;
    vctx.fillRect(0, 0, W, H);
    boot.classList.add("boot-skip");
    boot.style.display = "none";
    window.__entranceRunning = true; // tells effects.js's safety timeout to stand down

    var brush = makeBrush();

    // Failsafe: whatever happens in the loop, the veil is never allowed to outlive the entrance.
    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      window.__entranceRunning = false;   // let the background animations resume
      veil.el.remove();
      swarm.el.remove();
      var sh = document.querySelector(".min-h-screen");
      if (sh) { sh.style.transform = ""; sh.style.willChange = ""; }
    }
    var DUR = 2600, OUTRO = 460;
    window.setTimeout(cleanup, DUR + OUTRO + 1500);

    // The swarm: a loose cloud carrying the reveal. Each bat is anchored *relative to* the sweep by
    // a fixed `lead`, so the carving can never outrun the animation.
    var N = desktop ? 46 : 22;
    var bats = [];
    for (var i = 0; i < N; i++) {
      var trailing = Math.random() < 0.15;   // a few stragglers drift behind, over the revealed page
      bats.push({
        lead: trailing ? -W * (0.02 + Math.random() * 0.12)
                       : W * (0.03 + Math.random() * 0.42),
        y: H * 0.5 + (Math.random() - 0.5) * H * 0.92,
        size: (desktop ? 9 : 7) + Math.random() * (desktop ? 16 : 11),
        phase: Math.random() * Math.PI * 2,
        bob: 16 + Math.random() * 40,
        pale: Math.random() > 0.55,     // two tint groups → the swarm draws in two batched fills
        px: null, py: null,             // previous stamp position, for interpolation
      });
    }

    // Starts off-screen left so the swarm flies in before it begins carrying the page, and
    // overshoots right so the reveal completes while the last bats are still in flight.
    function sweepX(u) { return -W * 0.42 + u * (W * 1.62); }

    var shell = document.querySelector(".min-h-screen");
    var DRAG = 40;                          // px the page is dragged in from behind the swarm
    if (desktop && shell) {
      shell.style.willChange = "transform";
      shell.style.transform = "translate3d(" + (-DRAG) + "px,0,0)";  // start pose, set now...
      void shell.offsetHeight;             // ...and force the layer promotion here, while the veil
                                           // still hides everything, instead of on the first sweep frame
    }

    var start = null;
    var lastFrame = 0, MIN_DT = desktop ? 15 : 32;  // ~60fps cap: steadier than uncapped on high-refresh screens
    var done = false;

    function draw(t) {
      if (cleaned) return;
      if (start === null) start = t;
      if (t - lastFrame < MIN_DT) { requestAnimationFrame(draw); return; }
      lastFrame = t;

      var q = (t - start) / DUR;   // unbounded — the swarm keeps flying through the outro
      var p = Math.min(1, q);
      var batBase = sweepX(q);

      sctx.clearRect(0, 0, W, H);

      // --- carve the veil (destination-out, accumulating) ---
      vctx.globalCompositeOperation = "destination-out";
      for (var i = 0; i < bats.length; i++) {
        var b = bats[i];
        var x = batBase + b.lead;
        var y = b.y + Math.sin(t * 0.0018 + b.phase) * b.bob;
        // Brushes are generous relative to the bat so their swaths overlap into open sky.
        var r = b.size * 4.2;
        if (x > -r && x < W + r) {
          // Interpolate from the last stamp so fast movers leave a swath, not a dotted line.
          var steps = 1;
          if (b.px !== null) {
            var dx = x - b.px, dy = y - b.py;
            steps = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(dx * dx + dy * dy) / (r * 0.6))));
          }
          for (var s = 1; s <= steps; s++) {
            var k = s / steps;
            var sx = b.px === null ? x : b.px + (x - b.px) * k;
            var sy = b.py === null ? y : b.py + (y - b.py) * k;
            vctx.drawImage(brush, sx - r, sy - r, r * 2, r * 2);
          }
        }
        b.px = x; b.py = y;
      }
      vctx.globalCompositeOperation = "source-over";

      // --- draw the bats themselves, two batched passes (one per tint) ---
      for (var g = 0; g < 2; g++) {
        sctx.fillStyle = g === 0 ? PURPLE : PINK;
        sctx.globalAlpha = g === 0 ? 0.9 : 0.7;
        for (var j = 0; j < bats.length; j++) {
          var bb = bats[j];
          if ((bb.pale ? 1 : 0) !== g) continue;  // each bat belongs to exactly one pass
          var bx = batBase + bb.lead;
          if (bx < -80 || bx > W + 80) continue;
          var by = bb.y + Math.sin(t * 0.0018 + bb.phase) * bb.bob;
          var flap = 0.5 + Math.sin(t * 0.013 + bb.phase) * 0.5;
          sctx.save();
          sctx.translate(bx, by);
          sctx.rotate(Math.sin(t * 0.003 + bb.phase) * 0.16);
          batPath(sctx, bb.size, flap);
          sctx.restore();
        }
      }
      sctx.globalAlpha = 1;

      // Whatever scraps the bats missed dissolve over the last stretch, so the reveal always
      // completes no matter how the flight paths fell.
      if (p > 0.72) veil.el.style.opacity = String(Math.max(0, 1 - (p - 0.72) / 0.28));

      // The page settles in from behind the swarm, as if it were being dragged along.
      var eased = 1 - Math.pow(1 - p, 3);
      if (desktop && shell && !done) {
        // page-slide is desktop-only; on mobile there is no shell layer to move (or to demote)
        shell.style.transform = "translate3d(" + (-DRAG * (1 - eased)).toFixed(2) + "px,0,0)";
      }

      if (p >= 1) {
        // The veil is fully transparent by now, so drop it and let the bats fly off as the
        // swarm layer fades.
        if (!done) {
          done = true;
          window.__entranceRunning = false;   // reveal is complete — hand the thread back
          veil.el.remove();
          if (shell) { shell.style.transform = ""; shell.style.willChange = ""; }
        }
        var T = (q - 1) * DUR;
        swarm.el.style.opacity = String(Math.max(0, 1 - T / OUTRO));
        if (T >= OUTRO) { cleanup(); return; }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // Fires once the boot meter has filled (bar starts 1.85s, runs 0.62s, "100%" lands at 2.42s).
  function boot() {
    try { if (document.getElementById("boot")) window.setTimeout(run, 2600); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
