import type { Locale } from '@/i18n/config'
import type { LegalSection } from './types'

// Plus and VIP plans (20261009000280). Own file like ./calls.ts, inserted into each locale as one
// delimited section. No prices yet. Draft for review by a Malaysian lawyer (PDPA 2010).
export const plansLegal: Record<Locale, { privacy: LegalSection; terms: LegalSection }> = {
  en: {
    privacy: {
      heading: '5h. Plus and VIP plans',
      paragraphs: [
        'We store which plan you have (free, Plus or VIP), where it came from (a promo code, the matchmaker reward, the Vibely team or a purchase) and when it starts and ends. If a plan was granted by the Vibely team, we also store who granted it and a short note. This is used only to give you the features of your plan.',
        'For features with a limit (for example likes per day or boosts) we count how often you used them. These counters are kept only as long as the limit needs them: the separate usage records are deleted after 31 days.',
      ],
    },
    terms: {
      heading: '5e. Plus and VIP plans',
      paragraphs: [
        'Vibely has three levels: free, Plus and VIP. Some features are limited or need Plus or VIP. For example, sending photos, voice messages and video messages in chat and posting or commenting in the feed need Plus, audio and video calls need VIP, and likes in Discover and Blind Dating have daily limits on the free level. The app always shows which level a feature needs.',
        'A plan can come from a promo code, a reward (introducing two people who then match gives you Plus for 7 days) or the Vibely team. Paid plans may be offered later; the price will always be shown before any purchase. Plans are personal and cannot be transferred or exchanged for money.',
        'We may change which features belong to which level and the limits of each level. When a plan ends, everything you created stays visible; limits only apply to new actions.',
      ],
    },
  },
  ms: {
    privacy: {
      heading: '5h. Pelan Plus dan VIP',
      paragraphs: [
        'Kami menyimpan pelan yang anda miliki (percuma, Plus atau VIP), dari mana ia datang (kod promo, ganjaran pengenal, pasukan Vibely atau pembelian) dan bila ia bermula serta tamat. Jika pelan diberikan oleh pasukan Vibely, kami juga menyimpan siapa yang memberikannya dan nota ringkas. Maklumat ini hanya digunakan untuk memberi anda ciri pelan anda.',
        'Bagi ciri yang mempunyai had (contohnya suka setiap hari atau rangsangan), kami mengira berapa kerap anda menggunakannya. Kiraan ini hanya disimpan selagi had memerlukannya: rekod penggunaan berasingan dipadam selepas 31 hari.',
      ],
    },
    terms: {
      heading: '5e. Pelan Plus dan VIP',
      paragraphs: [
        'Vibely mempunyai tiga tahap: percuma, Plus dan VIP. Sesetengah ciri terhad atau memerlukan Plus atau VIP. Contohnya, menghantar foto, mesej suara dan mesej video dalam sembang serta menyiarkan atau mengulas dalam suapan memerlukan Plus, panggilan suara dan video memerlukan VIP, dan suka dalam Teroka serta Blind Dating mempunyai had harian pada tahap percuma. Aplikasi sentiasa menunjukkan tahap yang diperlukan oleh sesuatu ciri.',
        'Pelan boleh datang daripada kod promo, ganjaran (mengenalkan dua orang yang kemudian berpadanan memberi anda Plus selama 7 hari) atau pasukan Vibely. Pelan berbayar mungkin ditawarkan kemudian; harga akan sentiasa dipaparkan sebelum sebarang pembelian. Pelan adalah peribadi dan tidak boleh dipindahkan atau ditukar dengan wang.',
        'Kami boleh mengubah ciri yang termasuk dalam setiap tahap dan had setiap tahap. Apabila pelan tamat, semua yang anda cipta kekal kelihatan; had hanya digunakan pada tindakan baharu.',
      ],
    },
  },
  ru: {
    privacy: {
      heading: '5h. Тарифы Plus и VIP',
      paragraphs: [
        'Мы храним, какой у вас тариф (бесплатный, Plus или VIP), откуда он получен (промокод, награда за знакомство, команда Vibely или покупка) и когда он начинается и заканчивается. Если тариф выдала команда Vibely, мы также храним, кто его выдал, и короткую заметку. Эти данные используются только для того, чтобы открыть вам возможности вашего тарифа.',
        'Для функций с ограничением (например, лайки в день или бусты) мы считаем, сколько раз вы ими воспользовались. Эти счётчики хранятся только столько, сколько нужно для ограничения: отдельные записи об использовании удаляются через 31 день.',
      ],
    },
    terms: {
      heading: '5e. Тарифы Plus и VIP',
      paragraphs: [
        'В Vibely три уровня: бесплатный, Plus и VIP. Некоторые функции ограничены или требуют Plus или VIP. Например, фото, голосовые и видеосообщения в чате, а также посты и комментарии в ленте требуют Plus, аудио- и видеозвонки требуют VIP, а лайки в разделе Знакомства и Blind Dating на бесплатном уровне ограничены в день. Приложение всегда показывает, какой уровень нужен для функции.',
        'Тариф можно получить по промокоду, в награду (если вы познакомили двух людей и у них случился мэтч, вы получаете Plus на 7 дней) или от команды Vibely. Платные тарифы могут появиться позже; цена всегда будет показана до покупки. Тариф личный, его нельзя передать или обменять на деньги.',
        'Мы можем менять, какие функции входят в какой уровень, и ограничения каждого уровня. Когда тариф заканчивается, всё, что вы создали, остаётся видимым; ограничения действуют только для новых действий.',
      ],
    },
  },
}
