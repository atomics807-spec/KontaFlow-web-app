type Env = {
  APP_URL: string;
  CRON_SECRET: string;
};

type ScheduledController = {
  cron: string;
};

const JOBS: Record<string, string> = {
  "0 * * * *": "/api/cron/daily-digest",
  "0 8 * * *": "/api/cron/trial-reminders",
  "*/5 * * * *": "/api/cron/payment-reconciliation",
  "* * * * *": "/api/cron/queue-worker",
};

const worker = {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const path = JOBS[controller.cron];
    if (!path) return;

    const url = new URL(path, `${env.APP_URL.replace(/\/$/, "")}/`);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      });
      if (!response.ok) {
        console.error(JSON.stringify({ message: "cron.trigger_failed", path, status: response.status }));
      }
    } catch (error) {
      console.error(JSON.stringify({ message: "cron.trigger_error", path, error: String(error) }));
    }
  },

  async fetch(): Promise<Response> {
    return new Response("kontaflow cron trigger", { status: 200 });
  },
};

export default worker;
