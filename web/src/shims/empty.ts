// Stands in for `react-native-url-polyfill/auto`, which lib/supabase.ts
// imports for its side effect. Browsers already implement URL and
// URLSearchParams, so there is nothing to polyfill — and leaving the real
// import in place would pull React Native internals into the web bundle.
export {};
