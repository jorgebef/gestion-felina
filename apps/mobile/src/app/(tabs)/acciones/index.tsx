import { useMembership } from "@/lib/session";
import { ActionsScreen } from "@/screens/actions";
import { FeedScreen } from "@/screens/feed";

/** Associations manage their actions; town halls validate them in their feed. */
export default function ActionsTab() {
  const { isTownHall } = useMembership();
  return isTownHall ? <FeedScreen /> : <ActionsScreen />;
}
