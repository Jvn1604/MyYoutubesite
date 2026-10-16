import { handle } from "../../server/middleware/http.js";
import { withDb } from "../../server/db/client.js";
import { routeAuth } from "../../server/controllers/admin-auth.js";

export default handle((req, context) => withDb((db) => routeAuth(req, db, context)), { methods: ["GET", "POST"] });

export const config = { path: ["/api/admin/login", "/api/admin/logout", "/api/admin/session", "/api/admin/password"] };
