import { SSEMessage } from '../types/index';

export function parseSSEMessage(text: string): SSEMessage | null {
  const lines = text.split('\n');
  const message: SSEMessage = { data: '' };

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      message.data += (message.data ? '\n' : '') + line.slice(6);
    } else if (line.startsWith('event: ')) {
      message.event = line.slice(7);
    } else if (line.startsWith('id: ')) {
      message.id = line.slice(4);
    } else if (line.startsWith('retry: ')) {
      message.retry = Number.parseInt(line.slice(7), 10);
    }
  }

  return message.data ? message : null;
}
