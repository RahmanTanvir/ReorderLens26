import { handleAuthOperation } from "@/server/auth/operations";
import { endpoint } from "@/server/http";

export const POST = endpoint(handleAuthOperation, true);
