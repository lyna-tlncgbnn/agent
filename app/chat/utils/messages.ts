import type { ChatMessage, Role } from "@/app/chat/types";

export function createMessage(role: Role, content: string, streaming = false): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    streaming
  };
}

export function updateMessageById(
  list: ChatMessage[],
  id: string,
  updater: (message: ChatMessage) => ChatMessage
): ChatMessage[] {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index].id !== id) continue;
    const nextMessage = updater(list[index]);
    if (nextMessage === list[index]) return list;
    const nextList = list.slice();
    nextList[index] = nextMessage;
    return nextList;
  }
  return list;
}
