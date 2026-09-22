/**
 * Put the group's real photographs into the demo group's Vault.
 *
 * Usage:  npm run db:seed-photos      (after `npm run db:seed`)
 *
 * `seed-demo.ts` deliberately leaves the Vault empty so a real upload gets tested
 * through the UI. This is the separate, explicit step that fills it — with the
 * group's own photos, never stock — so the demo reads like the group it is.
 *
 * Each memory is named after what its photographs actually show; nothing here is
 * attached to a seeded memory whose story it doesn't match. Rows are backdated to the
 * memory's own date, so Home doesn't announce fifty photos "this week" and the pulse
 * doesn't fill with uploads nobody made today.
 *
 * Sources, in order of preference:
 *   public/images/group/<id>.webp        curated, already web-sized (committed)
 *   photo-source/Extra/<file>.jpg        local originals (gitignored) — resized here
 * Missing files are skipped, so a fresh clone without photo-source still runs.
 *
 * Safe to run twice: a memory is found by title, and one that already has photos is
 * left alone.
 */
import { readFile, access } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const INVITE_CODE = "DEMO247";
const BUCKET = "vault-media";

/** `g:` a curated photo in public/images/group, `x:` an original in photo-source/Extra. */
type Shot = { src: string; caption?: string };
type Memory = {
  title: string;
  description: string;
  date: string;
  by: string;
  there: string[];
  notes: Array<[string, string]>;
  shots: Shot[];
};

const MEMORIES: Memory[] = [
  {
    title: "Joey's Pizza, all ten of us",
    description: "Ten people, three pizzas, one table meant for six.",
    date: "2026-09-12",
    by: "priya",
    there: ["priya", "aisha", "rohan", "meera", "dev", "nina", "arjun", "kabir", "zayn"],
    notes: [
      ["nina", "Ten people and three pizzas. Somebody did that maths on purpose."],
      ["dev", "The guy took the photo like it was a wedding."],
    ],
    shots: [
      { src: "x:IMG-20260922-WA0016.jpg", caption: "Outside Joey's, before anyone had eaten" },
      { src: "g:cafe-numbers", caption: "Orders 10, 11 and 12" },
      { src: "g:ice-creams", caption: "Dessert was not optional" },
      { src: "g:cafe-selfie" },
    ],
  },
  {
    title: "Stripes day. Nobody planned it.",
    description: "Six people walked in wearing stripes and every one of them swears it was a coincidence.",
    date: "2026-08-27",
    by: "meera",
    there: ["meera", "aisha", "priya", "nina", "rohan", "kabir"],
    notes: [["meera", "I'm not saying there was a group chat. I'm saying I wasn't in it."]],
    shots: [
      { src: "x:IMG-20260922-WA0017.jpg", caption: "The evidence" },
      { src: "x:IMG-20260922-WA0012.jpg", caption: "Mirror, for the record" },
      { src: "g:plaid-trio", caption: "Plaid counts as a stripe. We voted." },
      { src: "x:IMG-20260922-WA0013.jpg" },
    ],
  },
  {
    title: "The park walk that became a whole day",
    description: "It was meant to be an hour. Somebody found a bicycle.",
    date: "2026-07-19",
    by: "arjun",
    there: ["arjun", "dev", "rohan", "meera", "aisha", "kabir", "zayn", "priya"],
    notes: [["arjun", "Best unplanned plan we've had. I'd like it noted that it was my idea."]],
    shots: [
      { src: "x:IMG-20260922-WA0014.jpg", caption: "Everyone, briefly facing the same way" },
      { src: "x:IMG-20260922-WA0018.jpg", caption: "The bicycle" },
      { src: "g:road-walk" },
      { src: "g:park-selfie", caption: "At the gate, pretending we'd read the timings" },
      { src: "g:forest-flex" },
    ],
  },
  {
    title: "Mirror selfie season",
    description: "Every mirror in the building, one by one.",
    date: "2026-06-05",
    by: "nina",
    there: ["nina", "priya", "meera", "aisha"],
    notes: [["priya", "We found the good mirror. We are not telling anyone where it is."]],
    shots: [
      { src: "x:IMG-20260922-WA0009.jpg", caption: "The good mirror" },
      { src: "x:IMG-20260922-WA0008.jpg" },
      { src: "x:IMG-20260922-WA0011.jpg", caption: "Four is the limit. We tested it." },
      { src: "g:corridor-mirror" },
      { src: "g:mirror-trio", caption: "Matching tees, allegedly unplanned" },
    ],
  },
  {
    title: "Fest night",
    description: "Loud, late, and nobody could hear anybody.",
    date: "2026-01-24",
    by: "rohan",
    there: ["rohan", "aisha", "dev", "zayn", "kabir", "nina", "meera"],
    notes: [["kabir", "I left at eleven. I'm told that was the good part."]],
    shots: [
      { src: "x:IMG-20260922-WA0015.jpg", caption: "Before the stage lights came on" },
      { src: "g:fest-crowd" },
    ],
  },
  {
    title: "Holi. It's still in my hair.",
    description: "Three washes later, still pink.",
    date: "2026-03-04",
    by: "aisha",
    there: ["aisha", "rohan", "dev", "meera", "zayn", "priya", "arjun", "nina"],
    notes: [
      ["zayn", "My shirt was white. Past tense."],
      ["aisha", "Whoever brought the green: we know."],
    ],
    shots: [
      { src: "g:holi-lineup", caption: "Roll call" },
      { src: "g:holi-laugh" },
      { src: "g:holi-peace" },
      { src: "g:holi-01" },
      { src: "g:holi-02", caption: "Pink was a choice. Not his." },
      { src: "g:holi-03" },
      { src: "g:holi-04" },
    ],
  },
  {
    title: "Ethnic day",
    description: "Everyone dressed up and then spent the day in the computer lab.",
    date: "2025-11-14",
    by: "priya",
    there: ["priya", "meera", "aisha", "nina", "rohan"],
    notes: [["meera", "The red threads were my idea. Now nobody takes them off."]],
    shots: [
      { src: "g:ethnic-five", caption: "Five in frame, one on the edge" },
      { src: "g:ethnic-day" },
      { src: "g:frame-pose" },
      { src: "g:saree-hug" },
      { src: "g:red-threads", caption: "Same thread, four wrists" },
      { src: "g:pout-selfie" },
    ],
  },
  {
    title: "Lab hours (allegedly studying)",
    description: "A semester's worth of proof that we were, technically, in class.",
    date: "2025-09-18",
    by: "dev",
    there: ["dev", "zayn", "kabir", "arjun", "aisha", "rohan", "priya", "nina", "meera"],
    notes: [
      ["dev", "The whole back row asleep is my best photograph and I will not be taking questions."],
    ],
    shots: [
      { src: "g:lecture-nap", caption: "The back row, in its natural state" },
      { src: "x:IMG-20260922-WA0010.jpg", caption: "Selfie, but make it the lab computer" },
      { src: "g:wait-what", caption: "Somebody read the marks out loud" },
      { src: "g:lab-hug" },
      { src: "g:lecture-candid" },
      { src: "g:class-thumbs" },
      { src: "g:canteen-trio" },
      { src: "g:corridor-tongue" },
      { src: "g:tongue-selfie" },
      { src: "g:lobby-three" },
      { src: "g:pout-trio" },
      { src: "g:corridor-trio" },
      { src: "g:screen-selfie" },
    ],
  },
];

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a shot to upload-ready bytes. Originals are resized to a 1600px long edge. */
async function load(src: string): Promise<{ body: Buffer; type: string; ext: string; w?: number; h?: number } | null> {
  const [kind, name] = src.split(":");
  if (kind === "g") {
    const path = `public/images/group/${name}.webp`;
    if (!(await exists(path))) return null;
    const body = await readFile(path);
    const size = await dimensions(body);
    return { body, type: "image/webp", ext: "webp", ...size };
  }
  const path = `photo-source/Extra/${name}`;
  if (!(await exists(path))) return null;
  const original = await readFile(path);
  try {
    // sharp ships with Next (image optimisation); used only by this script.
    const { default: sharp } = await import("sharp");
    const { data, info } = await sharp(original)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { body: data, type: "image/webp", ext: "webp", w: info.width, h: info.height };
  } catch {
    return { body: original, type: "image/jpeg", ext: "jpg" };
  }
}

async function dimensions(body: Buffer): Promise<{ w?: number; h?: number }> {
  try {
    const { default: sharp } = await import("sharp");
    const meta = await sharp(body).metadata();
    return { w: meta.width, h: meta.height };
  } catch {
    return {};
  }
}

async function main() {
  const { data: group } = await db.from("groups").select("id").eq("invite_code", INVITE_CODE).maybeSingle();
  if (!group) throw new Error("No demo group. Run `npm run db:seed` first.");

  const { data: people } = await db.from("profiles").select("id, username");
  const byName = new Map((people ?? []).map((p) => [p.username as string, p.id as string]));
  const uid = (username: string) => {
    const value = byName.get(username);
    if (!value) throw new Error(`No seeded user @${username}`);
    return value;
  };

  console.log("\nVault photographs\n");

  for (const memory of MEMORIES) {
    const stamp = `${memory.date}T20:00:00+00:00`;
    let { data: capsule } = await db
      .from("memory_capsules")
      .select("id")
      .eq("group_id", group.id)
      .eq("title", memory.title)
      .maybeSingle();

    if (!capsule) {
      const { data, error } = await db
        .from("memory_capsules")
        .insert({
          group_id: group.id,
          created_by: uid(memory.by),
          title: memory.title,
          description: memory.description,
          memory_date: memory.date,
          created_at: stamp,
          updated_at: stamp,
        })
        .select("id")
        .single();
      if (error) throw error;
      capsule = data;
      await db
        .from("memory_members")
        .insert(memory.there.map((u) => ({ capsule_id: data.id, user_id: uid(u), created_at: stamp })));
      await db.from("memory_notes").insert(
        memory.notes.map(([u, note], i) => ({
          capsule_id: data.id,
          user_id: uid(u),
          note,
          created_at: `${memory.date}T2${1 + i}:30:00+00:00`,
        })),
      );
    }

    const { count } = await db
      .from("memory_media")
      .select("id", { count: "exact", head: true })
      .eq("capsule_id", capsule.id);
    if ((count ?? 0) > 0) {
      console.log(`  = ${memory.title} (${count} photos already)`);
      continue;
    }

    let cover: string | null = null;
    let uploaded = 0;
    for (const [i, shot] of memory.shots.entries()) {
      const file = await load(shot.src);
      if (!file) {
        console.log(`    - skipped ${shot.src} (not on disk)`);
        continue;
      }
      const slug = shot.src.split(":")[1].replace(/\.[a-z]+$/i, "").toLowerCase();
      const path = `${group.id}/${capsule.id}/${String(i).padStart(2, "0")}-${slug}.${file.ext}`;
      const { error: upErr } = await db.storage
        .from(BUCKET)
        .upload(path, file.body, { contentType: file.type, upsert: true });
      if (upErr) {
        console.log(`    ! ${shot.src}: ${upErr.message}`);
        continue;
      }
      // Uploaded by whoever was there, in turn — not all by one account.
      const by = memory.there[i % memory.there.length];
      const { error: rowErr } = await db.from("memory_media").insert({
        capsule_id: capsule.id,
        uploaded_by: uid(by),
        storage_path: path,
        media_type: "image",
        caption: shot.caption ?? null,
        width: file.w ?? null,
        height: file.h ?? null,
        sort_order: i,
        created_at: `${memory.date}T22:${String(10 + i).padStart(2, "0")}:00+00:00`,
      });
      if (rowErr) {
        console.log(`    ! row for ${shot.src}: ${rowErr.message}`);
        continue;
      }
      cover ??= path;
      uploaded += 1;
    }

    if (cover) await db.from("memory_capsules").update({ cover_url: cover, updated_at: stamp }).eq("id", capsule.id);
    console.log(`  + ${memory.title} (${uploaded} photos)`);
  }

  console.log("\nDone.\n");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
