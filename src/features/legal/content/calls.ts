import type { Locale } from '@/i18n/config'
import type { LegalSection } from './types'

// Audio/video calls and their recording (CLAUDE.md: safety recording protocol). Kept in its own
// file and inserted into each locale as one clearly delimited section, so it can be edited
// independently of the general retention wording. Draft for review by a Malaysian lawyer.
export const callsLegal: Record<Locale, { privacy: LegalSection; terms: LegalSection }> = {
  en: {
    privacy: {
      heading: '5a. Audio and video calls (recorded)',
      paragraphs: [
        'Matched users can call each other only after both of them turn on "Allow calls in this chat". Before you can turn it on, we show you that calls are recorded, and you must accept this. During every call a "Recording" indicator is shown.',
        'All audio and video calls are recorded on our own media server for safety: audio calls as an audio file, video calls as a video file of both participants. Recordings are stored privately (not publicly accessible) and are never shown to other users, used for ads or used to train AI.',
        'Only Vibely moderators can open a recording, and only while handling a report between the people in that call. Every access is logged. Recordings and call records (who called whom, when and for how long) are deleted automatically after 90 days, unless they are part of an open report, in which case they are kept until the report is resolved.',
        'Calls run through our media server hosted by DigitalOcean in Singapore; recordings are stored with our storage provider (DigitalOcean Spaces or Supabase Storage).',
      ],
    },
    terms: {
      heading: '5a. Calls',
      paragraphs: [
        'Calls are available only when both people allow them in a chat. By turning calls on, you agree that all your calls on Vibely are recorded and stored for up to 90 days for safety, as described in the Privacy Policy. Do not use calls to harass, threaten, record or expose anyone; recordings may be used to enforce these Terms.',
      ],
    },
  },
  ms: {
    privacy: {
      heading: '5a. Panggilan suara dan video (dirakam)',
      paragraphs: [
        'Pengguna yang sepadan boleh membuat panggilan hanya selepas kedua-duanya menghidupkan "Benarkan panggilan dalam sembang ini". Sebelum anda boleh menghidupkannya, kami memaklumkan bahawa panggilan dirakam dan anda perlu menerimanya. Penunjuk "Merakam" dipaparkan sepanjang setiap panggilan.',
        'Semua panggilan suara dan video dirakam pada pelayan media kami sendiri demi keselamatan: panggilan suara sebagai fail audio, panggilan video sebagai fail video kedua-dua peserta. Rakaman disimpan secara peribadi (tidak boleh diakses awam) dan tidak pernah ditunjukkan kepada pengguna lain, digunakan untuk iklan atau untuk melatih AI.',
        'Hanya moderator Vibely boleh membuka rakaman, dan hanya semasa mengendalikan laporan antara orang dalam panggilan itu. Setiap akses direkodkan. Rakaman dan rekod panggilan (siapa memanggil siapa, bila dan berapa lama) dipadam secara automatik selepas 90 hari, kecuali ia sebahagian daripada laporan yang masih dibuka; dalam kes itu ia disimpan sehingga laporan diselesaikan.',
        'Panggilan melalui pelayan media kami yang dihoskan oleh DigitalOcean di Singapura; rakaman disimpan oleh penyedia storan kami (DigitalOcean Spaces atau Supabase Storage).',
      ],
    },
    terms: {
      heading: '5a. Panggilan',
      paragraphs: [
        'Panggilan hanya tersedia apabila kedua-dua pihak membenarkannya dalam sembang. Dengan menghidupkan panggilan, anda bersetuju bahawa semua panggilan anda di Vibely dirakam dan disimpan sehingga 90 hari demi keselamatan, seperti yang diterangkan dalam Dasar Privasi. Jangan gunakan panggilan untuk mengganggu, mengugut, merakam atau mendedahkan sesiapa; rakaman boleh digunakan untuk menguatkuasakan Terma ini.',
      ],
    },
  },
  ru: {
    privacy: {
      heading: '5a. Аудио- и видеозвонки (записываются)',
      paragraphs: [
        'Пользователи с совпадением могут звонить друг другу, только когда оба включили «Разрешить звонки в этом чате». Перед включением мы сообщаем, что звонки записываются, и вы должны это принять. Во время каждого звонка показывается индикатор «Запись».',
        'Все аудио- и видеозвонки записываются на нашем собственном медиасервере в целях безопасности: аудиозвонки — как аудиофайл, видеозвонки — как видеофайл с обоими участниками. Записи хранятся закрыто (без публичного доступа) и никогда не показываются другим пользователям, не используются для рекламы и обучения ИИ.',
        'Открыть запись может только модератор Vibely и только при разборе жалобы между участниками этого звонка. Каждый доступ фиксируется. Записи и сведения о звонках (кто кому звонил, когда и сколько длился звонок) удаляются автоматически через 90 дней, если они не относятся к открытой жалобе; в этом случае они хранятся до её рассмотрения.',
        'Звонки проходят через наш медиасервер у DigitalOcean в Сингапуре; записи хранятся у нашего поставщика хранилища (DigitalOcean Spaces или Supabase Storage).',
      ],
    },
    terms: {
      heading: '5a. Звонки',
      paragraphs: [
        'Звонки доступны, только когда оба собеседника разрешили их в чате. Включая звонки, вы соглашаетесь, что все ваши звонки в Vibely записываются и хранятся до 90 дней в целях безопасности, как описано в Политике конфиденциальности. Не используйте звонки, чтобы оскорблять, угрожать, тайно записывать или разоблачать кого-либо; записи могут использоваться для применения этих Условий.',
      ],
    },
  },
}
