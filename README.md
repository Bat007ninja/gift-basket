# 🧺 Gift Basket

A tiny, free replacement for trybasket.com.

- Make a basket of links to gifts you'd like.
- Share one link with friends and family.
- When someone buys a gift they tick it, and everyone else with the link sees it's taken, so nobody buys it twice.
- **You, the owner, never see what's been ticked.** Your edit page doesn't download that information at all.

It's a static site hosted free on **GitHub Pages**, with a free **Firebase Firestore** database to store the baskets and ticks. GitHub Pages can only serve files, so a small database is needed for people to save ticks without a GitHub account.

---

## Setup (about 10 minutes, one time only)

### 1. Put this code on GitHub
1. On github.com, click **New repository**. Name it e.g. `gift-basket`, make it **Public**, and create it without a README.
2. Upload these files: either drag them all onto the repo's "uploading an existing file" page, or from this folder run:
   ```
   git remote add origin https://github.com/YOUR-USERNAME/gift-basket.git
   git push -u origin main
   ```

### 2. Create the free database (Firebase)
1. Go to <https://console.firebase.google.com> and click **Create a project** (any name; you can turn off Google Analytics).
2. In the left menu, choose **Build → Firestore Database → Create database**. Pick a location near you and start in **production mode**.
3. Open the **Rules** tab, delete what's there, paste in the contents of [`firestore.rules`](firestore.rules), and click **Publish**.
4. Click the ⚙️ next to "Project overview" → **Project settings**. Under "Your apps", click the **`</>`** (Web) icon, give it any nickname and click **Register app**. You don't need Firebase Hosting.
5. Firebase shows a `firebaseConfig = { ... }` block. Copy those values into [`firebase-config.js`](firebase-config.js) in your GitHub repo (click the file, then the ✏️ pencil, paste, then **Commit changes**).

The free "Spark" plan is more than enough for this, and you never need to enter a card.

### 3. Turn on GitHub Pages
1. In your repo, go to **Settings → Pages**.
2. Under "Build and deployment", set Source to **Deploy from a branch**, Branch **main**, folder **/ (root)**, and click **Save**.
3. After a minute your site is live at `https://YOUR-USERNAME.github.io/gift-basket/`.

---

## Using it

1. Open your site, type your name and a basket name, and click **Create basket**.
2. Add gift links (with an optional price and note).
3. Click **Copy share link** and send it to friends and family.
4. Bookmark your **private edit link** (under "Your private edit link") so you can edit from another device. The site remembers your baskets on the device you made them on.

If you open your own share link on the device you made the basket on, the site warns you before showing any spoilers.

## How the secrecy works

| Link | Who gets it | Can do |
|---|---|---|
| `…/#/edit/<edit key>` | You only | Add and remove gifts. **Never loads ticks.** |
| `…/#/b/<basket id>` | Gift-givers | See gifts, tick and untick "bought" |

The edit key and the basket ID are different random codes, so the share link can't be turned into your edit link or the other way round. Baskets can't be browsed or searched, so only people with a link can find one.

This works on trust, just like Basket did. If you open your own share link and click past the spoiler warning, you'll see the ticks. Someone technically minded who has your share link could also change your basket through the database directly. That's fine for friends and family, but don't put anything private in a basket.

## Files

- `index.html`, `style.css`, `app.js`: the whole site, with no build step
- `firebase-config.js`: your Firebase settings (these are meant to be public)
- `firestore.rules`: database security rules (paste into Firebase)
