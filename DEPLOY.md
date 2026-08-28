# First deployment

The repository is configured for the project URL:

```text
https://pom4h.github.io/anatomy/
```

## Publish the source

From the repository root:

```bash
npm install
npm run build

git add .
git commit -m "Publish Anatomy issue 001: Hardware Wallet"
git push origin main
```

## Enable GitHub Pages

Open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.

The workflow `.github/workflows/deploy.yml` will:

1. use Node 24;
2. install the exact direct dependency `astro@7.2.9`;
3. build the static site;
4. upload the `dist/` Pages artifact;
5. deploy it to GitHub Pages.

## Expected routes

```text
/anatomy/
/anatomy/hardware-wallet/
/anatomy/rss.xml
/anatomy/sitemap.xml
/anatomy/robots.txt
```
