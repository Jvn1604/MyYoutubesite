import { scheduledSync } from "../../server/services/sync-runner.js";

// Channel statistics + daily snapshot. 1 quota unit per run (96/day).
export default scheduledSync("stats");
export const config = { schedule: "*/15 * * * *" };
