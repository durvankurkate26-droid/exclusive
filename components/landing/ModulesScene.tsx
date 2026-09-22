"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { gsap, pinnedTail, ScrollTrigger } from "@/lib/animations/gsap";
import { rooms } from "@/lib/constants/landing";
import type { PhotoId } from "@/lib/content/group-photos";
import { registerRoomTargets } from "@/lib/rooms-nav";
import { Shot } from "./Shot";

/**
 * ENTER THE ROOMS -- a five-scene scroll story told with the group's own photographs.
 *
 * One pinned stage, one master timeline, and one element (`[data-morph]`) that survives
 * every scene. It used to be an abstract rectangle; it is a photograph now, and what
 * changes from room to room is the *role* the photograph plays:
 *
 *   TEA      evidence    -- a tilted print someone sent, under a pile of messages
 *   CREATE   media       -- the same slot stretched into a 9:16 frame with REC chrome
 *   ONE DAY  possibility -- a postcard: "imagine us here"
 *   ALIGN    decision    -- one of three frames squared onto a shared axis
 *   VAULT    memory      -- the dominant photograph everything else settles around
 *
 * Two more photographs (`[data-travel]`) are born as ONE DAY postcards, snap into the
 * ALIGN row either side of the morph, and loosen into VAULT memories -- so the plan the
 * group aligned on is literally what ends up in the vault.
 *
 * Label map (normalised 0-1, so every position reads as a scroll percentage):
 *
 *   tea            0.00   messages surface at depth around the evidence photo
 *   teaToCreate    0.145  messages compress into the photo, it stretches to 9:16
 *   create         0.225  the reel frame, a contact strip running behind it
 *   createToOneDay 0.355  strip exits, the frame turns into a postcard
 *   oneDay         0.435  postcards and ticket fragments, a route drawn between them
 *   oneDayToAlign  0.565  three postcards square up into one row
 *   align          0.635  labels snap to the axis, the rule locks
 *   alignToVault   0.755  the row loosens into photographs
 *   vault          0.83   the memory settles, exposure comes up
 *   finale         0.93   the five chapters resolve into one line
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

/** Composed peak of each room, which is what the menu navigates to. */
const PEAK = [0.125, 0.33, 0.54, 0.735, 0.915] as const;

/*
 * Scene furniture, as vw/vh offsets from the centre of the viewport. Two zones are
 * reserved everywhere: the lower-left (titles, chapter rail) and the upper-left
 * (supporting paragraph).
 */

/** TEA: a real conversation with a hierarchy -- two loud lines, three normal, three
 *  barely-there. Senders only on the ones worth reading. */
const TEA_MSGS: Array<{ text: string; who?: string; tier: "lead" | "mid" | "whisper"; x: number; y: number; side?: "me" }> = [
  { text: "wait WHAT", who: "prisha", tier: "lead", x: 0, y: -27 },
  { text: "bro who told her 😭", who: "aarav", tier: "lead", x: 33, y: 22, side: "me" },
  { text: "tea after lecture???", who: "meher", tier: "mid", x: -3, y: -9 },
  { text: "someone explain what happened", who: "kabir", tier: "mid", x: 35, y: -28 },
  { text: "Prisha knows???", who: "riya", tier: "mid", x: 5, y: 13, side: "me" },
  { text: "college ka tea is insane today", tier: "whisper", x: 16, y: 33 },
  { text: "nah this is crazy 💀", tier: "whisper", x: 41, y: -14 },
  { text: "CALL NOW", tier: "whisper", x: -9, y: -33 },
];

/** Context photos in TEA: a flash print near the edge and a soft one deep behind. */
const TEA_PHOTOS: Array<{ id: PhotoId; x: number; y: number; w: number; r: number; role: "flash" | "deep" }> = [
  { id: "lectureCandid", x: 38, y: 8, w: 8.5, r: 7, role: "flash" },
  { id: "classThumbs", x: 3, y: 3, w: 15, r: -3, role: "deep" },
];

/** CREATE: the contact strip that runs behind the reel frame. */
const STRIP: PhotoId[] = ["holi01", "screenSelfie", "holi02", "mirrorTrio", "holi03", "corridorMirror", "holi04"];

/** ONE DAY: ticket stubs, not tags. A few places and plans, never all of them. */
const TICKETS = [
  { text: "GOA", x: 2, y: -26 },
  { text: "KARTING", x: 41, y: 3 },
  { text: "MIDNIGHT DRIVE", x: 35, y: 30 },
  { text: "15.2993° N", x: 1, y: -13 },
];

/** The two postcards that travel from ONE DAY through ALIGN into VAULT. */
const TRAVEL: Array<{
  id: PhotoId;
  label: string;
  oneDay: { x: number; y: number; r: number };
  vault: { x: number; y: number; r: number; s: number; z: number };
}> = [
  { id: "festCrowd", label: "CONCERT", oneDay: { x: 41, y: -23, r: 8 }, vault: { x: -15, y: -11, r: -7, s: 0.9, z: -120 } },
  { id: "parkSelfie", label: "GOA", oneDay: { x: 4, y: 25, r: -5 }, vault: { x: 31, y: -25, r: 5, s: 0.82, z: -180 } },
];

/** ALIGN: what the three frames resolve into. */
const CHIPS = ["SAT 7:30", "BANDRA", "8/9 IN", "₹800 EACH", "LOCKED"];

/** VAULT: memories settling around the dominant photograph. */
const VAULT_PHOTOS: Array<{ id: PhotoId; x: number; y: number; r: number; w: number; z: number }> = [
  { id: "iceCreams", x: 35, y: 9, r: 4, w: 11, z: -160 },
  { id: "redThreads", x: -9, y: 15, r: -5, w: 8.5, z: -90 },
  { id: "labHug", x: 23, y: 27, r: -3, w: 8.5, z: -240 },
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
     * The whole story. `d` scales every travel distance and every object size for
     * smaller stages, so an orbit never ends up inside the object it orbits.
     */
    const buildStage = (d: number, scroll: number) => {
      const stage = section.querySelector<HTMLElement>("[data-stage]");
      const morph = section.querySelector<HTMLElement>("[data-morph]");
      const q = <T extends HTMLElement>(s: string) => gsap.utils.toArray<T>(s, section);
      const one = (s: string) => section.querySelector<HTMLElement>(s);

      const vw = (n: number) => (n / 100) * window.innerWidth;
      const vh = (n: number) => (n / 100) * window.innerHeight;

      const atmos = q("[data-atmos]");
      const chapters = q("[data-chapter]");
      const titles = q("[data-title]");
      const notes = q("[data-note]");
      const scenes = q("[data-scene]");
      const msgs = q("[data-msg]");
      const teaShots = q("[data-tea-photo]");
      const frames = q("[data-strip-frame]");
      const tickets = q("[data-ticket]");
      const travel = q("[data-travel]");
      const chips = q("[data-chip]");
      const vaultShots = q("[data-vault-photo]");
      const route = one("[data-route]") as unknown as SVGPathElement | null;

      // ---- geometry, recomputed on every refresh through function-based values ----
      const teaW = () => Math.min(240, vw(17)) * d;
      const reelH = () => Math.min(560, vh(60)) * d;
      const cardW = () => Math.min(340, vw(24)) * d;
      const aH = () => Math.min(230, vh(26)) * d;
      const aW = () => (aH() * 4) / 3;
      const aX = (i: number) => (i - 1) * (aW() + vw(1.6) * d);
      const aY = () => vh(3) * d;
      const rowY = () => aY() + aH() / 2 + vh(3.4);
      const tW = () => Math.min(210, vw(15)) * d;
      const vaultW = () => Math.min(380, vw(26)) * d;

      // The route between the postcards, in the SVG's 0-100 viewport space. Written
      // here rather than in markup because it has to follow `d`.
      const pt = (x: number, y: number) => `${50 + x * d} ${50 + y * d}`;
      route?.setAttribute(
        "d",
        `M ${pt(TRAVEL[0].oneDay.x, TRAVEL[0].oneDay.y)} Q ${pt(34, -6)} ${pt(20, 1)} T ${pt(TRAVEL[1].oneDay.x, TRAVEL[1].oneDay.y)}`,
      );

      // Scene ownership. Each scene is gated as a whole with autoAlpha, so an inactive
      // scene is not merely transparent but visibility:hidden and unhittable.
      const OWN: Array<[number, number]> = [
        [L.tea, L.create + 0.01],
        [L.create - 0.01, L.oneDay + 0.01],
        [L.oneDay - 0.01, L.align + 0.01],
        [L.align - 0.01, L.vault + 0.025],
        [L.vault - 0.02, L.finale + 0.05],
      ];

      // ---------------------------------------------------------- resting state
      gsap.set(atmos, { opacity: 0 });
      gsap.set(scenes, { autoAlpha: 0 });
      gsap.set(titles, { opacity: 0, yPercent: 18 });
      gsap.set(notes, { opacity: 0, y: 14 });
      gsap.set(q("[data-face]"), { opacity: 0 });
      gsap.set(one('[data-face="tea"]'), { opacity: 1 });
      gsap.set(one("[data-finale]"), { opacity: 0, yPercent: 40 });
      gsap.set(one("[data-strip]"), { opacity: 0 });
      gsap.set(one("[data-playhead]"), { opacity: 0 });
      gsap.set(q("[data-reel-tag]"), { opacity: 0 });
      gsap.set(q("[data-vault-type]"), { opacity: 0, y: 16 });
      gsap.set(chapters, { opacity: 0.22 });
      gsap.set([...msgs, ...teaShots, ...tickets, ...chips, ...vaultShots], {
        xPercent: -50,
        yPercent: -50,
        opacity: 0,
        force3D: true,
      });
      gsap.set(travel, {
        xPercent: -50,
        yPercent: -50,
        autoAlpha: 0,
        width: tW,
        height: () => tW() * 0.9,
        transformPerspective: 1100,
        force3D: true,
      });
      gsap.set(route, { strokeDashoffset: 1, opacity: 0 });

      gsap.set(morph, {
        xPercent: -50,
        yPercent: -50,
        width: teaW,
        height: () => teaW() * 1.333,
        borderRadius: 3,
        x: () => vw(19) * d,
        y: () => vh(-2) * d,
        rotation: -4,
        transformPerspective: 1100,
        force3D: true,
      });

      // APPROACH. The stage and its first light arrive while the section is still
      // travelling up, so the pin inherits a scene that is already breathing.
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
            isActive ? stage?.setAttribute("data-live", "true") : stage?.removeAttribute("data-live"),
        },
      });

      OWN.forEach(([inAt, outAt], i) => {
        tl.to(scenes[i], { autoAlpha: 1, duration: 0.02, ease: "none" }, inAt);
        tl.to(scenes[i], { autoAlpha: 0, duration: 0.02, ease: "none" }, outAt);
        tl.to(notes[i], { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" }, inAt + 0.02);
        tl.to(notes[i], { opacity: 0, y: -10, duration: 0.04, ease: "power2.in" }, outAt - 0.07);
      });

      const chapter = (i: number, at: number) =>
        chapters.forEach((row, j) => {
          tl.to(row, { opacity: j === i ? 1 : 0.22, duration: 0.06, ease: "none" }, at);
        });

      // ================================================================= TEA
      // Messages surface from depth -- far ones start further back and stay soft, the
      // two loud ones arrive sharp and a beat later so they read as the punchline.
      tl.addLabel("tea", L.tea)
        .to(titles[0], { opacity: 1, yPercent: 0, duration: 0.07, ease: "power3.out" }, L.tea);

      TEA_MSGS.forEach((m, i) => {
        const far = m.tier === "whisper";
        tl.fromTo(
          msgs[i],
          { x: () => vw(m.x * 1.25 + 4) * d, y: () => vh(m.y * 1.25) * d, z: far ? -260 : -140, scale: 0.86, opacity: 0 },
          {
            x: () => vw(m.x) * d,
            y: () => vh(m.y) * d,
            z: 0,
            scale: 1,
            opacity: far ? 0.55 : 1,
            duration: 0.07,
            ease: "power3.out",
          },
          L.tea + (m.tier === "lead" ? 0.03 : m.tier === "mid" ? 0.012 : 0) + i * 0.003,
        );
      });

      TEA_PHOTOS.forEach((p, i) => {
        tl.fromTo(
          teaShots[i],
          {
            x: () => vw(p.x) * d,
            y: () => vh(p.y + 5) * d,
            rotation: p.r * 2,
            opacity: 0,
            clipPath: "inset(0% 0% 100% 0%)",
          },
          {
            y: () => vh(p.y) * d,
            rotation: p.r,
            opacity: p.role === "deep" ? 0.42 : 1,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 0.07,
            ease: "power2.out",
          },
          L.tea + 0.02 + i * 0.02,
        );
      });

      tl.fromTo(
        q("[data-typing] b"),
        { scale: 0.4, opacity: 0.2 },
        { scale: 1, opacity: 1, duration: 0.03, stagger: 0.008, ease: "power2.out" },
        L.tea + 0.06,
      ).set(q("[data-typing]"), { x: () => vw(19) * d - teaW() * 0.3, y: () => vh(-2) * d + teaW() * 0.72 + vh(2.5) }, 0);

      // One message is the thing everyone is reacting to: it comes forward and the
      // photo it is about separates from it.
      tl.to(msgs[0], { scale: 1.08, duration: 0.05, ease: "power2.out" }, L.tea + 0.085)
        .to(teaShots[0], { x: () => vw(TEA_PHOTOS[0].x + 1.5) * d, rotation: TEA_PHOTOS[0].r + 3, duration: 0.05, ease: "sine.inOut" }, L.tea + 0.085);

      chapter(0, L.tea);

      // ========================================================= TEA -> CREATE
      // Conversation compresses into the photograph instead of blowing away: every
      // message is drawn into the frame, and the frame stretches into a reel.
      tl.addLabel("teaToCreate", L.teaToCreate)
        .to(
          msgs,
          {
            x: () => vw(19) * d,
            y: () => vh(-2) * d,
            scale: 0.35,
            opacity: 0,
            duration: 0.06,
            stagger: { each: 0.004, from: "end" },
            ease: "power3.in",
          },
          L.teaToCreate,
        )
        .to(teaShots, { opacity: 0, y: () => vh(-8) * d, duration: 0.05, ease: "power2.in" }, L.teaToCreate)
        .to(q("[data-typing]"), { opacity: 0, duration: 0.03 }, L.teaToCreate)
        .to(titles[0], { opacity: 0, xPercent: -26, duration: 0.06, ease: "power2.in" }, L.teaToCreate + 0.01)
        .to(
          morph,
          {
            width: () => (reelH() * 9) / 16,
            height: reelH,
            borderRadius: 0,
            x: () => vw(2) * d,
            y: () => vh(4) * d,
            rotation: 0,
            duration: 0.09,
            ease: "power2.inOut",
          },
          L.teaToCreate + 0.02,
        )
        .to(one('[data-face="tea"]'), { opacity: 0, duration: 0.04 }, L.teaToCreate + 0.05)
        .to(one('[data-face="create"]'), { opacity: 1, duration: 0.04 }, L.teaToCreate + 0.045)
        .fromTo(atmos[0], { opacity: 1 }, { opacity: 0, duration: 0.08, ease: "none", immediateRender: false }, L.teaToCreate)
        .to(atmos[1], { opacity: 1, duration: 0.08, ease: "none" }, L.teaToCreate);

      // ============================================================== CREATE
      // The frame shifts its own crop as if being edited; the contact strip runs past
      // behind it frame by frame, each one wiped in horizontally like a cut.
      tl.addLabel("create", L.create)
        .to(titles[1], { opacity: 1, yPercent: 0, duration: 0.06, ease: "power3.out" }, L.create)
        .to(one("[data-strip]"), { opacity: 1, duration: 0.03 }, L.create - 0.01)
        .fromTo(one("[data-strip]"), { xPercent: 8 }, { xPercent: -14, duration: 0.12, ease: "none" }, L.create - 0.01)
        .fromTo(
          frames,
          { clipPath: "inset(0% 100% 0% 0%)" },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 0.03, stagger: 0.007, ease: "power2.out" },
          L.create,
        )
        .fromTo(
          one("[data-crop]"),
          { scale: 1.22, xPercent: 6, yPercent: -4 },
          { scale: 1, xPercent: 0, yPercent: 0, duration: 0.11, ease: "power1.inOut" },
          L.create - 0.02,
        )
        .to(q("[data-reel-tag]"), { opacity: 1, duration: 0.03, stagger: 0.01, ease: "none" }, L.create + 0.01)
        .fromTo(
          one("[data-playhead]"),
          { opacity: 0, xPercent: -46 },
          { opacity: 1, xPercent: 46, duration: 0.08, ease: "none" },
          L.create + 0.02,
        );
      chapter(1, L.create);

      // =================================================== CREATE -> ONE DAY
      // The strip slides out, the reel frame shortens and tilts into a postcard.
      tl.addLabel("createToOneDay", L.createToOneDay)
        .to(one("[data-strip]"), { opacity: 0, xPercent: -30, duration: 0.07, ease: "power2.in" }, L.createToOneDay)
        .to(one("[data-playhead]"), { opacity: 0, duration: 0.03 }, L.createToOneDay)
        .to(q("[data-reel-tag]"), { opacity: 0, duration: 0.03 }, L.createToOneDay)
        .to(titles[1], { opacity: 0, yPercent: -22, duration: 0.06, ease: "power2.in" }, L.createToOneDay + 0.01)
        .to(
          morph,
          {
            width: cardW,
            height: () => cardW() * 1.34,
            borderRadius: 1,
            x: () => vw(20) * d,
            y: () => vh(1) * d,
            rotation: -6,
            duration: 0.09,
            ease: "power2.inOut",
          },
          L.createToOneDay,
        )
        .to(one('[data-face="create"]'), { opacity: 0, duration: 0.04 }, L.createToOneDay + 0.04)
        .to(one('[data-face="oneday"]'), { opacity: 1, duration: 0.04 }, L.createToOneDay + 0.035)
        .to(atmos[1], { opacity: 0, duration: 0.08, ease: "none" }, L.createToOneDay)
        .to(atmos[2], { opacity: 1, duration: 0.08, ease: "none" }, L.createToOneDay);

      // ============================================================= ONE DAY
      // The loosest composition. Two more postcards arrive from different depths, the
      // tickets drift in, a route is drawn between the places, and the main postcard
      // leans toward camera: the one you can already picture yourself in.
      tl.addLabel("oneDay", L.oneDay)
        .to(titles[2], { opacity: 1, yPercent: 0, duration: 0.06, ease: "power2.out" }, L.oneDay);

      TRAVEL.forEach((t, i) => {
        tl.fromTo(
          travel[i],
          {
            x: () => vw(t.oneDay.x + (i ? -10 : 12)) * d,
            y: () => vh(t.oneDay.y + (i ? 14 : -10)) * d,
            z: i ? 160 : -320,
            rotation: t.oneDay.r * 2,
            autoAlpha: 0,
          },
          {
            x: () => vw(t.oneDay.x) * d,
            y: () => vh(t.oneDay.y) * d,
            z: 0,
            rotation: t.oneDay.r,
            autoAlpha: 1,
            duration: 0.07,
            ease: "power2.out",
            immediateRender: false,
          },
          L.oneDay - 0.02 + i * 0.015,
        );
      });

      tl.fromTo(
        tickets,
        {
          x: (i) => vw(TICKETS[i].x + (i % 2 ? 14 : -12)) * d,
          y: (i) => vh(TICKETS[i].y + (i % 3 ? -10 : 12)) * d,
          rotation: (i) => (i % 2 ? 10 : -9),
          opacity: 0,
        },
        {
          x: (i) => vw(TICKETS[i].x) * d,
          y: (i) => vh(TICKETS[i].y) * d,
          rotation: (i) => (i % 2 ? 3 : -2.5),
          opacity: 1,
          duration: 0.07,
          stagger: 0.008,
          ease: "power2.out",
        },
        L.oneDay + 0.005,
      )
        .to(route, { opacity: 1, duration: 0.02, ease: "none" }, L.oneDay + 0.02)
        .to(route, { strokeDashoffset: 0, duration: 0.08, ease: "none" }, L.oneDay + 0.02)
        .to(morph, { scale: 1.07, rotation: -3, duration: 0.1, ease: "sine.inOut" }, L.oneDay + 0.02);
      chapter(2, L.oneDay);

      // =============================================== ONE DAY -> ALIGN
      // Maybe becoming decision. The three postcards straighten, equalise and snap onto
      // one row; their paper borders drop away so they read as frames, not keepsakes.
      tl.addLabel("oneDayToAlign", L.oneDayToAlign)
        .to(
          tickets,
          {
            x: (i) => aX(i % 3),
            y: () => rowY(),
            rotation: 0,
            opacity: 0,
            scale: 0.8,
            duration: 0.07,
            stagger: { each: 0.006, from: "random" },
            ease: "power3.inOut",
          },
          L.oneDayToAlign,
        )
        .to(route, { opacity: 0, duration: 0.04, ease: "none" }, L.oneDayToAlign)
        .to(titles[2], { opacity: 0, yPercent: -18, duration: 0.05, ease: "power2.in" }, L.oneDayToAlign + 0.02)
        .to(
          morph,
          {
            width: aW,
            height: aH,
            borderRadius: 0,
            x: aX(1),
            y: aY,
            scale: 1,
            rotation: 0,
            duration: 0.09,
            ease: "power3.inOut",
          },
          L.oneDayToAlign,
        )
        .to(one('[data-face="oneday"]'), { opacity: 0, duration: 0.04 }, L.oneDayToAlign + 0.04)
        .to(one('[data-face="align"]'), { opacity: 1, duration: 0.04 }, L.oneDayToAlign + 0.035)
        .to(atmos[2], { opacity: 0, duration: 0.08, ease: "none" }, L.oneDayToAlign)
        .to(atmos[3], { opacity: 1, duration: 0.08, ease: "none" }, L.oneDayToAlign);

      travel.forEach((el, i) => {
        tl.to(
          el,
          { width: aW, height: aH, x: () => aX(i ? 2 : 0), y: aY, rotation: 0, duration: 0.09, ease: "power3.inOut" },
          L.oneDayToAlign + 0.004 * i,
        )
          .to(el.querySelectorAll("[data-paper]"), { opacity: 0, duration: 0.05, ease: "none" }, L.oneDayToAlign + 0.02)
          .to(el.querySelector("[data-travel-img]"), { top: 0, right: 0, bottom: 0, left: 0, duration: 0.07, ease: "power3.inOut" }, L.oneDayToAlign + 0.02);
      });

      // ================================================================ ALIGN
      // The cleanest frame in the story. Labels come in crooked and land on the axis
      // under the frame they describe; no bounce, no overshoot, just a hard settle.
      tl.addLabel("align", L.align)
        .to(titles[3], { opacity: 1, yPercent: 0, duration: 0.05, ease: "power4.out" }, L.align)
        .fromTo(
          chips,
          {
            x: (i) => vw([-24, 16, 30, -10, 22][i]) * d,
            y: (i) => vh([-18, 26, -20, 30, 14][i]) * d,
            rotation: (i) => [-11, 8, 13, -7, 6][i],
            opacity: 0,
          },
          {
            x: (i) => (i < 3 ? aX(i) : (i === 3 ? -1 : 1) * (aW() + vw(1.6) * d) * 0.5),
            y: (i) => (i < 3 ? rowY() : rowY() + vh(5)),
            rotation: 0,
            opacity: 1,
            duration: 0.06,
            stagger: { each: 0.006, from: "random" },
            ease: "power4.out",
          },
          L.align + 0.005,
        )
        .fromTo(
          q("[data-lock]"),
          { scaleX: 0, opacity: 0 },
          { scaleX: 1, opacity: 1, duration: 0.045, ease: "power3.out" },
          L.align + 0.05,
        )
        .fromTo(chips[4], { color: "#beb9dc" }, { color: "#ffffff", duration: 0.02, ease: "none" }, L.align + 0.07);
      chapter(3, L.align);

      // ======================================================= ALIGN -> VAULT
      // Slower and softer by design. The row loosens: frames regain a tilt, drift apart
      // and fall back in depth. The plan happened; now it is a photograph.
      tl.addLabel("alignToVault", L.alignToVault)
        .to(q("[data-lock]"), { opacity: 0, duration: 0.04 }, L.alignToVault)
        .to(chips, { opacity: 0, y: (i) => (i < 3 ? rowY() : rowY() + vh(5)) + vh(3), duration: 0.05, stagger: 0.004, ease: "power1.in" }, L.alignToVault)
        .to(titles[3], { opacity: 0, yPercent: -14, duration: 0.06, ease: "power1.in" }, L.alignToVault + 0.02)
        .to(
          morph,
          {
            width: vaultW,
            height: () => vaultW() * 1.3,
            borderRadius: 2,
            x: () => vw(9) * d,
            y: () => vh(-2) * d,
            rotation: 2,
            duration: 0.11,
            ease: "power1.inOut",
          },
          L.alignToVault,
        )
        .to(one('[data-face="align"]'), { opacity: 0, duration: 0.05 }, L.alignToVault + 0.05)
        .to(one('[data-face="vault"]'), { opacity: 1, duration: 0.05 }, L.alignToVault + 0.045)
        .to(atmos[3], { opacity: 0, duration: 0.09, ease: "none" }, L.alignToVault)
        .to(atmos[4], { opacity: 1, duration: 0.09, ease: "none" }, L.alignToVault);

      TRAVEL.forEach((t, i) => {
        tl.to(
          travel[i],
          {
            width: () => tW() * (i ? 0.95 : 1.05),
            height: () => tW() * (i ? 0.95 : 1.05) * 0.75,
            x: () => vw(t.vault.x) * d,
            y: () => vh(t.vault.y) * d,
            z: t.vault.z * d,
            rotation: t.vault.r,
            scale: t.vault.s,
            opacity: 0.82,
            duration: 0.1,
            ease: "power1.inOut",
          },
          L.alignToVault + 0.01 + i * 0.008,
        );
      });

      // ================================================================ VAULT
      // The quietest arrival. Memories settle behind the dominant photograph on long,
      // soft curves, and its exposure comes up last -- the memory developing.
      tl.addLabel("vault", L.vault)
        .to(titles[4], { opacity: 1, yPercent: 0, duration: 0.06, ease: "power2.out" }, L.vault);

      VAULT_PHOTOS.forEach((p, i) => {
        tl.fromTo(
          vaultShots[i],
          { x: () => vw(p.x * 0.6) * d, y: () => vh(p.y * 0.6 + 14) * d, z: p.z - 200, rotation: 0, opacity: 0 },
          {
            x: () => vw(p.x) * d,
            y: () => vh(p.y) * d,
            z: p.z * d,
            rotation: p.r,
            opacity: 0.9,
            duration: 0.075,
            ease: "power2.out",
          },
          L.vault - 0.01 + i * 0.01,
        );
      });

      tl.fromTo(one("[data-exposure]"), { opacity: 0.62 }, { opacity: 0, duration: 0.07, ease: "power1.out" }, L.vault)
        .to(q("[data-vault-type]"), { opacity: 1, y: 0, duration: 0.06, stagger: 0.012, ease: "power2.out" }, L.vault + 0.03);
      chapter(4, L.vault);

      // =============================================================== FINALE
      // Every photograph folds into the centre and the one shape that has been all
      // five things closes into a line.
      tl.addLabel("finale", L.finale)
        .to(chapters, { opacity: 1, duration: 0.03, ease: "none" }, L.finale)
        .to(
          [...vaultShots, ...travel],
          { x: 0, y: 0, z: -60, rotation: 0, scale: 0.3, opacity: 0, duration: 0.05, stagger: 0.005, ease: "power2.in" },
          L.finale,
        )
        .to(q("[data-vault-type]"), { opacity: 0, duration: 0.03 }, L.finale)
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
            duration: 0.06,
            ease: "power3.inOut",
          },
          L.finale + 0.005,
        )
        .to(one('[data-face="vault"]'), { opacity: 0, duration: 0.03 }, L.finale + 0.01)
        .to(morph, { opacity: 0, duration: 0.025, ease: "none" }, L.finale + 0.042)
        .fromTo(
          one("[data-finale]"),
          { opacity: 0, yPercent: 40 },
          { opacity: 1, yPercent: 0, duration: 0.045, ease: "power3.out" },
          L.finale + 0.025,
        );

      // DEPARTURE. The story dims and lifts out across the tail of its own pin while
      // THE LOOP rises through it.
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
            refreshPriority: -1,
          },
        },
      );

      // ------------------------------------------------------ ROOM NAVIGATION
      // Rooms are labelled moments inside one pin; publish a resolver rather than
      // anchors, and read start/end at click time since refresh rewrites both.
      const st = tl.scrollTrigger;
      return registerRoomTargets((name) => {
        const i = rooms.findIndex((room) => room.name === name);
        if (i < 0 || !st) return null;
        const span = tl.duration() || 1;
        return { top: st.start + (PEAK[i] / span) * (st.end - st.start) };
      });
    };

    /** Mobile: no pin. Scenes stack as their own short compositions, each keeping the
     *  room's idea -- messages, media frames, a postcard, a snap, a memory stack. */
    const buildStacked = () => {
      const scenes = gsap.utils.toArray<HTMLElement>("[data-scene]", section);
      const atmos = gsap.utils.toArray<HTMLElement>("[data-atmos]", section);
      gsap.set(atmos, { opacity: 0 });

      scenes.forEach((scene, i) => {
        const shots = scene.querySelectorAll("[data-m-shot], [data-tea-photo], [data-vault-photo]");
        const text = scene.querySelectorAll("[data-title], [data-msg], [data-ticket]");
        const tl = gsap.timeline({
          scrollTrigger: { trigger: scene, start: "top 82%", end: "top 30%", scrub: 0.5 },
        });
        tl.fromTo(text, { opacity: 0, y: 22 }, { opacity: 1, y: 0, stagger: 0.06, ease: "power2.out" }, 0).fromTo(
          shots,
          { clipPath: "inset(0% 0% 100% 0%)", y: 30 },
          { clipPath: "inset(0% 0% 0% 0%)", y: 0, stagger: 0.08, ease: "power2.out" },
          0.1,
        );
        // ALIGN keeps its one idea on a phone: crooked labels snapping straight.
        const chips = scene.querySelectorAll("[data-chip]");
        if (chips.length) {
          tl.fromTo(
            chips,
            { rotation: (j) => [-9, 7, -5, 8, -6][j] ?? 0, x: (j) => (j % 2 ? 18 : -18), opacity: 0.3 },
            { rotation: 0, x: 0, opacity: 1, stagger: 0.04, ease: "power3.out" },
            0.2,
          );
        }
        const strip = scene.querySelector("[data-strip]");
        if (strip) tl.fromTo(strip, { xPercent: 6 }, { xPercent: -10, ease: "none" }, 0);
        gsap.to(atmos[i], {
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: scene, start: "top 80%", end: "bottom 30%", scrub: true },
        });
      });

      return registerRoomTargets((name) => {
        const i = rooms.findIndex((room) => room.name === name);
        const scene = scenes[i];
        if (!scene) return null;
        return { top: scene.getBoundingClientRect().top + window.scrollY };
      });
    };

    const ok = "(prefers-reduced-motion: no-preference)";
    media.add(`${ok} and (min-width: 1024px)`, () => buildStage(1, 5.4));
    media.add(`${ok} and (min-width: 641px) and (max-width: 1023px)`, () => buildStage(0.7, 4.6));
    media.add(`${ok} and (max-width: 640px)`, () => buildStacked());

    // Photos inside the stacked build change scene heights as they decode; one refresh
    // once everything on the page has loaded keeps every later trigger honest.
    const onLoad = () => ScrollTrigger.refresh();
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("load", onLoad);
      media.revert();
    };
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

        <ol data-chapters className="rooms-chapters" aria-label="Chapters">
          {rooms.map((room) => (
            <li key={room.name} data-chapter>
              <b>{room.number}</b>
              <span>{room.name}</span>
            </li>
          ))}
        </ol>

        {/* The photograph that is all five things in turn. */}
        <div data-morph className="rooms-morph" aria-hidden="true">
          <span data-face="tea" className="face face-photo">
            <Shot id="waitWhat" decorative ratio={false} className="face-shot" sizes="(max-width: 1023px) 30vw, 26vw" />
          </span>
          <span data-face="create" className="face face-reel">
            <span data-crop className="reel-crop">
              <Shot id="framePose" decorative ratio={false} className="face-shot" sizes="(max-width: 1023px) 30vw, 22vw" />
            </span>
            <i className="reel-corner c-tl" />
            <i className="reel-corner c-tr" />
            <i className="reel-corner c-bl" />
            <i className="reel-corner c-br" />
            <b data-reel-tag className="reel-rec">REC</b>
            <b data-reel-tag className="reel-tc">00:03:41</b>
            <b data-reel-tag className="reel-take">TAKE 03 · 9:16</b>
          </span>
          <span data-face="oneday" className="face face-postcard">
            <span className="postcard-img">
              <Shot id="roadWalk" decorative ratio={false} className="face-shot" sizes="(max-width: 1023px) 30vw, 26vw" />
            </span>
            <em>LONAVALA</em>
            <u>imagine us here.</u>
            <s className="postcard-stamp">ROAD<br />TRIP</s>
          </span>
          <span data-face="align" className="face face-photo">
            <Shot id="cafeNumbers" decorative ratio={false} className="face-shot" sizes="(max-width: 1023px) 30vw, 24vw" />
          </span>
          <span data-face="vault" className="face face-photo">
            <Shot id="holiLaugh" decorative ratio={false} className="face-shot" sizes="(max-width: 1023px) 34vw, 28vw" />
            <i data-exposure className="face-exposure" />
          </span>
        </div>

        {/* Postcards that live from ONE DAY to VAULT, outside any one scene. */}
        {TRAVEL.map((t) => (
          <div key={t.id} data-travel className="rooms-travel" aria-hidden="true">
            <i data-paper className="travel-paper" />
            <span data-travel-img className="travel-img">
              <Shot id={t.id} decorative ratio={false} className="face-shot" sizes="(max-width: 1023px) 22vw, 17vw" />
            </span>
            <b data-paper className="travel-cap">{t.label}</b>
          </div>
        ))}

        <div className="rooms-scenes">
          {/* ----------------------------------------------------------- TEA */}
          <div data-scene className="scene scene-tea">
            <p data-title className="scene-title t-tea">TEA</p>
            <Shot data-m-shot id="waitWhat" sizes="90vw" className="m-shot m-tilt-l" />
            {TEA_PHOTOS.map((p) => (
              <Shot
                key={p.id}
                id={p.id}
                data-tea-photo
                data-role={p.role}
                sizes="(max-width: 640px) 40vw, 16vw"
                className="tea-photo"
                style={{ "--w": `${p.w}vw` } as CSSProperties}
              />
            ))}
            <div className="tea-thread">
              {TEA_MSGS.map((m) => (
                <p key={m.text} data-msg data-tier={m.tier} data-side={m.side} className="msg">
                  {m.who && <b>{m.who}</b>}
                  <span>{m.text}</span>
                </p>
              ))}
            </div>
            <span data-typing className="typing" aria-hidden="true">
              <b />
              <b />
              <b />
            </span>
            <p data-note className="scene-note n-tea">
              <b>ROOM 01 · THE SPILL</b>
              {rooms[0].description}
            </p>
          </div>

          {/* -------------------------------------------------------- CREATE */}
          <div data-scene className="scene scene-create">
            <p data-title className="scene-title t-create">CREATE</p>
            <Shot data-m-shot id="framePose" sizes="90vw" className="m-shot m-reel" />
            <div data-strip className="strip" aria-hidden="true">
              {STRIP.map((id, i) => (
                <span key={id} data-strip-frame className="strip-frame">
                  <Shot id={id} decorative ratio={false} className="face-shot" sizes="(max-width: 640px) 34vw, 12vw" />
                  {i === 2 && <b className="strip-mark">CUT</b>}
                  {i === 4 && <b className="strip-mark">ROLLING</b>}
                </span>
              ))}
            </div>
            <i data-playhead className="playhead" aria-hidden="true" />
            <p data-note className="scene-note n-create">
              <b>ROOM 02 · THE MAKE</b>
              {rooms[1].description}
            </p>
          </div>

          {/* ------------------------------------------------------- ONE DAY */}
          <div data-scene className="scene scene-oneday">
            <p data-title className="scene-title t-oneday">ONE<br />DAY</p>
            <figure data-m-shot className="m-shot m-postcard">
              <Shot id="roadWalk" sizes="80vw" ratio={false} className="face-shot" />
              <figcaption>LONAVALA <span>imagine us here.</span></figcaption>
            </figure>
            <svg className="route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path data-route pathLength={1} />
            </svg>
            {TICKETS.map((t) => (
              <span key={t.text} data-ticket className="ticket">
                {t.text}
              </span>
            ))}
            <p data-note className="scene-note n-oneday">
              <b>ROOM 03 · THE SOMEDAY</b>
              {rooms[2].description}
            </p>
          </div>

          {/* --------------------------------------------------------- ALIGN */}
          <div data-scene className="scene scene-align">
            <p data-title className="scene-title t-align">ALIGN</p>
            <div className="m-row" aria-hidden="true">
              <Shot data-m-shot id="festCrowd" sizes="30vw" className="m-shot" />
              <Shot data-m-shot id="cafeNumbers" sizes="30vw" className="m-shot" />
              <Shot data-m-shot id="parkSelfie" sizes="30vw" className="m-shot" />
            </div>
            <div className="chips">
              {CHIPS.map((c) => (
                <span key={c} data-chip className="chip">
                  {c}
                </span>
              ))}
            </div>
            <i data-lock className="align-lock" aria-hidden="true" />
            <p data-note className="scene-note n-align">
              <b>ROOM 04 · THE DECISION</b>
              {rooms[3].description}
            </p>
          </div>

          {/* --------------------------------------------------------- VAULT */}
          <div data-scene className="scene scene-vault">
            <p data-title className="scene-title t-vault">VAULT</p>
            <Shot data-m-shot id="holiLaugh" sizes="90vw" className="m-shot m-tilt-r" />
            {VAULT_PHOTOS.map((p) => (
              <Shot
                key={p.id}
                id={p.id}
                data-vault-photo
                sizes="(max-width: 640px) 40vw, 12vw"
                className="vault-photo"
                style={{ "--w": `${p.w}vw` } as CSSProperties}
              />
            ))}
            <p data-vault-type className="vault-quote">
              WE ACTUALLY
              <br />
              DID THIS.
            </p>
            <p data-vault-type className="vault-date">HOLI · 8 PEOPLE WERE HERE</p>
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
