import { handle } from "../../server/middleware/http.js";
import { withDb } from "../../server/db/client.js";
import { routeCms } from "../../server/controllers/cms/router.js";

// Admin CMS API. All routes require a signed-in admin (and CSRF token for writes).
export default handle((req, context) => withDb((db) => routeCms(req, db, context)), { methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] });

export const config = { path: "/api/cms/*" };
