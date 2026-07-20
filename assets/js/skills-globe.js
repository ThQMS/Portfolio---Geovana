/* skills-globe.js — the skills section: a padlock the toolset breaks open.
 *
 * A wireframe globe used to sit at the centre. It looked fine and said nothing. The lock says the
 * thing the site is about — the tools go at the defence until it gives — while the icons keep
 * doing their real job, which is being *readable*. That constraint drove the design: skills stay
 * parked in their orbit where they can be read and hovered, and only one at a time peels off to
 * strike. Turning them all into projectiles would look better in a trailer and serve a recruiter
 * worse.
 *
 * Two overlaid renderers share one camera:
 *   • WebGLRenderer  → the padlock: body, shackle, keyhole, and the cracks it accumulates.
 *   • CSS3DRenderer  → the Devicon skill icons, placed on the vertices of an icosahedron
 *                      of radius 3.3 (just outside the globe), billboarded to face the camera.
 *
 * Nodes on the FAR side fade out and shrink (dot-product vs the camera), so only the front
 * hemisphere reads clearly — this is what keeps it from looking cramped. OrbitControls give a slow
 * auto-rotate (0.8) plus drag-to-rotate. Three.js is loaded from a CDN via the page import map.
 *
 * The strike only ever picks a node on the front hemisphere, so the hit is always something the
 * viewer can actually see happen.
 */
// Three.js (~700KB via CDN) is imported lazily — see the bootstrap at the bottom of this file.
// These are assigned by loadGlobe() right before initGlobe() runs.
let THREE, CSS3DRenderer, CSS3DObject, OrbitControls;

const ACCENT = "#a855f7";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const LOCK_CRACKS = 5;    // hits needed to break the lock apart
const FRAGMENTS = 12;     // Voronoi pieces the body is carved into
const NODE_RADIUS = 3.3; // skill icons sit just outside the globe
const NODE_SCALE = 0.007; // world-units per CSS pixel for the DOM nodes

const SKILLS = [
  // QA / testing — the core of the craft
  { icon: "devicon-selenium-original", label: "Selenium" },
  { icon: "devicon-playwright-plain", label: "Playwright" },
  { icon: "devicon-cypressio-plain", label: "Cypress" },
  { icon: "devicon-junit-plain", label: "JUnit" },
  { icon: "devicon-postman-plain", label: "Postman" },
  { icon: "devicon-insomnia-plain", label: "Insomnia" },
  // offensive security
  { icon: "devicon-kalilinux-plain", label: "Kali Linux" },
  { icon: "devicon-linux-plain", label: "Linux" },
  { icon: "devicon-bash-plain", label: "Bash" },
  // mobile — Flutter
  { icon: "devicon-flutter-plain", label: "Flutter" },
  { icon: "devicon-dart-plain", label: "Dart" },
  { icon: "devicon-android-plain", label: "Android" },
  { icon: "devicon-apple-original", label: "iOS" },
  { icon: "devicon-androidstudio-plain", label: "Android Studio" },
  { icon: "devicon-firebase-plain", label: "Firebase" },
  // languages / web
  { icon: "devicon-python-plain", label: "Python" },
  { icon: "devicon-javascript-plain", label: "JavaScript" },
  { icon: "devicon-html5-plain", label: "HTML5" },
  { icon: "devicon-css3-plain", label: "CSS3" },
  // data
  { icon: "devicon-mysql-original", label: "MySQL" },
  { icon: "devicon-postgresql-plain", label: "PostgreSQL" },
  { icon: "devicon-sqldeveloper-plain", label: "SQL" },
  // process / tooling
  { icon: "devicon-jira-plain", label: "Jira" },
  { icon: "devicon-trello-plain", label: "Trello" },
  { icon: "devicon-git-plain", label: "Git" },
  { icon: "devicon-azuredevops-plain", label: "Azure DevOps" },
  { icon: "devicon-figma-plain", label: "Figma" },
  { icon: "devicon-vscode-plain", label: "VS Code" },
];

// Icons whose Devicon brand colour is very dark (low luminance) and would vanish on the dark globe —
// these get a white glow via the "is-dark" class (see skills-globe.css).
const DARK_ICONS = new Set([]);

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Unique vertex directions of an icosahedron (radius r, detail 1) — same placement basis as the source.
function icosahedronDirections(r) {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const pos = geo.attributes.position;
  const seen = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!seen.some((s) => s.distanceTo(v) < 0.1)) seen.push(v);
  }
  geo.dispose();
  return seen.map((v) => v.normalize());
}

/* ---- the padlock ----------------------------------------------------------------------------
 * Flat colours: the scene has no lights, so form comes from silhouette, bevel and wireframe.
 *
 * The body is carved into Voronoi fragments at build time. The borders between them are the seams,
 * and the seams are what appear as cracks when a skill lands a hit — so the damage the viewer sees
 * is literally the line the lock will break along. When the last seam lights up, it comes apart.
 */
function roundedRectPoly(w, h, r, perCorner) {
  const pts = [];
  const corners = [
    [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, -Math.PI / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const a = a0 + (i / perCorner) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

/* Sutherland-Hodgman against one Voronoi bisector: keep the side nearer A than B. */
function clipHalf(poly, ax, ay, bx, by) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const nx = ax - bx, ny = ay - by;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = (p[0] - mx) * nx + (p[1] - my) * ny;
    const dq = (q[0] - mx) * nx + (q[1] - my) * ny;
    if (dp >= 0) out.push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/* Seeds relaxed toward their cell centroids (a couple of Lloyd passes), so no fragment comes out
 * a sliver. Straight random seeding gives the odd needle-thin shard that looks like an artefact. */
function fractureCells(n, boundary) {
  const bx = boundary.map((p) => p[0]), by = boundary.map((p) => p[1]);
  const w = Math.max(...bx) - Math.min(...bx), h = Math.max(...by) - Math.min(...by);
  let seeds = [];
  for (let i = 0; i < n; i++) {
    seeds.push([(Math.random() - 0.5) * w * 0.86, (Math.random() - 0.5) * h * 0.86]);
  }
  let cells = [];
  for (let pass = 0; pass < 3; pass++) {
    cells = seeds.map((s, i) => {
      let poly = boundary;
      for (let j = 0; j < seeds.length && poly.length; j++) {
        if (i !== j) poly = clipHalf(poly, s[0], s[1], seeds[j][0], seeds[j][1]);
      }
      return poly;
    });
    if (pass === 2) break;
    seeds = seeds.map((s, i) => {
      const c = cells[i];
      if (c.length < 3) return s;
      let cx = 0, cy = 0;
      for (const p of c) { cx += p[0]; cy += p[1]; }
      cx /= c.length; cy /= c.length;
      return [s[0] * 0.35 + cx * 0.65, s[1] * 0.35 + cy * 0.65];
    });
  }
  return cells.filter((c) => c.length >= 3);
}

function buildPadlock() {
  const group = new THREE.Group();
  const BW = 2.5, BH = 2.1, BD = 0.7;

  const boundary = roundedRectPoly(BW, BH, 0.30, 4);
  const cells = fractureCells(FRAGMENTS, boundary);

  /* No bevel and no per-fragment wireframe: both draw the seam between neighbours, which is
   * exactly what must NOT be visible while the lock is whole. The fragments only ever appear
   * after it breaks, by which point the seams are real. */
  const fragMat = new THREE.MeshBasicMaterial({ color: "#171029" });
  const fragEdge = new THREE.MeshBasicMaterial({
    color: "#2b1f47", wireframe: true, transparent: true, opacity: 0.5,
  });

  /* Each fragment's geometry is re-centred on its own centroid and the mesh moved there instead,
   * so flying it outward is a change of position rather than a rebuild of its vertices. */
  const fragments = [];
  for (const cell of cells) {
    let cx = 0, cy = 0;
    for (const p of cell) { cx += p[0]; cy += p[1]; }
    cx /= cell.length; cy /= cell.length;

    const shape = new THREE.Shape();
    shape.moveTo(cell[0][0] - cx, cell[0][1] - cy);
    for (let i = 1; i < cell.length; i++) shape.lineTo(cell[i][0] - cx, cell[i][1] - cy);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: BD, bevelEnabled: false, curveSegments: 1,
    });
    geo.translate(0, 0, -BD / 2);

    const mesh = new THREE.Mesh(geo, fragMat);
    const wire = new THREE.Mesh(geo, fragEdge);
    mesh.position.set(cx, cy, 0);
    wire.position.copy(mesh.position);
    mesh.visible = false; wire.visible = false;      // shown only once it actually breaks
    group.add(mesh, wire);

    // outward from the middle, with a little lift, so the burst opens up rather than smearing flat
    const d = Math.hypot(cx, cy) || 1;
    fragments.push({
      mesh, wire,
      rest: new THREE.Vector3(cx, cy, 0),
      dir: new THREE.Vector3(cx / d, cy / d + 0.25, (Math.random() - 0.5) * 1.6),
      spin: new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9,
                              (Math.random() - 0.5) * 0.9),
      // a second, independent axis used only on the way home, so the return reads as its own
      // tumble instead of the outward spin played backwards
      spinBack: new THREE.Vector3((Math.random() - 0.5) * 3.0, (Math.random() - 0.5) * 3.0,
                                  (Math.random() - 0.5) * 3.0),
      reach: 2.4 + Math.random() * 2.6,
    });
  }

  /* The intact body: one piece, bevelled, with the silhouette wireframe the section's visual
   * language uses. This is what is on screen for all but a second or two of each cycle. */
  const shellShape = new THREE.Shape(
    boundary.map((p) => new THREE.Vector2(p[0], p[1]))
  );
  const shellGeo = new THREE.ExtrudeGeometry(shellShape, {
    depth: BD, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09, bevelSegments: 2,
    curveSegments: 1,
  });
  shellGeo.translate(0, 0, -BD / 2);
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: "#171029" }));
  const shellWire = new THREE.Mesh(
    shellGeo,
    new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.16 })
  );
  group.add(shell, shellWire);

  const faceZ = BD / 2 + 0.10;

  /* Seams: every cell border, deduplicated so a shared edge isn't drawn twice, ordered by distance
   * from the middle so damage spreads outward from the first hit. Drawn on both faces — the lock
   * auto-rotates, and a crack that only exists on the front reads as a decal. */
  const segList = [];
  const seen = {};
  for (const cell of cells) {
    for (let i = 0; i < cell.length; i++) {
      const p = cell[i], q = cell[(i + 1) % cell.length];
      const key = [p[0], p[1], q[0], q[1]].map((v) => v.toFixed(3)).sort().join(",");
      if (seen[key]) continue;
      seen[key] = 1;
      const mid = Math.hypot((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      segList.push({ p, q, d: mid });
    }
  }
  segList.sort((s1, s2) => s1.d - s2.d);

  const pos = new Float32Array(segList.length * 12);   // two faces per seam
  const col = new Float32Array(segList.length * 12);
  for (let i = 0; i < segList.length; i++) {
    const s = segList[i], o = i * 12;
    const zs = [faceZ, -faceZ];
    for (let f = 0; f < 2; f++) {
      const b = o + f * 6;
      pos[b] = s.p[0]; pos[b + 1] = s.p[1]; pos[b + 2] = zs[f];
      pos[b + 3] = s.q[0]; pos[b + 4] = s.q[1]; pos[b + 5] = zs[f];
    }
    for (let k = 0; k < 4; k++) {
      col[o + k * 3] = 0.94; col[o + k * 3 + 1] = 0.67; col[o + k * 3 + 2] = 0.99;
    }
  }
  const seamGeo = new THREE.BufferGeometry();
  seamGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  seamGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  seamGeo.setDrawRange(0, 0);
  const seams = new THREE.LineSegments(
    seamGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })
  );
  seams.userData = { total: segList.length * 4 };
  group.add(seams);

  // an inset face plate, so the front reads as a surface rather than a flat silhouette
  const plate = new THREE.Mesh(
    new THREE.ShapeGeometry(new THREE.Shape(
      roundedRectPoly(BW * 0.78, BH * 0.76, 0.22, 3).map((p) => new THREE.Vector2(p[0], p[1]))
    )),
    new THREE.MeshBasicMaterial({ color: "#1e1636", transparent: true, opacity: 0.9 })
  );
  plate.position.z = faceZ - 0.05;
  group.add(plate);

  // shackle, its own piece: it flies off with the rest
  const pivot = new THREE.Group();
  const steel = new THREE.MeshBasicMaterial({ color: "#3a2c5e" });
  const steelWire = new THREE.MeshBasicMaterial({
    color: ACCENT, wireframe: true, transparent: true, opacity: 0.28,
  });
  const R = BW * 0.30, TUBE = 0.17;
  const arcGeo = new THREE.TorusGeometry(R, TUBE, 10, 24, Math.PI);
  const arc = new THREE.Mesh(arcGeo, steel);
  const arcW = new THREE.Mesh(arcGeo, steelWire);
  arc.position.set(0, BH * 0.5 + 0.44, 0); arcW.position.copy(arc.position);
  const legGeo = new THREE.CylinderGeometry(TUBE, TUBE, 0.56, 10);
  for (const dx of [-R, R]) {
    const leg = new THREE.Mesh(legGeo, steel);
    const legW = new THREE.Mesh(legGeo, steelWire);
    leg.position.set(dx, BH * 0.5 + 0.17, 0); legW.position.copy(leg.position);
    pivot.add(leg, legW);
  }
  pivot.add(arc, arcW);
  group.add(pivot);

  // keyhole
  const dark = new THREE.MeshBasicMaterial({ color: "#0a0714" });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.19, 18), dark);
  hole.position.set(0, 0.06, faceZ);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.46), dark);
  slot.position.set(0, -0.22, faceZ);
  group.add(hole, slot);

  return { group, fragments, seams, pivot, plate, shell: [shell, shellWire], face: [hole, slot] };
}

function buildNode(skill, dir) {
  const wrapper = document.createElement("div");
  const inner = document.createElement("div");
  inner.className = "skill-node";
  inner.title = skill.label;
  const icon = document.createElement("i");
  icon.className = skill.icon + " colored" + (DARK_ICONS.has(skill.icon) ? " is-dark" : ""); // ".colored" applies Devicon's brand colours
  const label = document.createElement("span");
  label.textContent = skill.label;
  inner.append(icon, label);
  wrapper.appendChild(inner);
  const obj = new CSS3DObject(wrapper);
  obj.position.copy(dir).multiplyScalar(NODE_RADIUS);
  obj.userData = { dir: dir.clone(), inner };
  return obj;
}

function initGlobe(mount) {
  const skills = shuffle(SKILLS);
  const dirs = icosahedronDirections(NODE_RADIUS);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 0, 9); // direction seed; resize() adjusts the actual distance adaptively

  const gl = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  Object.assign(gl.domElement.style, { position: "absolute", inset: "0", zIndex: "1" });
  mount.appendChild(gl.domElement);

  const css = new CSS3DRenderer();
  Object.assign(css.domElement.style, { position: "absolute", inset: "0", zIndex: "2", pointerEvents: "none" });
  mount.appendChild(css.domElement);

  const lock = buildPadlock();
  scene.add(lock.group);

  const nodes = dirs.map((dir, i) => {
    const obj = buildNode(skills[i % skills.length], dir);
    obj.scale.setScalar(NODE_SCALE);
    scene.add(obj);
    return obj;
  });

  const controls = new OrbitControls(camera, gl.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.5;
  controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotateSpeed = 0.8;

  const camDir = new THREE.Vector3();

  // The strikes only happen while the section is in view: attacking a lock nobody is looking at is
  // wasted, and it also spares the CPU when the section is scrolled away.
  let onScreen = true;
  if ("IntersectionObserver" in window) {
    onScreen = false;
    new IntersectionObserver(function (entries) {
      onScreen = entries.some(function (e) { return e.isIntersecting; });
    }, { threshold: 0.25 }).observe(mount);
  }

  /* The strike/damage cycle.
   *   idle       → wait, then pick a visible node and send it in
   *   strike     → it flies at the lock, connects, and returns to its slot
   *   shatter    → the last hit takes the lock apart; the pieces fly outward and hang there
   *   reassemble → every piece eases back to exactly where it belongs, and it starts over
   * `damage` counts landed hits; seams light up in step, and they are the lines it breaks along. */
  let phase = "idle";
  let phaseT = 0;
  let damage = 0;
  let attacker = null;
  let shake = 0;
  let seamShown = 0;                       // vertices of the seam buffer currently drawn
  const sparks = [];
  let nextStrike = 900;

  const SEAM_TOTAL = lock.seams.userData.total;
  const HOLD = 2200, FLY = 900, BACK = 1500;

  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(90);
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkPts = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ color: "#f0abfc", size: 0.12, transparent: true, opacity: 0 })
  );
  scene.add(sparkPts);

  function burstSparks(at) {
    sparks.length = 0;
    for (let i = 0; i < 30; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize().multiplyScalar(0.02 + Math.random() * 0.05);
      sparks.push({ p: at.clone(), v: d, life: 1 });
    }
  }

  // Only ever pick something the viewer can actually see connect.
  function pickAttacker() {
    camera.getWorldPosition(camDir).normalize();
    const front = nodes.filter((n) => n.userData.dir.dot(camDir) > 0.45);
    if (!front.length) return null;
    return front[(Math.random() * front.length) | 0];
  }

  /* Pieces fly out along their own direction and tumble. `returning` adds a second, independent
   * rotation on the way home (see spinBack) that lands back at zero, so the reassembly is a spin
   * rather than the outward tumble rewound frame-for-frame. */
  function setBurst(u, returning) {
    const e = 1 - Math.pow(1 - u, 2.2);
    // a bump that is 0 at both ends and peaks mid-flight; only used on the return leg
    const back = returning ? Math.sin(Math.PI * u) : 0;
    for (const f of lock.fragments) {
      const d = f.reach * e;
      f.mesh.position.set(f.rest.x + f.dir.x * d, f.rest.y + f.dir.y * d, f.rest.z + f.dir.z * d);
      f.wire.position.copy(f.mesh.position);
      f.mesh.rotation.x = f.spin.x * e * 4 + f.spinBack.x * back;
      f.mesh.rotation.y = f.spin.y * e * 4 + f.spinBack.y * back;
      f.mesh.rotation.z = f.spin.z * e * 4 + f.spinBack.z * back;
      f.wire.rotation.copy(f.mesh.rotation);
      // the seam edges fade out as the piece nears home, so no full crack pattern flashes at
      // the instant before the swap to the solid shell
      f.wire.material.opacity = 0.5 * Math.min(1, e * 2.2);
    }
    lock.pivot.position.set(0, 2.0 * e, 0);
    lock.pivot.rotation.z = e * 2.2;
    /* The swap: whole body out, pieces in, on the first frame of the burst — hidden by the shake
     * and the spark flash. Seam visibility is deliberately NOT touched here: the seams live or die
     * by their draw range (reset to zero when it shatters), so an intact lock can never wear the
     * old cracks. */
    const whole = u < 0.001;
    for (const m of lock.shell) m.visible = whole;
    for (const f of lock.fragments) { f.mesh.visible = !whole; f.wire.visible = !whole; }
    lock.plate.visible = whole;
    for (const m of lock.face) m.visible = whole;
  }

  function stepCycle(dt) {
    phaseT += dt;

    if (phase === "idle") {
      nextStrike -= dt;
      if (nextStrike <= 0) {
        attacker = pickAttacker();
        if (attacker) {
          attacker.userData.home = attacker.position.clone();
          phase = "strike"; phaseT = 0;
        } else {
          nextStrike = 400;                        // nothing in view yet; look again shortly
        }
      }
    } else if (phase === "strike") {
      const IN = 380, OUT = 560;
      const h = attacker.userData.home;
      if (phaseT <= IN) {
        const u = phaseT / IN;
        attacker.position.copy(h).multiplyScalar(1 - u * u * 0.62);   // accelerate into the hit
      } else if (phaseT <= IN + OUT) {
        if (attacker.userData.landed !== true) {   // the moment of contact
          attacker.userData.landed = true;
          damage = Math.min(LOCK_CRACKS, damage + 1);
          shake = 1;
          burstSparks(attacker.position);
          // The final hit breaks it NOW, not after the attacker's return leg — waiting left a
          // half-second of an intact, fully-cracked lock just sitting there.
          if (damage >= LOCK_CRACKS) {
            attacker.position.copy(h);
            attacker.userData.landed = false;
            attacker = null;
            seamShown = 0;
            lock.seams.geometry.setDrawRange(0, 0);   // the pieces carry the meaning now; drop the lines
            phase = "shatter"; phaseT = 0;
            return;
          }
        }
        const u = (phaseT - IN) / OUT;
        const e = 1 - Math.pow(1 - u, 3);
        attacker.position.copy(h).multiplyScalar(0.38 + e * 0.62);
      } else {
        attacker.position.copy(h);
        attacker.userData.landed = false;
        attacker = null;
        if (damage >= LOCK_CRACKS) { phase = "shatter"; phaseT = 0; }
        else { phase = "idle"; phaseT = 0; nextStrike = 1500 + Math.random() * 1800; }
      }
    } else if (phase === "shatter") {
      setBurst(Math.min(1, phaseT / FLY));
      if (phaseT > FLY + HOLD) { phase = "reassemble"; phaseT = 0; }
    } else if (phase === "reassemble") {
      const u = Math.min(1, phaseT / BACK);
      setBurst(1 - (1 - Math.pow(1 - u, 3)), true); // ease home, settling rather than snapping
      if (u >= 1) {
        setBurst(0);
        damage = 0;
        phase = "idle"; phaseT = 0; nextStrike = 1600 + Math.random() * 1800;
      }
    }

    /* Seams light up in step with the damage, growing rather than popping. They are ordered from
     * the middle outward, so the fracture spreads from the first hit toward the edges. */
    if (phase !== "shatter" && phase !== "reassemble") {
      const want = Math.round((damage / LOCK_CRACKS) * SEAM_TOTAL / 4) * 4;
      if (seamShown < want) {
        seamShown = Math.min(want, seamShown + Math.max(4, Math.round(dt * 0.10) * 4));
        lock.seams.geometry.setDrawRange(0, seamShown);
      }
    }

    // impact shake, decaying
    if (shake > 0) {
      shake = Math.max(0, shake - dt / 240);
      lock.group.position.x = (Math.random() - 0.5) * 0.16 * shake;
      lock.group.position.y = (Math.random() - 0.5) * 0.16 * shake;
    } else {
      lock.group.position.set(0, 0, 0);
    }

    // sparks
    if (sparks.length) {
      let alive = 0;
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.p.addScaledVector(s.v, dt / 16);
        s.life -= dt / 620;
        const o = i * 3;
        sparkPos[o] = s.p.x; sparkPos[o + 1] = s.p.y; sparkPos[o + 2] = s.p.z;
        if (s.life > 0) alive++;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkPts.material.opacity = Math.max(0, alive / sparks.length) * 0.9;
      if (!alive) sparks.length = 0;
    } else {
      sparkPts.material.opacity = 0;
    }
  }

  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    camera.aspect = w / h;
    // Adaptive distance: frame the node sphere to ~95% of the smaller mount dimension, so the
    // section reads large on any monitor instead of a fixed world-space size.
    const bound = NODE_RADIUS + 0.4; // sphere radius + node card overhang
    const halfV = Math.tan((camera.fov * Math.PI) / 360);
    const distV = bound / (0.95 * halfV);
    const distH = bound / (0.95 * halfV * camera.aspect);
    camera.position.setLength(Math.max(distV, distH));
    camera.updateProjectionMatrix();
    gl.setSize(w, h);
    css.setSize(w, h);
  }

  let lastT = 0;
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = lastT ? Math.min(90, now - lastT) : 16;
    lastT = now;
    // pause the whole hunt when off-screen; a strike in progress simply resumes on return
    if (!prefersReducedMotion && onScreen) stepCycle(dt);
    controls.update();
    camera.getWorldPosition(camDir).normalize();
    for (const obj of nodes) {
      obj.quaternion.copy(camera.quaternion); // billboard toward the camera
      if (obj === attacker) { obj.userData.inner.style.opacity = "1"; continue; }
      const facing = obj.userData.dir.dot(camDir); // 1 = front of globe, <0 = behind
      const s = facing > 0.1 ? Math.max(0, Math.min(1, (facing - 0.1) * 2)) : 0;
      obj.userData.inner.style.opacity = String(s);
      obj.userData.inner.style.pointerEvents = s > 0.8 ? "auto" : "none";
      obj.scale.setScalar(NODE_SCALE * (0.8 + 0.4 * s));
    }
    gl.render(scene, camera);
    css.render(scene, camera);
  }

  resize();
  controls.update();
  animate();

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(mount);
  else window.addEventListener("resize", resize);
}

// ---- Lazy bootstrap ----
// The CDN download only starts when the skills section approaches the viewport (600px early).
// If the CDN is unreachable, a quiet fallback note appears instead of an empty void.
function loadGlobe(mount) {
  Promise.all([
    import("three"),
    import("three/addons/renderers/CSS3DRenderer.js"),
    import("three/addons/controls/OrbitControls.js"),
  ])
    .then(function (mods) {
      THREE = mods[0];
      CSS3DRenderer = mods[1].CSS3DRenderer;
      CSS3DObject = mods[1].CSS3DObject;
      OrbitControls = mods[2].OrbitControls;
      initGlobe(mount);
    })
    .catch(function () {
      // Three.js failed to load, or the device has no usable WebGL context. Fall back to the flat
      // 2D globe — the plan B: try full 3D everywhere, drop to the light version where it can't run.
      mount.innerHTML = "";
      try { renderLightGlobe(mount); }
      catch (e) {
        mount.innerHTML =
          '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:12px;color:#8b949e">// universo indisponível no momento</div>';
      }
    });
}

// Lightweight static grid for mobile — avoids the ~700KB Three.js download and the WebGL/CSS3D
// render loop that stutters on phones. Same skills, same Devicon icons, no runtime cost.
function renderStatic(mount) {
  var wrap = document.createElement("div");
  wrap.className = "skills-static";
  shuffle(SKILLS).forEach(function (s) {
    var item = document.createElement("div");
    item.className = "ss-item";
    item.title = s.label;
    var icon = document.createElement("i");
    icon.className = s.icon + " colored" + (DARK_ICONS.has(s.icon) ? " is-dark" : "");
    var label = document.createElement("span");
    label.textContent = s.label;
    item.append(icon, label);
    wrap.appendChild(item);
  });
  mount.appendChild(wrap);
  var caption = document.getElementById("skills-caption");
  if (caption) caption.style.display = "none"; // static grid: nothing to drag
}

function buildGeodesic(detail) {
  var t = (1 + Math.sqrt(5)) / 2;
  var base = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
              [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  var faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4],
               [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8],
               [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  function lerp(p, q, s) { return [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s, p[2] + (q[2] - p[2]) * s]; }
  function norm(p) { var l = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]); return [p[0] / l, p[1] / l, p[2] / l]; }
  var verts = [], vmap = {}, edges = {}, cols = detail + 1;
  function addV(p) {
    var n = norm(p), k = n[0].toFixed(3) + "," + n[1].toFixed(3) + "," + n[2].toFixed(3);
    if (vmap[k] === undefined) { vmap[k] = verts.length; verts.push(n); }
    return vmap[k];
  }
  function addE(i, j) { if (i !== j) edges[Math.min(i, j) + "_" + Math.max(i, j)] = [Math.min(i, j), Math.max(i, j)]; }
  faces.forEach(function (f) {
    var a = base[f[0]], b = base[f[1]], c = base[f[2]], grid = [];
    for (var i = 0; i <= cols; i++) {
      grid[i] = [];
      var aj = lerp(a, c, i / cols), bj = lerp(b, c, i / cols), rows = cols - i;
      for (var j = 0; j <= rows; j++) grid[i][j] = rows === 0 ? addV(aj) : addV(lerp(aj, bj, j / rows));
    }
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < 2 * (cols - i) - 1; j++) {
        var k = Math.floor(j / 2), v1, v2, v3;
        if (j % 2 === 0) { v1 = grid[i][k + 1]; v2 = grid[i + 1][k]; v3 = grid[i][k]; }
        else { v1 = grid[i][k + 1]; v2 = grid[i + 1][k + 1]; v3 = grid[i + 1][k]; }
        addE(v1, v2); addE(v2, v3); addE(v3, v1);
      }
    }
  });
  return { verts: verts, edges: Object.keys(edges).map(function (k) { return edges[k]; }) };
}

// Light globe — a real rotating 3D icon sphere built from plain DOM nodes projected by hand
// (fibonacci distribution + Y/X rotation + perspective scale). ~31 nodes, no WebGL, no Three.js:
// the phone downloads nothing extra and the loop is cheap. Drag horizontally to spin.
function renderLightGlobe(mount) {
  var skills = shuffle(SKILLS);
  var N = skills.length;
  var container = document.createElement("div");
  container.className = "light-globe";

  var nodes = skills.map(function (s, i) {
    var el = document.createElement("div");
    el.className = "lg-node";
    var icon = document.createElement("i");
    icon.className = s.icon + " colored" + (DARK_ICONS.has(s.icon) ? " is-dark" : "");
    var label = document.createElement("span");
    label.textContent = s.label;
    el.append(icon, label);
    container.appendChild(el);
    var y = 1 - (i / (N - 1)) * 2;        // 1 .. -1
    var rad = Math.sqrt(Math.max(0, 1 - y * y));
    var theta = i * 2.399963;             // golden angle
    return { el: el, x: Math.cos(theta) * rad, y: y, z: Math.sin(theta) * rad };
  });
  mount.appendChild(container);

  // Wireframe cage: an icosahedron (12 verts, 30 edges) drawn on a light canvas behind the icons,
  // rotating with them — same shape the desktop WebGL globe uses, at a fraction of the cost.
  var wire = document.createElement("canvas");
  wire.className = "lg-wire";
  container.insertBefore(wire, container.firstChild);
  var wctx = wire.getContext("2d");
  var DPR = 1;   // 1 device-pixel is plenty for thin wireframe lines; halves the cage fill on dense phones
  // detail 2 is the desktop-matching dense cage (~480 edges); phones use detail 1 (~120), which is
  // the difference between a laggy drag and a smooth one.
  var geo = buildGeodesic(window.matchMedia("(min-width: 768px)").matches ? 2 : 1);
  var wv = geo.verts, wedges = geo.edges;
  var wsize = 0;
  var wproj = wv.map(function () { return { x: 0, y: 0, z: 0 }; }); // reused each frame, no allocation
  var EDGE_BUCKETS = 5;                                             // edges batched by depth/opacity

  var BASE = 0.008;
  var angY = 0, angX = -0.32, velY = BASE, velX = 0;
  var dragging = false, lastX = 0, lastY = 0;

  function coords(e) { var t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }
  function down(e) { dragging = true; var p = coords(e); lastX = p.x; lastY = p.y; }
  function move(e) {
    if (!dragging) return;
    var p = coords(e), dx = p.x - lastX, dy = p.y - lastY;
    angY += dx * 0.007;
    velY = dx * 0.0009;
    if (e.type !== "touchmove") { angX += -dy * 0.007; velX = -dy * 0.0009; } // vertical tilt: mouse only
    lastX = p.x; lastY = p.y;
  }
  function up() { dragging = false; }
  container.addEventListener("touchstart", down, { passive: true });
  container.addEventListener("touchmove", move, { passive: true });
  container.addEventListener("touchend", up);
  container.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);

  // Only animate while the globe is actually on screen: it used to spin continuously from page
  // load, competing for the phone's main thread with the entrance animation and the rest of the page.
  var onScreen = true, pageVisible = !document.hidden;
  if ("IntersectionObserver" in window) {
    onScreen = false;
    new IntersectionObserver(function (entries) {
      onScreen = entries.some(function (e) { return e.isIntersecting; });
    }, { rootMargin: "120px" }).observe(mount);
  }
  document.addEventListener("visibilitychange", function () {
    pageVisible = !document.hidden;
  });

  var last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (!onScreen || !pageVisible) return;  // idle while off-screen or in a background tab
    // Cap the rate even while dragging: moving 28 DOM icons every frame at 120Hz is what made
    // rotation feel heavy on phones. ~45fps under the finger stays responsive; ~24fps idle.
    if (t - last < (dragging ? 22 : 42)) return;
    last = t;
    if (!dragging) {
      angY += velY; angX += velX;
      velY += (BASE - velY) * 0.03; // ease back to gentle auto-rotate
      velX *= 0.94;
    }
    if (angX > 0.6) angX = 0.6; else if (angX < -0.6) angX = -0.6;
    var w = mount.clientWidth, h = mount.clientHeight;
    var R = Math.min(w, h) * 0.4, cx = w / 2, cy = h / 2;
    var cy_ = Math.cos(angY), sy = Math.sin(angY), cx_ = Math.cos(angX), sx = Math.sin(angX);

    // --- wireframe cage ---
    if (wsize !== w * 10000 + h) { // resize canvas only when needed
      wsize = w * 10000 + h;
      wire.width = w * DPR; wire.height = h * DPR;
      wire.style.width = w + "px"; wire.style.height = h + "px";
      wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    wctx.clearRect(0, 0, w, h);
    var Rw = R * 0.82;
    for (var vi = 0; vi < wv.length; vi++) {              // project in place — no per-frame garbage
      var v = wv[vi], p3 = wproj[vi];
      var vx1 = v[0] * cy_ - v[2] * sy, vz1 = v[0] * sy + v[2] * cy_;
      var vy2 = v[1] * cx_ - vz1 * sx, vz2 = v[1] * sx + vz1 * cx_;
      p3.x = cx + vx1 * Rw; p3.y = cy + vy2 * Rw; p3.z = vz2;
    }
    // Batch the cage by depth: one stroke() per opacity band instead of one per edge (~480 → 5).
    wctx.lineWidth = 1;
    for (var band = 0; band < EDGE_BUCKETS; band++) {
      wctx.beginPath();
      var drew = false;
      for (var e = 0; e < wedges.length; e++) {
        var pa = wproj[wedges[e][0]], pb = wproj[wedges[e][1]];
        var depth = ((pa.z + pb.z) / 2 + 1.15) / 2.15;     // 0 back .. 1 front
        if (((depth * (EDGE_BUCKETS - 1) + 0.5) | 0) !== band) continue;
        wctx.moveTo(pa.x, pa.y);
        wctx.lineTo(pb.x, pb.y);
        drew = true;
      }
      if (!drew) continue;
      var op = (band / (EDGE_BUCKETS - 1)) * 0.26;         // ~0.02 back → ~0.26 front, like desktop
      wctx.strokeStyle = "rgba(168,85,247," + op.toFixed(3) + ")";
      wctx.stroke();
    }

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var x1 = n.x * cy_ - n.z * sy;
      var z1 = n.x * sy + n.z * cy_;
      var y2 = n.y * cx_ - z1 * sx;
      var z2 = n.y * sx + z1 * cx_;
      var sc = (z2 + 1.7) / 2.7;                                  // depth -> scale
      var op = Math.max(0, Math.min(1, (z2 + 1.1) / 1.7));        // depth -> opacity
      // Position purely with transform: writing left/top every frame forced a full layout pass for
      // every node, which is what made dragging feel heavy on phones.
      n.el.style.transform =
        "translate3d(" + (cx + x1 * R).toFixed(1) + "px," + (cy + y2 * R).toFixed(1) + "px,0)" +
        " translate(-50%,-50%) scale(" + sc.toFixed(3) + ")";
      var opS = op.toFixed(2);
      if (opS !== n.lastOp) { n.el.style.opacity = opS; n.lastOp = opS; }
      var z = ((z2 + 1) * 100) | 0;
      if (z !== n.lastZ) { n.el.style.zIndex = z; n.lastZ = z; }
      var pe = op > 0.75 ? "auto" : "none";
      if (pe !== n.lastPe) { n.el.style.pointerEvents = pe; n.lastPe = pe; }
    }
  }
  requestAnimationFrame(frame);
}

const mount = document.getElementById("skills-globe");
const isMobile = window.matchMedia("(max-width: 767px)").matches;
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (mount) {
  if (isMobile) {
    if (prefersReduced) renderStatic(mount); // no motion requested -> static grid
    else renderLightGlobe(mount);            // wireframe-cage globe: light, no WebGL, no scroll-trap
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          io.disconnect();
          loadGlobe(mount);
        }
      },
      { rootMargin: "600px" }
    );
    io.observe(mount);
  } else {
    loadGlobe(mount);
  }
}
