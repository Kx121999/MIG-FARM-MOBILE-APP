# تطبيق MIG FARM المستقل

تطبيق Expo وReact Native مستقل عن منصات التجارة الجاهزة. يحتوي المشروع على تطبيق العميل، Mig Farm API، كتالوج محلي من 250 منتجًا، 381 صورة محلية، طلبات مستقلة، ودفع داخل التطبيق عبر Stripe.

## التشغيل المحلي

ثبت الحزم ثم شغّل الـ API والتطبيق في نافذتين منفصلتين:

```bash
pnpm install
pnpm server
pnpm start
```

الخادم يعمل افتراضيًا على `http://127.0.0.1:8787`، وتطبيق الويب على `http://127.0.0.1:8081`.

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

لا تضع `STRIPE_SECRET_KEY` أو `STRIPE_WEBHOOK_SECRET` في إعدادات Expo العامة أو مستودع Git.

## بنية المشروع

- `app/`: شاشات التطبيق، ومنها المتجر والمنتج والسلة والدفع والطلبات.
- `src/services/catalog.ts`: عميل كتالوج Mig Farm API والكاش المحلي.
- `src/services/payments.ts`: إنشاء جلسة الدفع داخل التطبيق.
- `server/src/server.mjs`: API المنتجات والصور والطلبات وStripe Webhook.
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

## ترحيل الكتالوج

الكتالوج والصور مترحّلان بالفعل. لإعادة الترحيل من المصدر القديم عند الحاجة فقط:

```bash
pnpm migrate:catalog
```

بعد الترحيل لا يحتوي ملف الكتالوج على روابط صور تابعة للمصدر القديم.
