import { json, route } from "@/lib/http";
import { openApiDocument } from "@/lib/openapi";

// Serve the OpenAPI spec for import into Swagger UI / Postman / codegen.
// Content-Disposition makes the browser "Download" button save a file instead of
// dumping raw JSON in the tab; API clients reading the body ignore the header.
export const GET = route(async () =>
  json(openApiDocument, {
    headers: { "Content-Disposition": 'attachment; filename="keyshield-openapi.json"' },
  }),
);
