import { scheduledSync } from "../../server/services/sync-runner.js";

// Full uploads playlist refresh + deletion detection. ~20 quota units per run.
export default scheduledSync("library");
export const config = { schedule: "17 */6 * * *" };
