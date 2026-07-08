import type { SearchStreamEvent } from "./streamEvents";

export async function consumeSearchStream(
  response: Response,
  onEvent: (event: SearchStreamEvent) => void
) {
  if (!response.body) {
    throw new Error("Streaming response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6)) as SearchStreamEvent;
      onEvent(event);
    }
  }
}
