# CHANGELOG

## [V10] - 2026-06-07
### Added
- Zorunlu işlem adımlarını belirleyen `ALWAYS_DO.md` SOP dosyası oluşturuldu.
- Global Chat üzerine sadece "owner" (Kurucu) yetkisine sahip kullanıcıların görebileceği 👑 (Admin Yap) butonu eklendi.
- Nginx yapılandırmasına `index.html` için `Cache-Control: no-cache` kuralları eklendi.

### Fixed
- Eşleşme (Matchmaking) sırasında tarayıcı belleğinin (Cache) eski V8 kodunu çalıştırmasından kaynaklanan "Kareli Arkaplan" çökme hatası kalıcı olarak giderildi. Kullanıcıların cache'e takılmaması sağlandı.
- `/admin yap` komutunun sunucu tarafındaki yetkilendirme mantığı daha güvenli hale getirildi.
