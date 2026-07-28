import { RankingBadge } from "./ranking-badge";

export type ActivityRank = 1 | 2 | 3;

export function MostActiveBadge({ position = 1 }: { position?: ActivityRank }) {
  return (
    <RankingBadge
      position={position}
      label={`${position}º lugar entre os membros mais ativos`}
    />
  );
}
