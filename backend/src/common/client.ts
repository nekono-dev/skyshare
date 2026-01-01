import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

const createOpenApiHono = () =>
  new OpenAPIHono({
    strict: false,
    defaultHook: (result) => {
      if (!result.success) {
        if (result.error.name === "ZodError") {
          throw new HTTPException(400, {
            res: new Response(JSON.stringify({ error: "Invalid request" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }),
          });
        }
        throw new HTTPException(500, {
          res: new Response(
            JSON.stringify({ error: "Internal server error" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          ),
        });
      }
    },
  });

const client = createOpenApiHono();
// CORS対応
client.use("/*", cors());
client.use(
  "/*",
  cors({
    origin: "*", // 'http://example.com',
    allowHeaders: ["Content-Type", "Authorization"],
  })
);
// APIドキュメントを出力
client
  .doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "Skyshare backend API",
      version: "1.0.0",
    },
  })
  // swagger側は相対パス
  .get("/doc", swaggerUI({ url: "./openapi.json" }));

client.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});
export { client, createOpenApiHono };
