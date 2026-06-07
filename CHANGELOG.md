# CHANGELOG

## [V10.4] - 2026-06-07
### Added
- Co-Op modunda iletişim kurabilmek için Analist ve Breacher'ın ortak kullanabileceği "ŞİFRELİ TELSİZ" (Team Chat) sistemi arayüze eklendi. Sesli konuşma zorunluluğu ortadan kalktı.
- Co-Op bulmacaları tamamen yenilendi ve zorlaştırıldı:
  - 1. Aşama: **Ağ Taraması** (Belli kurallara uyan IP adresini bulma)
  - 2. Aşama: **Kriptografi** (Sayısal örüntüyü çözüp eksik şifreyi bulma)
  - 3. Aşama: **Sistem Aşırı Yüklemesi** (Güç, Soğutma ve Kalkan değerlerini tek komutta ayarlama)
### Optimized
- `server.js` içerisindeki aktif oyun, bağlantı kopma (disconnect) ve eşleşme (matchmaking) bellek kullanımları (Map ve Set'ler) olası memory leak'lere karşı gözden geçirildi ve optimize edildi.

## [V10.3] - 2026-06-07
### Added
- Co-Op modunda oyuna başlamadan önce oyuncuların rollerini (Analist ve Breacher) detaylı bir şekilde açıklayan ve onay bekleyen animasyonlu "Görev Brifing" ekranı eklendi.
- "Gerçek Zamanlı Hazır Sistemi" entegre edildi. Artık iki oyuncu da "Hazırım" butonuna basmadan oyun (süre) başlamıyor. Partnerin hazır olup olmadığı gerçek zamanlı olarak görülebiliyor.
### Removed
- Co-Op moduna girerken gösterilen teknik "DEBUG INFO" yazıları kaldırılarak daha profesyonel bir görünüm elde edildi.

## [V10.2] - 2026-06-07
### Fixed
- Co-Op modunda "Yenilgi" ve "Kazanma" durumlarındaki büyük senkronizasyon (desync) hatası çözüldü. Artık iki oyuncu da eşzamanlı olarak aynı sonuç ekranını (Zafer veya Görev Başarısız) alacak.
### Changed
- Co-Op oynanış mantığı 3 aşamaya çıkarılarak zorlaştırıldı. Artık analistin ipuçlarını çözüp (matematik, kelime ters çevirme vb.) Breacher'a iletmesi gerekiyor.

## [V10.1] - 2026-06-07
### Fixed
- Oyun eşleştiğinde gerçekleşen çökme sorunu `PlayerCard` bileşenine `AnimatePresence` modülü eklenerek çözüldü.
- Ses dosyalarından (Google Actions) dönen 404 hatalarını önlemek için ses çaldırma fonksiyonu geçici olarak devre dışı bırakıldı.
### Changed
- Global Chat mesajları artık SQLite veritabanına (`messages` tablosuna) kalıcı olarak kaydediliyor. Sunucu yeniden başlasa bile geçmiş (50 mesaja kadar) yükleniyor.

## [V10] - 2026-06-07
### Added
- Zorunlu işlem adımlarını belirleyen `ALWAYS_DO.md` SOP dosyası oluşturuldu.
- Global Chat üzerine sadece "owner" (Kurucu) yetkisine sahip kullanıcıların görebileceği 👑 (Admin Yap) butonu eklendi.
- Nginx yapılandırmasına `index.html` için `Cache-Control: no-cache` kuralları eklendi.

### Fixed
- Eşleşme (Matchmaking) sırasında tarayıcı belleğinin (Cache) eski V8 kodunu çalıştırmasından kaynaklanan "Kareli Arkaplan" çökme hatası kalıcı olarak giderildi. Kullanıcıların cache'e takılmaması sağlandı.
- `/admin yap` komutunun sunucu tarafındaki yetkilendirme mantığı daha güvenli hale getirildi.
