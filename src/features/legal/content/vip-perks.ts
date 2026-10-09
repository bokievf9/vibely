import type { Locale } from '@/i18n/config'
import type { LegalSection } from './types'

// Read receipts, profile visits and notes on likes (VIP features, 20261009000290). Kept in its
// own file and inserted into each locale as one delimited section, like ./nearby.ts.
// Draft: MUST be reviewed by a Malaysian lawyer (PDPA 2010) before launch.
export const vipPerksLegal: Record<Locale, { privacy: LegalSection }> = {
  en: {
    privacy: {
      heading: '5i. Read receipts, profile visits and notes',
      paragraphs: [
        'Read receipts: when you open a chat, we record up to which moment you have read it. The other person sees this ("Seen") only if their plan includes read receipts and both of you have "Send read receipts" turned on in Settings. If you turn it off, nobody sees when you read their messages, and you do not see when others read yours.',
        "Profile visits: when you open someone's profile, or the details on their card in Discover, we record that you viewed it, at most once per person per day. People whose plan includes this feature can see who viewed their profile (your first photo, name, age and when). Others only see how many people viewed them. Visits are not recorded while Incognito mode is on, between people who blocked each other, or for staff accounts. Visits are deleted after 30 days.",
        'Notes with a like: with some plans you can send a short note (up to 200 characters) together with a like, before you match. The note is shown to that person with your like; people whose plan does not show who liked them see the note with your first name only. Notes are checked automatically for phone numbers, links, other apps and money requests; such notes are held and not shown. The person can report a note; moderators then see its text, and every view is logged. If you match, the note becomes the first message of your chat. Notes are deleted after 90 days, or kept until a report about them is resolved.',
      ],
    },
  },
  ms: {
    privacy: {
      heading: '5i. Resit baca, lawatan profil dan nota',
      paragraphs: [
        'Resit baca: apabila anda membuka sembang, kami merekodkan sehingga saat mana anda telah membacanya. Orang lain melihatnya ("Dilihat") hanya jika pelan mereka termasuk resit baca dan kedua-dua anda menghidupkan "Hantar resit baca" dalam Tetapan. Jika anda mematikannya, tiada sesiapa melihat bila anda membaca mesej mereka, dan anda tidak melihat bila orang lain membaca mesej anda.',
        'Lawatan profil: apabila anda membuka profil seseorang, atau butiran pada kad mereka dalam Teroka, kami merekodkan bahawa anda melihatnya, paling banyak sekali bagi setiap orang setiap hari. Orang yang pelannya termasuk ciri ini boleh melihat siapa yang melihat profil mereka (foto pertama, nama, umur dan masa anda). Orang lain hanya melihat berapa ramai yang melihat mereka. Lawatan tidak direkodkan semasa Mod inkognito hidup, antara orang yang menyekat satu sama lain, atau bagi akaun kakitangan. Lawatan dipadam selepas 30 hari.',
        'Nota bersama suka: dengan sesetengah pelan anda boleh menghantar nota pendek (sehingga 200 aksara) bersama suka, sebelum padanan. Nota itu ditunjukkan kepada orang tersebut bersama suka anda; orang yang pelannya tidak menunjukkan siapa yang menyukai mereka melihat nota itu dengan nama pertama anda sahaja. Nota disemak secara automatik untuk nombor telefon, pautan, aplikasi lain dan permintaan wang; nota sebegini ditahan dan tidak dipaparkan. Orang itu boleh melaporkan nota; moderator kemudian melihat teksnya, dan setiap paparan direkodkan. Jika anda berpadanan, nota itu menjadi mesej pertama sembang anda. Nota dipadam selepas 90 hari, atau disimpan sehingga laporan mengenainya diselesaikan.',
      ],
    },
  },
  ru: {
    privacy: {
      heading: '5i. Отчёты о прочтении, просмотры профиля и записки',
      paragraphs: [
        'Отчёты о прочтении: когда вы открываете чат, мы записываем, до какого момента вы его прочитали. Собеседник видит это («Прочитано»), только если его план включает отчёты о прочтении и у вас обоих в Настройках включено «Отчёты о прочтении». Если вы это выключите, никто не увидит, когда вы прочитали их сообщения, и вы тоже не увидите, когда прочитали ваши.',
        'Просмотры профиля: когда вы открываете чей-то профиль или подробности на его карточке в Знакомствах, мы записываем, что вы его смотрели, не чаще одного раза в день для каждого человека. Люди, чей план включает эту функцию, видят, кто смотрел их профиль (ваше первое фото, имя, возраст и когда). Остальные видят только, сколько человек их смотрели. Просмотры не записываются, пока включён режим инкогнито, между людьми, заблокировавшими друг друга, и для служебных аккаунтов. Просмотры удаляются через 30 дней.',
        'Записки к лайку: с некоторыми планами можно отправить короткую записку (до 200 символов) вместе с лайком, ещё до мэтча. Записка показывается этому человеку вместе с вашим лайком; тем, чей план не показывает, кто их лайкнул, записка видна только с вашим именем. Записки автоматически проверяются на телефоны, ссылки, другие мессенджеры и просьбы о деньгах; такие записки задерживаются и не показываются. Получатель может пожаловаться на записку; тогда модераторы видят её текст, и каждый просмотр записывается в журнал. Если у вас мэтч, записка становится первым сообщением чата. Записки удаляются через 90 дней или хранятся, пока жалоба на них не рассмотрена.',
      ],
    },
  },
}
