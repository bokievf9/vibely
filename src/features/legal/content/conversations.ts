import type { Locale } from '@/i18n/config'
import type { LegalSection } from './types'

// "Reply privately" on feed posts and the question of the day (20261009000220). Own file like
// calls.ts, inserted into each locale as one delimited section. Draft for review by a Malaysian
// lawyer (PDPA 2010).
export const conversationsLegal: Record<Locale, { privacy: LegalSection; terms: LegalSection }> = {
  en: {
    privacy: {
      heading: '5b. Private replies and the question of the day',
      paragraphs: [
        'You can reply privately to a feed post. This opens an anonymous conversation between you and the author: the author keeps the name the post shows (the random nickname, or their real name if they posted "As me"), and you are shown to the author only as an alias (for example "Partner #402"). Your name, photos and profile are not sent to the author, and an anonymous author stays anonymous to you, unless you both press "Reveal identity". That button becomes available only after each of you sent 5 messages. If you both press it, you become a match, your profiles are shown to each other and the conversation is copied into your regular chat. If either of you presses Pass, the conversation ends for both.',
        'Every day at 19:00 Malaysia time we show a question of the day in the feed. Your answer is stored together with your account and used to show you how many people chose each option and up to 8 verified people near you who chose the same answer as you (name, age and main photo, with the same rules as Discover). They may also see you. Answers are deleted after 90 days.',
        'Private replies and question-of-the-day conversations are stored like blind date messages: for 90 days, or until a report about them is resolved, and only moderators handling a report can read them. Pushes about a private reply never contain the message or who wrote it.',
      ],
    },
    terms: {
      heading: '5b. Private replies and the question of the day',
      paragraphs: [
        'Private replies are for talking to the author of a post, not for spam: you can start at most 10 private conversations per day and one per post. Do not use anonymity to harass anyone; moderators can see who takes part in a reported conversation. Answers to the question of the day are shown to other people only as counts and, if you chose the same option, as a Discover-style card.',
      ],
    },
  },
  ms: {
    privacy: {
      heading: '5b. Balasan peribadi dan soalan hari ini',
      paragraphs: [
        'Anda boleh membalas secara peribadi kepada siaran dalam suapan. Ini membuka perbualan tanpa nama antara anda dan penulis: penulis mengekalkan nama yang dipaparkan pada siaran (nama samaran rawak, atau nama sebenar jika mereka menyiarkan "Sebagai saya"), dan anda dipaparkan kepada penulis hanya sebagai alias (contohnya "Rakan #402"). Nama, foto dan profil anda tidak dihantar kepada penulis, dan penulis tanpa nama kekal tanpa nama kepada anda, melainkan anda berdua menekan "Dedahkan identiti". Butang itu hanya tersedia selepas setiap seorang menghantar 5 mesej. Jika anda berdua menekannya, anda menjadi padanan, profil anda dipaparkan kepada satu sama lain dan perbualan disalin ke sembang biasa anda. Jika salah seorang menekan Lepas, perbualan tamat untuk kedua-duanya.',
        'Setiap hari pada 19:00 waktu Malaysia kami memaparkan soalan hari ini dalam suapan. Jawapan anda disimpan bersama akaun anda dan digunakan untuk menunjukkan berapa ramai yang memilih setiap pilihan serta sehingga 8 orang yang disahkan berdekatan anda yang memilih jawapan yang sama (nama, umur dan foto utama, dengan peraturan yang sama seperti Terokai). Mereka juga mungkin melihat anda. Jawapan dipadam selepas 90 hari.',
        'Balasan peribadi dan perbualan soalan hari ini disimpan seperti mesej temu janji buta: selama 90 hari, atau sehingga laporan mengenainya diselesaikan, dan hanya moderator yang mengendalikan laporan boleh membacanya. Pemberitahuan tentang balasan peribadi tidak pernah mengandungi mesej atau siapa yang menulisnya.',
      ],
    },
    terms: {
      heading: '5b. Balasan peribadi dan soalan hari ini',
      paragraphs: [
        'Balasan peribadi adalah untuk berbual dengan penulis siaran, bukan untuk spam: anda boleh memulakan paling banyak 10 perbualan peribadi sehari dan satu bagi setiap siaran. Jangan gunakan ketanpanamaan untuk mengganggu sesiapa; moderator boleh melihat siapa yang terlibat dalam perbualan yang dilaporkan. Jawapan kepada soalan hari ini dipaparkan kepada orang lain hanya sebagai jumlah dan, jika anda memilih pilihan yang sama, sebagai kad seperti Terokai.',
      ],
    },
  },
  ru: {
    privacy: {
      heading: '5b. Личные ответы и вопрос дня',
      paragraphs: [
        'На пост в ленте можно ответить лично. Открывается анонимная переписка между вами и автором: автор остаётся под именем, которое показывает пост (случайный псевдоним или настоящее имя, если пост опубликован «От себя»), а вы показаны автору только под псевдонимом (например, «Собеседник #402»). Ваше имя, фото и профиль автору не передаются, а анонимный автор остаётся анонимным для вас, пока вы оба не нажмёте «Раскрыть личность». Эта кнопка доступна только после того, как каждый из вас отправил 5 сообщений. Если нажмёте оба, вы становитесь парой, ваши профили показываются друг другу, а переписка копируется в обычный чат. Если кто-то из вас нажмёт «Пропустить», переписка завершится для обоих.',
        'Каждый день в 19:00 по Малайзии мы показываем в ленте вопрос дня. Ваш ответ хранится вместе с аккаунтом и используется, чтобы показать, сколько людей выбрали каждый вариант, и до 8 проверенных людей рядом с вами, выбравших тот же ответ (имя, возраст и главное фото, по тем же правилам, что и в «Знакомствах»). Они тоже могут увидеть вас. Ответы удаляются через 90 дней.',
        'Личные ответы и переписки по вопросу дня хранятся так же, как сообщения свиданий вслепую: 90 дней или до рассмотрения жалобы на них, и читать их могут только модераторы, рассматривающие жалобу. Уведомления о личном ответе никогда не содержат текст сообщения и то, кто его написал.',
      ],
    },
    terms: {
      heading: '5b. Личные ответы и вопрос дня',
      paragraphs: [
        'Личные ответы предназначены для разговора с автором поста, а не для спама: можно начать не более 10 личных переписок в день и одну на пост. Не используйте анонимность, чтобы кого-то преследовать; модераторы видят участников переписки, на которую пожаловались. Ответы на вопрос дня показываются другим только в виде чисел и, если вы выбрали один и тот же вариант, в виде карточки как в «Знакомствах».',
      ],
    },
  },
}
