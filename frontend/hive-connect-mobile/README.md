# Hive Connect Mobile

Expo-based React Native app for testing:

- application-console app registration
- QR claim flow
- claimed device listing
- command execution

## Run

1. Install dependencies:

```bash
npm install
```

2. Start Expo:

```bash
npm start
```

3. Open in Expo Go or an emulator.

## API Base URL

The app defaults to:

`http://10.0.2.2:4000/api`

That works for the Android emulator. For a real phone, update the API Base URL field in the app to your laptop's LAN IP, for example:

`http://192.168.1.25:4000/api`

You can also change the default in [app.json](./app.json).

## Deep Link

The app handles QR payloads like:

`hiveconnect://device-claim?token=...`

You can also paste the token manually.

## Test Flow

1. Create an application in the web admin and copy its `appId` and `appKey`.
2. Create a device in the web admin.
3. Generate an enrollment QR for that device from the backend or admin console.
4. Open the mobile app and enter:
   - API Base URL
   - Application ID
   - Application Key
   - Installation ID
5. Scan the QR or paste the token manually.
6. Tap `Claim Device`.
7. Tap `Load Claimed Devices`.
8. Select a claimed device and send a test command.
