# Admin setup

The admin page is available at `/admin`. It requires a signed-in Discord account whose ID is listed in the Vercel environment variable `ADMIN_DISCORD_IDS` (comma-separated Discord user IDs). The server checks this allowlist for every save, delete, and image upload. Admins can also update or delete any cloud build; changing a build does not change its original creator.

The existing Firebase Admin credentials and Discord sign-in settings must be configured for the deployment. Register `https://www.theveilbuilder.com/api/auth/discord/callback` as a redirect URI in the Discord application. Production sign-in is sent through `www.theveilbuilder.com` even if it was opened from a Vercel deployment URL.

The admin cloud-build list requires the Firestore collection-group index on `builds.updatedAt`. Deploy the checked-in index after selecting your Firebase project:

```text
npx firebase-tools deploy --only firestore:indexes --project YOUR_FIREBASE_PROJECT_ID
```

Wait for the index to finish building in Firebase before using the admin cloud-build list.

Connect a **public** Vercel Blob store to the project to enable image uploads; site images must be reachable by visitors without authentication. A private store cannot accept these public site images, so create or connect a public store instead. Blob uploads use Vercel-managed OIDC credentials when available; the Blob SDK resolves them automatically, so do not manually create or invent a `VERCEL_OIDC_TOKEN`. If OIDC is not enabled for the project/environment, configure the store's `BLOB_READ_WRITE_TOKEN` instead. Firebase Storage and its billing setup are not used. Accepted image types are PNG, JPEG, WebP, and GIF, up to 3 MB.

Builder data changes are stored in the Firestore `veilSiteContent` collection and loaded by the builder. Uploaded images are public Vercel Blob assets; the bundled database remains the default, and Firestore records override, add, or hide individual entries.