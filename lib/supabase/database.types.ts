/**
 * Database contract.
 *
 * Hand-written rather than generated, because `supabase gen types` needs the CLI and
 * a live project and this repo has neither at build time. It mirrors
 * `supabase/migrations/*` exactly — if you change a migration, change this too.
 *
 * Only the columns the app actually reads or writes are typed. Defaults and
 * database-generated columns are optional on Insert, which is what makes
 * `.insert({...})` type-check without restating every default.
 */

export type Role = "owner" | "admin" | "member";
export type TeaStatus = "brewing" | "spilled" | "archived";
export type IdeaStatus = "idea" | "ready_to_plan" | "moved_to_align" | "completed";
export type CreateStatus =
  | "idea"
  | "people_joining"
  | "scheduled"
  | "shot"
  | "editing"
  | "posted"
  | "completed";
export type PlanStatus = "open" | "locked" | "done" | "cancelled";
export type Attendance = "in" | "maybe" | "out";
export type OptionType = "date" | "location" | "budget";
export type CreateRole = "camera" | "editor" | "appearing" | "director";

type Timestamps = { created_at: string; updated_at: string };

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  avatar_config: Record<string, unknown>;
  onboarded_at: string | null;
} & Timestamps;

export type Group = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  invite_code: string;
  created_by: string;
} & Timestamps;

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: Role;
  created_at: string;
};

export type Tea = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  context: string | null;
  status: TeaStatus;
} & Timestamps;

export type TeaMessage = {
  id: string;
  tea_id: string;
  user_id: string;
  content: string;
} & Timestamps;

export type TeaReaction = {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
};

export type OneDayIdea = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  description: string | null;
  image_url: string | null;
  status: IdeaStatus;
} & Timestamps;

export type OneDayInterest = {
  id: string;
  idea_id: string;
  user_id: string;
  interested: boolean;
  created_at: string;
};

export type CreateIdea = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  description: string | null;
  reference_url: string | null;
  thumbnail_url: string | null;
  /** Added in 0006. Optional in the type so the app degrades before the migration runs. */
  result_url?: string | null;
  status: CreateStatus;
} & Timestamps;

export type CreateMember = {
  id: string;
  create_id: string;
  user_id: string;
  role: CreateRole | null;
  participation_status: Attendance;
} & Timestamps;

export type Plan = {
  id: string;
  group_id: string;
  source_idea_id: string | null;
  source_create_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  status: PlanStatus;
  final_date: string | null;
  final_location: string | null;
  final_budget: string | null;
} & Timestamps;

export type PlanOption = {
  id: string;
  plan_id: string;
  option_type: OptionType;
  value: string;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
};

export type PlanVote = {
  id: string;
  option_id: string;
  user_id: string;
  created_at: string;
};

export type PlanMember = {
  id: string;
  plan_id: string;
  user_id: string;
  attendance_status: Attendance;
} & Timestamps;

export type MemoryCapsule = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  memory_date: string | null;
  source_plan_id: string | null;
  source_create_id: string | null;
  source_idea_id: string | null;
} & Timestamps;

export type MemoryMedia = {
  id: string;
  capsule_id: string;
  uploaded_by: string;
  storage_path: string;
  media_type: "image" | "video";
  caption: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
};

export type MemoryMember = {
  id: string;
  capsule_id: string;
  user_id: string;
  created_at: string;
};

export type MemoryNote = {
  id: string;
  capsule_id: string;
  user_id: string;
  note: string;
  created_at: string;
};

/** Columns the database fills in for us, so callers never have to. */
type Generated = "id" | "created_at" | "updated_at";

type TableDef<Row, OptionalOnInsert extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Extract<Generated | OptionalOnInsert, keyof Row>> &
    Partial<Pick<Row, Extract<Generated | OptionalOnInsert, keyof Row>>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile, "avatar_url" | "bio" | "avatar_config" | "onboarded_at">;
      groups: TableDef<Group, "description">;
      group_members: TableDef<GroupMember, "role">;
      teas: TableDef<Tea, "context" | "status">;
      tea_messages: TableDef<TeaMessage>;
      tea_reactions: TableDef<TeaReaction>;
      one_day_ideas: TableDef<OneDayIdea, "description" | "image_url" | "status">;
      one_day_interest: TableDef<OneDayInterest, "interested">;
      create_ideas: TableDef<
        CreateIdea,
        "description" | "reference_url" | "thumbnail_url" | "status" | "result_url"
      >;
      create_members: TableDef<CreateMember, "role" | "participation_status">;
      plans: TableDef<
        Plan,
        | "description"
        | "status"
        | "source_idea_id"
        | "source_create_id"
        | "final_date"
        | "final_location"
        | "final_budget"
      >;
      plan_options: TableDef<PlanOption, "metadata">;
      plan_votes: TableDef<PlanVote>;
      plan_members: TableDef<PlanMember, "attendance_status">;
      memory_capsules: TableDef<
        MemoryCapsule,
        | "description"
        | "cover_url"
        | "memory_date"
        | "source_plan_id"
        | "source_create_id"
        | "source_idea_id"
      >;
      memory_media: TableDef<
        MemoryMedia,
        "caption" | "media_type" | "sort_order" | "width" | "height"
      >;
      memory_members: TableDef<MemoryMember>;
      memory_notes: TableDef<MemoryNote>;
    };
    Views: Record<never, never>;
    Functions: {
      create_group: {
        Args: { group_name: string; group_description?: string | null };
        Returns: { id: string; slug: string; invite_code: string }[];
      };
      join_group_by_code: {
        Args: { code: string };
        Returns: { id: string; slug: string; name: string; already_member: boolean }[];
      };
      get_invite_preview: {
        Args: { code: string };
        Returns: {
          name: string;
          description: string | null;
          member_count: number;
          already_member: boolean;
        }[];
      };
      rotate_invite_code: { Args: { gid: string }; Returns: string };
      promote_idea_to_plan: { Args: { idea: string }; Returns: string };
      promote_create_to_plan: { Args: { creation: string }; Returns: string };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
