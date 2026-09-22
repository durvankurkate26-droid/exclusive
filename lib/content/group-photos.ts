/**
 * The group's photographs, curated from the raw library in `photo-source/`.
 *
 * `photo-source/` is the master (gitignored, never served). 35 of its 71 files were
 * picked: burst duplicates, near-identical retakes and shots dominated by strangers
 * were left out. Each pick is exported to `public/images/group/<id>.webp` at a 1200-1400px
 * long edge, which is what `next/image` resizes from, and the handful the hero trail and
 * the menu show instantly also get a ~520px variant in `sm/` so they can be preloaded
 * without shipping the big file.
 *
 * One registry instead of per-section folders: several photos play more than one role on
 * purpose (the "wait WHAT" faces are hero trail *and* TEA evidence), and the role a photo
 * plays is decided by the section that uses it, not by where the file lives.
 */
export type GroupPhoto = {
  src: string;
  /** Pre-sized variant for places that bypass next/image (trail, menu). */
  sm?: string;
  w: number;
  h: number;
  alt: string;
};

const photo = (id: string, w: number, h: number, alt: string, sm = false): GroupPhoto => ({
  src: `/images/group/${id}.webp`,
  sm: sm ? `/images/group/sm/${id}.webp` : undefined,
  w,
  h,
  alt,
});

export const photos = {
  forestFlex: photo("forest-flex", 1200, 900, "Five friends flexing and pulling faces in a selfie on a forest road", true),
  waitWhat: photo("wait-what", 1050, 1400, "Three friends with hands over their mouths, mid-gasp", true),
  poutSelfie: photo("pout-selfie", 960, 1280, "A friend in a kurta pouting into the camera", true),
  holiPeace: photo("holi-peace", 627, 836, "A friend covered in Holi colour throwing a peace sign", true),
  festCrowd: photo("fest-crowd", 836, 627, "Four friends in a selfie at a college fest, stage lights behind them", true),
  poutTrio: photo("pout-trio", 1400, 1050, "Three friends squished together, pouting", true),
  tongueSelfie: photo("tongue-selfie", 627, 836, "Three friends in a close selfie, one sticking her tongue out", true),
  iceCreams: photo("ice-creams", 1050, 1400, "Eight hands holding ice-cream cones together over a chevron floor", true),
  cafeNumbers: photo("cafe-numbers", 836, 627, "Three friends at a café counter behind order numbers 10, 11 and 12", true),
  framePose: photo("frame-pose", 627, 836, "Four friends in ethnic wear framing their faces with their hands", true),
  corridorTongue: photo("corridor-tongue", 836, 627, "Three friends in a college corridor, one pulling a face", true),
  lectureNap: photo("lecture-nap", 1280, 960, "A whole row of students asleep on their desks mid-lecture", true),
  cafeSelfie: photo("cafe-selfie", 836, 627, "Three friends in a selfie at a café table"),
  corridorMirror: photo("corridor-mirror", 1050, 1400, "Three friends taking a mirror selfie at the end of a long corridor"),
  lectureCandid: photo("lecture-candid", 960, 1280, "Two friends caught mid-conversation in a lecture hall"),
  classThumbs: photo("class-thumbs", 836, 627, "Four friends in a classroom selfie, one with a thumbs up"),
  mirrorTrio: photo("mirror-trio", 1050, 1400, "Three friends in matching oversized tees taking a mirror selfie"),
  screenSelfie: photo("screen-selfie", 543, 965, "A selfie of four friends showing on a lab computer screen"),
  holi01: photo("holi-01", 627, 836, "A friend in glasses with Holi colour on his face"),
  holi02: photo("holi-02", 627, 836, "A friend in a striped tee smeared with pink Holi colour"),
  holi03: photo("holi-03", 627, 836, "A friend in a Nike tee with yellow Holi colour on her cheek"),
  holi04: photo("holi-04", 627, 836, "A friend in a striped sweater looking back over her shoulder"),
  roadWalk: photo("road-walk", 900, 1200, "Four friends walking down a tree-lined road toward the camera", true),
  parkSelfie: photo("park-selfie", 1200, 900, "Three friends in a selfie at the gate of a national park"),
  holiLineup: photo("holi-lineup", 965, 543, "Eight friends lined up after Holi, colour on their faces", true),
  plaidTrio: photo("plaid-trio", 627, 836, "Three friends standing together, the middle one in a plaid shirt"),
  holiLaugh: photo("holi-laugh", 627, 836, "A group of friends laughing together after Holi"),
  redThreads: photo("red-threads", 1050, 1400, "Four wrists on a table, each tied with the same red thread", true),
  labHug: photo("lab-hug", 1050, 1400, "Two friends hugging in a college computer lab"),
  ethnicFive: photo("ethnic-five", 1400, 1050, "Five friends in ethnic wear in a tight selfie"),
  corridorTrio: photo("corridor-trio", 836, 627, "Three friends in a corridor selfie, one giving a thumbs up"),
  sareeHug: photo("saree-hug", 1050, 1400, "Three friends in sarees hugging in a computer lab"),
  ethnicDay: photo("ethnic-day", 1280, 960, "Four friends dressed up for ethnic day in a selfie"),
  canteenTrio: photo("canteen-trio", 1400, 1050, "Three friends leaning into each other in the canteen"),
  lobbyThree: photo("lobby-three", 1400, 1050, "Three friends smiling in a college lobby"),
} satisfies Record<string, GroupPhoto>;

export type PhotoId = keyof typeof photos;

/**
 * Hero trail order. Mixed on purpose: landscape, portrait and square-ish alternate, and
 * funny sits next to tender, so no two consecutive frames read as the same kind of shot.
 */
export const heroTrail: PhotoId[] = [
  "forestFlex",
  "waitWhat",
  "cafeNumbers",
  "poutSelfie",
  "festCrowd",
  "iceCreams",
  "corridorTongue",
  "holiPeace",
  "lectureNap",
  "framePose",
  "poutTrio",
];

/** The four the touch hero composes statically, since there is no cursor to follow. */
export const heroStill: PhotoId[] = ["forestFlex", "waitWhat", "festCrowd", "holiPeace"];

/** Menu previews, one per room, in `rooms` order. */
export const menuPreview: PhotoId[] = ["lectureNap", "framePose", "roadWalk", "holiLineup", "redThreads"];
