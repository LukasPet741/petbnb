const messages = {
  title: "Messages",
  subtitle: "Every conversation is attached to the booking it's about.",
  emptyTitle: "No conversations yet",
  emptyDescription:
    "When you send or receive a booking request, a conversation opens here automatically.",
  findASitter: "Find a sitter",

  threadListUnread: "{count} unread",
  threadListNoMessages: "No messages yet",
  threadListYouPrefix: "You: ",
  threadListLoadFailed: "Could not load your conversations.",

  back: "Back to messages",
  threadHeaderWith: "Conversation with {name}",
  threadAboutPet: "About {pet} · {service}",
  unknownPerson: "Someone",
  loadFailed: "Could not load this conversation.",
  notAParty: "This conversation isn't yours to view.",

  composerPlaceholder: "Write a message…",
  send: "Send",
  sendFailed: "Message not sent. Check your connection and try again.",
  today: "Today",
  yesterday: "Yesterday",

  // System rows: the DB stores only an `event`, so both languages render freely.
  systemEvent: {
    requested: "{actor} sent this booking request",
    accepted: "{actor} confirmed the booking",
    declined: "{actor} declined the request",
    cancelled: "{actor} cancelled the request",
    completed: "{actor} marked the booking as completed",
  },

  notifications: {
    title: "Notifications",
    bellAriaLabel: "Notifications",
    bellAriaLabelUnread: "Notifications, {count} unread",
    empty: "You're all caught up.",
    emptyHint: "Booking updates and new messages will show up here.",
    markAllRead: "Mark all read",
    viewAll: "View all messages",
    booking_requested: "{actor} requested {service} for {pet}",
    booking_accepted: "{actor} confirmed your booking for {pet}",
    booking_declined: "{actor} declined your request for {pet}",
    booking_cancelled: "{actor} cancelled the booking for {pet}",
    booking_completed: "{actor} marked {pet}'s booking as completed",
    message_received: "{actor} sent you a message",
    fallbackPet: "your pet",
  },
};

export default messages;
