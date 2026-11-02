import { TabStack } from "@/components/app/tab-stack";
import { useMembership } from "@/lib/session";

export default function Layout() {
  const { isTownHall } = useMembership();
  return <TabStack title={isTownHall ? "Feed de acciones" : "Acciones"} />;
}
