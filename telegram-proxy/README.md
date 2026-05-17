# Telegram Proxy Kurulumu

Bu klasor, TradingView Logger bildirimlerini Telegram'a guvenli sekilde iletmek icin kullanilan
Cloudflare Worker proxy'sini icerir. Telegram bot token Chrome extension icinde saklanmaz;
yalnizca Worker ortam degiskenlerinde tutulur.

Resmi Telegram Bot API dokumanina gore bot istekleri `https://api.telegram.org/bot<token>/METHOD_NAME`
formatinda yapilir ve `sendMessage` metodu mesaj gondermek icin kullanilir:
https://core.telegram.org/bots/api

## 1. Telegram Botu Olustur

1. Telegram uygulamasini ac.
2. Aramada resmi `@BotFather` hesabini bul.
3. BotFather sohbetinde `/newbot` yaz.
4. Bot icin gorunen bir ad gir:
   ```text
   TradingView Logger
   ```
5. Bot icin benzersiz bir username gir. Telegram bot username'i `_bot` ile bitmeli:
   ```text
   tradingview_logger_<kisa_isim>_bot
   ```
6. BotFather sana bir HTTP API token verir. Token su formata benzer:
   ```text
   123456789:AA...
   ```
7. Bu tokeni repo dosyalarina veya Chrome extension ayarlarina yazma. Sadece backend/proxy ortam
   degiskeni olarak kullan.

## 2. Chat ID Al

Kisisel sohbet icin:

1. Olusturdugun bota Telegram'da gir.
2. `/start` yaz.
3. Tarayicida veya terminalde su istegi calistir:
   ```text
   https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
   ```
4. Donen JSON icinde `message.chat.id` degerini bul.

Grup icin:

1. Botu gruba ekle.
2. Grupta botu etiketleyerek veya herhangi bir mesaj yazarak update olusmasini sagla.
3. Yine `getUpdates` sonucunda `message.chat.id` degerini bul.
4. Grup/supergroup chat id genelde negatif olur, ornegin:
   ```text
   -1001234567890
   ```

Not: Bot bir gruba mesaj atacaksa botun o grupta bulunmasi gerekir.

## 3. Cloudflare Worker Dosyalarini Hazirla

Bu klasorde hazir Worker dosyasi var:

```text
telegram-proxy/cloudflare-worker.js
```

Cloudflare Workers kullanacaksan `wrangler.toml.example` dosyasini kopyalayip gercek config
dosyasini olustur:

```powershell
Copy-Item telegram-proxy\wrangler.toml.example telegram-proxy\wrangler.toml
```

Sonra `telegram-proxy/wrangler.toml` icinde `name` alanini kendi Worker adinla degistir.

## 4. Secret Bilgileri Ekle

Gercek tokeni dosyaya yazma. Cloudflare secret olarak ekle:

```powershell
cd telegram-proxy
wrangler secret put TELEGRAM_BOT_TOKEN
```

Komut tokeni sorunca BotFather'dan aldigin tokeni yapistir.

Varsayilan chat id'yi Worker tarafinda saklamak istersen:

```powershell
wrangler secret put TELEGRAM_CHAT_ID
```

Extension ile Worker arasinda ek bir paylasimli anahtar kullanmak istersen:

```powershell
wrangler secret put CLIENT_SECRET
```

Yerel test yaparken `.dev.vars.example` dosyasini `.dev.vars` olarak kopyalayabilirsin:

```powershell
Copy-Item telegram-proxy\.dev.vars.example telegram-proxy\.dev.vars
```

`.dev.vars` dosyasina gercek degerleri yazarsan bunu git'e ekleme.

## 5. Worker'i Deploy Et

```powershell
cd telegram-proxy
wrangler deploy
```

Deploy sonrasi Cloudflare sana buna benzer bir URL verir:

```text
https://tradingview-logger-telegram.<hesap>.workers.dev
```

Extension icin endpoint URL su olacak:

```text
https://tradingview-logger-telegram.<hesap>.workers.dev/telegram/send
```

## 6. Extension Ayarlarini Gir

Chrome extension popup'ini ac ve `Telegram` tabina git.

Alanlari su sekilde doldur:

```text
Endpoint URL:  https://<worker-domain>/telegram/send
Chat ID:       chat id veya bos birak, eger Worker'da TELEGRAM_CHAT_ID varsa
Client secret: CLIENT_SECRET ile ayni deger veya bos birak
```

Sonra:

1. `Telegram bildirimleri` toggle'ini ac.
2. `Kaydet` butonuna bas.
3. `Test` butonuna bas.
4. Telegram'da test mesajinin geldigini kontrol et.

## 7. Beklenen Akis

- Not kaydedilince Telegram'a not bildirimi gider.
- `Bugunun Ozetini Gonder` butonu bugunku log ozetini yollar.
- Gun arsivlenirken gunluk ozet otomatik gonderilir.
- Backend kapaliysa veya secret yanlissa extension log/not kaydini bozmadan hata gosterir.

## Guvenlik Notlari

- `TELEGRAM_BOT_TOKEN` repo icine yazilmayacak.
- Chrome extension icinde bot token alani yoktur.
- `CLIENT_SECRET` bot token kadar kritik degildir, ama yine de herkese acik paylasilmaz.
- Token yanlislikla paylasilirsa BotFather uzerinden tokeni yenile.
