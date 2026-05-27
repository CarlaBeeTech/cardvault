# CardVault 📇

**A free, privacy-first business card scanner and contact manager — built as a Progressive Web App (PWA).**

Developed by **CMB Enterprise Group LLC** · [carlabee.com](https://carlabee.com)

---

## Features

- 📷 **Camera capture** — scan paper or digital business cards directly from your phone
- 📁 **Image upload** — upload a card photo from your gallery
- 🔍 **OCR extraction** — automatically pulls name, email, phone, website, company, and address using Tesseract.js
- ✏️ **Manual entry** — add contacts by hand with full field support
- 🗂️ **Searchable contact list** — find anyone instantly
- 💾 **Persistent storage** — contacts saved locally in your browser (no account needed)
- 📤 **CSV export** — export all contacts for use in Excel, Google Sheets, or any CRM
- 🏷️ **Paper / Digital badge** — tag each card by type
- 📱 **Add to Home Screen** — works like a native app on iOS and Android
- ✈️ **Offline capable** — service worker caches the app for offline use

---

## Live Demo

Host on GitHub Pages:
1. Push this repo to `CarlaBeeTech/cardvault`
2. Go to **Settings → Pages → Deploy from branch → main / root**
3. Your app will be live at `https://carlabeetech.github.io/cardvault`

---

## Getting Started Locally

No build tools required. Just open `index.html` in a browser, or serve with:

```bash
npx serve .
# or
python3 -m http.server 8080
```

> **Note:** Camera access requires HTTPS in production. GitHub Pages provides this automatically.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | HTML5, CSS3, Vanilla JS |
| OCR | [Tesseract.js v5](https://tesseract.projectnaptha.com/) |
| Storage | LocalStorage |
| PWA | Web App Manifest + Service Worker |
| Fonts | Cormorant Garamond + DM Mono (Google Fonts) |

---

## Roadmap / Phase 2

- [ ] Wrap with [Capacitor](https://capacitorjs.com) for native iOS/Android
- [ ] Submit to Apple App Store ($99/yr) and Google Play Store ($25 one-time)
- [ ] Cloud sync (Firebase or Supabase)
- [ ] Contact deduplication
- [ ] vCard (.vcf) export for direct import to phone contacts
- [ ] QR code generation for your own card

---

## Project Structure

```
cardvault/
├── index.html          # App shell
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline support)
├── css/
│   └── style.css       # All styles
├── js/
│   └── app.js          # All logic
├── icons/
│   ├── icon-192.png    # PWA icon (add your own)
│   └── icon-512.png    # PWA icon (add your own)
└── README.md
```

---

## Icons

Add your own PNG icons at:
- `icons/icon-192.png` (192×192px)
- `icons/icon-512.png` (512×512px)

You can generate them free at [realfavicongenerator.net](https://realfavicongenerator.net).

---

## Privacy

All data is stored **locally in your browser**. No data is sent to any server. No account required. No tracking.

---

## License

MIT — free to use, modify, and distribute.

© CMB Enterprise Group LLC — [carlabee.com](https://carlabee.com)
