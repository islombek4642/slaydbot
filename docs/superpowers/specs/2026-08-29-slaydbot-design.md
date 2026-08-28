# Slaydbot — AI Telegram Presentation Bot — Design Spec

Date: 2026-08-29
Status: Approved

## 1. Maqsad

Telegram bot orqali foydalanuvchi mavzu va parametrlarni kiritadi, Claude API
yordamida professional darajadagi `.pptx` taqdimot avtomatik generatsiya
qilinadi va foydalanuvchiga yuboriladi. Hozircha to'lov tizimi yo'q — faqat
ruxsat berilgan (whitelist) foydalanuvchilar ishlata oladi. Kod modulli,
kengaytiriladigan va hardcode'siz (constants/i18n asosida) yoziladi, chunki
kelajakda to'lov, yangi temalar va yangi tillar qo'shilishi rejalashtirilgan.

## 2. Texnologiya stacki

- **Til:** TypeScript (Node.js)
- **Telegram bot framework:** grammY (+ `@grammyjs/conversations` — ko'p
  bosqichli wizard uchun)
- **Taqdimot generatsiya:** `pptxgenjs`
- **AI:** Claude API (Anthropic SDK)
- **Sandbox:** `isolated-vm` — Claude yozgan JS kodni xavfsiz ijro etish uchun
- **Ikonkalar:** `react-icons` + `react-dom/server` (SSR SVG) + `sharp`
  (SVG → PNG konvertatsiya)
- **DB:** PostgreSQL + Prisma ORM
- **i18n:** lokal JSON locale fayllar (boshida faqat `uz.json`)
- **Logging:** `pino`
- **Test:** Vitest
- **Deploy:** Docker + Docker Compose, mavjud umumiy `nginx-proxy` +
  Let's Encrypt (acme-companion) infratuzilmasi (QuizBot loyihasi bilan bir
  xil server/`proxy_network`)

## 3. Loyiha tuzilishi (modulli arxitektura)

```
src/
├── bot/            # grammY: handlers, conversations (wizard), middlewares
│   ├── handlers/       # /start, /admin, /help va h.k.
│   ├── conversations/  # ko'p bosqichli "taqdimot yaratish" wizard
│   ├── middlewares/    # access-control (whitelist tekshirish)
│   └── keyboards/      # inline tugma generatorlari
├── ai/             # Claude API bilan ishlash
│   ├── client.ts       # Anthropic SDK wrapper
│   ├── designGuide.ts  # dizayn qo'llanma matni (rasmiy pptx-skill'dan
│   │                    # moslashtirilgan) + bridge API hujjatlari
│   └── codeValidator.ts # Claude qaytargan kodni statik tekshirish
├── pptx/           # taqdimot fayl generatsiya dvigateli
│   ├── bridge.ts       # sandbox ichidan chaqiriladigan cheklangan API
│   │                    # (addSlide, addText, addImage, addChart, addIcon...)
│   ├── sandbox.ts       # isolated-vm ijro muhiti (timeout/memory limit)
│   ├── themes/          # tema konfiguratsiyalari (ranglar, fontlar)
│   │   ├── corporate.ts
│   │   ├── creative.ts
│   │   ├── minimal.ts
│   │   └── dark.ts
│   └── icons/            # react-icons -> SVG -> PNG renderer
├── db/             # Prisma client + repository qatlami
│   ├── schema.prisma
│   └── repositories/    # UserRepository, PresentationRepository
├── i18n/           # locale fayllar + loader (hardcode yo'q)
│   ├── locales/uz.json
│   └── t.ts
├── config/         # env parsing (Zod bilan validatsiya) + constants
│   ├── env.ts
│   └── constants.ts
└── index.ts        # entrypoint (webhook HTTP server)
```

Har bir modul mustaqil: `pptx` moduli Claude'dan qanday kod kelganini
bilmaydi, faqat bridge orqali chaqiriladi; `ai` moduli pptxgenjs haqida
bilmaydi, faqat kod matni generatsiya qiladi. Bu qismlarni bir-biriga
tegmasdan almashtirish/kengaytirish imkonini beradi.

## 4. Ruxsat va rol tizimi

Ikki rol:

- **SUPER_ADMIN** — Telegram ID `.env`da (`SUPER_ADMIN_ID`), birinchi
  ishga tushirishda DB'ga seed qilinadi. O'chirilmaydi.
- **ADMIN** — super-admin (yoki boshqa admin) tomonidan qo'shiladi,
  foydalanuvchilarni boshqara oladi.

DB'dagi `User` jadvalida bo'lishning o'zi botdan foydalanish huquqini
bildiradi (alohida "oddiy foydalanuvchi" rol nomi yo'q) — `isAdmin: boolean`
maydoni faqat boshqaruv huquqini belgilaydi.

**Admin buyruqlari:**

- `/adduser <telegram_id>` — foydalanuvchini qo'shish
- `/removeuser <telegram_id>` — olib tashlash
- `/listusers` — ro'yxatni ko'rish
- `/promote <telegram_id>` — (faqat SUPER_ADMIN) ADMIN huquqi berish

**Access-control middleware:** ro'yxatda yo'q foydalanuvchi har qanday
buyruqqa "Kirish cheklangan" xabarini oladi.

Hozircha kunlik/oylik foydalanish limiti YO'Q (to'lov tizimi bilan birga
kelajakda qo'shiladi).

## 5. Foydalanuvchi oqimi (wizard)

`@grammyjs/conversations` orqali ko'p bosqichli suhbat:

```
/start → [ruxsat tekshiriladi]
  → "Taqdimot mavzusini yozing" (matn kiritish)
  → "Nechta slayd?" [5] [10] [15] [20] [AI tanlasin]
  → "Til?" [O'zbek] [Rus] [Ingliz]
  → "Dizayn uslubi?" [Corporate] [Creative] [Minimal] [Dark]
  → "Tayyorlanmoqda..." (progress xabari)
  → Claude API chaqiriladi → JS kod qaytadi
  → kod statik tekshiruvdan o'tadi
  → isolated-vm sandbox'da ijro etiladi (bridge orqali pptxgenjs to'ldiriladi)
  → .pptx fayl buferga yig'iladi
  → Telegram orqali yuboriladi
  → DB'ga generatsiya tarixi yoziladi (status, xato bo'lsa xabari)
```

Har bir qadamda `❌ Bekor qilish` tugmasi mavjud.

## 6. AI integratsiyasi: kod generatsiya va sandbox

Claude JSON emas, **JavaScript kod** qaytaradi — bu kod
`ai/designGuide.ts`da berilgan dizayn qo'llanma (Anthropic'ning rasmiy
pptx-skill asosida moslashtirilgan: rang sxemalari, layout qoidalari,
tipografiya) va bridge API hujjatlari asosida yoziladi.

Claude'ga to'liq xom `pptxgenjs` emas, balki `pptx/bridge.ts`da belgilangan
**cheklangan funksiyalar to'plami** taqdim etiladi:

```
Claude yozgan kod (isolate ichida)          Host process (asosiy Node)
─────────────────────────────────          ──────────────────────────
addSlide({ layout: "title" })      ──────▶  pptxgenjs: pptx.addSlide()
addText(slideId, "Sarlavha", {...}) ──────▶  slide.addText(...)
addChart(slideId, "bar", data)      ──────▶  slide.addChart(...)
addIcon(slideId, "FaChartBar", {...}) ────▶  react-icons SVG → slide.addImage(...)
```

Claude bu funksiyalar orasida erkin JS mantiq yoza oladi (loop, shart va
h.k.) — ijodiy layout erkinligi beriladi, lekin har bir chaqiruv oddiy
primitiv argumentlar bilan host tomonga o'tadi va real ishni haqiqiy
`pptxgenjs` bajaradi. Ranglar/shriftlar Claude kodiga tanlangan tema
obyekti (`theme.primaryColor` va h.k.) orqali beriladi — Claude ranglarni
o'zi o'ylab topmaydi.

**Ijro oqimi:**

1. Claude kod qaytaradi (matn ko'rinishida)
2. `ai/codeValidator.ts` — taqiqlangan kalit so'zlar (`require`, `import`,
   `process`, `eval`, `fetch` va h.k.) statik tekshiriladi
3. `pptx/sandbox.ts` — `isolated-vm`da ijro: **5s vaqt limiti**, **128MB
   xotira limiti**, faqat bridge funksiyalari mavjud
4. Xato (timeout/sintaksis/bridge argument xatosi) — ushlanadi, foydalanuvchiga
   do'stona xabar, tafsilotlar loglanadi va DB'ga yoziladi
5. Muvaffaqiyat — host tomonda yig'ilgan `pptxgenjs` obyekti `.pptx`
   buferga aylantiriladi va yuboriladi

## 7. Ikonkalar va tema tizimi

- `react-icons`dan kerakli komponent olinadi → `react-dom/server`ning
  `renderToStaticMarkup()` bilan statik SVG matiga aylantiriladi (server
  tomonda, brauzersiz) → `sharp` orqali shaffof fonli PNG'ga konvertatsiya
  qilinadi → `addImage()` bilan slaydga qo'yiladi.
- Claude bridge orqali faqat ikonka nomini beradi
  (`addIcon(slideId, "FaChartBar", {...})`); mavjud ikonkalar ro'yxati
  system prompt'da beriladi, shunda mavjud bo'lmagan nom yozilmaydi.
- Har bir tema (`corporate`, `creative`, `minimal`, `dark`) — alohida
  konstantalar fayli: asosiy/ikkinchi/fon rang, shrift oilasi, o'lchamlar.
  Yangi tema qo'shish = yangi fayl, boshqa kodga tegilmaydi.

## 8. Ma'lumotlar bazasi (Prisma)

```prisma
model User {
  id          BigInt   @id            // Telegram user ID
  username    String?
  firstName   String?
  isAdmin     Boolean  @default(false)
  addedById   BigInt?
  addedBy     User?    @relation("UserAddedBy", fields: [addedById], references: [id])
  addedUsers  User[]   @relation("UserAddedBy")
  createdAt   DateTime @default(now())
  presentations Presentation[]
}

model Presentation {
  id          String   @id @default(cuid())
  userId      BigInt
  user        User     @relation(fields: [userId], references: [id])
  topic       String
  slideCount  Int
  language    String
  theme       String
  status      PresentationStatus @default(PENDING)
  errorMessage String?
  createdAt   DateTime @default(now())
}

enum PresentationStatus {
  PENDING
  SUCCESS
  FAILED
}
```

## 9. Konfiguratsiya va i18n

- **`config/env.ts`:** barcha env o'zgaruvchilar (`BOT_TOKEN`,
  `WEBHOOK_DOMAIN`, `WEBHOOK_SECRET`, `DATABASE_URL`, `ANTHROPIC_API_KEY`,
  `SUPER_ADMIN_ID`, `PORT`) Zod sxema orqali validatsiya qilinadi — noto'g'ri
  qiymat bo'lsa bot ishga tushishdan oldin aniq xato bilan to'xtaydi.
- **`config/constants.ts`:** slaydlar soni variantlari (`[5, 10, 15, 20]`),
  temalar ro'yxati, tillar ro'yxati — bitta joyda, hech narsa tarqoq
  hardcode qilinmaydi.
- **`i18n/locales/uz.json` + `i18n/t.ts`:** barcha bot matnlari kalit-qiymat
  ko'rinishida (`t("start.welcome")`). Yangi til = yangi locale fayl,
  kodga tegilmaydi.

## 10. Deploy

Mavjud QuizBot infratuzilmasi bilan bir xil naqsh:

- **Server:** bir xil VPS, bir xil tashqi `proxy_network` Docker tarmog'i
  (umumiy `nginx-proxy` + acme-companion allaqachon ishlab turibdi).
- **Domen:** `xamidullayevi.uz` (`VIRTUAL_HOST`/`LETSENCRYPT_HOST` env orqali,
  SSL avtomatik).
- **Webhook:** `https://xamidullayevi.uz/webhook`, `WEBHOOK_SECRET` bilan
  himoyalangan.
- **`docker-compose.yml`:** `bot` + `postgres` xizmatlari, `proxy_network`
  (external) va ichki `backend` tarmog'i. `isolated-vm` native modul
  bo'lgani uchun multi-stage Dockerfile (build/runtime bosqichlari alohida).
- **`scripts/deploy.sh`:** QuizBot naqshiga mos — backup (DB dump) →
  `git pull` → `docker compose up -d --build` → `prisma migrate deploy` →
  health check → Telegram webhook o'rnatish (rangli step-by-step chiqish).

## 11. Xatoliklarni boshqarish

- Har bir bosqich (Claude chaqiruvi, kod validatsiyasi, sandbox ijrosi,
  fayl yuborish) alohida try/catch, xato turiga mos aniq foydalanuvchi
  xabari.
- Claude API vaqtinchalik xatolari uchun eksponensial backoff bilan 2 marta
  qayta urinish.
- Barcha xatolar `Presentation.status = FAILED` + `errorMessage` bilan
  DB'ga yoziladi.
- Strukturaviy logging (`pino`), har bir so'rov uchun `requestId`.

## 12. Testlash strategiyasi

- **Unit:** `pptx/bridge.ts` funksiyalari, `ai/codeValidator.ts`, i18n
  loader, config Zod validatsiyasi.
- **Integratsion:** to'liq oqim — mock Claude javobi (tayyor JS kod
  namunasi) → sandbox ijrosi → haqiqiy `.pptx` fayl hosil bo'lishi
  (fayl mavjudligi, slaydlar soni to'g'riligi).
- **Sandbox xavfsizlik testlari:** zararli kod namunalari (`require('fs')`,
  cheksiz loop, xotira "flood") to'g'ri bloklanishi/timeout bo'lishi.
- Framework: Vitest.

## 13. Kelajakdagi kengaytirishlar (hozirgi scope'dan tashqarida)

- To'lov tizimi (Telegram Stars va/yoki Click/Payme) va tariflar
- Foydalanish limitlari (rate limiting)
- Qo'shimcha tillar (ru, en) — bot interfeysi uchun
- PDF eksport varianti
