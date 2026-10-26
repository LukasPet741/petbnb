/**
 * Community on a place's panel (migration 20261026210000_place_community): reviews of the place,
 * visits posted at its pin, and the public pets that go there. Reads go through the
 * place_community() function (first name and initial only); writes go to the tables, where RLS
 * lets a signed-in owner add, change or delete only their own. Until the migration is live, the
 * read answers null and the panel simply leaves the section out.
 */

export interface CommunityReview {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  author: string;
  mine: boolean;
}

export interface CommunityPost {
  id: string;
  body: string;
  createdAt: string;
  author: string;
  mine: boolean;
  petName: string | null;
  petType: string | null;
  /** Set only while the pet's profile is public: the post links to it. */
  petId: string | null;
}

export interface CommunityPet {
  id: string;
  name: string;
  type: string;
  photoUrl: string | null;
}

export interface PlaceCommunity {
  placeId: string;
  average: number | null;
  count: number;
  reviews: CommunityReview[];
  posts: CommunityPost[];
  pets: CommunityPet[];
}

export type ReportReason = "spam" | "offensive" | "false" | "private" | "other";
export const REPORT_REASONS: ReportReason[] = ["spam", "offensive", "false", "private", "other"];

type DbError = { code?: string; message: string } | null;
type Result = PromiseLike<{ error: DbError }>;
type Filter = Result & { eq(column: string, value: string): Filter };
type Query = PromiseLike<{ data: unknown; error: DbError }> & {
  eq(column: string, value: string): Query;
  is(column: string, value: null): Query;
};

/**
 * What this module asks of the Supabase client. The community tables are not in
 * database.types.ts until it is regenerated after the migration, so the client is taken by shape.
 */
export interface CommunityClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: DbError }>;
  from(table: string): {
    insert(row: object): Result;
    update(values: object): Filter;
    delete(): Filter;
    select(columns: string): Query;
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- parses the function's JSON, checked field by field */
export function parseCommunity(raw: any): PlaceCommunity {
  const average = raw?.rating?.average;
  return {
    placeId: String(raw.place_id),
    average: average == null ? null : Number(average),
    count: Number(raw?.rating?.count ?? 0),
    reviews: (raw.reviews ?? []).map((r: any) => ({
      id: r.id, rating: Number(r.rating), body: r.body ?? null, createdAt: r.created_at, author: r.author, mine: r.mine === true,
    })),
    posts: (raw.posts ?? []).map((p: any) => ({
      id: p.id, body: p.body, createdAt: p.created_at, author: p.author, mine: p.mine === true,
      petName: p.pet_name ?? null, petType: p.pet_type ?? null, petId: p.pet_id ?? null,
    })),
    pets: (raw.pets ?? []).map((p: any) => ({ id: p.id, name: p.name, type: p.type, photoUrl: p.photo_url ?? null })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchCommunity(client: CommunityClient, slug: string): Promise<PlaceCommunity | null> {
  try {
    const { data, error } = await client.rpc("place_community", { p_slug: slug });
    if (error || !data) return null;
    return parseCommunity(data);
  } catch {
    return null;
  }
}

const words = (text: string | undefined) => text?.trim() || null;

/** A first review is added; one already written changes only its rating and words. */
export async function saveReview(
  client: CommunityClient,
  review: { placeId: string; rating: number; body: string; reviewId?: string },
): Promise<DbError> {
  const values = { rating: review.rating, body: words(review.body) };
  const { error } = review.reviewId
    ? await client.from("place_reviews").update(values).eq("id", review.reviewId)
    : await client.from("place_reviews").insert({ place_id: review.placeId, ...values });
  return error;
}

export async function deleteReview(client: CommunityClient, reviewId: string): Promise<DbError> {
  return (await client.from("place_reviews").delete().eq("id", reviewId)).error;
}

export async function addPost(client: CommunityClient, post: { placeId: string; body: string; petId: string | null }): Promise<DbError> {
  return (await client.from("place_posts").insert({ place_id: post.placeId, pet_id: post.petId, body: post.body.trim() })).error;
}

export async function deletePost(client: CommunityClient, postId: string): Promise<DbError> {
  return (await client.from("place_posts").delete().eq("id", postId)).error;
}

/** "This pet goes here", or no longer. */
export async function setPetPlace(client: CommunityClient, petId: string, placeId: string, goes: boolean): Promise<DbError> {
  return goes
    ? (await client.from("pet_places").insert({ pet_id: petId, place_id: placeId })).error
    : (await client.from("pet_places").delete().eq("pet_id", petId).eq("place_id", placeId)).error;
}

export async function setPetPublic(client: CommunityClient, petId: string, isPublic: boolean): Promise<DbError> {
  return (await client.from("pets").update({ is_public: isPublic }).eq("id", petId)).error;
}

/** "sent", "already" (this reporter filed one for it before) or "failed". */
export async function reportContent(
  client: CommunityClient,
  report: { targetType: "place_review" | "place_post" | "pet"; targetId: string; reason: ReportReason; details?: string },
): Promise<"sent" | "already" | "failed"> {
  const { error } = await client.from("content_reports").insert({
    target_type: report.targetType, target_id: report.targetId, reason: report.reason, details: words(report.details),
  });
  if (!error) return "sent";
  return error.code === "23505" ? "already" : "failed";
}

/** The signed-in owner's own review of a place, hidden or not: a hidden one shows them why. */
export interface MyReview {
  id: string;
  rating: number;
  body: string | null;
  hiddenReason: string | null;
}

export async function fetchMyReview(client: CommunityClient, placeId: string, userId: string): Promise<MyReview | null> {
  const { data } = await client.from("place_reviews").select("id, rating, body, status, hidden_reason").eq("place_id", placeId).eq("author_id", userId);
  const row = Array.isArray(data) ? data[0] : null;
  return row ? { id: row.id, rating: Number(row.rating), body: row.body ?? null, hiddenReason: row.status === "hidden" ? row.hidden_reason : null } : null;
}

export interface MyPet {
  id: string;
  name: string;
  type: string;
  isPublic: boolean;
}

export async function fetchMyPets(client: CommunityClient, userId: string): Promise<MyPet[]> {
  const { data } = await client.from("pets").select("id, name, type, is_public").eq("owner_id", userId).is("archived_at", null);
  return Array.isArray(data) ? data.map((p) => ({ id: p.id, name: p.name, type: p.type, isPublic: p.is_public === true })) : [];
}

/** Which of the owner's pets they said go to this place (RLS shows only their own pets' rows). */
export async function fetchMyPetPlaces(client: CommunityClient, placeId: string): Promise<Set<string>> {
  const { data } = await client.from("pet_places").select("pet_id").eq("place_id", placeId);
  return new Set(Array.isArray(data) ? data.map((r) => String(r.pet_id)) : []);
}

export interface PublicPet {
  id: string;
  name: string;
  type: string;
  photoUrl: string | null;
  places: { slug: string; name: string; logo: string | null }[];
}

/** A public pet profile, or null when the pet is private, archived or unknown (or the function is not live). */
export async function fetchPublicPet(client: CommunityClient, petId: string): Promise<PublicPet | null> {
  try {
    const { data, error } = await client.rpc("public_pet", { p_pet: petId });
    if (error || !data) return null;
    const p = data as { id: string; name: string; type: string; photo_url: string | null; places?: { slug: string; name: string; logo: string | null }[] };
    return { id: p.id, name: p.name, type: p.type, photoUrl: p.photo_url ?? null, places: p.places ?? [] };
  } catch {
    return null;
  }
}
