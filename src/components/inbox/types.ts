import type { Contact, Conversation, Message, User } from "@prisma/client";

export type ConversationListItem = Conversation & {
  contact: Contact;
  assignedUser: Pick<User, "id" | "name"> | null;
  messages: Message[];
  unreadCount: number;
};

export type ConversationDetail = Conversation & {
  contact: Contact;
  assignedUser: Pick<User, "id" | "name"> | null;
  messages: (Message & { senderUser: Pick<User, "id" | "name"> | null })[];
};
