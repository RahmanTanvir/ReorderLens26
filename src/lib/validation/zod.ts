import { z } from "zod";

// Zod's dynamic-code probe itself triggers a strict-CSP violation, even when
// caught. Configure before constructing shared schemas; server JIT is unchanged.
if (typeof window !== "undefined") z.config({ jitless: true });

export { z };
