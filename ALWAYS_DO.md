# STANDART İŞLEM PROSEDÜRÜ (SOP) - ZORUNLU KONTROL LİSTESİ

Bu dosya, projede yapılacak **herhangi bir kod güncellemesi, özellik eklemesi veya hata çözümü** tamamlandıktan sonra, YZ Asistanı tarafından **İŞİ BİTİRMEDEN ÖNCE EKSİKSİZ VE SIRASIYLA** uygulanması gereken adımları içerir.

Bu adımlar tamamlanmadan kullanıcıya "işlem tamamlandı" DENİLMEYECEKTİR!

## 📌 Mecburi Kontrol Listesi

- [ ] **1. Kod Yazımı ve Syntax Kontrolü:** Yazılan tüm kodlar kaydedilmeden önce dikkatlice incelenmeli, parantez hataları, değişken isimleri ve olası mantık hataları gözden geçirilmelidir.
- [ ] **2. CHANGELOG.md Güncellemesi:** Yapılan değişiklikler, düzeltilen hatalar ve eklenen özellikler kısa ve net bir dille `CHANGELOG.md` dosyasına en üste (yeni sürüm olarak) eklenmelidir.
- [ ] **3. GitHub'a Push İşlemi:** 
  - `git add .`
  - `git commit -m "Mesaj"`
  - `git push`
  (Komutları terminal üzerinden çalıştırılarak commit edilmelidir.)
- [ ] **4. Sunucuya Deploy (Yükleme):** 
  - `node remote-deploy.js` veya ilgili deploy betiği çalıştırılarak değişiklikler canlı sunucuya (`193.164.4.57`) gönderilmelidir.
- [ ] **5. Projenin Yeniden Başlatılması:**
  - Deploy betiği içerisinde PM2 restart (`pm2 reload flag-game-backend --update-env`) işleminin başarıyla tamamlandığı doğrulanmalıdır.
- [ ] **6. HATA KONTROLÜ (KRİTİK ADIM):**
  - Proje yeniden başladıktan sonra **kesinlikle 5-10 saniye beklenmeli** ve `fetch-logs.js` veya muadili bir yöntemle **sunucu logları okunmalıdır**.
  - Loglarda herhangi bir `Crash`, `Error`, veya `Exception` (Örn: pm2 error logs) varsa, işlem tamamlandı denmeden hataya müdahale edilip baştan çözülmelidir.
- [ ] **7. İletişim ve Teslimat:**
  - Sadece loglar temiz çıktığında ve tüm özellikler test edildiğinde kullanıcıya "İşlem tamamlandı, test edebilirsiniz" mesajı verilmelidir.
