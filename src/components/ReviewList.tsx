"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate } from "@/lib/utils";
import Avatar from "./Avatar";
import Stars from "./Stars";
import type { Review } from "@/lib/types";

// The author is embedded rather than fetched per row: reviews and profiles are both
// publicly readable, so one join answers the whole list.
const REVIEW_SELECT =
  "id,booking_id,author_id,subject_id,direction,rating,body,created_at,communication,pet_wellbeing,reliability,author:profiles!reviews_author_id_fkey(id,full_name,avatar_url)";

/** Enough to establish a pattern for a reader without paginating a page that has
 *  no pagination anywhere else. */
const MAX_REVIEWS = 20;

type Status = "loading" | "ready" | "error";

export default function ReviewList({ sitterId }: { sitterId: string }) {
  const { t, locale } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    supabase
      .from("reviews")
      .select(REVIEW_SELECT)
      .eq("subject_id", sitterId)
      .eq("direction", "owner_to_sitter")
      .order("created_at", { ascending: false })
      .limit(MAX_REVIEWS)
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!active) return;
        if (error || !data) {
          setStatus("error");
          return;
        }
        setReviews(data as Review[]);
        setStatus("ready");
      });

    return () => {
      active = false;
    };
  }, [sitterId]);

  // Reviews decorate a profile that has to render without them. A failed query
  // drops the section rather than replacing a working page with an error box.
  if (status === "error") return null;

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-semibold text-ink mb-4">{t("sitters.reviews.heading")}</h2>

      {reviews.length === 0 ? (
        <p className="text-sm text-ink-soft">{t("sitters.reviews.emptyDescription")}</p>
      ) : (
        <ul className="space-y-5">
          {reviews.map((r, i) => (
            <ReviewEntry key={r.id} review={r} index={i} locale={locale} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewEntry({
  review,
  index,
  locale,
  t,
}: {
  review: Review;
  index: number;
  locale: "en" | "lt";
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  // First name only. The reviewer is a private individual who booked a sitter, not
  // a listed business — a surname here would publish a full name next to a city and
  // a service they paid for.
  const firstName = review.author?.full_name?.split(" ")[0] ?? t("sitters.reviews.anonymousAuthor");
  const body = review.body?.trim();

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 4) * 0.05 }}
      className="flex gap-3"
    >
      <Avatar name={firstName} url={review.author?.avatar_url ?? null} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-ink">{firstName}</span>
          <Stars value={review.rating} />
          <span className="text-xs text-ink-soft">{formatDate(review.created_at, locale)}</span>
        </div>
        {body && (
          <blockquote className="text-sm text-ink-soft leading-relaxed mt-1.5 whitespace-pre-line">
            {body}
          </blockquote>
        )}
      </div>
    </motion.li>
  );
}
