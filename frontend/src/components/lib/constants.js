const isDevelopment = process.env.NODE_ENV === "development";

export const SERVER_URL = isDevelopment
  ? "http://localhost:5012"
  : "https://fpdeskapi.cmxph.com";