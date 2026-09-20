import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { serveRobots, serveSitemap } from "./seo";

const http = httpRouter();

auth.addHttpRoutes(http);

// SEO endpoints (served from the Convex site origin).
http.route({
  path: "/robots.txt",
  method: "GET",
  handler: serveRobots,
});
http.route({
  path: "/sitemap.xml",
  method: "GET",
  handler: serveSitemap,
});

export default http;
