const defaultEndpoint = "https://integrate.api.nvidia.com/v1/chat/completions";

export const nvidiaEndpoint = process.env.NVIDIA_API_URL ?? defaultEndpoint;
export const nvidiaModel = process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

function isLoopbackEndpoint() {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(nvidiaEndpoint).hostname);
  } catch {
    return false;
  }
}

export function nvidiaConfigured() {
  return Boolean(process.env.NVIDIA_API_URL || process.env.NVIDIA_API_KEY);
}

export function nvidiaHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (process.env.NVIDIA_API_KEY && !isLoopbackEndpoint()) {
    headers.Authorization = `Bearer ${process.env.NVIDIA_API_KEY}`;
  }
  return headers;
}
