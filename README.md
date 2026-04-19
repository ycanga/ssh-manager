# SSH Manager

Electron tabanlı SSH bağlantı yöneticisi ve terminal arayüzü.

## Komutlar

### Geliştirme

| Komut | Açıklama |
|--------|----------|
| `npm run dev` | Vite geliştirme sunucusu (HMR) |
| `npm run start` | Üretim öncesi derleme sonrası Electron’u `electron .` ile çalıştırır |
| `npm run build` | `dist/` ve `dist-electron/` üretim derlemesi |
| `npm run lint` | ESLint |
| `npm run preview` | Vite önizleme sunucusu |

### Kurulum paketleri (electron-builder)

Çıktılar `release/` klasörüne yazılır.

| Komut | Açıklama |
|--------|----------|
| `npm run dist` | Geçerli işletim sistemi için paket üretir |
| `npm run dist:mac` | macOS: `.dmg` ve `.zip` |
| `npm run dist:win` | Windows: NSIS kurulum + portable `.exe` (x64) |
| `npm run dist:linux` | Linux: AppImage + `.deb` |

> **Not:** Windows ve Linux paketlerini sorunsuz üretmek için genelde ilgili OS üzerinde veya CI’da çalıştırmak gerekir.
