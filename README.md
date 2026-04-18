<h1 align="center">🧹 ViBE Auto Delete Bot</h1><p align="center">
  Smart Message Cleaner for Discord • Fast • Lightweight • Reliable
</p><p align="center">
  <img src="https://img.shields.io/badge/STATUS-ACTIVE-00C853?style=for-the-badge">
  <img src="https://img.shields.io/badge/VERSION-1.0-8A2BE2?style=for-the-badge">
  <img src="https://img.shields.io/badge/BUILD-STABLE-2962FF?style=for-the-badge">
  <img src="https://img.shields.io/badge/MAINTAINED-YES-success?style=for-the-badge">
</p>---

✨ About

ViBE Auto Delete Bot adalah bot Discord yang secara otomatis menghapus pesan berdasarkan aturan yang telah ditentukan.

Cocok untuk menjaga server tetap bersih, rapi, dan profesional tanpa harus moderasi manual.

---

🔥 Features

- 🧹 Auto delete message (berdasarkan waktu)
- ⚡ Real-time cleaning system
- 🎯 Custom per channel
- 🛡️ Ignore role tertentu
- 🔒 Anti spam support
- ⚙️ Fully configurable

---

🧠 How It Works

«Bot akan memonitor pesan yang masuk dan menghapusnya secara otomatis sesuai pengaturan.»

- User kirim pesan
- Bot membaca rule
- Pesan dihapus setelah waktu tertentu

---

🎮 Commands

Command| Description
"/automode delete on"| Aktifkan sistem
"/automode delete off"| Nonaktifkan
"/set-links-delete"| Atur hapus links
"/set-emages-delete| Atur hapus gambar
"/ignore-role"| Tambah role yang diabaikan
"/set-channel"| Pilih channel target

---

⚙️ Installation

git clone https://github.com/iscvtdjio-bit/Bott
cd Bott
npm install
node index.js

---

📁 Configuration

{
  "delete_after": 10,
  "ignore_roles": ["Admin", "Moderator"],
  "channels": ["general", "chat"],
  "log_channel": "logs"
}

---

🚀 Roadmap

- [ ] Auto delete media only
- [ ] Smart spam detection
- [ ] Dashboard web config
- [ ] Log system upgrade

---

🌐 Invite Bot

«Coming soon...»

---

👑 Credits

Developed by ViBETeam

---

📜 License

MIT License
