// Logic to interact with Microsoft Graph API for SharePoint/OneDrive shared links

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
    const response = await fetch(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const err = await response.json();
        // Return a clear error message
        throw new Error(err.error?.message || `Error ${response.status}: No se pudo acceder al archivo.`);
    }

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
    // We can use the /content endpoint on the driveItem
    const response = await fetch(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
         throw new Error("Error descargando contenido binario del archivo");
    }

    return await response.arrayBuffer();
};