export function chatMembersFromMatch(data: Record<string, unknown>): string[] {
  const hostUid = data.hostUid;
  const playerUids = (data.playerUids as unknown[] | undefined) ?? [];
  const members: string[] = [];
  for (const uid of [hostUid, ...playerUids]) {
    if (typeof uid === "string" && uid.length > 0 && !members.includes(uid)) {
      members.push(uid);
    }
  }
  return members;
}

export function backfillChatDoc(
  data: Record<string, unknown>,
): { memberUids: string[] } | null {
  if (Array.isArray(data.memberUids)) return null;
  return { memberUids: chatMembersFromMatch(data) };
}
