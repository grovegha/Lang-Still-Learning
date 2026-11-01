# Lang — Still Learning

Website belajar pribadi berbahasa Indonesia, monokrom, dengan font IBM Plex Mono. React + Vite, Express, SQLite. API key sengaja kosong dan hanya dibaca server.

## Jalankan

Memerlukan **Node.js 22.13+** (disarankan Node.js 24 LTS) dan npm.

### Windows: cara paling mudah

1. Unduh ZIP source dari branch `codex/lang-windows-ready` di GitHub, lalu pilih **Extract All / Ekstrak Semua**.
2. Pasang Node.js 24 LTS dari https://nodejs.org/ jika belum ada.
3. Buka folder hasil ekstrak yang berisi `package.json` dan klik dua kali **MULAI-WINDOWS.bat**. Jangan menjalankan file langsung dari dalam ZIP.
4. Tunggu pemasangan dan build selesai. Setelah alamat server muncul, buka http://127.0.0.1:3000 di browser.
5. Biarkan jendela terminal tetap terbuka. Tutup server dengan Ctrl+C setelah selesai.

Script otomatis berpindah ke foldernya sendiri, menyalin `.env.example` menjadi `.env` hanya jika belum ada, memasang dependensi pada penggunaan pertama, dan menjalankan aplikasi. API key boleh kosong.

`/workspace/Lang-Still-Learning` adalah lokasi pada lingkungan pengembangan sesi ini, **bukan lokasi folder pada laptop Windows**. Tidak perlu membuat `C:\Users\ASUS\workspace`. Jika memakai terminal secara manual, buka folder hasil ekstrak di File Explorer, ketik `cmd` pada address bar, lalu tekan Enter. Terminal akan terbuka pada folder yang benar.

### Terminal manual

```sh
npm ci
```

Salin `.env.example` menjadi `.env`. Boleh tetap membiarkan `OPENAI_API_KEY=` kosong.

```sh
npm run build
npm start
```

Buka **http://127.0.0.1:3000**. Folder `dist/` dalam ZIP sudah dibangun; build ulang hanya diperlukan setelah mengubah source. Untuk pengembangan gunakan `npm run dev`.

Klik **Coba pelajaran** pada beranda untuk mencoba materi contoh lengkap tanpa API. Materi contoh ditandai CONTOH dan baru disimpan setelah tombol ditekan. Teks/dokumen yang ditambahkan tersimpan sebagai draf meskipun AI belum aktif.

## Mengisi API key nanti

Edit `.env` pada server, isi key setelah tanda sama dengan, lalu mulai ulang server:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TRANSCRIPTION_MODEL=whisper-1
```

Model bisa diubah sesuai akses akun. Status Pengaturan memeriksa keberadaan key, bukan saldo atau izin model. Koneksi sesungguhnya diuji ketika fitur AI digunakan. Klik **Susun dengan AI** pada draf yang sudah disimpan.

Jangan menggunakan `VITE_OPENAI_API_KEY`, menaruh key dalam source, atau membagikan `.env`. Semua panggilan OpenAI dilakukan di server. Penggunaan API mengikuti organisasi API milikmu.

## Fitur

| Bagian | Implementasi |
| --- | --- |
| Perpustakaan | Pelajaran, pencarian, folder, pindah folder, ubah judul, hapus |
| Materi | Teks, topik, PDF teks, DOCX, PPTX, XLSX, TXT, MD, CSV |
| Gambar | OCR JPG, PNG, WEBP melalui OpenAI setelah key diisi |
| Audio/video | Transkripsi unggahan melalui OpenAI + FFmpeg |
| Mikrofon | Rekam dari browser, lalu simpan sebagai materi |
| YouTube | Ambil transkrip publik jika tersedia |
| Ringkasan | Markdown, penyuntingan, ekspor catatan .md |
| Bab | Pelajaran bertahap, penanda selesai, lanjut bab |
| Mind map | Peta konsep dan hubungan topik |
| Flashcard | Balik kartu, empat penilaian, jadwal pengulangan, daftar kartu |
| Kuis | Koreksi langsung, pembahasan, skor, pengulangan |
| Latihan ujian | Jawaban ditahan sampai dikumpulkan, durasi, hasil, pembahasan |
| Tutor | Chat berdasarkan sumber dan riwayat tersimpan |
| Progres | Streak WIB, XP, level, aktivitas, riwayat nilai |
| Preferensi | Tema terang/gelap; font lokal tanpa Google Fonts |
| Data | SQLite, berkas asli, ekspor JSON, unduh sumber |
| Akses | Loopback default; login password untuk server jaringan |

Flashcard memakai aturan interval deterministik sederhana: Lagi 1 menit, Sulit minimal 6 menit, Bagus minimal 1 hari, Mudah minimal 4 hari. Interval kartu yang sudah pernah dipelajari disesuaikan dari interval sebelumnya. Ini bukan klaim memakai algoritma internal Pelajarin.ai. XP bab diberikan sekali per bab; XP latihan maksimal satu penghargaan per jenis latihan/pelajaran/hari. Percobaan ulang tetap tercatat.

## Batas dan persyaratan

- Maksimal 5 berkas per pelajaran, total 600 MB. Per berkas: dokumen 100 MB, gambar 25 MB, audio 300 MB, video 500 MB. Hasil teks maksimal 150.000 karakter; materi panjang diminta dipisah, tidak dipotong diam-diam.
- PDF scan belum di-OCR otomatis: ekspor halaman ke JPG/PNG, lalu unggah gambar. DOC/PPT/XLS lama perlu dikonversi ke DOCX/PPTX/XLSX; HEIC ke JPG/PNG.
- Audio/video memerlukan **ffmpeg dan ffprobe** pada PATH server. Rekaman maksimal 4 jam, dipecah per 10 menit untuk transkripsi. FFmpeg tidak dibundel. Tanpa FFmpeg, pemrosesan audio/video menampilkan pesan kesalahan.
- Mikrofon memerlukan localhost/HTTPS dan izin browser. Rekaman panjang bergantung pada memori browser; unggah berkas untuk kuliah panjang.
- YouTube bergantung pada transkrip dan akses jaringan server. Video privat, tanpa caption, atau akses yang dibatasi tidak dijamin. Alternatif: tempel transkrip sebagai teks.
- Tanpa API, teks/dokumen yang bisa diekstrak tetap dapat disimpan/dibaca. OCR, transkripsi, pembuatan pelajaran, dan tutor menunggu API aktif. Tidak ada respons AI simulasi.
- Tidak ada MABAR, leaderboard antar pengguna, pembayaran, atau aplikasi Android/iOS. Aplikasi ini untuk satu pengguna pribadi dan belum setara 100% dengan seluruh fungsi Pelajarin.ai.
- Bahasa pelajaran: Indonesia, English, Arab, Mandarin. Antarmuka berbahasa Indonesia.
- Server membutuhkan Node.js dan disk permanen. Jangan unggah sebagai situs statis atau Cloudflare Worker; backend tidak akan berjalan di sana.

## Cadangan

Data otomatis tersimpan di `data/` atau `DATA_DIR`:

```text
data/lang.sqlite
data/uploads/
```

Ekspor JSON dari Pengaturan berisi teks, progres, kartu, chat, dan hasil latihan. Tidak menyertakan biner unggahan dan belum ada tombol impor. Untuk cadangan/pemulihan lengkap, hentikan server lalu salin/pulihkan seluruh folder `data/`. Pertahankan folder ini saat memperbarui aplikasi.

## Akses jaringan

Default `HOST=127.0.0.1` hanya membuka akses lokal. Untuk server pribadi yang diakses perangkat lain:

```dotenv
HOST=0.0.0.0
APP_PASSWORD=
PUBLIC_ORIGIN=
```

Isi password panjang yang unik sebelum menjalankan. Isi PUBLIC_ORIGIN dengan origin HTTPS server tanpa trailing slash, gunakan reverse proxy HTTPS, dan disk permanen. Server menolak membuka akses jaringan tanpa APP_PASSWORD. Jangan menyajikan source, data/, atau .env sebagai berkas publik. Cookie sesi HTTP-only; restart server mengakhiri sesi lama. Ini aplikasi satu akun, bukan multi-user.

## Validasi

```sh
npm run check
npm run build
npm test
```

Pemeriksaan TypeScript, build produksi, dan enam pengujian lulus pada Node.js 24.19.0. Pengujian integrasi mencakup login, simpan/baca/ubah/hapus materi, unggahan teks, progres bab, jadwal kartu, pengumpulan kuis idempoten, ekspor, penolakan lintas origin, dan respons saat API kosong.

Belum diuji langsung: panggilan OpenAI, OCR, transkripsi audio/video, pengambilan transkrip YouTube, dan interaksi browser. Runtime browser QA belum tersedia; percobaan server pratinjau tambahan diblokir kegagalan pemeriksaan persetujuan karena kredit workspace habis. Aplikasi belum dipublikasikan. Build helper Sites tidak terpasang, sehingga aplikasi disediakan sebagai paket Node.js untuk dijalankan sendiri.

## Struktur

```text
src/main.tsx          Antarmuka dan alur belajar
src/style.css         Desain monokrom responsif
src/types.ts          Tipe data frontend
server/index.mjs      API, akses, SQLite, unggahan
server/ai.mjs         OpenAI dan ekstraksi materi
server/core.mjs       Jadwal kartu, skor, streak, validasi
server/demo.mjs       Materi contoh
tests/               Pengujian fungsi dan API
```
