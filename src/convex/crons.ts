import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Server-side enforcement of workspace inactivity expiry.
// Runs every 10 minutes; also enforced on every workspace access.
crons.interval(
  "expire stale workspaces",
  { minutes: 10 },
  internal.workspaces.expireStaleWorkspaces,
  {},
);

export default crons;
