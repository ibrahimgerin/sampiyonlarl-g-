# Enerjisa Şampiyonlar Ligi

Turnuva sitesi: puan durumu, fikstür, eleme ağacı, haberler, oyuncu profilleri, liderler ve yönetim paneli.
Vercel'de çalışır, veriyi **Vercel KV (Upstash Redis)** içinde tutar.

## Klasör yapısı

```
public/            Site (index.html, app.css, app.js, img/)
api/               Vercel fonksiyonları
  login.js           Giriş (takım veya yönetim), imzalı çerez verir
  logout.js          Çıkış
  session.js         Oturum bilgisi
  teams-public.js    Giriş formu için yalnızca takım adları (şifre yok)
  data.js            Takım, maç, oyuncu, haber verisi (oturum gerekir)
  mutate.js          Ekle / güncelle / sil (yalnızca yönetim)
  upload.js, img.js  Logo ve fotoğraf yükleme / gösterme
  _lib/              KV bağlantısı, oturum, doğrulama
scripts/
  dev.mjs            Yerelde çalıştırma (Vercel CLI gerekmez)
  seed.mjs           Örnek verileri KV'ye yükler
  seed-data.json     Mevcut turnuva verisi (12 takım, 18 maç, 10 oyuncu, 5 haber)
vercel.json          Güvenlik başlıkları ve önbellek ayarları
```

## Vercel'e yayınlama

1. **Projeyi Vercel'e ver.**
   - GitHub'a yükleyip Vercel'de *Add New → Project* ile içe aktar, ya da
   - bu klasörde `npx vercel` çalıştır.
   Framework olarak *Other* seçili kalsın, build komutu ve çıktı klasörü ayarı gerekmez (`public/` ve `api/` otomatik algılanır).
2. **KV veritabanını bağla.** Vercel panelinde projeye gir: *Storage → Create Database → Upstash Redis* (eski adıyla Vercel KV) seç, projeye bağla.
   Bağlayınca `KV_REST_API_URL` ve `KV_REST_API_TOKEN` otomatik eklenir.
3. **İki ortam değişkeni ekle** (*Settings → Environment Variables*):
   - `ADMIN_PASSWORD`: yönetim paneli şifresi
   - `SESSION_SECRET`: uzun rastgele metin. Üretmek için:
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. **Yeniden yayınla** (*Deployments → Redeploy*), değişkenler ancak yeni yayında geçerli olur.
5. **Mevcut veriyi yükle** (bir kez):
   ```bash
   npm install
   npx vercel link
   npx vercel env pull .env.local
   npm run seed
   ```
   `npm run seed` yalnızca boş koleksiyonları doldurur. Her şeyi silip baştan yüklemek için `npm run seed:reset`.

Bundan sonra yönetim şifresiyle girip takım, maç, oyuncu ve haber ekleyebilirsin; CSV aktarımı da yönetim panelinde.

## Yerelde çalıştırma

```bash
npm install
npm run dev
```
`http://localhost:3000` açılır. `.env.local` yoksa bellek içi geçici bir veritabanı örnek verilerle başlar
(yönetim şifresi `admin123`, kapatınca silinir). Gerçek KV ile denemek için `.env.example` dosyasını `.env.local` olarak kopyalayıp doldur.

## Güvenlik notları

- Giriş artık sunucuda kontrol edilir. Takım şifreleri tarayıcıya gönderilmez (yalnızca yönetim oturumu görür).
- Oturum, imzalı ve `HttpOnly` bir çerezdir. "Beni hatırla" işaretli değilse tarayıcı kapanınca biter, işaretliyse 30 gün sürer.
- Giriş denemeleri IP başına dakikada 8 ile sınırlıdır.
- Yazma işlemleri yalnızca yönetim oturumuyla yapılır ve alanlar sunucuda doğrulanır.
- Takım şifreleri KV içinde düz metin olarak durur, çünkü yönetim panelinde gösterilir. Şirket girişine (SSO) bağlanmak istersen `api/login.js` tek değiştirilecek yerdir.
- `scripts/seed-data.json` içinde mevcut takım şifreleri var. Dosyayı herkese açık bir depoya koyma.

## Bilmen gerekenler

- **Güncelleme sıklığı:** Açık sekme verileri her 8 saniyede bir kontrol eder (sekme arka plandaysa durur). Değişiklik yoksa tek bir KV okuması yapılır. Çok kullanıcılı bir günde KV kullanım limitlerini (Upstash planın) kontrol et.
- **Fotoğraflar:** Yüklenen logo ve fotoğraflar tarayıcıda küçültülüp KV'de saklanır (en fazla yaklaşık 450 KB). Eski sürümdeki fotoğraflar taşınmadı, yönetim panelinden yeniden yükle.
- **Bölgeler:** Başkent, AYEDAŞ, Toroslar `api/_lib/store.js` ve `public/app.js` (`BOLGELER`) içinde tanımlı.
- **Telif:** Enerjisa logosu ve küre görseli şirkete aittir; sitenin dışarıya açık yayınlanması için iletişim ekibinden onay al.
