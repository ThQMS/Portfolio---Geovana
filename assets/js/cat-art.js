/* cat-art.js — where the cat sprite sheet lives and what's in it.
 *
 * Art: "Pet Cats Pack" by LuizMelo — https://luizmelo.itch.io/pet-cat-pack
 * Licence: CC0 (Creative Commons Zero). Free for commercial use, no attribution required; it is
 * recorded here anyway so the provenance of every asset on the site stays traceable.
 *
 * Only the black cat (Cat-2) ships, and only the frames actually used, cropped to a shared 30x16
 * box so a cat never jumps between frames. The pack's other five cats and its unused poses are
 * left out — the sheet is 810x16 and 2KB.
 *
 * The pack has no pounce, so the hunt is choreographed from what it does have: `crouch` is lifted
 * from the middle of the Stretching animation, where the cat drops its front and lifts its rear —
 * which is the same coil that precedes a real pounce. Reusing frames this way is ordinary practice.
 *
 * Earlier versions of this file tried to generate the cat: first as vector geometry, then as
 * hand-authored pixels. Both failed the same way. Character art is drawing, and drawing isn't
 * something this codebase can derive — sourcing it and integrating it carefully is.
 */
window.CatArt = {
  src: "assets/img/cat-sprite.png",
  frameW: 30,
  frameH: 16,
  frames: 27,
  anim: {
    sit: [0],                                            // resting, facing the viewer
    groom: [1, 2, 3, 4, 5],                              // washes itself — a contented cat
    walk: [6, 7, 8, 9, 10, 11, 12, 13],                  // side-on prowl
    crouch: [14, 15, 16, 17, 18],                        // front down, rear up: the coil
    run: [19, 20, 21, 22, 23, 24, 25, 26],               // the dash
  },
  groomMs: 170,
  walkMs: 110,
  crouchMs: 150,   // the coil needs to be readable, not a flicker
  runMs: 70,
};
