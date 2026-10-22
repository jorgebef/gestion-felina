import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "./paraglide/server.js";

export default {
  fetch(req: Request): Promise<Response> {
    // TanStack Router de-localizes URLs through its `rewrite` option (see router.tsx),
    // so the original request is passed through to avoid a double rewrite.
    return paraglideMiddleware(req, () => handler.fetch(req));
  },
};
