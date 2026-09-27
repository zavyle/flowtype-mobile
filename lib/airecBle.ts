// TypeScript resolves this fallback while Metro selects airecBle.native.ts or
// airecBle.web.ts at runtime. The web adapter deliberately exposes the same API.
export * from "./airecBle.web";
