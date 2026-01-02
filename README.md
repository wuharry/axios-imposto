[繁體中文](./README.zh-TW.md) | **English**

# Axios Impostor 🎭

A small HTTP client with an Axios‑like API. This README only focuses on **how to use it**, **what types exist**, and **where we recommend putting the code** in your own project.

## Installation

```bash
npm install axios-impostor
# or
pnpm add axios-impostor
# or
yarn add axios-impostor
```

---

## 1. Recommended usage pattern

In your own app we recommend:

1. **Create a single shared client**
   - Put it in a file such as `src/api/client.ts`.
   - Configure `baseURL`, `timeout`, default `headers`, and interceptors in one place.
2. **Create small functions for each endpoint**
   - Example: `src/api/users.ts` exports `getUser`, `createUser`, etc.
   - Each function returns a typed value (e.g. `Promise<User>`), and internally calls `api.get<User>()`.
3. **Handle errors close to your UI or business logic**
   - Use the `FetchClientError` type when you want to check HTTP status, error code, or request config.
4. **SSE usage in a separate module**
   - For long‑lived streams (chat, notifications, AI streaming), create a module like `src/api/stream.ts` that exports helper functions using `api.sse()`.

You do **not** need to know how this library is implemented internally to follow the rest of this README.

---

## 2. Copy‑paste example (REST + error handling)

A minimal example you can drop into your project:

```typescript
import { createFetchClient, FetchClientError } from 'axios-impostor';

// 1. Define your response types
interface User {
  id: number;
  name: string;
  email: string;
}

// 2. Create a shared client (put this in something like src/api/client.ts)
export const api = createFetchClient({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 10000,
});

// 3. Wrap endpoints in small helper functions (e.g. in src/api/users.ts)
export async function getUser(userId: number): Promise<User> {
  return api.get<User>(`/users/${userId}`);
}

export async function createUser(input: Pick<User, 'name' | 'email'>): Promise<User> {
  return api.post<User, typeof input>('/users', input);
}

// 4. Use helpers in your UI / services
async function example() {
  try {
    const user = await getUser(1);
    console.log('User name:', user.name);
  } catch (error) {
    if (error instanceof FetchClientError) {
      console.error('Request failed:', {
        code: error.code,
        status: error.response?.status,
        url: (error.config as any).url,
      });
    }
    throw error;
  }
}
```

You can start from this snippet and adjust:
- Change `baseURL` to your API domain.
- Add more endpoint helpers in separate files.
- Re‑use the same `api` instance everywhere.

---

## 3. Copy‑paste example (SSE streaming)

For streaming responses (chat, AI, notifications):

```typescript
import { api } from './client'; // shared client from previous example
import type { SSEMessage, SSEConnection } from 'axios-impostor';

export function subscribeChat(roomId: string, onMessage: (data: unknown) => void): SSEConnection {
  const connection = api.sse(`/chat/rooms/${roomId}/stream`, {
    headers: {
      Authorization: 'Bearer your-token',
    },
    onOpen: () => {
      console.log('SSE connected');
    },
    onMessage: (message: SSEMessage) => {
      // Many backends send JSON in `message.data`
      try {
        const parsed = JSON.parse(message.data);
        onMessage(parsed);
      } catch {
        onMessage(message.data);
      }
    },
    onError: (error) => {
      console.error('SSE error', error);
    },
    onClose: () => {
      console.log('SSE closed');
    },
  });

  return connection;
}

// usage
const connection = subscribeChat('room-1', (payload) => {
  console.log('chat update:', payload);
});

// later, when you want to stop listening
connection.close();
```

---

## 4. Public API

### `createFetchClient(options?: CreateFetchClientProp)`

Creates a client instance you reuse across your app.

**Options (`CreateFetchClientProp`):**
- `baseURL?: string` – base URL that will be prefixed in all relative endpoints.
- `headers?: HeadersInit` – default headers sent with every request.
- `timeout?: number` – default timeout (ms) for non‑streaming requests.
- `credentials?: RequestCredentials` – how cookies/auth are sent (`'omit' | 'same-origin' | 'include'`).

**Return value (`FetchClient`):**
- `get<T>(endpoint: string, options?: CustomRequestInit): Promise<T>`
- `post<T, B>(endpoint: string, body?: B, options?: CustomRequestInit): Promise<T>`
- `put<T, B>(endpoint: string, body?: B, options?: CustomRequestInit): Promise<T>`
- `patch<T, B>(endpoint: string, body?: B, options?: CustomRequestInit): Promise<T>`
- `delete<T>(endpoint: string, options?: CustomRequestInit): Promise<T | null>`
- `sse(endpoint: string, options: SSEOptions): SSEConnection`
- `interceptors.request: InterceptorManager<CustomRequestInit>`
- `interceptors.response: InterceptorManager<Response>`

**How the methods behave:**
- All HTTP methods **parse JSON automatically** and return the parsed value as `T`.
- `204 No Content` resolves to **`null`**.
- Non‑2xx statuses throw a `FetchClientError`.

### `interceptors`

- Use **request interceptors** for things like:
  - Adding auth headers.
  - Logging or tagging requests.
- Use **response interceptors** for things like:
  - Global 401 handling (e.g. redirect to login).
  - Normalizing error messages.

Example:

```typescript
api.interceptors.request.use((config) => {
  config.headers = {
    ...config.headers,
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  };
  return config;
});
```

---

## 5. Types and where to use them

This section lists the important public types and how you would typically use them in an app.

### `CustomRequestInit`

Extends the built‑in `RequestInit` with:
- `timeout?: number` – per‑request timeout (overrides client default).
- `isStream?: boolean` – internal flag used by the client (you usually dont need to set this).
- `url?: string` – set internally to the endpoint.
- `baseURL?: string` – set internally to the clients base URL.

**Use it when:** you want to type a function that forwards arbitrary request options into the client, e.g. helper utilities that accept `options?: CustomRequestInit`.

### `FetchClient`

The shape of the object returned by `createFetchClient`.

**Use it when:**
- You want to type a shared client instance: `const api: FetchClient = createFetchClient(...)`.
- You pass the client around (e.g. dependency injection or testing).

### `FetchClientError`

A custom error type thrown when:
- The request times out.
- The network fails.
- The server returns a non‑OK HTTP status (4xx/5xx).

It extends `Error` and adds:
- `code?: string` – e.g. `'ERR_NETWORK'`, `'ERR_BAD_RESPONSE'`, `'ECONNABORTED'`.
- `config: CustomRequestInit` – the final request config.
- `request?: Request` – the underlying `Request` when available.
- `response?: Response` – the underlying `Response` when available.

**Use it when:**
- Writing error‑handling helpers.
- Building a global error boundary.
- Logging structured error information.

### `InterceptorManager<T>` / `InterceptorHandler<T>`

You normally dont construct these yourself; you get them through `api.interceptors.request` and `api.interceptors.response`.

**Use them when:**
- Adding or removing interceptors with `use` / `eject`.

### `SSEMessage`

Represents one SSE event from the server:
- `data: string` – payload (often JSON string).
- `event?: string` – event name.
- `id?: string` – message id.
- `retry?: number` – reconnection delay suggested by server.

**Use it when:**
- Typing your SSE handlers: `onMessage: (message: SSEMessage) => void`.

### `SSEOptions`

Configuration for `api.sse()`:
- Inherits all non‑`method` fields from `CustomRequestInit` (e.g. `headers`, `credentials`).
- Adds callbacks: `onOpen`, `onMessage`, `onError`, `onClose`.

**Use it when:**
- Exposing your own SSE helpers that simply forward options to `api.sse()`.

### `SSEConnection`

The object returned from `api.sse()`:
- `close(): void` – stop the stream.
- `readyState: 'connecting' | 'open' | 'closed'` – current connection state.

**Use it when:**
- Managing the lifecycle of a stream (e.g. in a React effect or a custom hook).

---

## 6. License

[MIT License](LICENSE)
