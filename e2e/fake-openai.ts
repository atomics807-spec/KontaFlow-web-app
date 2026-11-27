import { createServer } from "node:http";

const port = Number(process.env.FAKE_OPENAI_PORT ?? 4010);

function completion(body: unknown) {
  const messages = (body as { messages?: { role?: string; tool_calls?: unknown[] }[] })?.messages ?? [];
  const hasToolResult = messages.some((message) => message.role === "tool");
  if (hasToolResult) {
    return {
      id: "chatcmpl-e2e-final",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "gpt-4.1-mini",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content:
              "I prepared a draft expense for 500 FCFA on transport. Review it and confirm before I post it.",
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
    };
  }

  return {
    id: "chatcmpl-e2e-tool",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4.1-mini",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_e2e_1",
              type: "function",
              function: {
                name: "propose_transactions",
                arguments: JSON.stringify({
                  transactions: [
                    {
                      kind: "expense",
                      amount: "500",
                      description: "E2E transport",
                      category: "Transport",
                      payment_method: "cash",
                      occurred_on: null,
                      contact: null,
                      account: "Cash",
                      counter_account: null,
                    },
                  ],
                }),
              },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 45, total_tokens: 145 },
  };
}

createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.method !== "POST" || !request.url?.endsWith("/chat/completions")) {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "not_found" } }));
    return;
  }

  let raw = "";
  request.on("data", (chunk) => {
    raw += chunk;
  });
  request.on("end", () => {
    try {
      const body = JSON.parse(raw) as unknown;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(completion(body)));
    } catch {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "invalid_json" } }));
    }
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`fake OpenAI listening on http://127.0.0.1:${port}`);
});
