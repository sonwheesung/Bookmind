# Re:Read — Privacy Policy

**Effective date: 21 September 2026** · Version 1.2

This English text is the **canonical version**. A Korean translation is available at
[`PRIVACY.ko.md`](./PRIVACY.ko.md); if the two ever disagree, this version governs.

> 🔴 **This file is the source of truth.** The published web page at
> `https://vivace-games.com/reread/privacy` is a copy of it. If the wording has to change,
> change it here first and then update the page (`docs/STORE_LISTING.md` §8).

---

## 1. Who we are

| | |
|---|---|
| Service | **Re:Read** (Android app, package `com.vivacegames.reread`) |
| Operator | Hwiseong Games (휘성게임즈), a sole proprietorship registered in the Republic of Korea |
| Publisher name on Google Play | Vivace Games Studio |
| Representative | SON WHEESUNG (손휘성) |
| Business registration number | 749-25-02260 |
| Business address | 204, 2F, 22 Seongan 5-gil, Jung-gu, Ulsan, 44421, Republic of Korea |
| Privacy officer | SON WHEESUNG, Representative · `support@vivace-games.com` |
| Contact | `support@vivace-games.com` |

We are the data controller for the limited processing described below.

---

## 2. The short version

- **There is no account.** You cannot sign up, and we do not know who you are.
- **The app shows ads.** Google AdMob ads appear at the bottom of a few screens and once after you
  finish a review session (section 4.2). If you buy ad removal, the advertising SDK is never started.
  There is no analytics, attribution or crash-reporting SDK.
- **What you save never leaves your phone.** Books, passages, your own thoughts, tags, review
  schedules and practices are written to a database on the device and nowhere else.
- **The only request the app itself makes is the update check.** Ads are requested by Google's
  advertising SDK, and the ad-removal purchase is handled by Google Play. Everything that leaves
  is listed in section 4. **Your saved passages go into none of these.**
- **Photos are read on the device.** Text recognition runs locally; no image is ever uploaded.

---

## 3. What stays on your device

Everything the app is for.

| What | Where |
|---|---|
| Books (title, author, reading status, page progress) | Local database on the device |
| Passages you save, the source book and page | 〃 |
| Your own thoughts on a passage | 〃 |
| Tags | 〃 |
| Review schedule and review history | 〃 |
| Practices and the days you checked them | 〃 |
| App settings (language, reminder time) | Device storage |

This data is held in the app's private storage. We have no server that holds it, no way to read
it remotely, and no copy of it. **Uninstalling the app deletes all of it**, which is also why we
give you an export (below).

### 3.1 The export file

You can export your whole library to a single file and import it again later. The file is created
by the app and handed to your operating system's share sheet; where it goes from there is your
choice and the app does not follow it.

> ⚠ **The export file is plain, unencrypted text and contains everything you have saved**,
> including your private thoughts. Treat it the way you would treat a diary. If you put it in a
> shared folder or send it to someone, they can read all of it.

---

## 4. What leaves your device

### 4.1 The update check

Re:Read can update its own application code without a new store release, so that we can fix
problems quickly. **Each time you open the app**, it asks Expo's update service (Expo, Inc., United
States — "EAS Update") whether a newer version exists for the version you have installed. If one
does, it is downloaded in the background and applied the next time the app fully restarts.

The request contains only the following:

| Sent | What it is |
|---|---|
| Platform | The literal value `android` |
| Runtime version | Which native version of the app you have (currently `native-2`) |
| Update channel | The literal value `production` |
| Protocol and API version | Fixed technical values used by the update service |
| Update token (`EAS-Client-ID`) | A **random identifier generated on your device** the first time the app runs, stored only in the app's own storage. It lets the service tell whether a device has already downloaded a given update |
| IP address | Unavoidably visible to any server you connect to, as with any internet request |

**What the request does not contain**: no name, no email address, no account, no advertising ID,
no device identifier supplied by the operating system, no location, and **none of your books,
passages or thoughts**. We do not receive per-device information from this service; we use it to
deliver code, not to measure anything.

- **Purpose**: keeping the app you already installed working.
- **Legal basis (GDPR)**: our legitimate interest in maintaining and securing the app.
- **Retention**: by Expo under its own policy. We store nothing from these requests.

The update token is random and is **not** derived from your hardware. It is erased when you
uninstall the app or clear its data, and a new one is generated if you install the app again.

### 4.2 Ads (Google AdMob)

Unless you have bought ad removal, Google's advertising SDK (Google AdMob) loads ads. Ads appear as a
banner at the bottom of the home, passages and books screens, and as one full-screen ad after you
finish reviewing at least one card. No ad appears while you are saving a passage or in the middle of
a review.

To choose ads, prevent fraud and measure ad performance, the SDK sends the following to Google:

| Sent | What it is |
|---|---|
| Advertising ID | The advertising identifier provided by the operating system. You can reset or delete it in your device settings |
| Device information | Values such as device model, OS version, language and screen size |
| IP address | May be used to estimate your approximate region |
| App information and ad interactions | App name and version, and which ads were shown or tapped |
| Ad consent status | What you chose in the consent step below |

**None of your books, passages or thoughts are sent.** The only things the app itself adds to an ad
request are these two signals:

- **Personalised ads are enabled only if you passed the age check** (section 9). If you did not
  answer, or the threshold was not met, only non-personalised ads are requested; when the threshold
  was not met, the request is also tagged as under the age of consent.
- **In regions where consent is required, such as the EEA and the UK,** the app asks through
  Google's consent tool (User Messaging Platform) before any ad is loaded. You can change your
  choice at any time under **Ad privacy settings** in the app's settings.

- **Purpose**: paying for a free app through advertising.
- **Legal basis (GDPR)**: consent for personalised ads and for storing or accessing information on
  the device; legitimate interest for non-personalised ads.
- **Retention**: by Google under its own policy: <https://policies.google.com/technologies/ads>.

### 4.3 Buying ad removal

Ad removal is a one-time purchase, and **payment is handled by Google Play.** We never receive your
card number or payment method. The app only asks Google Play whether this item has been bought, and
keeps the answer (bought or not) on the device. We have no server that stores purchase records. On a
new device, use **Restore Purchases** in the settings.

### 4.4 Nothing else leaves

To be concrete, none of the following is sent anywhere:

- **Photos and the camera.** When you bring a passage in from a photo, the image is read on the
  device using Google's ML Kit text recognition, which runs entirely offline. The temporary image
  file is deleted after recognition. The photo is never uploaded, and the recognised text is never
  uploaded.
- **Reminders.** Review reminders are scheduled by the device itself. The app does not register a
  push token and there is no notification server.
- **Search and statistics.** These are calculated on the device from the local database.
- **Crashes and usage.** We collect neither. If the app crashes, we do not hear about it unless
  you tell us.

---

## 5. Permissions, and why

| Permission | Why the app asks |
|---|---|
| Camera | To photograph a page when you choose to bring a passage in from a photo |
| Photos / media files | To let you pick an existing photo, and to save or open an export file |
| Notifications | To show review reminders, if you turn them on |
| Run at startup | To restore your scheduled reminders after the phone restarts |
| Vibrate, keep awake | Used by the reminder itself |
| Internet, network state | For the update check in section 4.1 and the ads in section 4.2 |
| Advertising ID | Used by the advertising SDK in section 4.2 to choose ads |
| Billing (Google Play) | For the ad-removal purchase in section 4.3 |

> ⚠ **An honest note about version 0.2.0.** The build currently on Google Play also declares two
> permissions the app does not use: microphone (`RECORD_AUDIO`) and display over other apps
> (`SYSTEM_ALERT_WINDOW`). They came from the default project template we built on, not from any
> feature. **The app contains no code that records audio or draws over other apps.** We found them
> by auditing the build ourselves and they are removed in the next version.

---

## 6. What we do not do

- We do not use analytics, attribution or crash-reporting services.
- We do not ourselves track you across apps or websites. The advertising ID is used only by the
  advertising SDK in section 4.2.
- We do not sell personal information, and we do not profile you ourselves. Personalised ads may,
  however, count as "sharing" under some laws such as California's. You can opt out through Ad
  privacy settings or by deleting your device's advertising ID, and buying ad removal stops the
  advertising SDK from starting at all.
- We do not read your library, because we do not have it.

---

## 7. Processors and international transfers

| Recipient | Role | Data | Location |
|---|---|---|---|
| Expo, Inc. (EAS Update) | Delivers updates to the app's own code | Platform, runtime version, update channel, random update token; IP address transiently | United States |
| Google LLC (AdMob, User Messaging Platform) | Serves ads and manages ad consent | Advertising ID, device information, IP address, app information and ad interactions, ad consent status | United States |

This is the complete list. Where data is transferred outside your jurisdiction we rely on the
recipient's standard contractual clauses or equivalent safeguards. Expo's own policy applies to its
processing: <https://expo.dev/privacy>. Google's own policy applies to its advertising processing:
<https://policies.google.com/privacy>.

Google Play distributes the app and processes your download and any device information under
[its own policy](https://policies.google.com/privacy); that relationship is between you and Google,
and we receive only aggregate, non-identifying store statistics. The ad-removal payment (section 4.3)
is also processed by Google Play, and we receive no payment information.

Our Google Play Data Safety declaration mirrors this policy.

---

## 8. Your rights

Depending on where you live you may have rights to access, correct, delete, restrict or port your
personal data, to object to processing, and to complain to a supervisory authority. In the Republic
of Korea these arise under PIPA; in the EEA and the UK under the GDPR; in California under the CCPA
as amended.

We want to be straightforward about what these mean here, because **we hold almost nothing**:

- **Your library.** It is on your device. You can read, edit, export and delete all of it inside
  the app at any time, and uninstalling removes it. There is nothing for us to hand over or erase,
  because we never had a copy.
- **The update token.** This is the only identifier connected with you, it is random, and it is not
  linked to your name or account. You can erase it by clearing the app's data or uninstalling. If
  you want it handled by the recipient, write to us and we will pass the request to Expo.
- **Ads.** You can change your ad consent under Ad privacy settings, and reset or delete the
  advertising ID in your device settings. Requests about advertising data held by Google can be made
  to Google directly; write to us and we will point you to the right place.
- **Complaints.** Write to `support@vivace-games.com`. In Korea you may also contact the Personal
  Information Protection Commission (privacy.go.kr, 국번없이 182). In the EEA or UK you may complain
  to your local supervisory authority.

We do not charge for these requests and we do not require an account to make one.

---

## 9. Children

Re:Read is intended for users aged 13 and over and is not directed at children. We do not knowingly
collect personal information from children.

**Age check on this device.** The first time the app opens, it asks for your year of birth. The year is
checked on your phone and then discarded; it is never saved and never sent to us. The app keeps only the
result on your phone: when the check happened, the age threshold that applied, and the version of the
rule. The threshold follows the region set on your device: 16 in the European Economic Area, the United
Kingdom and Switzerland, 14 in the Republic of Korea, 13 elsewhere, and 16 if the region cannot be read.
If the threshold is not met, features that need an account are not available; saving passages, reviewing
and practice keep working. The app asks again after one year. **Ads follow this result too:**
personalised ads are enabled only if you passed; if not, non-personalised ads are requested and
tagged as under the age of consent; and if you closed the question, personalised ads stay off
(section 4.2). Closing the question without answering
saves nothing, so it is asked again the next time the app opens.

Because the app has no account and sends no profile, this result never reaches us. If you believe a child
has provided personal information to us, contact us and we will act on it.

---

## 10. Security, and its honest limits

The data that matters is on your device, so the security that matters most is your device's:
a screen lock, an up-to-date operating system, and encryption if your phone supports it.
Within the app, your library sits in the app's private storage, which other apps cannot read on a
normal, non-rooted Android device.

We would rather state the limits than imply protections we do not provide:

- **The local database is not separately encrypted by the app.** It relies on Android's app
  sandbox and on your device's own encryption.
- **The export file is not encrypted** (section 3.1). Once it leaves the app it is an ordinary file.
- **A rooted or compromised device** can read app storage, and we cannot prevent that.
- **The update check travels over HTTPS**, but no transmission over the internet is ever absolutely
  secure.

---

## 11. Changes to this policy

This policy describes the app **as it is actually published today**. It does not describe features
we have not shipped.

🔴 The following are planned, and **each one will require this policy to be revised and republished
before the version containing it is released** — not afterwards:

| Planned | What it would add |
|---|---|
| Accounts and sign-in with Google (together with cloud backup) | An identity, and a route to delete it |
| Inquiries, notices | Message content and a random device identifier created by the app, sent to and kept on a server; no name or email address |
| Encrypted cloud backup | Ciphertext held on a server |

If we make a change that materially affects how we handle your data, we will update the effective
date at the top and, where the change is significant, give notice in the app before it takes effect.
Where the law requires your consent, we will ask for it rather than assume it.

---

## 12. Contact

**`support@vivace-games.com`**

Hwiseong Games · Representative SON WHEESUNG · Business registration number 749-25-02260
204, 2F, 22 Seongan 5-gil, Jung-gu, Ulsan, 44421, Republic of Korea
