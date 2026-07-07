# Get Fit Backend API

Node.js + Express backend for the Get Fit mobile app.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env`.
3. Update environment values for your database, auth, payment providers, and mobile app version rules.
4. Start the server:
   ```bash
   npm run dev
   ```

## Forced Update Endpoint

The mobile app calls:

```http
GET /api/app-version
```

Response shape:

```json
{
  "ios": {
    "minimumVersion": "1.2.0",
    "latestVersion": "1.3.0",
    "storeUrl": "https://apps.apple.com/app/idYOUR_APP_ID",
    "message": "A new version of Get Fit is required to continue."
  },
  "android": {
    "minimumVersion": "1.2.0",
    "latestVersion": "1.3.0",
    "storeUrl": "https://play.google.com/store/apps/details?id=com.yourcompany.getfit",
    "message": "A new version of Get Fit is required to continue."
  }
}
```

## Environment Variables For Forced Updates

Replace the placeholder store URLs before production:

- `IOS_MINIMUM_VERSION`
- `ANDROID_MINIMUM_VERSION`
- `IOS_LATEST_VERSION`
- `ANDROID_LATEST_VERSION`
- `IOS_STORE_URL`
- `ANDROID_STORE_URL`

## Updating The Required Version

To force older mobile builds to update, change the minimum version values on the backend and redeploy the API. This lets you require a newer mobile release without publishing another backend or mobile binary.

## Finding Your Store URLs

- iOS App Store URL: Open your app in App Store Connect or the public App Store page and copy the URL in the form `https://apps.apple.com/app/idYOUR_APP_ID`.
- Google Play URL: Open your Play Console listing or public Play Store page and copy the URL in the form `https://play.google.com/store/apps/details?id=com.yourcompany.getfit`.

## Important Notes

- The mobile app version in `gym-management-app/app.json` must be increased before each store release.
- iOS cannot silently install updates. The app can only redirect users to the App Store.
