import type { Locale } from '@/i18n/config'
import type { LegalSection } from './types'

// Duo Dating (20261009000261): duos of two friends, team likes and 4-person group chats. Kept in
// its own file and inserted into each locale as one delimited section, like ./crush.ts.
// Draft: MUST be reviewed by a Malaysian lawyer (PDPA 2010) before launch.
export const duoLegal: Record<Locale, { privacy: LegalSection; terms: LegalSection }> = {
  en: {
    privacy: {
      heading: '5d. Duo Dating',
      paragraphs: [
        'A duo is formed only when one verified user invites another verified user and that person accepts. Other duos see both members of your duo: their main photo, first name and age, and the bio of your duo. Duo bios are checked automatically; a bio that looks suspicious (for example contact details, links or requests for money) is held and not shown until a moderator has reviewed it.',
        'When you like another duo, your partner sees that like and can undo it within 1 hour. When two duos like each other, a group chat for the 4 of you is created.',
        'Group chats are text and photos only (there are no calls in group chats). Like chats between matches, they are stored for safety (see section 3): photos are deleted after 90 days, and are kept longer only while they are part of an open report, until that report is resolved. Moderators read a group chat only while handling a report about someone in it, and every access is logged.',
        "If you block a member of a group chat, you are removed from that group and you will not be matched with that person's duo again. If you leave your duo or your account is banned, the duo is dissolved. A group chat is deleted once all members have left it, unless a report about one of its members is open. Dissolved duos and old duo likes are deleted after 90 days.",
      ],
    },
    terms: {
      heading: '5b. Duo Dating',
      paragraphs: [
        'Only invite someone you know who wants to join you. Our rules of conduct (section 3) apply to your duo bio and to everything you send in a group chat, and you are responsible for your own messages and photos there. You can report a message or a member of a group chat at any time.',
        "Blocking a member removes you from that group chat and prevents future duo matches with that person's duo. Leaving your duo, or a ban of either member, dissolves the duo.",
      ],
    },
  },
  ms: {
    privacy: {
      heading: '5d. Temu Janji Duo',
      paragraphs: [
        'Duo hanya terbentuk apabila seorang pengguna yang disahkan menjemput pengguna lain yang disahkan dan orang itu menerimanya. Duo lain melihat kedua-dua ahli duo anda: foto utama, nama pertama dan umur mereka, serta bio duo anda. Bio duo disemak secara automatik; bio yang kelihatan mencurigakan (contohnya butiran hubungan, pautan atau permintaan wang) ditahan dan tidak ditunjukkan sehingga moderator menyemaknya.',
        'Apabila anda menyukai duo lain, pasangan anda melihat suka itu dan boleh membatalkannya dalam masa 1 jam. Apabila dua duo saling menyukai, sembang kumpulan untuk anda berempat diwujudkan.',
        'Sembang kumpulan hanya untuk teks dan foto (tiada panggilan dalam sembang kumpulan). Seperti sembang antara padanan, ia disimpan demi keselamatan (lihat seksyen 3): foto dipadam selepas 90 hari, dan disimpan lebih lama hanya semasa ia menjadi sebahagian daripada laporan terbuka, sehingga laporan itu diselesaikan. Moderator membaca sembang kumpulan hanya semasa mengendalikan laporan tentang seseorang di dalamnya, dan setiap akses direkodkan.',
        'Jika anda menyekat ahli sembang kumpulan, anda dikeluarkan daripada kumpulan itu dan anda tidak akan dipadankan dengan duo orang itu lagi. Jika anda keluar daripada duo anda atau akaun anda diharamkan, duo itu dibubarkan. Sembang kumpulan dipadam apabila semua ahli telah keluar, kecuali jika ada laporan terbuka tentang salah seorang ahlinya. Duo yang telah dibubarkan dan suka duo yang lama dipadam selepas 90 hari.',
      ],
    },
    terms: {
      heading: '5b. Temu Janji Duo',
      paragraphs: [
        'Jemput hanya orang yang anda kenali dan yang mahu menyertai anda. Peraturan tingkah laku kami (seksyen 3) terpakai pada bio duo anda dan pada semua yang anda hantar dalam sembang kumpulan, dan anda bertanggungjawab atas mesej dan foto anda sendiri di situ. Anda boleh melaporkan mesej atau ahli sembang kumpulan pada bila-bila masa.',
        'Menyekat seorang ahli mengeluarkan anda daripada sembang kumpulan itu dan menghalang padanan duo pada masa hadapan dengan duo orang itu. Keluar daripada duo anda, atau pengharaman salah seorang ahli, membubarkan duo itu.',
      ],
    },
  },
  ru: {
    privacy: {
      heading: '5d. Знакомства вдвоём (Duo)',
      paragraphs: [
        'Дуо создаётся, только когда один верифицированный пользователь приглашает другого верифицированного пользователя и тот принимает приглашение. Другие дуо видят обоих участников вашего дуо: их главное фото, имя и возраст, а также описание вашего дуо. Описания дуо проверяются автоматически; подозрительное описание (например, с контактами, ссылками или просьбами о деньгах) задерживается и не показывается, пока его не проверит модератор.',
        'Когда вы ставите лайк другому дуо, ваш партнёр видит этот лайк и может отменить его в течение 1 часа. Когда два дуо ставят лайк друг другу, создаётся групповой чат для вас четверых.',
        'В групповых чатах можно отправлять только текст и фото (звонков в групповых чатах нет). Как и чаты между мэтчами, они хранятся ради безопасности (см. раздел 3): фото удаляются через 90 дней и хранятся дольше, только пока они относятся к открытой жалобе, до её рассмотрения. Модераторы читают групповой чат только при рассмотрении жалобы на кого-то из его участников, и каждый доступ записывается в журнал.',
        'Если вы заблокируете участника группового чата, вы выйдете из этой группы и больше не получите мэтч с дуо этого человека. Если вы выйдете из дуо или ваш аккаунт будет заблокирован, дуо распадается. Групповой чат удаляется, когда из него вышли все участники, если только нет открытой жалобы на кого-то из них. Распавшиеся дуо и старые лайки дуо удаляются через 90 дней.',
      ],
    },
    terms: {
      heading: '5b. Знакомства вдвоём (Duo)',
      paragraphs: [
        'Приглашайте только знакомых людей, которые сами хотят присоединиться к вам. Наши правила поведения (раздел 3) действуют для описания вашего дуо и для всего, что вы отправляете в групповом чате, и вы отвечаете за свои сообщения и фото в нём. Вы в любой момент можете пожаловаться на сообщение или участника группового чата.',
        'Блокировка участника удаляет вас из этого группового чата и исключает будущие мэтчи с дуо этого человека. Выход из дуо или блокировка аккаунта любого из участников распускает дуо.',
      ],
    },
  },
}
