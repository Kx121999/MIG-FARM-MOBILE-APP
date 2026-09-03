# تطبيق MIG FARM المستقل

تطبيق Expo وReact Native مستقل عن منصات التجارة الجاهزة. يحتوي المشروع على تطبيق العميل، Mig Farm API، كتالوج محلي من 250 منتجًا، 381 صورة محلية، طلبات مستقلة، ودفع داخل التطبيق عبر Stripe.

## التشغيل المحلي

ثبت الحزم ثم شغّل الـ API والتطبيق في نافذتين منفصلتين:

```bash
pnpm install
pnpm db:migrate
pnpm server
pnpm start
```

الخادم يعمل افتراضيًا على `http://127.0.0.1:8787`، وتطبيق الويب على `http://127.0.0.1:8081`.

التطبيق يستخدم افتراضيًا API الإنتاج `https://mig-farm-api.onrender.com`، وليس الخادم المحلي. الحسابات والطلبات الجديدة تحتاج PostgreSQL مُجهّزًا. تعليمات النشر والترحيل وحدود المرحلة في `PRODUCTION_CUSTOMER_BACKEND_REPORT_AR.md`.

## إعداد البيئة

انسخ `.env.example` إلى `.env` ثم اضبط القيم التالية:

- `EXPO_PUBLIC_API_URL`: عنوان Mig Farm API المتاح للتطبيق.
- `EXPO_PUBLIC_APP_URL`: الرابط العام للتطبيق المستخدم عند مشاركة المنتجات.
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`: مفتاح Stripe العام للموبايل والويب.
- `STRIPE_SECRET_KEY`: مفتاح Stripe السري، ويُستخدم على الخادم فقط.
- `STRIPE_WEBHOOK_SECRET`: سر Webhook لتأكيد حالات الدفع.
- `CORS_ORIGIN`: رابط واجهة الويب المسموح لها بالاتصال بالخادم.
- `DELIVERY_FEE_AED`: قيمة التوصيل التي يضيفها الخادم.
- `EXPO_PUBLIC_AI_API_URL`: عنوان المساعد الزراعي.
- `DATABASE_URL`: اتصال PostgreSQL/Neon للخادم فقط، مع TLS.
- `DATABASE_URL_UNPOOLED`: اتصال مباشر اختياري لتشغيل الترحيلات.
- `ORDER_TOKEN_SECRET`: سر عشوائي ثابت بطول 32 حرفًا على الأقل لتأمين وإعادة استخدام محاولات checkout.
- `AUTH_ACCESS_TTL` و`AUTH_REFRESH_TTL`: بالثواني، افتراضيًا 900 و2592000.
- `TRUST_PROXY_HOPS`: عدد الوكلاء الموثوقين أمام الخادم، يضبط بعد التحقق من مسار Render.
- `PASSWORD_RESET_BASE_URL`: رابط HTTPS لشاشة استعادة كلمة المرور، لا يفعّل إرسال البريد بمفرده.

لا تضع `STRIPE_SECRET_KEY` أو `STRIPE_WEBHOOK_SECRET` في إعدادات Expo العامة أو مستودع Git.

## بنية المشروع

- `app/`: شاشات التطبيق، ومنها المتجر والمنتج والسلة والدفع والطلبات.
- `src/services/catalog.ts`: عميل كتالوج Mig Farm API والكاش المحلي.
- `src/services/payments.ts`: إنشاء جلسة الدفع داخل التطبيق.
- `server/src/server.mjs`: API المنتجات والصور والطلبات وStripe Webhook.
- `server/src/app.mjs`: توجيه الطلبات العامة والمحمية، دون تغيير مسارات المتجر الحالية.
- `server/db/`: اتصال PostgreSQL والترحيلات واستيراد الطلبات القديمة وتنظيف السجلات المنتهية.
- `server/auth/` و`server/services/`: الجلسات والعملاء والطلبات ومزوّدو الخدمات.
- `server/data/products.json`: بيانات المنتجات المستقلة.
- `server/public/media/products/`: صور المنتجات المستقلة.
- `scripts/migrate-shopify-catalog.mjs`: أداة ترحيل المصدر القديم فقط، ولا يستخدمها التطبيق وقت التشغيل.

## الدفع

الخادم يعيد حساب الأسعار من الكتالوج الموثوق قبل إنشاء PaymentIntent. بيانات البطاقة تُدخل في Stripe PaymentSheet على iOS وAndroid، وفي Stripe Payment Element على الويب، ولا تمر أو تُحفظ في Mig Farm API.

للاختبار استخدم مفاتيح Stripe test، ثم اربط Webhook بالمسار:

```text
POST /api/stripe/webhook
```

الأحداث المدعومة: نجاح الدفع، فشل الدفع، وإلغاء PaymentIntent.

قاعدة PostgreSQL هي مصدر بيانات الطلبات الجديد. قبل نشر هذا التحديث يجب تصدير ملفات الطلبات القديمة من Render واستيرادها بأمر `pnpm db:import-orders -- /path/to/export` بعد تشغيل الترحيل. لا تُحذف الملفات القديمة تلقائيًا. لا تنشر التحديث قبل تجهيز قاعدة البيانات والسر الجديد، وإلا سترجع عمليات checkout خطأ إعداد واضحًا بدل ادعاء حفظ الطلب.

## ترحيل الكتالوج

الكتالوج والصور مترحّلان بالفعل. لإعادة الترحيل من المصدر القديم عند الحاجة فقط:

```bash
pnpm migrate:catalog
```

بعد الترحيل لا يحتوي ملف الكتالوج على روابط صور تابعة للمصدر القديم.
