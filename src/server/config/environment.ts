import "server-only";

import { parseServerEnvironment } from "@/lib/validation/environment";

export function getServerEnvironment() {
  return parseServerEnvironment(process.env);
}
