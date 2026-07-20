/* effects.js — ambient dev/architecture effects, all decorative and self-contained:
 *   1. The hunt          — cats take out failing tests; passes drift by untouched
 *   2. Compile bar       — top scroll-progress bar styled as a build meter
 *   3. Blueprint spine   — a left-gutter system trace that draws as you scroll (lg+)
 * Everything degrades gracefully and honours prefers-reduced-motion.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- 1. The hunt ----------------
   * Test results drift across the background. The passes are left alone and sail off the edge;
   * the failures get stalked, and a cat takes them out.
   *
   * Every earlier backdrop here said "hacker" in the generic way — code rain, a subnet map, a
   * ghost terminal, padlocks. Any security portfolio could run those. This one says what the owner
   * of the site actually does: a QA engineer hunts the failures and lets the passes through.
   */
  function initHunt() {
    if (window.matchMedia("(max-width: 767px)").matches) return;  // too cramped to read
    if (!window.CatRig || !window.CatArt) return;
    var shell = document.querySelector(".min-h-screen.bg-dark-200") || document.body;
    var canvas = document.createElement("canvas");
    canvas.id = "hunt-bg";
    canvas.setAttribute("aria-hidden", "true");
    shell.insertBefore(canvas, shell.firstChild);   // above the shell bg, below all content
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var PASS = "#34d399", FAIL = "#fb7185", DIM = "#8b7fa8";
    var SCALE = 3;                                  // whole number, or the pixels smear
    var A = window.CatArt;

    var PASSES = [
      "login_valid", "session_expiry", "csrf_token", "input_sanitised",
      "rate_limit", "password_hash", "audit_log", "tls_handshake",
      "role_boundary", "token_refresh"
    ];
    var FAILS = [
      "auth_bypass", "sqli_on_search", "idor_user_id", "xss_reflected",
      "race_condition", "null_deref", "path_traversal", "weak_jwt_secret",
      "open_redirect", "stale_session"
    ];

    var W, H, items = [], cats = [], pops = [];

    function spawn() {
      // roughly one failure to every three passes: a healthy suite, mostly green
      var bad = Math.random() < 0.28;
      var pool = bad ? FAILS : PASSES;
      var fromLeft = Math.random() < 0.5;
      items.push({
        bad: bad,
        label: pool[(Math.random() * pool.length) | 0],
        x: fromLeft ? -170 : W + 170,
        y: 90 + Math.random() * Math.max(1, H - 210),
        vx: (fromLeft ? 1 : -1) * (0.034 + Math.random() * 0.026),
        life: 1, dead: false, hunted: false
      });
      if (items.length > 14) items.shift();
    }

    function makeCat(depth) {
      return {
        depth: depth, y: 0,
        x: Math.random() * window.innerWidth,
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: 0.026 + Math.random() * 0.014,
        state: "prowl", t: 0, anim: 0, prey: null
      };
    }

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      // Explicit px, not 100%: during the intro the shell is transformed, and a transformed
      // ancestor makes a position:fixed child size against the shell (the whole tall page) instead
      // of the viewport — which stretched this canvas and made the cats giant until the intro ended.
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      for (var i = 0; i < cats.length; i++) cats[i].y = H * cats[i].depth;
    }
    cats = [makeCat(0.34), makeCat(0.62), makeCat(0.88)];
    resize();
    window.addEventListener("resize", resize);
    for (var n = 0; n < 4; n++) spawn();

    /* The nearest live failure this cat could plausibly reach: roughly level with it, and ahead
     * of it rather than behind. */
    function findPrey(c) {
      var best = null, bd = Infinity;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it.bad || it.dead || it.hunted) continue;
        if (Math.abs(it.y - c.y) > 90) continue;
        var dx = it.x - c.x;
        if (dx * c.dir < 0) continue;               // never chase what is behind you
        var d = Math.abs(dx);
        if (d > 520 || d < 60) continue;
        if (d < bd) { bd = d; best = it; }
      }
      return best;
    }

    function pop(x, y) {
      for (var i = 0; i < 10; i++) {
        var a = Math.random() * Math.PI * 2, sp = 0.02 + Math.random() * 0.06;
        pops.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.02, life: 1 });
      }
    }

    function frameOf(c) {
      var key = c.state === "prowl" ? "walk" : c.state === "crouch" ? "crouch" : "run";
      var ms = c.state === "prowl" ? A.walkMs : c.state === "crouch" ? A.crouchMs : A.runMs;
      var set = A.anim[key];
      return set[Math.floor(c.anim / ms) % set.length];
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.font = '12px "Geist Mono", ui-monospace, monospace';
      ctx.textBaseline = "middle";

      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var a = it.dead ? Math.max(0, it.life) : 1;
        ctx.globalAlpha = a * (it.bad ? 0.85 : 0.5);
        ctx.fillStyle = it.bad ? FAIL : PASS;
        ctx.fillText(it.bad ? "✗" : "✓", it.x, it.y);
        ctx.globalAlpha = a * (it.bad ? 0.7 : 0.36);
        ctx.fillStyle = it.bad ? FAIL : DIM;
        ctx.fillText(it.label, it.x + 16, it.y);
      }

      for (var k = 0; k < cats.length; k++) {
        var c = cats[k];
        ctx.globalAlpha = 0.9;
        window.CatRig.draw(ctx, { x: c.x, y: c.y, scale: SCALE, frame: frameOf(c), dir: c.dir });
      }

      ctx.globalAlpha = 1;
      for (var q = 0; q < pops.length; q++) {
        var s = pops[q];
        ctx.globalAlpha = Math.max(0, s.life) * 0.8;
        ctx.fillStyle = FAIL;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    var last = 0, prev = 0, nextSpawn = 0;
    function frame(t) {
      requestAnimationFrame(frame);
      if (t - last < 33) return;
      var dt = prev ? Math.min(90, t - prev) : 33;
      last = t; prev = t;

      nextSpawn -= dt;
      if (nextSpawn <= 0) { spawn(); nextSpawn = 2600 + Math.random() * 3600; }
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        if (it.dead) { it.life -= dt / 420; if (it.life <= 0) items.splice(i, 1); continue; }
        it.x += it.vx * dt;
        if (it.x < -230 || it.x > W + 230) items.splice(i, 1);
      }

      for (var k = 0; k < cats.length; k++) {
        var c = cats[k];
        c.t += dt; c.anim += dt;

        if (c.state === "prowl") {
          c.x += c.dir * c.speed * dt;
          if (c.x < -80) { c.x = -80; c.dir = 1; }
          if (c.x > W + 80) { c.x = W + 80; c.dir = -1; }
          if (c.t > 700) {
            var p = findPrey(c);
            if (p) { p.hunted = true; c.prey = p; c.state = "crouch"; c.t = 0; c.anim = 0; }
            else if (Math.random() < 0.004) c.dir *= -1;   // idle change of heart
          }
        } else if (c.state === "crouch") {
          if (c.prey) c.dir = c.prey.x > c.x ? 1 : -1;
          if (c.t > A.crouchMs * A.anim.crouch.length) { c.state = "dash"; c.t = 0; c.anim = 0; }
        } else if (c.state === "dash") {
          var target = c.prey;
          if (!target || target.dead) { c.state = "prowl"; c.t = 0; c.prey = null; }
          else {
            var dx = target.x - c.x;
            c.dir = dx > 0 ? 1 : -1;
            c.x += c.dir * 0.22 * dt;
            if (Math.abs(dx) < 26) {                 // caught
              target.dead = true;
              pop(target.x, target.y);
              c.prey = null; c.state = "prowl"; c.t = 0; c.anim = 0;
            } else if (c.t > 2600) {                 // it got away
              target.hunted = false;
              c.prey = null; c.state = "prowl"; c.t = 0;
            }
          }
        }
      }

      for (var q = pops.length - 1; q >= 0; q--) {
        var s = pops[q];
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.0002 * dt;
        s.life -= dt / 700;
        if (s.life <= 0) pops.splice(q, 1);
      }

      draw();
    }

    if (reduce) { draw(); return; }                 // one still frame: nothing drifts, nothing hunts
    requestAnimationFrame(frame);
  }


  /* ---------------- 2. Compile progress bar ---------------- */
  function initProgress() {
    var bar = document.createElement("div");
    bar.id = "compile-bar";
    var fill = document.createElement("div");
    fill.id = "compile-fill";
    bar.appendChild(fill);
    var pct = document.createElement("div");
    pct.id = "compile-pct";
    pct.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    document.body.appendChild(pct);

    var ticking = false;
    function apply() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      var v = Math.round(p * 100);
      fill.style.width = v + "%";
      pct.textContent = "build " + (v >= 100 ? "[done]" : "[" + v + "%]");
      pct.style.opacity = p > 0.01 ? "1" : "0";
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", apply);
    apply();
  }

  /* ---------------- 3. Blueprint spine ---------------- */
  function initBlueprint() {
    var SECTIONS = ["hero", "about", "skills", "experience", "projects", "formacao", "contact"];
    var wrap = document.createElement("div");
    wrap.id = "blueprint";
    wrap.setAttribute("aria-hidden", "true");
    var track = document.createElement("div");
    track.className = "bp-track";
    var fill = document.createElement("div");
    fill.className = "bp-fill";
    wrap.appendChild(track);
    wrap.appendChild(fill);

    var TOP = 8, SPAN = 84; // percentages, matching effects.css
    var nodes = SECTIONS.map(function (id, i) {
      var n = document.createElement("span");
      n.className = "bp-node";
      n.style.top = TOP + (SPAN * i) / (SECTIONS.length - 1) + "%";
      wrap.appendChild(n);
      return n;
    });
    document.body.appendChild(wrap);

    var activeIndex = 0;
    function paintNodes() {
      nodes.forEach(function (n, i) {
        n.classList.toggle("active", i === activeIndex);
        n.classList.toggle("passed", i < activeIndex);
      });
    }

    var ticking = false;
    function apply() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      fill.style.height = p * SPAN + "%";
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", apply);
    apply();

    // Light the node of whichever section is most in view.
    if ("IntersectionObserver" in window) {
      var visible = {};
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            visible[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0;
          });
          var best = -1, bestRatio = 0;
          SECTIONS.forEach(function (id, i) {
            if ((visible[id] || 0) > bestRatio) { bestRatio = visible[id]; best = i; }
          });
          if (best >= 0 && best !== activeIndex) { activeIndex = best; paintNodes(); }
        },
        { threshold: [0.15, 0.4, 0.7] }
      );
      SECTIONS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }
    paintNodes();
  }

  /* ---------------- 4. Boot sequence: click / tap to skip ---------------- */
  function initBootSkip() {
    var el = document.getElementById("boot");
    if (!el) return;
    el.addEventListener("click", function () { el.classList.add("boot-skip"); });
    // Safety net: guarantee the overlay is gone if the circuit entrance never runs (script blocked,
    // canvas unavailable…). While it IS running it owns the timing, so don't cut its sequence short.
    window.setTimeout(function () {
      if (!window.__entranceRunning) el.classList.add("boot-skip");
    }, 4400);
  }

  /* ---------------- 5. Count-up on stats (when they scroll into view) ---------------- */
  function initCountUp() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    function run(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      var dur = 900, start = null;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target;
      }
      requestAnimationFrame(step);
    }
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- 6. Scramble section headings (decode effect) ---------------- */
  function initScramble() {
    if (reduce || !("IntersectionObserver" in window)) return;
    var CH = "!<>-_\\/[]{}=+*^?#01";
    var headings = document.querySelectorAll("main section h2.font-mono");
    function textNodeOf(h) {
      for (var i = h.childNodes.length - 1; i >= 0; i--) {
        var n = h.childNodes[i];
        if (n.nodeType === 3 && n.textContent.trim().length > 1) return n;
      }
      return null;
    }
    function scramble(node) {
      var finalText = node.textContent;
      var lead = finalText.match(/^\s*/)[0];
      var core = finalText.slice(lead.length);
      var frame = 0, total = core.length + 12;
      function tick() {
        var out = "";
        for (var i = 0; i < core.length; i++) {
          if (core[i] === " ") { out += " "; continue; }
          var revealAt = i + 6;
          if (frame >= revealAt) out += core[i];
          else out += CH[(Math.random() * CH.length) | 0];
        }
        node.textContent = lead + out;
        frame++;
        if (frame <= total) setTimeout(tick, 28);
        else node.textContent = finalText;
      }
      tick();
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var node = textNodeOf(e.target);
        if (node) scramble(node);
        io.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    headings.forEach(function (h) { io.observe(h); });
  }

  function boot() {
    try { initHunt(); } catch (e) {}
    try { initProgress(); } catch (e) {}
    try { initBlueprint(); } catch (e) {}
    try { initBootSkip(); } catch (e) {}
    try { initCountUp(); } catch (e) {}
    try { initScramble(); } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
