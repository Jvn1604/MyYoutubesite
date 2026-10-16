import { scheduledSync } from "../../server/services/sync-runner.js";

// Newest uploads + live/upcoming state. ~2 YouTube quota units per run (~1,440/day).
export default scheduledSync("live");
export const config = { schedule: "*/2 * * * *" };
