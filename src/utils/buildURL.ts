export const buildURL = (baseURL: string, endpoint: string) => {
  if (endpoint.startsWith('http')) return endpoint;
  // 移除 baseURL 尾部 slash 與 endpoint 頭部 slash
  return `${baseURL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
};
