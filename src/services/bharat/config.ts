// Where the BharatConnect server (the Cloudflare Worker in /worker) lives.
//
// Leave baseUrl EMPTY to keep the demo engine. After you deploy the Worker,
// paste its URL and the APP_TOKEN you set, e.g.
//   baseUrl: 'https://bharatconnect-api.<your-name>.workers.dev'
//
// The token only stops strangers from using your free quota; it is NOT a
// secret (anything inside an app can be extracted). The real keys (Groq,
// Gnani) live only inside the Worker. Don't commit your real token to a
// public repo.

export const BHARAT_API = {
  baseUrl: 'https://bharatconnect-api.bharatconnect.workers.dev',
  appToken: 'kX9vM2pQ7bZ4wL1rN8tY3xC6vB5mK9jA',
  /** Speak translations with Gnani voices (uses credits). false = the phone's own voice. */
  serverTts: true,
};
