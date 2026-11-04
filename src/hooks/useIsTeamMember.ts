import { useEffect, useState } from "react";
import { TeamService } from "../services/TeamService";

export function useIsTeamMember(uid: string | null): boolean {
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (!uid) {
      setIsMember(false);
      return;
    }
    return TeamService.subscribeToIsTeamMember(uid, setIsMember, () =>
      setIsMember(false),
    );
  }, [uid]);

  return isMember;
}
