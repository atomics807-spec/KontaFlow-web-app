import http from "k6/http";
import { check } from "k6";

// Example:
//   BASE_URL=https://app.kontaflow.com SESSION_COOKIE='sb-...=...' \
//     k6 run --vus 250 --duration 7m load-tests/k6.js
export const options = {
  scenarios: {
    dashboard_read: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS ?? 100),
      duration: __ENV.DURATION ?? "7m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800", "p(99)<1500"],
  },
};

const base = __ENV.BASE_URL ?? "http://127.0.0.1:3000";
const path = __ENV.PATH ?? "/en/dashboard";
const cookie = __ENV.SESSION_COOKIE ?? "";

export default function dashboardRead() {
  const response = http.get(`${base}${path}`, {
    headers: cookie ? { cookie } : {},
    tags: { scenario: "dashboard_read" },
  });
  check(response, { "status is 200": (r) => r.status === 200 });
}
