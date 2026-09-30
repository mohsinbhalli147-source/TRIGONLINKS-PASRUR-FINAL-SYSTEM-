# Trigon Links — Play Store release checklist

Everything Play Console asks for, gathered here so nothing is missed at upload time.

## Before the first upload

### 1. Backend is live and reachable over HTTPS

The app refuses cleartext HTTP (`usesCleartextTraffic="false"` plus a network
security config), so the API **must** be on HTTPS. A self-signed certificate
will not work — the device trusts only system CAs.

Set the API host in the customer app before building:

```bash
# customer-app/.env.production
VITE_API_BASE=https://app.trigonlinks.pk
```

Leaving `VITE_API_BASE` empty makes the app call its own origin, which is correct
when the app is served from the same host as the API.

### 2. Signing key exists

See `android/SIGNING.md`. Generate the upload key, create
`android/keystore.properties`, and **back it up somewhere safe**. Without it you
cannot ship an update to the same listing.

### 3. Version numbers

`android/app/build.gradle` — increment `versionCode` on every upload or Play
rejects it as a duplicate.

---

## Listing content

Already in `android/app/src/main/res/values/strings.xml`, copy from there:

- **App name** (30 chars max): `Trigon Links`
- **Short description** (80 chars max): `Check your bill and payment history, and report problems.`
- **Full description** (4000 chars max): see `store_full_description`
- **Tagline**: see `store_tagline`

### Category and contact

- App or game: **App**
- Category: **Utilities**
- Website: your Trigon Links site
- Privacy policy URL: **required** — see below
- Email: a monitored address

---

## Data safety declaration

The app is deliberately permission-free apart from the network. Declare exactly
this, and nothing more:

| Question | Answer | Why |
| --- | --- | --- |
| Does your app collect or share user data? | **Yes** | |
| Data type: Personal info | Name, email, phone, **government ID (CNIC)** | Shown on the subscriber's own profile screen |
| Data type: Financial info | Purchase history / payment records | Bills and receipts |
| Data type: App activity | Support tickets | Complaints the subscriber files |
| Data type: Messages | Complaint text | |
| Is the data encrypted in transit? | **Yes** | HTTPS only, cleartext blocked by the manifest |
| Can the user request deletion? | **Yes** | Contact the ISP; the admin panel has a deletion-request workflow |
| Is data shared with third parties? | **No** | No analytics, no ads, no crash SDK |
| Is data collected for tracking? | **No** | No advertising ID, no tracking |

There is **no analytics, no advertising and no third-party SDK** in the build. Keep
it that way: adding one changes this declaration and re-triggers review.

**App permissions:** only `INTERNET` and `ACCESS_NETWORK_STATE` appear in the
manifest, so Play's permission declaration is minimal.

---

## Privacy policy

Play requires a publicly reachable URL. A workable policy covers:

1. What is collected (account details, CNIC, billing and payment history, support
   tickets) and why
2. That the CNIC is used **only** to verify the subscriber's identity at sign-in
   and is stored hashed, never in plain text
3. That access is limited to the subscriber's own records, and to staff for
   operational purposes
4. Retention and how to request correction or deletion
5. Contact details and the grievance/appeal process
6. That data is **not** sold or shared with third parties

`PRIVACY-POLICY.md` in this folder is a starting point — have it reviewed before
publishing.

---

## Graphics the Play Console asks for

| Asset | Spec |
| --- | --- |
| App icon | 512×512 PNG, 32-bit, no alpha. Already in `res/mipmap-xxxhdpi` |
| Feature graphic | 1024×500 PNG/JPG, no alpha — **not** generated here, make it in a design tool |
| Phone screenshots | 2–8 images, 16:9 or 9:16, 320–3840 px on the long edge |
| 7" and 10" tablet screenshots | Only if you declare tablet support |

Screenshots should show, in order: the sign-in screen, My Account with the
outstanding balance, a bill with the Paid/Unpaid state, the payment history, and
a support ticket. Get real device screenshots rather than a simulator.

Note: the app is portrait-locked and the manifest declares no tablet-specific
layout, so declare **phone only** to avoid a tablet review requirement.

---

## Release tracks

- **Internal testing** — upload, then add your own Google accounts as testers.
  Do this first; it catches crashers within minutes.
- **Closed testing** — needed for new personal developer accounts and required
  before production for some categories.
- **Production** — staged rollout at 10% is sensible for an app that shows bills.

---

## Post-upload checks

- [ ] Internal testing install works on a real Android phone
- [ ] Sign-in with a real user ID + CNIC succeeds
- [ ] An unpaid bill shows the correct outstanding amount
- [ ] A filed complaint appears in the admin panel's queue
- [ ] Signing out really signs out (the server revokes the session)
- [ ] The app works with the phone in airplane mode — it should show a clear
      "cannot reach Trigon Links" message, never a blank screen
- [ ] Play Console shows no policy or data-safety warnings

---

## Known limitations for review purposes

- No push notifications: a subscriber must open the app to see a ticket update.
  Adding them means a Firebase project and a new permission in the manifest.
- No in-app payment: the app shows bills and receipts only. Payments are taken
  through the channels already listed in the admin panel's company settings.
