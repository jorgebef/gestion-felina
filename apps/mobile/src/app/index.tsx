import { Redirect } from "expo-router";

import { homeHref, useViewer } from "@/lib/session";

/** Entry point: sends each person to where the web app's `/` would. */
export default function Index() {
  return <Redirect href={homeHref(useViewer() ?? null)} />;
}
