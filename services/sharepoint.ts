// Logic to interact with Microsoft Graph API for SharePoint/OneDrive shared links

const BASE_GRAPH_URL = "https://graph.microsoft.com/v1.0";
const MAX_RETRIES = 3;
const BASE_DELAY = 400;

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const parseErrorResponse = async (response: Response) => {
    try {
        const asJson = await response.clone().json();
        return asJson.error?.message || JSON.stringify(asJson);
    } catch {
        try {
            return await response.text();
        } catch {
            return response.statusText || 'Error desconocido';
        }
    }
};

const fetchWithRetry = async (url: string, accessToken: string, attempt = 0): Promise<Response> => {
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (response.ok) return response;

    if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : (BASE_DELAY * Math.pow(2, attempt));
        await sleep(retryAfterMs);
        return fetchWithRetry(url, accessToken, attempt + 1);
    }

    const detail = await parseErrorResponse(response);
    throw new Error(`Graph error ${response.status}: ${detail}`);
};

// 1. Encode URL to Sharing Token (u!...)
// Specification: https://learn.microsoft.com/en-us/graph/api/shares-get?view=graph-rest-1.0
// Requisito: base64url encoding (RFC 4648) sin padding, '+' -> '-', '/' -> '_'
export const getShareIdFromLink = (link: string): string => {
    if (!link) return "";
    try {
        // 1. Base64 standard
        const base64 = btoa(link);
        // 2. Base64url conversion
        const encoded = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return `u!${encoded}`;
    } catch (e) {
        console.error("Error encoding link:", e);
        return "";
    }
};

// 2. Get Drive Item Metadata (Check ETag/Mod Date)
export const getDriveItemMeta = async (shareId: string, accessToken: string) => {
    const response = await fetchWithRetry(`${BASE_GRAPH_URL}/shares/${shareId}/driveItem`, accessToken);

    const data = await response.json();
    return {
        name: data.name,
        lastModifiedDateTime: data.lastModifiedDateTime,
        eTag: data.eTag, // Critical for cache validation
        webUrl: data.webUrl,
        size: data.size
    };
};

// 3. Download Content (Returns ArrayBuffer for SheetJS)
export const downloadDriveItemContent = async (shareId: string, accessToken: string): Promise<ArrayBuffer> => {
    const response = await fetchWithRetry(`${BASE_GRAPH_URL}/shares/${shareId}/driveItem/content`, accessToken);
    return await response.arrayBuffer();
};
