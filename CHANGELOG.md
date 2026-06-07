# CHANGELOG

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
