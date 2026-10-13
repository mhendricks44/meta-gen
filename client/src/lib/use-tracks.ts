import { useMutation, useQuery } from "@tanstack/react-query";
import type { TrackWithOpp } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useApp } from "@/lib/app-state";

export function useTracks() {
  const { member, openJoin } = useApp();
  const q = useQuery<TrackWithOpp[]>({
    queryKey: ["/api/members", member?.id ?? 0, "tracks"],
    enabled: !!member,
  });
  const byOpp = new Map((q.data ?? []).map((t) => [t.opportunityId, t]));

  const set = useMutation({
    mutationFn: async (v: { opportunityId: number; status: string; wouldHaveMissed?: boolean | null }) =>
      (await apiRequest("POST", "/api/tracks", { memberId: member!.id, ...v })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", member?.id ?? 0, "tracks"] });
    },
  });
  const remove = useMutation({
    mutationFn: async (opportunityId: number) => apiRequest("DELETE", `/api/tracks/${member!.id}/${opportunityId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/members", member?.id ?? 0, "tracks"] }),
  });

  function requireMember(reason: string) {
    if (!member) {
      openJoin(reason);
      return false;
    }
    return true;
  }

  return {
    tracks: q.data ?? [],
    isLoading: q.isLoading,
    byOpp,
    toggleSave(opportunityId: number) {
      if (!requireMember("Join to save opportunities and get them back in My moves.")) return;
      if (byOpp.has(opportunityId)) remove.mutate(opportunityId);
      else set.mutate({ opportunityId, status: "saved" });
    },
    setStatus(opportunityId: number, status: string, wouldHaveMissed?: boolean | null) {
      if (!requireMember("Join to track what you've applied to and done.")) return;
      set.mutate({ opportunityId, status, wouldHaveMissed });
    },
    requireMember,
  };
}
