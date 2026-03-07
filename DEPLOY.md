# 🛡 WalletGuard — Netlify Deployment

## Deploy in 60 seconds (drag & drop)

1. Go to https://app.netlify.com
2. Drag the entire `walletguard-site/` folder onto the Netlify dashboard
3. Your site is live instantly at a `.netlify.app` URL

> **Note:** the HTML/JS lives in the project root. The default `publish`
> directory is now `.` (see `netlify.toml`), so you don’t need to move
> files into a `public/` subfolder. If you prefer a `public` folder, just
> put the contents there and update `publish` accordingly.

---

## Deploy via Netlify CLI

```bash
# Install CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy (from walletguard-site/ folder)
netlify deploy --dir=. --prod
```

---

## Deploy via GitHub (recommended for updates)

1. Push this folder to a GitHub repo
2. Go to https://app.netlify.com → "New site from Git"
3. Connect your GitHub repo
4. Set build settings:
   - **Build command:** (leave empty — no build needed)
   - **Publish directory:** `public`
5. Click Deploy

---

## Custom Domain

In Netlify → Site settings → Domain management → Add custom domain

---

## Environment

The site is pure HTML/JS — no build step, no Node.js required.
All blockchain data is fetched client-side from free public APIs.

For enhanced detection, deploy the `walletguard-api/` backend separately
on Railway or Render, then update the `API_BASE` variable in `index.html`.
