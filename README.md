# WhatsApp AI Bot

Bot WhatsApp berbasis Node.js + Baileys + OpenAI API.

## Fitur
- Login WhatsApp dengan QR
- Auto-reply AI
- Konteks percakapan sementara
- `/ai on`, `/ai off`
- `/reset`
- `/help`
- Opsional: hanya membalas pesan dengan prefix tertentu
- Session dan API key dikecualikan dari Git

## Termux

```bash
pkg update -y
pkg install nodejs git -y
cd wa-ai-bot
npm install
cp .env.example .env
nano .env
npm start
```

Kemudian scan QR dari WhatsApp > Perangkat tertaut.

## GitHub

Jangan upload `.env` atau folder `session/`.

```bash
git init
git add .
git commit -m "Initial WhatsApp AI bot"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

## Catatan

Gunakan bot secara wajar dan patuhi aturan WhatsApp serta penyedia API. Jangan gunakan untuk spam, penipuan, atau mengirim pesan massal tanpa izin.
