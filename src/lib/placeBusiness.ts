/**
 * Businesses on the places map (migration 20261026220000_place_business): claiming a place, an
 * owner editing their own page, and the Bookable tier's booking requests. Status changes go
 * through database functions that check who is asking; nothing here sends email.
 */

import type { CommunityClient } from "@/lib/placeCommunity";

type DbError = { code?: string; message: string } | null;

export type ClaimRole = "owner" | "manager" | "employee";
export const CLAIM_ROLES: ClaimRole[] = ["owner", "manager", "employee"];
export type TimeOfDay = "morning" | "afternoon" | "evening";
export const TIMES_OF_DAY: TimeOfDay[] = ["morning", "afternoon", "evening"];

export interface MyClaim {
  id: string;
  placeSlug: string;
  placeName: string;
  role: ClaimRole;
  status: "pending" | "approved" | "rejected";
  decidedReason: string | null;
  createdAt: string;
}

export interface OwnedPlace {
  id: string;
  slug: string;
  name: string;
  tier: string;
  status: string;
  descriptionLt: string;
  descriptionEn: string;
  hoursLt: string;
  hoursEn: string;
  website: string;
  accepts: string[];
  services: { id: string; nameLt: string; nameEn: string; priceFrom: number | null }[];
}

export interface BookingRequest {
  id: string;
  placeSlug: string;
  placeName: string;
  serviceName: string;
  preferredDate: string;
  preferredTime: TimeOfDay;
  note: string | null;
  status: "requested" | "accepted" | "declined" | "cancelled";
  responseNote: string | null;
  createdAt: string;
  /** Owner's view only: "Jonas J." and the pet. */
  requester?: string;
  petName?: string | null;
  petType?: string | null;
  petWeightKg?: number | null;
}

/** "already" when this user claimed it before; "owned" when the place already has an owner. */
export async function claimPlace(
  client: CommunityClient,
  claim: { placeId: string; role: ClaimRole; message: string },
): Promise<"sent" | "already" | "owned" | "failed"> {
  const { error } = await client.from("place_claims").insert({ place_id: claim.placeId, role: claim.role, message: claim.message.trim() || null });
  if (!error) return "sent";
  if (error.code === "23505") return "already";
  // RLS refuses a claim on a place that has an owner (42501 through PostgREST).
  if (error.code === "42501") return "owned";
  return "failed";
}

/* eslint-disable @typescript-eslint/no-explicit-any -- rows parsed field by field */
export async function fetchMyClaims(client: CommunityClient): Promise<MyClaim[] | null> {
  const { data, error } = await client.from("place_claims").select("id, role, status, decided_reason, created_at, places(slug, name)");
  if (error) return null;
  return (Array.isArray(data) ? data : []).map((c: any) => ({
    id: c.id, role: c.role, status: c.status, decidedReason: c.decided_reason ?? null, createdAt: c.created_at,
    placeSlug: c.places?.slug ?? "", placeName: c.places?.name ?? "",
  }));
}

export async function fetchOwnedPlaces(client: CommunityClient, userId: string): Promise<OwnedPlace[]> {
  const { data } = await client
    .from("places")
    .select("id, slug, name, tier, status, description_lt, description_en, hours_lt, hours_en, website_url, accepts, place_services(id, name_lt, name_en, price_from, sort_order)")
    .eq("owner_user_id", userId);
  return (Array.isArray(data) ? data : []).map((p: any) => ({
    id: p.id, slug: p.slug, name: p.name, tier: p.tier, status: p.status,
    descriptionLt: p.description_lt ?? "", descriptionEn: p.description_en ?? "",
    hoursLt: p.hours_lt ?? "", hoursEn: p.hours_en ?? "", website: p.website_url ?? "", accepts: p.accepts ?? [],
    services: [...(p.place_services ?? [])]
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((s: any) => ({ id: s.id, nameLt: s.name_lt, nameEn: s.name_en, priceFrom: s.price_from == null ? null : Number(s.price_from) })),
  }));
}

const parseRequest = (r: any): BookingRequest => ({
  id: r.id, placeSlug: r.place_slug ?? r.places?.slug ?? "", placeName: r.place_name ?? r.places?.name ?? "",
  serviceName: r.service_name, preferredDate: r.preferred_date, preferredTime: r.preferred_time, note: r.note ?? null,
  status: r.status, responseNote: r.response_note ?? null, createdAt: r.created_at,
  requester: r.requester, petName: r.pet_name ?? null, petType: r.pet_type ?? null,
  petWeightKg: r.pet_weight_kg == null ? null : Number(r.pet_weight_kg),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The owner's words on their page; empty fields are cleared. A website must be https. */
export async function updateOwnedPlace(
  client: CommunityClient,
  placeId: string,
  fields: { descriptionLt: string; descriptionEn: string; hoursLt: string; hoursEn: string; website: string; accepts: string[] },
): Promise<DbError> {
  const text = (v: string) => v.trim() || null;
  const website = text(fields.website);
  if (website && !/^https:\/\//.test(website)) return { code: "website", message: "https only" };
  return (await client.from("places").update({
    description_lt: text(fields.descriptionLt), description_en: text(fields.descriptionEn),
    hours_lt: text(fields.hoursLt), hours_en: text(fields.hoursEn), website_url: website, accepts: fields.accepts,
  }).eq("id", placeId)).error;
}

/** A service the owner adds; one name serves both languages until they write a translation. */
export async function addService(client: CommunityClient, placeId: string, service: { name: string; priceFrom: number | null; sortOrder: number }): Promise<DbError> {
  const name = service.name.trim();
  return (await client.from("place_services").insert({
    place_id: placeId, name_lt: name, name_en: name, price_from: service.priceFrom, sort_order: service.sortOrder,
    unit_lt: service.priceFrom == null ? null : "nuo", unit_en: service.priceFrom == null ? null : "from",
  })).error;
}

export async function deleteService(client: CommunityClient, serviceId: string): Promise<DbError> {
  return (await client.from("place_services").delete().eq("id", serviceId)).error;
}

export async function requestBooking(
  client: CommunityClient,
  request: { placeId: string; petId: string | null; serviceName: string; date: string; time: TimeOfDay; note: string },
): Promise<DbError> {
  return (await client.from("place_booking_requests").insert({
    place_id: request.placeId, pet_id: request.petId, service_name: request.serviceName,
    preferred_date: request.date, preferred_time: request.time, note: request.note.trim() || null,
  })).error;
}

/** The signed-in owner's own requests at one place (RLS shows only their own). */
export async function fetchMyRequestsAt(client: CommunityClient, placeId: string): Promise<BookingRequest[]> {
  const { data } = await client.from("place_booking_requests").select("*").eq("place_id", placeId);
  return (Array.isArray(data) ? data : []).map(parseRequest).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function cancelRequest(client: CommunityClient, requestId: string): Promise<boolean> {
  const { data, error } = await client.rpc("cancel_place_booking_request", { p_request: requestId });
  return !error && data === true;
}

/** Requests for the caller's own places; null when the business tables are not live. */
export async function fetchOwnerRequests(client: CommunityClient): Promise<BookingRequest[] | null> {
  const { data, error } = await client.rpc("my_place_booking_requests", {});
  if (error) return null;
  return (Array.isArray(data) ? data : []).map(parseRequest);
}

export async function respondToRequest(client: CommunityClient, requestId: string, accept: boolean, note: string): Promise<boolean> {
  const { data, error } = await client.rpc("respond_place_booking_request", { p_request: requestId, p_accept: accept, p_note: note.trim() || null });
  return !error && data === true;
}

/** Pet owners per city (floor 5 in the database), for a business owner. */
export async function fetchOwnerCounts(client: CommunityClient): Promise<{ city: string; count: number }[]> {
  const { data, error } = await client.rpc("owner_counts_by_city", {});
  if (error || !Array.isArray(data)) return [];
  return data.map((r: { city: string; owners: number }) => ({ city: r.city, count: Number(r.owners) }));
}

/** Tomorrow and later only: a request needs a day's notice. "YYYY-MM-DD" in local time. */
export function earliestRequestDate(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
