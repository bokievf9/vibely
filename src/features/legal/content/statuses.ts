import type { Locale } from '@/i18n/config'
import type { LegalSection } from './types'

// Live statuses ("What's your vibe?", 20261009000271). Own file like calls.ts, inserted into each
// locale as one delimited section. Draft for review by a Malaysian lawyer (PDPA 2010).
export const statusesLegal: Record<Locale, { privacy: LegalSection; terms: LegalSection }> = {
  en: {
    privacy: {
      heading: '5e. Live statuses',
      paragraphs: [
        'You can share a status: an emoji and up to 60 characters, shown for 3 hours at the top of Discover and the feed. It is shown with your name, age and main photo to verified people near you whom you could also meet in Discover (you are interested in each other and within each other\'s distance and age range). It is not shown to people you blocked or who blocked you, or while your profile is paused, hidden or suspended. Your exact location is never shown. Which statuses you have already seen is remembered only on your device.',
        'Statuses are checked automatically when you post them for phone numbers, links, other messengers, requests for money and similar signs of scams. A flagged status is shown only to you, marked "Under review", until a moderator approves or removes it. People can report a status; moderators then see the status and your profile.',
        'If someone replies to your status, a conversation opens in which you both see each other\'s name and photo, with your status pinned on top. If you both press Connect, you become a match and the conversation is copied into your regular chat. These conversations are stored like blind date messages: for 90 days, or until a report about them is resolved. Your status itself is deleted 24 hours after it expires; a status that was held or removed by moderation is kept for 90 days, and a reported one until the report is resolved.',
      ],
    },
    terms: {
      heading: '5c. Live statuses',
      paragraphs: [
        'Statuses are for saying what you are up to, not for advertising, contact details or anything you could not post in the feed. You can reply to at most 10 statuses per day and start one conversation per status. Moderators may hide a status at any time, and breaking these rules can lead to the measures in section 6.',
      ],
    },
  },
  ms: {
    privacy: {
      heading: '5e. Status langsung',
      paragraphs: [
        'Anda boleh berkongsi status: satu emoji dan sehingga 60 aksara, dipaparkan selama 3 jam di bahagian atas Teroka dan suapan. Ia dipaparkan bersama nama, umur dan foto utama anda kepada orang yang disahkan berdekatan anda yang juga boleh anda temui di Teroka (anda berminat antara satu sama lain dan berada dalam jarak serta julat umur masing-masing). Ia tidak dipaparkan kepada orang yang anda sekat atau yang menyekat anda, atau semasa profil anda dijeda, disembunyikan atau digantung. Lokasi tepat anda tidak pernah dipaparkan. Status yang telah anda lihat hanya diingati pada peranti anda.',
        'Status disemak secara automatik semasa disiarkan untuk nombor telefon, pautan, aplikasi pesanan lain, permintaan wang dan tanda penipuan yang serupa. Status yang ditanda hanya dipaparkan kepada anda, bertanda "Sedang disemak", sehingga moderator meluluskan atau membuangnya. Orang lain boleh melaporkan status; moderator kemudian melihat status dan profil anda.',
        'Jika seseorang membalas status anda, perbualan dibuka di mana anda berdua melihat nama dan foto masing-masing, dengan status anda disematkan di atas. Jika anda berdua menekan Sambung, anda menjadi padanan dan perbualan disalin ke sembang biasa anda. Perbualan ini disimpan seperti mesej temu janji buta: selama 90 hari, atau sehingga laporan mengenainya diselesaikan. Status anda sendiri dipadam 24 jam selepas ia tamat; status yang ditahan atau dibuang oleh moderasi disimpan selama 90 hari, dan status yang dilaporkan sehingga laporan diselesaikan.',
      ],
    },
    terms: {
      heading: '5c. Status langsung',
      paragraphs: [
        'Status adalah untuk menyatakan apa yang anda lakukan, bukan untuk pengiklanan, butiran hubungan atau apa-apa yang tidak boleh anda siarkan dalam suapan. Anda boleh membalas paling banyak 10 status sehari dan memulakan satu perbualan bagi setiap status. Moderator boleh menyembunyikan status pada bila-bila masa, dan melanggar peraturan ini boleh membawa kepada langkah dalam seksyen 6.',
      ],
    },
  },
  ru: {
    privacy: {
      heading: '5e. Статусы',
      paragraphs: [
        'Вы можете поделиться статусом: эмодзи и до 60 символов, который 3 часа показывается вверху «Знакомств» и ленты. Он показывается вместе с вашим именем, возрастом и главным фото проверенным людям рядом с вами, с которыми вы могли бы встретиться и в «Знакомствах» (вы интересны друг другу и подходите друг другу по расстоянию и возрасту). Статус не показывается тем, кого вы заблокировали или кто заблокировал вас, а также пока ваш профиль на паузе, скрыт или заблокирован. Ваше точное местоположение никогда не показывается. Какие статусы вы уже посмотрели, запоминается только на вашем устройстве.',
        'При публикации статус автоматически проверяется на номера телефонов, ссылки, другие мессенджеры, просьбы о деньгах и похожие признаки мошенничества. Отмеченный статус видите только вы, с пометкой «На проверке», пока модератор не одобрит или не удалит его. На статус можно пожаловаться; тогда модераторы видят статус и ваш профиль.',
        'Если кто-то ответит на ваш статус, откроется переписка, в которой вы оба видите имя и фото друг друга, а ваш статус закреплён сверху. Если вы оба нажмёте «Познакомиться», вы станете парой, и переписка скопируется в обычный чат. Такие переписки хранятся так же, как сообщения свиданий вслепую: 90 дней или до рассмотрения жалобы на них. Сам статус удаляется через 24 часа после окончания; статус, задержанный или удалённый модерацией, хранится 90 дней, а статус с жалобой хранится до её рассмотрения.',
      ],
    },
    terms: {
      heading: '5c. Статусы',
      paragraphs: [
        'Статус нужен, чтобы рассказать, чем вы заняты, а не для рекламы, контактных данных или того, что нельзя публиковать в ленте. Можно ответить не более чем на 10 статусов в день и начать одну переписку на статус. Модераторы могут скрыть статус в любой момент, а нарушение этих правил может привести к мерам из раздела 6.',
      ],
    },
  },
}
