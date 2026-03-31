async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || `Request failed: ${response.status}`);
    }

    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export async function getJson(url) {
  const response = await fetch(url);
  return parseResponse(response);
}

export async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function uploadFile(url, file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });
  return parseResponse(response);
}

export async function deleteRequest(url) {
  const response = await fetch(url, { method: "DELETE" });
  return parseResponse(response);
}
