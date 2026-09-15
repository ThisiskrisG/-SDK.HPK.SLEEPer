# PhonexOS Development Hub

This project gives you a server-side website for presenting **PhonexOS** development details while hosting downloadable project files from your own Node.js server. The frontend is static enough to publish on GitHub Pages, and the API keeps large builds, documents, screenshots, and support files in server storage.

## What it includes

- A polished PhonexOS website in `public/` with a landing hero, development details, roadmap phases, investor showcase invite copy, promotion copy, download portal, setup guide, and admin upload controls.
- A Node.js file server with upload, list, download, health, and delete API routes.
- A `game-files/` storage folder for local development. In production, set `STORAGE_DIR` to a persistent disk or mounted volume.
- GitHub issue and pull request templates for tracking requested work that should be handled by a PR.

## PhonexOS website sections

The homepage now focuses on PhonexOS and includes:

1. **Project snapshot** — a quick explanation of the operating-layer / launcher-style concept.
2. **Development details** — the vision, audience, delivery model, and project structure.
3. **Roadmap phases** — brand foundation, prototype builds, and feedback / consulting.
4. **Investor showcase** — local staff, advisor, and investor invitation copy plus a virtual event outline.
5. **Promotion kit** — copy-ready advertisement previews for social posts, sidebars, email, and website banners.
6. **Build portal** — public download cards loaded from the server API.
7. **Admin control** — protected uploads using `ADMIN_TOKEN`.

## Run locally

```bash
ADMIN_TOKEN=change-me npm start
```

Open <http://localhost:3000> to use the PhonexOS development hub. Paste the admin token in the upload section and upload a build file such as a `.zip`, `.pdf`, `.png`, `.mp4`, `.wasm`, or `.mp3`.

## Publish the frontend on GitHub Pages

1. Deploy the Node server to your preferred host.
2. Set `CORS_ORIGIN` to your GitHub Pages URL, for example `https://your-user.github.io`.
3. Publish the `public/` folder to GitHub Pages.
4. In the website's **API base URL** field, enter your server URL and click **Save**.

## Inviting local staff and investors

You can use GitHub Pages as the public virtual showcase page for PhonexOS. GitHub Pages hosts static HTML, CSS, and JavaScript, so it can show the pitch, roadmap, downloadable files, and invite copy. It does not send bulk emails by itself.

Suggested workflow:

1. Publish the site on GitHub Pages.
2. Replace `investors@example.com` in `public/index.html` with your real contact address.
3. Copy the investor invite text from the **Investor showcase** section.
4. Send the invite through your email account, calendar tool, CRM, or newsletter provider.
5. Add your meeting link, GitHub Pages URL, and any private investor files you want to share.

## Request an issue and pull request action

Use the GitHub **PR action request** issue template when you want a change tracked as an issue and handled by a pull request. The included GitHub Actions workflow labels `[PR Action]` issues with `needs-pr` and comments with next steps for opening a linked PR.

See [`docs/pr-action-request.md`](docs/pr-action-request.md) for the exact workflow.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port for the Node server. |
| `STORAGE_DIR` | `./game-files` | Folder where uploaded files are stored. Use persistent storage in production. |
| `ADMIN_TOKEN` | empty | Required for `PUT` uploads and `DELETE` deletes. The server refuses admin actions until this is set. |
| `PUBLIC_DOWNLOADS` | `true` | Set to `false` to require a download token. |
| `DOWNLOAD_TOKEN` | empty | Token accepted through `x-download-token` or `?token=` when private downloads are enabled. |
| `CORS_ORIGIN` | `*` | Browser origin allowed to call the API. Set this to your GitHub Pages origin in production. |
| `MAX_UPLOAD_BYTES` | `1073741824` | Maximum upload size in bytes. |

## API examples

Upload a file:

```bash
curl -X PUT \
  -H "x-admin-token: change-me" \
  --data-binary @build.zip \
  http://localhost:3000/api/files/build.zip
```

List files:

```bash
curl http://localhost:3000/api/files
```

Download a file:

```bash
curl -OJ http://localhost:3000/api/files/build.zip
```

Delete a file:

```bash
curl -X DELETE \
  -H "x-admin-token: change-me" \
  http://localhost:3000/api/files/build.zip
```

## Production notes

- Always set a strong `ADMIN_TOKEN` before exposing the server publicly.
- Put the server behind HTTPS so tokens and downloads are encrypted in transit.
- Mount `STORAGE_DIR` to persistent storage so PhonexOS files survive deploys and container restarts.
- If GitHub Pages hosts the frontend, keep only lightweight site files there and store large builds on the server.
