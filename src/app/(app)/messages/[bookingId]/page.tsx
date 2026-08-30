"use client";
import { useParams } from "next/navigation";
import MessageThread from "@/components/MessageThread";

export default function MessageThreadPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  return <MessageThread bookingId={bookingId} />;
}
