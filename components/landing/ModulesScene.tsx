"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, pinnedTail } from "@/lib/animations/gsap";
import { rooms } from "@/lib/constants/landing";
import { registerRoomTargets } from "@/lib/rooms-nav";

/**
 * ENTER THE ROOMS -- a five-scene scroll story.
 *
 * One pinned stage, one master timeline, and one DOM element (`[data-morph]`) that
 * survives every scene: it is the chat capsule in TEA, stretches into the reel frame in
 * CREATE, tilts into a postcard in ONE DAY, snaps to a plan block in ALIGN, and settles
 * as a photograph in VAULT. Nothing crossfades into existence; the object carries the
 * story and each scene's own furniture arrives around it.
 *
 * Label map (normalised 0-1, so every position reads as a scroll percentage):
 *
 *   tea            0.00  scattered chat, type clipped by the left edge
 *   teaToCreate    0.13  shards scatter, the capsule stretches wide
 *   create         0.20  reel frame dominant right, playhead running
 *   createToOneDay 0.33  frames separate, one enlarges
 *   oneDay         0.40  possibilities spread across the whole viewport
 *   oneDayToAlign  0.53  fragments drift onto shared axes
 *   align          0.60  everything converges centrally and locks
 *   alignToVault   0.73  the grid loosens into photographs
 *   vault          0.82  layered memory depth, one hero frame
 *   finale         0.92  the five chapters resolve into one line
 */
const L = {
  tea: 0,
  teaToCreate: 0.145,
  create: 0.225,
  createToOneDay: 0.355,
  oneDay: 0.435,
  oneDayToAlign: 0.565,
  align: 0.635,
  alignToVault: 0.755,
  vault: 0.83,
  finale: 0.93,
} as const;

/**
 * Where each room is *itself*.
 *
 * A label marks the moment a scene starts arriving; it is not the moment the scene is
 * worth looking at. These are the composed peaks -- after the scene's furniture has
 * landed and before the next transition starts pulling it apart -- and they are what
 * the menu navigates to. Keyed by index into `rooms`, which runs in story order.
 */
const PEAK = [0.125, 0.33, 0.557, 0.748, 0.922] as const;

/**
 * Scene furniture coordinates, as vw/vh offsets from the centre of the viewport.
 *
 * Two zones are reserved and no coordinate may enter them:
 *   lower-left  -- the bottom-anchored title and the chapter rail
 *   upper-left  -- the supporting paragraph
 * Everything below is placed in the remaining field, which is why TEA and VAULT lean
 * right and ONE DAY orbits its postcard instead of spreading over the whole screen.
 */
const TEA_SHARDS = [
  { text: "who's awake", x: -2, y: -30, s: 1, blur: 0 },
  { text: "bhai suno", x: 27, y: -26, s: 0.84, blur: 1.4 },
  { text: "spill", x: 33, y: -9, s: 0.68, blur: 2.6 },
  { text: "screenshot bhejo", x: 31, y: 11, s: 0.78, blur: 1.9 },
  { text: "no way 💀", x: 9, y: 26, s: 0.9, blur: 0 },
  { text: "2:41 am", x: -19, y: -13, s: 0.6, blur: 3 },
];

/** Orbit around the postcard, which sits at x +20vw. Nothing crosses into the title
 *  column on the left, and nothing passes x 40 so the right gutter stays clear. */
const ONE_DAY_FRAGMENTS = [
  { text: "GOA", x: 1, y: -25, s: 1.1 },
  { text: "ROAD TRIP", x: 33, y: -21, s: 0.88 },
  { text: "KARTING", x: 39, y: 3, s: 0.8 },
  { text: "CAFÉ", x: 34, y: 21, s: 0.76 },
  // These two used to sit at (6,27) and (18,24), which is exactly where the postcard
  // prints its own GOA / coordinates label. At 1366 they cleared its bottom edge by a
  // few pixels; at 1024 and below they landed straight on top of it. Pushed out and
  // down so they orbit the card at every stage size rather than only the widest one.
  { text: "PHOTOSHOOT", x: 2, y: 31, s: 0.84 },
  { text: "15.2993° N", x: 2, y: -6, s: 0.6 },
  { text: "SOMEDAY", x: 25, y: 29, s: 0.58 },
];

/** ALIGN resolves into two flanking columns either side of the locked plan block.
 *  The previous build sent all ten blocks to x:0,y:0, which piled them on one point
 *  and made the scene read as chaos at exactly the moment it must read as order. */
const ALIGN_GRID = Array.from({ length: 10 }, (_, i) => ({
  x: i < 5 ? -17 : 17,
  y: [-16, -8, 0, 8, 16][i % 5],
}));

/** Layered around the hero frame at x +7vw; the lower-left quadrant stays empty. */
const VAULT_FRAMES = [
  { x: -20, y: -5, r: -7, s: 0.62, z: -140 },
  { x: 26, y: -25, r: 6, s: 0.54, z: -200 },
  { x: 34, y: 9, r: 4, s: 0.48, z: -260 },
  { x: 9, y: 21, r: -5, s: 0.58, z: -180 },
  { x: -16, y: 5, r: 8, s: 0.42, z: -300 },
];

export function ModulesScene() {
  const sectionRef = useRef<HTMLElement>(null);

  // Plain useLayoutEffect + gsap.matchMedia, matching HeroScene and SocialChaosScene.
  // useGSAP wraps the body in its own gsap.context, which then fights matchMedia over
  // ownership of the same tweens: the ScrollTrigger got built and instantly reverted,
  // leaving an orphaned zero-height pin-spacer and an unpinned section.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = gsap.matchMedia();

    /**
     * The whole story. `d` scales every travel distance -- and, since this pass, the
     * morph's own dimensions -- for smaller stages. Scaling only the distances made the
     * object relatively *larger* on a narrow stage: at 768 the ONE DAY postcard was
     * 26vw wide and 46vh tall while everything orbiting it had been pulled 30% closer,
     * so the orbit ended up inside the card.
     */
    const buildStage = (d: number, scroll: number) => {
      const stage = section.querySelector<HTMLElement>("[data-stage]");
      const morph = section.querySelector<HTMLElement>("[data-morph]");
      const q = <T extends HTMLElement>(s: string) => gsap.utils.toArray<T>(s, section);
      const one = (s: string) => section.querySelector<HTMLElement>(s);

      const vw = (n: number) => (n / 100) * window.innerWidth;
      const vh = (n: number) => (n / 100) * window.innerHeight;

      const atmos = q('[data-atmos]');
      const chapters = q('[data-chapter]');
      const titles = q('[data-title]');
      const notes = q('[data-note]');
      const scenes = q('[data-scene]');

      // Scene ownership. Each scene is gated as a whole with autoAlpha, so an inactive
      // scene is not merely transparent but visibility:hidden and unhittable. Without
      // this, anything not individually reset (the five paragraphs, for one) stayed on
      // screen for the entire story and piled up into noise.
      const OWN: Array<[number, number]> = [
        [L.tea, L.create + 0.01],
        [L.create - 0.01, L.oneDay + 0.01],
        [L.oneDay - 0.01, L.align + 0.01],
        [L.align - 0.01, L.vault + 0.025],
        [L.vault - 0.02, L.finale + 0.05],
      ];

      // Resting state: every scene off, the object as a TEA capsule.
      gsap.set(atmos, { opacity: 0 });
      gsap.set(scenes, { autoAlpha: 0 });
      gsap.set(titles, { opacity: 0, yPercent: 18 });
      gsap.set(notes, { opacity: 0, y: 14 });
      gsap.set(q('[data-shard]'), { opacity: 0, scale: 0.8 });
      gsap.set(q('[data-frag]'), { opacity: 0, scale: 0.7 });
      gsap.set(q('[data-block]'), { opacity: 0 });
      gsap.set(q('[data-lock]'), { opacity: 0, scaleX: 0, transformOrigin: '50% 50%' });
      gsap.set(q('[data-photo]'), { opacity: 0 });
      gsap.set(q('[data-face]'), { opacity: 0 });
      gsap.set(one('[data-face="tea"]'), { opacity: 1 });
      gsap.set(one('[data-finale]'), { opacity: 0, yPercent: 40 });
      gsap.set(one('[data-strip]'), { opacity: 0 });
      gsap.set(one('[data-playhead]'), { opacity: 0 });
      gsap.set(chapters, { opacity: 0.22 });

      gsap.set(morph, {
        xPercent: -50,
        yPercent: -50,
        width: () => Math.min(260, vw(22)) * d,
        height: () => Math.min(74, vh(9)) * d,
        borderRadius: 26,
        x: () => vw(19) * d,
        y: () => vh(-2) * d,
        rotation: -4,
        transformPerspective: 1100,
        force3D: true,
        "--edge": "var(--pink)",
      });

      // APPROACH. Everything here is gated to autoAlpha 0 until the pin engages, so the
      // story used to scroll in as a blank screen and then snap into TEA. Bringing the
      // atmosphere and the chapter rail up during the travel means the pin inherits a
      // scene that is already breathing instead of one that switches on. The stage
      // itself rides the same band so nothing this section paints arrives at full
      // strength over the scene it is taking over from.
      gsap.fromTo(
        stage,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "top 22%",
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        },
      );
      gsap.fromTo(
        [atmos[0], section.querySelector("[data-chapters]")],
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "top top",
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        },
      );

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${Math.round(window.innerHeight * scroll)}`,
          pin: true,
          scrub: 0.7,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onToggle: ({ isActive }) =>
            isActive
              ? stage?.setAttribute("data-live", "true")
              : stage?.removeAttribute("data-live"),
        },
      });

      OWN.forEach(([inAt, outAt], i) => {
        tl.to(scenes[i], { autoAlpha: 1, duration: 0.02, ease: "none" }, inAt);
        tl.to(scenes[i], { autoAlpha: 0, duration: 0.02, ease: "none" }, outAt);
        // The paragraph rises with its own title and leaves before the next arrives.
        tl.to(notes[i], { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" }, inAt + 0.02);
        tl.to(notes[i], { opacity: 0, y: -10, duration: 0.04, ease: "power2.in" }, outAt - 0.07);
      });

      // The active chapter crossfades against the rest over a real band. The previous
      // version dimmed every row and then re-lit the active one with a 0.001s tween --
      // an instant set dressed as a tween, which showed up as a blink on the indicator.
      const chapter = (i: number, at: number) =>
        chapters.forEach((row, j) => {
          tl.to(row, { opacity: j === i ? 1 : 0.22, duration: 0.06, ease: "none" }, at);
        });

      // ---------------------------------------------------------------- TEA
      // Type is clipped by the left edge; shards scatter across the full field at
      // different depths, the nearest sharp and the furthest genuinely blurred.
      tl.addLabel("tea", L.tea)
        .to(titles[0], { opacity: 1, yPercent: 0, duration: 0.07, ease: "power3.out" }, L.tea)
        .fromTo(
          q('[data-shard]'),
          {
            x: (i) => vw(TEA_SHARDS[i].x * 1.7) * d,
            y: (i) => vh(TEA_SHARDS[i].y * 1.7) * d,
            opacity: 0,
          },
          {
            x: (i) => vw(TEA_SHARDS[i].x) * d,
            y: (i) => vh(TEA_SHARDS[i].y) * d,
            opacity: (i) => 1 - TEA_SHARDS[i].blur * 0.13,
            scale: (i) => TEA_SHARDS[i].s,
            duration: 0.07,
            stagger: 0.008,
            ease: "power3.out",
          },
          L.tea + 0.005,
        )
        .fromTo(
          q('[data-typing] b'),
          { scale: 0.3, opacity: 0.2 },
          { scale: 1, opacity: 1, duration: 0.03, stagger: 0.008, ease: "back.out(2.4)" },
          L.tea + 0.06,
        )
        // Parked just under the capsule rather than at a fixed viewport offset, which
        // previously dropped them straight into the TEA title's bounding box.
        .set(q('[data-typing]'), { x: () => vw(19) * d, y: () => vh(6) * d }, 0);

      chapter(0, L.tea);

      // ------------------------------------------------ TEA -> CREATE
      // The shards blow outward and die. The capsule survives, stretches wide, loses
      // its pill radius and gains the reel face: conversation becoming creation.
      tl.addLabel("teaToCreate", L.teaToCreate)
        .to(
          q('[data-shard]'),
          {
            x: (i) => vw(TEA_SHARDS[i].x * 2.4) * d,
            y: (i) => vh(TEA_SHARDS[i].y * 2.4) * d,
            opacity: 0,
            scale: 0.5,
            duration: 0.05,
            stagger: 0.006,
            ease: "power2.in",
          },
          L.teaToCreate,
        )
        .to(q('[data-typing]'), { opacity: 0, duration: 0.03 }, L.teaToCreate)
        .to(
          titles[0],
          { opacity: 0, xPercent: -26, duration: 0.06, ease: "power2.in" },
          L.teaToCreate + 0.01,
        )
        .to(
          morph,
          {
            width: () => Math.min(560, vw(40)) * d,
            height: () => Math.min(316, vh(38)) * d,
            borderRadius: 14,
            x: () => vw(6) * d,
            y: () => vh(4) * d,
            rotation: 0,
            "--edge": "var(--violet)",
            duration: 0.09,
            ease: "power2.inOut",
          },
          L.teaToCreate,
        )
        .to(one('[data-face="tea"]'), { opacity: 0, duration: 0.04 }, L.teaToCreate + 0.01)
        .to(one('[data-face="create"]'), { opacity: 1, duration: 0.05 }, L.teaToCreate + 0.04)
        .fromTo(atmos[0], { opacity: 1 }, { opacity: 0, duration: 0.08, ease: "none", immediateRender: false }, L.teaToCreate)
        .to(atmos[1], { opacity: 1, duration: 0.08, ease: "none" }, L.teaToCreate);

      // ------------------------------------------------------------- CREATE
      // Frame dominant on the right, type intersecting it from the left. The strip
      // runs linearly because film is linear, and the playhead sweeps once.
      tl.addLabel("create", L.create)
        .to(titles[1], { opacity: 1, yPercent: 0, duration: 0.06, ease: "power3.out" }, L.create)
        .to(one('[data-strip]'), { opacity: 1, duration: 0.04 }, L.create)
        .fromTo(
          one('[data-strip]'),
          { xPercent: 6 },
          { xPercent: -16, duration: 0.07, ease: "none" },
          L.create,
        )
        .fromTo(
          one('[data-playhead]'),
          { opacity: 0, xPercent: -46 },
          { opacity: 1, xPercent: 46, duration: 0.06, ease: "none" },
          L.create + 0.02,
        );
      chapter(1, L.create);

      // --------------------------------------- CREATE -> ONE DAY
      // The strip slows and separates; the surviving frame enlarges, tilts and turns
      // into a postcard. Content idea becoming future experience.
      tl.addLabel("createToOneDay", L.createToOneDay)
        .to(
          one('[data-strip]'),
          { opacity: 0, xPercent: -34, duration: 0.07, ease: "power2.in" },
          L.createToOneDay,
        )
        .to(one('[data-playhead]'), { opacity: 0, duration: 0.03 }, L.createToOneDay)
        .to(
          titles[1],
          { opacity: 0, yPercent: -22, duration: 0.06, ease: "power2.in" },
          L.createToOneDay + 0.01,
        )
        .to(
          morph,
          {
            width: () => Math.min(360, vw(26)) * d,
            height: () => Math.min(452, vh(46)) * d,
            borderRadius: 10,
            x: () => vw(20) * d,
            y: () => vh(1) * d,
            rotation: -6,
            "--edge": "var(--cyan)",
            duration: 0.09,
            ease: "power2.inOut",
          },
          L.createToOneDay,
        )
        .to(one('[data-face="create"]'), { opacity: 0, duration: 0.04 }, L.createToOneDay + 0.01)
        .to(one('[data-face="oneday"]'), { opacity: 1, duration: 0.05 }, L.createToOneDay + 0.04)
        .to(atmos[1], { opacity: 0, duration: 0.08, ease: "none" }, L.createToOneDay)
        .to(atmos[2], { opacity: 1, duration: 0.08, ease: "none" }, L.createToOneDay);

      // ------------------------------------------------------------ ONE DAY
      // Deliberately the loosest composition: possibilities spread to every corner,
      // arriving on soft easing from random offsets. Nothing here is decided.
      tl.addLabel("oneDay", L.oneDay)
        .to(titles[2], { opacity: 1, yPercent: 0, duration: 0.06, ease: "power2.out" }, L.oneDay)
        .fromTo(
          q('[data-frag]'),
          {
            x: (i) => vw(ONE_DAY_FRAGMENTS[i].x + (i % 2 ? 16 : -16)) * d,
            y: (i) => vh(ONE_DAY_FRAGMENTS[i].y + (i % 3 ? -12 : 14)) * d,
            rotation: (i) => (i % 2 ? 9 : -8),
            opacity: 0,
          },
          {
            x: (i) => vw(ONE_DAY_FRAGMENTS[i].x) * d,
            y: (i) => vh(ONE_DAY_FRAGMENTS[i].y) * d,
            rotation: (i) => (i % 2 ? 2.5 : -2),
            scale: (i) => ONE_DAY_FRAGMENTS[i].s,
            opacity: 1,
            duration: 0.07,
            stagger: 0.007,
            ease: "power2.out",
          },
          L.oneDay + 0.005,
        );
      chapter(2, L.oneDay);

      // ------------------------------------- ONE DAY -> ALIGN
      // The strongest transition. The scattered fragments do not fade: they drift onto
      // shared axes, straighten, and equalise scale. Maybe becoming decision.
      tl.addLabel("oneDayToAlign", L.oneDayToAlign)
        .to(
          q('[data-frag]'),
          {
            x: (i) => vw((i % 3) * 14 - 14) * d,
            y: (i) => vh(Math.floor(i / 3) * 11 - 12) * d,
            rotation: 0,
            scale: 0.72,
            duration: 0.09,
            stagger: { each: 0.008, from: "random" },
            ease: "power3.inOut",
          },
          L.oneDayToAlign,
        )
        .to(
          q('[data-frag]'),
          { opacity: 0, scale: 0.5, duration: 0.028, ease: "power2.in" },
          L.oneDayToAlign + 0.05,
        )
        .to(
          titles[2],
          { opacity: 0, yPercent: -18, duration: 0.05, ease: "power2.in" },
          L.oneDayToAlign + 0.02,
        )
        .to(
          morph,
          {
            width: () => Math.min(300, vw(21)) * d,
            height: () => Math.min(300, vh(30)) * d,
            borderRadius: 6,
            x: 0,
            y: () => vh(3) * d,
            rotation: 0,
            "--edge": "var(--pink)",
            duration: 0.09,
            ease: "power4.inOut",
          },
          L.oneDayToAlign,
        )
        .to(one('[data-face="oneday"]'), { opacity: 0, duration: 0.04 }, L.oneDayToAlign + 0.02)
        .to(one('[data-face="align"]'), { opacity: 1, duration: 0.05 }, L.oneDayToAlign + 0.05)
        .to(atmos[2], { opacity: 0, duration: 0.08, ease: "none" }, L.oneDayToAlign)
        .to(atmos[3], { opacity: 1, duration: 0.08, ease: "none" }, L.oneDayToAlign);

      // -------------------------------------------------------------- ALIGN
      // The only centred composition in the story, and the only one whose elements
      // snap rather than arrive. Blocks converge onto a grid and lock.
      tl.addLabel("align", L.align)
        .to(titles[3], { opacity: 1, yPercent: 0, duration: 0.05, ease: "power4.out" }, L.align)
        .fromTo(
          q('[data-block]'),
          {
            x: (i) => vw([-26, 19, -13, 24, -21, 15, -18, 22, -9, 12][i]) * d,
            y: (i) => vh([14, -19, 22, -12, 17, -22, 11, -16, 19, -14][i]) * d,
            rotation: (i) => [-12, 9, -7, 14, -10, 8, -13, 11, -6, 9][i],
            opacity: 0,
            scale: 0.7,
          },
          {
            x: (i) => vw(ALIGN_GRID[i].x) * d,
            y: (i) => vh(ALIGN_GRID[i].y) * d,
            rotation: 0,
            opacity: 1,
            scale: 1,
            duration: 0.06,
            stagger: { each: 0.005, from: "random" },
            ease: "power4.out",
          },
          L.align + 0.005,
        )
        .fromTo(
          q('[data-lock]'),
          { scaleX: 0, opacity: 0 },
          { scaleX: 1, opacity: 1, duration: 0.045, ease: "power3.out" },
          L.align + 0.045,
        );
      chapter(3, L.align);

      // ------------------------------------ ALIGN -> VAULT
      // Slower and softer than the others by design. The rigid grid loosens: blocks
      // regain rotation, drift apart and become photographs. The plan happened.
      tl.addLabel("alignToVault", L.alignToVault)
        .to(q('[data-lock]'), { opacity: 0, duration: 0.04 }, L.alignToVault)
        .to(
          q('[data-block]'),
          {
            x: (i) => vw(VAULT_FRAMES[i % 5].x * 0.8) * d,
            y: (i) => vh(VAULT_FRAMES[i % 5].y * 0.8) * d,
            rotation: (i) => VAULT_FRAMES[i % 5].r,
            opacity: 0,
            duration: 0.05,
            stagger: 0.004,
            ease: "power1.inOut",
          },
          L.alignToVault,
        )
        .to(
          titles[3],
          { opacity: 0, yPercent: -14, duration: 0.06, ease: "power1.in" },
          L.alignToVault + 0.02,
        )
        .to(
          morph,
          {
            width: () => Math.min(400, vw(29)) * d,
            height: () => Math.min(300, vh(34)) * d,
            borderRadius: 8,
            x: () => vw(7) * d,
            y: () => vh(-1) * d,
            rotation: 2.5,
            "--edge": "var(--violet)",
            duration: 0.11,
            ease: "power1.inOut",
          },
          L.alignToVault,
        )
        .to(one('[data-face="align"]'), { opacity: 0, duration: 0.05 }, L.alignToVault + 0.02)
        .to(one('[data-face="vault"]'), { opacity: 1, duration: 0.06 }, L.alignToVault + 0.05)
        .to(atmos[3], { opacity: 0, duration: 0.09, ease: "none" }, L.alignToVault)
        .to(atmos[4], { opacity: 1, duration: 0.09, ease: "none" }, L.alignToVault);

      // -------------------------------------------------------------- VAULT
      // Layered depth around the hero frame, each photograph further back and dimmer.
      // The quietest arrival in the story.
      tl.addLabel("vault", L.vault)
        .to(titles[4], { opacity: 1, yPercent: 0, duration: 0.06, ease: "power2.out" }, L.vault)
        .fromTo(
          q('[data-photo]'),
          {
            x: (i) => vw(VAULT_FRAMES[i].x * 0.5) * d,
            y: (i) => vh(VAULT_FRAMES[i].y * 0.5 + 16) * d,
            rotation: 0,
            opacity: 0,
            scale: VAULT_FRAMES[0].s * 0.8,
          },
          {
            x: (i) => vw(VAULT_FRAMES[i].x) * d,
            y: (i) => vh(VAULT_FRAMES[i].y) * d,
            z: (i) => VAULT_FRAMES[i].z * d,
            rotation: (i) => VAULT_FRAMES[i].r,
            scale: (i) => VAULT_FRAMES[i].s,
            opacity: (i) => 0.95 + VAULT_FRAMES[i].z / 900,
            duration: 0.055,
            stagger: 0.007,
            ease: "power2.out",
          },
          L.vault + 0.005,
        );
      chapter(4, L.vault);

      // ------------------------------------------------------------- FINALE
      // The five chapters brighten together, the object settles dead centre as the
      // one shape that has been all five things, and the closing line rises.
      tl.addLabel("finale", L.finale)
        .to(chapters, { opacity: 1, duration: 0.03, ease: "none" }, L.finale)
        .to(
          q('[data-photo]'),
          {
            x: 0,
            y: 0,
            z: -60,
            rotation: 0,
            scale: 0.3,
            opacity: 0,
            duration: 0.05,
            stagger: 0.006,
            ease: "power2.in",
          },
          L.finale,
        )
        .to(titles[4], { opacity: 0, duration: 0.04, ease: "none" }, L.finale)
        .to(
          morph,
          {
            width: () => Math.min(520, vw(38)) * d,
            height: () => Math.min(110, vh(13)) * d,
            borderRadius: 999,
            x: 0,
            y: () => vh(6) * d,
            rotation: 0,
            "--edge": "var(--cyan)",
            duration: 0.06,
            ease: "power3.inOut",
          },
          L.finale + 0.005,
        )
        .to(one('[data-face="vault"]'), { opacity: 0, duration: 0.03 }, L.finale)
        .to(morph, { opacity: 0, duration: 0.025, ease: "none" }, L.finale + 0.042)
        .fromTo(
          one('[data-finale]'),
          { opacity: 0, yPercent: 40 },
          { opacity: 1, yPercent: 0, duration: 0.045, ease: "power3.out" },
          L.finale + 0.025,
        );

      // DEPARTURE. The mirror of the approach: the story dims and lifts out across the
      // tail of its own pin while THE LOOP rises through it, so the last thing this
      // section does is hand over rather than scroll away and leave a gap.
      gsap.fromTo(
        stage,
        { autoAlpha: 1, y: 0 },
        {
          autoAlpha: 0,
          y: () => -window.innerHeight * 0.06,
          ease: "none",
          immediateRender: false,
          scrollTrigger: {
            trigger: section,
            ...pinnedTail(() => tl.scrollTrigger),
            scrub: 0.6,
            invalidateOnRefresh: true,
            // Refreshed last. pinnedTail() reads the pin-spacer's height, and the spacer
            // only grows to the pin distance during the pinned trigger's own refresh --
            // at default priority this measured the un-pinned box and put the fade a
            // few hundred pixels into the scene instead of after it.
            refreshPriority: -1,
          },
        },
      );

      // ------------------------------------------------------ ROOM NAVIGATION
      // The five rooms have no anchors to link to: they are labelled moments inside
      // this one pinned trigger. Publish a resolver instead of href targets, and read
      // `start`/`end` at click time -- ScrollTrigger rewrites both on every refresh,
      // so anything cached here would be wrong after the first resize.
      const st = tl.scrollTrigger;
      return registerRoomTargets((name) => {
        const i = rooms.findIndex((room) => room.name === name);
        if (i < 0 || !st) return null;
        // PEAK is written on the same 0-1 clock as the labels, but a tween positioned
        // past 1.0 silently stretches the timeline's duration and breaks the identity
        // "position == scroll percentage". Dividing by the real duration keeps the
        // targets correct even if a future beat overshoots again.
        const span = tl.duration() || 1;
        return { top: st.start + (PEAK[i] / span) * (st.end - st.start) };
      });
    };

    /** Mobile: no pin. Scenes stack, the object is sticky and still morphs across the
     *  whole stack, so the story survives without hijacking the scroll. */
    const buildStacked = () => {
      const scenes = gsap.utils.toArray<HTMLElement>("[data-scene]", section);
      const atmos = gsap.utils.toArray<HTMLElement>("[data-atmos]", section);
      gsap.set(atmos, { opacity: 0 });

      scenes.forEach((scene, i) => {
        gsap.fromTo(
          scene.querySelectorAll("[data-title], [data-shard], [data-frag], [data-block], [data-photo]"),
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.05,
            ease: "power2.out",
            scrollTrigger: { trigger: scene, start: "top 74%", once: true },
          },
        );
        gsap.to(atmos[i], {
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: scene, start: "top 80%", end: "bottom 30%", scrub: true },
        });
      });

      // Same menu contract, different geometry: with no pin, a room is simply its own
      // block in the document, so the resolver returns that block's top.
      return registerRoomTargets((name) => {
        const i = rooms.findIndex((room) => room.name === name);
        const scene = scenes[i];
        if (!scene) return null;
        return { top: scene.getBoundingClientRect().top + window.scrollY };
      });
    };

    const ok = "(prefers-reduced-motion: no-preference)";
    media.add(`${ok} and (min-width: 1024px)`, () => buildStage(1, 5.2));
    media.add(`${ok} and (min-width: 641px) and (max-width: 1023px)`, () => buildStage(0.7, 4.4));
    media.add(`${ok} and (max-width: 640px)`, () => buildStacked());

    return () => media.revert();
  }, []);

  return (
    <section ref={sectionRef} id="modules-anchor" className="rooms-story" aria-labelledby="modules-title">
      <div data-stage className="rooms-stage">
        <h2 id="modules-title" className="sr-only">The five rooms inside EXCLUSIVE</h2>

        <div className="rooms-atmos" aria-hidden="true">
          {rooms.map((room) => (
            <i key={room.name} data-atmos />
          ))}
        </div>

        {/* The old list survives only as a chapter index. */}
        <ol data-chapters className="rooms-chapters" aria-label="Chapters">
          {rooms.map((room) => (
            <li key={room.name} data-chapter>
              <b>{room.number}</b>
              <span>{room.name}</span>
            </li>
          ))}
        </ol>

        {/* The one object that is all five things in turn. */}
        <div data-morph className="rooms-morph" aria-hidden="true">
          <span data-face="tea" className="face face-tea">
            <i />
            <i />
          </span>
          <span data-face="create" className="face face-create">
            <b />
            <b />
            <b />
            <b />
            <b />
            <b />
          </span>
          <span data-face="oneday" className="face face-oneday">
            <em>GOA</em>
            <u>15.2993° N / 74.1240° E</u>
          </span>
          <span data-face="align" className="face face-align">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          <span data-face="vault" className="face face-vault" />
        </div>

        <div className="rooms-scenes">
          {/* ---------------------------------------------------------- TEA */}
          <div data-scene className="scene scene-tea">
            <p data-title className="scene-title t-tea">TEA</p>
            {TEA_SHARDS.map((shard) => (
              <span key={shard.text} data-shard className="shard" style={{ filter: shard.blur ? `blur(${shard.blur}px)` : undefined }}>
                {shard.text}
              </span>
            ))}
            <span data-typing className="typing">
              <b />
              <b />
              <b />
            </span>
            <p data-note className="scene-note n-tea">
              <b>ROOM 01 · THE SPILL</b>
              {rooms[0].description}
            </p>
          </div>

          {/* ------------------------------------------------------- CREATE */}
          <div data-scene className="scene scene-create">
            <p data-title className="scene-title t-create">CREATE</p>
            <div data-strip className="strip" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <i data-playhead className="playhead" aria-hidden="true" />
            <p data-note className="scene-note n-create">
              <b>ROOM 02 · THE MAKE</b>
              {rooms[1].description}
            </p>
          </div>

          {/* ------------------------------------------------------ ONE DAY */}
          <div data-scene className="scene scene-oneday">
            <p data-title className="scene-title t-oneday">ONE<br />DAY</p>
            {ONE_DAY_FRAGMENTS.map((frag) => (
              <span key={frag.text} data-frag className="frag">
                {frag.text}
              </span>
            ))}
            <p data-note className="scene-note n-oneday">
              <b>ROOM 03 · THE SOMEDAY</b>
              {rooms[2].description}
            </p>
          </div>

          {/* -------------------------------------------------------- ALIGN */}
          <div data-scene className="scene scene-align">
            <p data-title className="scene-title t-align">ALIGN</p>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} data-block className="block" aria-hidden="true" />
            ))}
            <i data-lock className="align-lock" aria-hidden="true" />
            <p data-note className="scene-note n-align">
              <b>ROOM 04 · THE DECISION</b>
              {rooms[3].description}
            </p>
          </div>

          {/* -------------------------------------------------------- VAULT */}
          <div data-scene className="scene scene-vault">
            <p data-title className="scene-title t-vault">VAULT</p>
            {VAULT_FRAMES.map((frame, i) => (
              <i key={i} data-photo className="photo" aria-hidden="true" />
            ))}
            <p data-note className="scene-note n-vault">
              <b>ROOM 05 · THE KEEP</b>
              {rooms[4].description}
            </p>
          </div>
        </div>

        <div data-finale className="rooms-finale">
          <p>FROM THE CHAT</p>
          <p><span>TO THE MEMORY.</span></p>
        </div>
      </div>
    </section>
  );
}
