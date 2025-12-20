[繁體中文](https://github.com/wuharry/axios-imposto/blob/main/README.zh-TW.md) | **English**

# Axios Impostor 🎭

A lightweight HTTP client based on Fetch API that mimics Axios core features, including `axios.create()` and interceptor mechanisms.

## ✨ Features

- 🚀 **Built on Modern Fetch API** - No additional dependencies required
- 🔧 **axios.create() Style** - Familiar API design
- 🔄 **Request/Response Interceptors** - Full interceptor support
- ⏱️ **Request Timeout Control** - Customizable timeout settings
- 📝 **TypeScript Support** - Complete type definitions
- 🎯 **Smart Content-Type Detection** - Intelligent handling of JSON and FormData
- 🛡️ **Unified Error Handling** - Consistent error handling mechanism

## 📦 Installation

```bash
npm install axios-impostor
```

```bash
pnpm add axios-impostor
```

```bash
yarn add axios-impostor
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { createFetchClient } from 'axios-impostor';

// Create client instance
const api = createFetchClient({
  baseURL: 'https://jsonplaceholder.typicode.com',
  headers: {
    Authorization: 'Bearer your-token',
    'X-Custom-Header': 'value',
  },
  timeout: 5000, // 5 seconds timeout
});

// GET request
interface User {
  id: number;
  name: string;
  email: string;
}

const user = await api.get<User>('/users/1');
console.log(user.name);

// POST request
const newUser = await api.post<User>('/users', {
  name: 'John Doe',
  email: 'john@example.com',
});

// PUT request
const updatedUser = await api.put<User>('/users/1', {
  name: 'Jane Doe',
  email: 'jane@example.com',
});

// DELETE request
await api.delete('/users/1');
```

### Using Interceptors

```typescript
// Request Interceptor
api.interceptors.request.use(
  (config) => {
    // Do something before request is sent
    console.log('Sending request:', config);

    // Modify config
    config.headers = {
      ...config.headers,
      'X-Timestamp': Date.now().toString(),
    };

    return config;
  },
  (error) => {
    // Do something with request error
    console.error('Request error:', error);
    return Promise.reject(error);
  },
);

// Response Interceptor
api.interceptors.response.use(
  (response) => {
    // Do something with response data
    console.log('Received response:', response);
    return response;
  },
  (error) => {
    // Do something with response error
    if (error.message.includes('401')) {
      // Handle unauthorized error, e.g., redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
```

### FormData Support

```typescript
// Automatic FormData handling, no need to manually set Content-Type
const formData = new FormData();
formData.append('file', file);
formData.append('name', 'document.pdf');

const response = await api.post('/upload', formData);
```

## 🔧 API Reference

### createFetchClient(options?)

Create a new HTTP client instance.

**Parameters:**

```typescript
interface CreateFetchClientProp {
  baseURL?: string; // Base URL
  headers?: HeadersInit; // Default headers
  timeout?: number; // Default timeout (milliseconds)
}
```

**Returns:**

```typescript
{
  // HTTP methods
  get<T>(endpoint: string, options?: CustomRequestInit): Promise<T>
  post<T, B>(endpoint: string, body?: B, options?: CustomRequestInit): Promise<T>
  put<T, B>(endpoint: string, body?: B, options?: CustomRequestInit): Promise<T>
  delete<T>(endpoint: string, options?: CustomRequestInit): Promise<T>

  // Interceptors
  interceptors: {
    request: InterceptorManager<CustomRequestInit>
    response: InterceptorManager<Response>
  }
}
```

### Interceptor Manager

```typescript
// Register interceptor
const id = interceptors.request.use(fulfilled, rejected);

// Remove interceptor
interceptors.request.eject(id);
```

## 🎯 Key Features

### Smart Content-Type Handling

- **JSON Data**: Automatically sets `Content-Type: application/json`
- **FormData**: Lets browser automatically set correct boundary
- **Custom Override**: Can manually specify in headers

### Request Timeout Control

```typescript
// Global setting
const api = createFetchClient({ timeout: 10000 });

// Per-request setting
const data = await api.get('/slow-endpoint', { timeout: 30000 });
```

### Error Handling

- **HTTP Errors**: Automatically checks `response.ok` and throws appropriate errors
- **Timeout Errors**: Converts AbortError to readable timeout messages
- **204 No Content**: Returns `null`

## 🔄 Comparison with Axios

| Feature                       | Axios Impostor  | Axios          |
| ----------------------------- | --------------- | -------------- |
| Base Technology               | Fetch API       | XMLHttpRequest |
| Bundle Size                   | Lightweight     | Larger         |
| Browser Support               | Modern Browsers | Wide Support   |
| Request/Response Interceptors | ✅              | ✅             |
| Request Timeout               | ✅              | ✅             |
| Automatic JSON Parsing        | ✅              | ✅             |
| Request/Response Transform    | ❌              | ✅             |
| Upload Progress               | ❌              | ✅             |

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint

# Format
pnpm format
```

## 📄 License

[0BSD License](LICENSE) - Free to use for any purpose

## 🤝 Contributing

Contributions are welcome! Please feel free to submit Issues and Pull Requests.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

If this package helps you, please give it a ⭐️ to show your support!
