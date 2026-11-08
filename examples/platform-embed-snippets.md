# CALLORIA Live Chat — platform embed snippets

Add the matching one-line snippet before `</body>` in each platform's own repository. Replace the two project placeholders with the public Supabase project URL/ref and the project's public anon or publishable key. These are public browser settings, not service-role or encryption secrets.

## RuffNeck Learn — `ruffneck-lms.vercel.app`

```html
<script defer src="https://calloria.vercel.app/widgets/calloria-chat.js" data-calloria-chat data-platform="ruffneck-learn" data-endpoint="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/calloria-web-chat" data-anon-key="YOUR_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY"></script>
```

## RuffNeck Prospector — `ruffneck-prospector.vercel.app`

```html
<script defer src="https://calloria.vercel.app/widgets/calloria-chat.js" data-calloria-chat data-platform="ruffneck-prospector" data-endpoint="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/calloria-web-chat" data-anon-key="YOUR_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY"></script>
```

## RuffNeck Connect — `ruffneck-connect.vercel.app`

```html
<script defer src="https://calloria.vercel.app/widgets/calloria-chat.js" data-calloria-chat data-platform="ruffneck-connect" data-endpoint="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/calloria-web-chat" data-anon-key="YOUR_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY"></script>
```

## RuffNeck Social Hub — `ruffneck-social-hub.vercel.app`

```html
<script defer src="https://calloria.vercel.app/widgets/calloria-chat.js" data-calloria-chat data-platform="ruffneck-social-hub" data-endpoint="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/calloria-web-chat" data-anon-key="YOUR_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY"></script>
```

## Kano Run — `kano-run.vercel.app`

```html
<script defer src="https://calloria.vercel.app/widgets/calloria-chat.js" data-calloria-chat data-platform="kano-run" data-endpoint="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/calloria-web-chat" data-anon-key="YOUR_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY"></script>
```

## Kano Keke — `kano-keke.vercel.app`

```html
<script defer src="https://calloria.vercel.app/widgets/calloria-chat.js" data-calloria-chat data-platform="kano-keke" data-endpoint="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/calloria-web-chat" data-anon-key="YOUR_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY"></script>
```

## Content Security Policy

If a product website uses CSP response headers, allow the widget script host (`https://calloria.vercel.app`) in `script-src` and the Supabase project URL (or exact function origin) in `connect-src`. Keep existing CSP restrictions and avoid a broad `*` allowlist. If a platform uses a custom domain or preview hostname, do not assume it is included: the server currently accepts only the six exact production origins named above.
