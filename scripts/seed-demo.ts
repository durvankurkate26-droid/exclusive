/**
 * Seed a demo group with people and a full loop of content.
 *
 * Usage:  npm run db:seed
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY, because it creates auth users and writes rows as
 * several different people — both things the anon client is correctly forbidden from
 * doing. This is the only file in the repo that legitimately bypasses RLS, and it is
 * a script, not a route: nothing here is reachable from the running app.
 *
 * Safe to run twice. Every write is keyed on something stable (the users' emails, the
 * group's invite code), so a second run finds what it made the first time and tops it
 * up rather than producing a second identical group.
 *
 * What it deliberately does NOT do: upload photographs. The Vault's storage policies
 * are path-scoped and the point of testing them is to watch a real upload succeed
 * through the UI, so the demo capsules are created empty and you add the images
 * yourself. A seeded photo would prove nothing about the thing most likely to break.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing credentials.\n" +
      "  NEXT_PUBLIC_SUPABASE_URL      Dashboard > Project Settings > API\n" +
      "  SUPABASE_SERVICE_ROLE_KEY     Dashboard > Project Settings > API > service_role\n" +
      "Put both in .env.local (gitignored).",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "exclusive-demo-2026";
const GROUP_NAME = "The Group Chat";
const INVITE_CODE = "DEMO247";

type Person = {
  email: string;
  username: string;
  name: string;
  role: "owner" | "admin" | "member";
  bio: string;
};

const PEOPLE: Person[] = [
  { email: "aisha@exclusive.demo", username: "aisha", name: "Aisha Rahman", role: "owner", bio: "Organises everything. Resents it." },
  { email: "rohan@exclusive.demo", username: "rohan", name: "Rohan Mehta", role: "admin", bio: "Has the terrace." },
  { email: "dev@exclusive.demo", username: "dev", name: "Dev Kapoor", role: "member", bio: "Owns the camera. Never charges it." },
  { email: "meera@exclusive.demo", username: "meera", name: "Meera Iyer", role: "member", bio: "Says maybe. Always comes." },
  { email: "zayn@exclusive.demo", username: "zayn", name: "Zayn Qureshi", role: "member", bio: "Edits at 3am." },
  { email: "priya@exclusive.demo", username: "priya", name: "Priya Nair", role: "member", bio: "Screenshots everything." },
  { email: "arjun@exclusive.demo", username: "arjun", name: "Arjun Sethi", role: "member", bio: "Suggests Goa. Every time." },
  { email: "nina@exclusive.demo", username: "nina", name: "Nina D'Souza", role: "member", bio: "Keeps the receipts." },
  { email: "kabir@exclusive.demo", username: "kabir", name: "Kabir Anand", role: "member", bio: "Replies in six days." },
];

const ids = new Map<string, string>();
const id = (username: string): string => {
  const value = ids.get(username);
  if (!value) throw new Error(`No seeded user for @${username}`);
  return value;
};

/** Days from now, as an ISO timestamp. Negative is the past. */
const at = (days: number): string =>
  new Date(Date.now() + days * 86400000).toISOString();

const day = (days: number): string => at(days).slice(0, 10);

async function seedPeople(): Promise<void> {
  // One page of 200 covers a demo project; anything larger is not this script's job.
  const { data: existing } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const byEmail = new Map(
    (existing?.users ?? []).map((user) => [user.email ?? "", user.id]),
  );

  for (const person of PEOPLE) {
    let userId = byEmail.get(person.email);

    if (!userId) {
      const { data, error } = await db.auth.admin.createUser({
        email: person.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: person.name, user_name: person.username },
      });
      if (error) throw new Error(`${person.email}: ${error.message}`);
      userId = data.user.id;
      console.log(`  + ${person.name} <${person.email}>`);
    } else {
      console.log(`  = ${person.name}`);
    }

    // The handle_new_user trigger already made a profile with a derived username.
    // This is what turns it into a finished, onboarded one.
    const { error } = await db
      .from("profiles")
      .update({
        username: person.username,
        display_name: person.name,
        bio: person.bio,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw new Error(`profile ${person.username}: ${error.message}`);

    ids.set(person.username, userId);
  }
}

async function seedGroup(): Promise<string> {
  const { data: existing } = await db
    .from("groups")
    .select("id")
    .eq("invite_code", INVITE_CODE)
    .maybeSingle();

  if (existing) {
    console.log(`  = ${GROUP_NAME} (${INVITE_CODE})`);
    return existing.id;
  }

  const { data, error } = await db
    .from("groups")
    .insert({
      name: GROUP_NAME,
      description: "Nine people who have been saying 'we should' since 2019.",
      slug: "the-group-chat",
      invite_code: INVITE_CODE,
      created_by: id("aisha"),
    })
    .select("id")
    .single();

  if (error) throw new Error(`group: ${error.message}`);

  await db.from("group_members").insert(
    PEOPLE.map((person) => ({
      group_id: data.id,
      user_id: id(person.username),
      role: person.role,
    })),
  );

  console.log(`  + ${GROUP_NAME} (${INVITE_CODE})`);
  return data.id;
}

/** Skip a room that already has rows, so re-running does not duplicate content. */
async function isEmpty(table: string, groupId: string): Promise<boolean> {
  const { count } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  return (count ?? 0) === 0;
}

async function seedTea(groupId: string): Promise<void> {
  if (!(await isEmpty("teas", groupId))) return console.log("  = tea");

  const { data: tea } = await db
    .from("teas")
    .insert({
      group_id: groupId,
      created_by: id("priya"),
      title: "Kabir replied to the wedding invite. In February.",
      context: "The wedding was in November.",
      status: "brewing",
      updated_at: at(-0.2),
    })
    .select("id")
    .single();

  if (tea) {
    await db.from("tea_messages").insert([
      { tea_id: tea.id, user_id: id("priya"), content: "I want everyone to understand the timeline here.", created_at: at(-1.4) },
      { tea_id: tea.id, user_id: id("nina"), content: "Three months. Three.", created_at: at(-1.3) },
      { tea_id: tea.id, user_id: id("kabir"), content: "I was going to say yes", created_at: at(-1.1) },
      { tea_id: tea.id, user_id: id("meera"), content: "kabir the food is gone", created_at: at(-1.0) },
      { tea_id: tea.id, user_id: id("rohan"), content: "Genuinely impressive commitment to the bit.", created_at: at(-0.3) },
    ]);
  }

  await db.from("teas").insert({
    group_id: groupId,
    created_by: id("meera"),
    title: "Who put the empty carton back in the fridge",
    context: "We all know. I just want it said out loud.",
    status: "spilled",
    updated_at: at(-9),
  });

  console.log("  + tea");
}

async function seedOneDay(groupId: string): Promise<void> {
  if (!(await isEmpty("one_day_ideas", groupId))) return console.log("  = one day");

  const ideas: Array<{ by: string; title: string; description: string; wants: string[]; days: number }> = [
    {
      by: "arjun",
      title: "Drive to Goa without telling anyone",
      description: "Leave Friday night. Come back when we come back.",
      wants: ["arjun", "rohan", "dev", "priya", "meera", "zayn"],
      days: -22,
    },
    {
      by: "nina",
      title: "That rooftop dinner we keep describing",
      description: "Long table, string lights, everyone cooks one thing.",
      wants: ["nina", "aisha", "meera", "kabir"],
      days: -14,
    },
    {
      by: "zayn",
      title: "Learn to surf, badly, on camera",
      description: "The footage is the point. The surfing is incidental.",
      wants: ["zayn", "dev"],
      days: -6,
    },
    {
      by: "meera",
      title: "Go back to the place with the bad karaoke machine",
      description: "",
      wants: ["meera"],
      days: -2,
    },
  ];

  for (const idea of ideas) {
    const { data } = await db
      .from("one_day_ideas")
      .insert({
        group_id: groupId,
        created_by: id(idea.by),
        title: idea.title,
        description: idea.description || null,
        created_at: at(idea.days),
      })
      .select("id")
      .single();

    if (!data) continue;
    await db.from("one_day_interest").insert(
      idea.wants.map((username) => ({
        idea_id: data.id,
        user_id: id(username),
        interested: true,
      })),
    );
  }

  console.log("  + one day");
}

async function seedCreate(groupId: string): Promise<void> {
  if (!(await isEmpty("create_ideas", groupId))) return console.log("  = create");

  const { data: film } = await db
    .from("create_ideas")
    .insert({
      group_id: groupId,
      created_by: id("dev"),
      title: "The one-take walk through the old market",
      description: "One shot, no cuts, everyone crosses frame exactly once.",
      reference_url: "https://vimeo.com/channels/staffpicks",
      status: "people_joining",
      updated_at: at(-3),
    })
    .select("id")
    .single();

  if (film) {
    await db.from("create_members").insert([
      { create_id: film.id, user_id: id("dev"), role: "camera", participation_status: "in" },
      { create_id: film.id, user_id: id("zayn"), role: "editor", participation_status: "in" },
      { create_id: film.id, user_id: id("priya"), role: "appearing", participation_status: "in" },
      { create_id: film.id, user_id: id("rohan"), role: null, participation_status: "in" },
    ]);
  }

  const { data: photo } = await db
    .from("create_ideas")
    .insert({
      group_id: groupId,
      created_by: id("priya"),
      title: "Disposable camera night, developed properly",
      description: "Nine cameras, one each, nobody looks until they're back.",
      reference_url: "https://www.lomography.com",
      status: "editing",
      updated_at: at(-11),
    })
    .select("id")
    .single();

  if (photo) {
    await db.from("create_members").insert([
      { create_id: photo.id, user_id: id("priya"), role: "director", participation_status: "in" },
      { create_id: photo.id, user_id: id("nina"), role: "appearing", participation_status: "in" },
    ]);
  }

  console.log("  + create");
}

async function seedAlign(groupId: string): Promise<void> {
  if (!(await isEmpty("plans", groupId))) return console.log("  = align");

  /* An open plan with a real argument in it: a date everyone disagrees about, a
     place that is nearly settled, no budget. This is the state the room is for. */
  const { data: open } = await db
    .from("plans")
    .insert({
      group_id: groupId,
      created_by: id("aisha"),
      title: "Rohan's birthday, allegedly",
      description: "He says he doesn't want anything. He does.",
      status: "open",
      updated_at: at(-0.5),
    })
    .select("id")
    .single();

  if (open) {
    const options: Array<{ type: "date" | "location" | "budget"; value: string; by: string; votes: string[] }> = [
      { type: "date", value: day(9), by: "aisha", votes: ["aisha", "meera", "nina", "priya"] },
      { type: "date", value: day(16), by: "dev", votes: ["dev", "zayn"] },
      { type: "date", value: day(10), by: "kabir", votes: ["kabir"] },
      { type: "location", value: "Rohan's terrace, obviously", by: "meera", votes: ["meera", "aisha", "nina", "priya", "arjun", "dev"] },
      { type: "location", value: "The place with the bad karaoke machine", by: "arjun", votes: ["arjun"] },
    ];

    for (const option of options) {
      const { data } = await db
        .from("plan_options")
        .insert({
          plan_id: open.id,
          option_type: option.type,
          value: option.value,
          created_by: id(option.by),
        })
        .select("id")
        .single();

      if (!data) continue;
      await db.from("plan_votes").insert(
        option.votes.map((username) => ({ option_id: data.id, user_id: id(username) })),
      );
    }

    await db.from("plan_members").insert([
      { plan_id: open.id, user_id: id("aisha"), attendance_status: "in" },
      { plan_id: open.id, user_id: id("meera"), attendance_status: "in" },
      { plan_id: open.id, user_id: id("nina"), attendance_status: "in" },
      { plan_id: open.id, user_id: id("priya"), attendance_status: "in" },
      { plan_id: open.id, user_id: id("dev"), attendance_status: "maybe" },
      { plan_id: open.id, user_id: id("zayn"), attendance_status: "maybe" },
      { plan_id: open.id, user_id: id("kabir"), attendance_status: "out" },
    ]);
  }

  // A locked one, so the "it's happening" state is visible without locking anything.
  const { data: locked } = await db
    .from("plans")
    .insert({
      group_id: groupId,
      created_by: id("nina"),
      title: "Sunday lunch, the long one",
      status: "locked",
      final_date: at(4),
      final_location: "Nina's, from 1pm",
      final_budget: "₹600 each",
      updated_at: at(-2),
    })
    .select("id")
    .single();

  if (locked) {
    await db.from("plan_members").insert(
      ["nina", "aisha", "meera", "rohan", "priya", "arjun"].map((username) => ({
        plan_id: locked.id,
        user_id: id(username),
        attendance_status: "in" as const,
      })),
    );
  }

  console.log("  + align");
}

async function seedVault(groupId: string): Promise<void> {
  if (!(await isEmpty("memory_capsules", groupId))) return console.log("  = vault");

  const capsules: Array<{ title: string; description: string; by: string; when: number; there: string[]; notes: Array<[string, string]> }> = [
    {
      title: "The night it rained on the terrace",
      description: "Nobody went inside. Nobody could explain why afterwards.",
      by: "rohan",
      when: -38,
      there: ["rohan", "aisha", "meera", "priya", "nina", "dev"],
      notes: [
        ["meera", "We stood in it for forty minutes arguing about whether to go in."],
        ["dev", "Camera survived. Barely. Worth it."],
      ],
    },
    {
      title: "Zayn's last night before he moved",
      description: "",
      by: "priya",
      when: -96,
      there: ["zayn", "priya", "dev", "arjun", "kabir", "aisha"],
      notes: [["zayn", "You all said you'd visit. Two of you did. I'm counting."]],
    },
    {
      title: "The disastrous beach trip",
      description: "Three flat tyres, one working phone, zero regrets.",
      by: "arjun",
      when: -210,
      there: ["arjun", "rohan", "dev", "meera"],
      notes: [["arjun", "I maintain the route was fine."]],
    },
  ];

  for (const capsule of capsules) {
    const { data } = await db
      .from("memory_capsules")
      .insert({
        group_id: groupId,
        created_by: id(capsule.by),
        title: capsule.title,
        description: capsule.description || null,
        memory_date: day(capsule.when),
      })
      .select("id")
      .single();

    if (!data) continue;

    await db.from("memory_members").insert(
      capsule.there.map((username) => ({ capsule_id: data.id, user_id: id(username) })),
    );

    await db.from("memory_notes").insert(
      capsule.notes.map(([username, note]) => ({
        capsule_id: data.id,
        user_id: id(username),
        note,
        created_at: at(capsule.when + 1),
      })),
    );
  }

  console.log("  + vault (no photographs — upload those through the UI)");
}

async function main(): Promise<void> {
  console.log("\nSeeding EXCLUSIVE demo data\n");

  console.log("people");
  await seedPeople();

  console.log("\ngroup");
  const groupId = await seedGroup();

  console.log("\nrooms");
  await seedTea(groupId);
  await seedOneDay(groupId);
  await seedCreate(groupId);
  await seedAlign(groupId);
  await seedVault(groupId);

  console.log(
    `\nDone.\n\n` +
      `  Sign in as any of:\n` +
      PEOPLE.map((p) => `    ${p.email}`).join("\n") +
      `\n  Password: ${PASSWORD}\n` +
      `  Invite code: ${INVITE_CODE}\n\n` +
      `  Start at http://localhost:3000/login\n`,
  );
}

main().catch((error: unknown) => {
  console.error("\nSeed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
