import { Configuration, PopupRequest } from "@azure/msal-browser";

const authority = import.meta.env.VITE_MSAL_AUTHORITY || "https://login.microsoftonline.com/common";
const clientId = import.meta.env.VITE_MSAL_CLIENT_ID || "";

// --- CONFIGURACIÓN MSAL ---
export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI || window.location.origin + "/",
    postLogoutRedirectUri: import.meta.env.VITE_MSAL_POST_LOGOUT_REDIRECT_URI || window.location.origin + "/",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// 1. Scopes BÁSICOS: Intentar leer archivos con permisos mínimos.
// Normalmente no requiere Admin Approval en la mayoría de tenants.
export const loginRequest: PopupRequest = {
  scopes: ["User.Read", "Files.Read"]
};

// 2. Scopes AVANZADOS: Solo si falla el básico (Sites.Read.All suele pedir Admin).
// Se invocará explícitamente vía botón "Solicitar Permisos Avanzados".
export const advancedRequest: PopupRequest = {
  scopes: ["Files.Read.All", "Sites.Read.All"]
};
