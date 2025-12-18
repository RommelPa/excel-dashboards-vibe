import { Configuration, PopupRequest } from "@azure/msal-browser";

// --- CONFIGURACIÓN MSAL ---
export const msalConfig: Configuration = {
  auth: {
    clientId: "874f6d0d-3d75-4e7e-8fe8-1170401bec02", 
    authority: "https://login.microsoftonline.com/17d96fc3-4c56-4adb-a9de-a1b922b14554", // Usar common para multi-tenant o personal
    redirectUri: window.location.origin + "/",
    postLogoutRedirectUri: window.location.origin + "/",
  },
  cache: {
    cacheLocation: "localStorage", 
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