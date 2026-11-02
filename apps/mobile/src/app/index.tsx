import { Redirect } from "expo-router";

import { useViewer } from "@/lib/session";

/** Entry point: sends each person to where the web app's `/` would. */
export default function Index() {
  const viewer = useViewer();
  if (!viewer) return <Redirect href="/login" />;
  if (viewer.membership?.organization.status === "approved") return <Redirect href="/panel" />;
  if (viewer.isPlatformAdmin && !viewer.membership) return <Redirect href="/admin" />;
  return <Redirect href="/onboarding" />;
}
