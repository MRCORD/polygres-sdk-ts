# Security Policy

## Reporting a Vulnerability

We take the security of Polygres and its developer tools seriously. If you believe you have found a security vulnerability in `polygres-sdk-ts`, please do **not** report it in public GitHub issues or public forums.

Instead, please report vulnerabilities by contacting our security team directly:

- **Email**: [security@polygres.com](mailto:security@polygres.com)
- **Discord**: Contact the team moderators or open a private ticket on [Discord](https://discord.gg/GnHR8ezuwG).

Please include:
1. A description of the issue and the potential impact.
2. Steps to reproduce or a minimal proof-of-concept.
3. Affected SDK versions and runtime environment (Node.js, Cloudflare Workers, etc.).

We will acknowledge receipt of your report within 48 hours and work with you to resolve the issue promptly before public disclosure.

## Secret Redaction

`polygres-sdk-ts` implements strict client-side secret scrubbing.

Any API keys adhering to the Polygres Project API Key format (`poly_live_[0-9a-fA-F]{32}`) as well as the active client API key are automatically redacted (`[REDACTED]`) from:
- Exception messages
- Error detail objects
- Request ID logs
- Stack traces

Even with this automatic masking, we strongly recommend:
- Storing API keys in secure environment variables or secret vaults (e.g. Wrangler Secrets, AWS Secrets Manager, Doppler).
- Never committing live API keys or `.env` files to source control.
