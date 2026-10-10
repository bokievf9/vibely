import type { Locale } from '@/i18n/config'
import type { LegalSection } from './types'

// Early access waitlist on the landing page (20261009000300). Own file like ./crush.ts, inserted
// into each locale's privacy policy as one delimited section. The landing form links here
// (#waitlist). Draft: MUST be reviewed by a Malaysian lawyer (PDPA 2010) before launch.
export const waitlistLegal: Record<Locale, { privacy: LegalSection }> = {
  en: {
    privacy: {
      id: 'waitlist',
      heading: '5j. Early access waitlist',
      paragraphs: [
        'Before sign-up opens, you can join our early access waitlist on vibelydate.com. We store your Malaysian mobile number, the city you chose (optional), your language, the page you joined from and the time you gave your consent. We use this only to send you one invite by SMS when your spot opens and to plan which cities open first. We do not use it for advertising and we do not share it with anyone except the SMS provider that delivers the invite.',
        'The list is not visible to other users. Our team sees numbers masked (for example +60 •••• 4567); only admins can see full numbers to send invites, and every export is logged. We delete your number 90 days after we send your invite. You can ask us to remove it sooner by writing to privacy@vibelydate.com from any address and telling us the number.',
        'To protect the form from bots, we may check your browser with Cloudflare Turnstile, and we limit how often a number can be submitted. We keep a one-way code of the number (not the number itself) for up to 1 day for these limits.',
      ],
    },
  },
  ms: {
    privacy: {
      id: 'waitlist',
      heading: '5j. Senarai menunggu akses awal',
      paragraphs: [
        'Sebelum pendaftaran dibuka, anda boleh menyertai senarai menunggu akses awal kami di vibelydate.com. Kami menyimpan nombor telefon bimbit Malaysia anda, bandar yang anda pilih (pilihan), bahasa anda, halaman tempat anda mendaftar dan masa anda memberi persetujuan. Kami menggunakan maklumat ini hanya untuk menghantar satu jemputan melalui SMS apabila giliran anda tiba dan untuk merancang bandar mana yang dibuka dahulu. Kami tidak menggunakannya untuk iklan dan tidak berkongsinya dengan sesiapa kecuali penyedia SMS yang menghantar jemputan itu.',
        'Senarai ini tidak kelihatan kepada pengguna lain. Pasukan kami melihat nombor yang disembunyikan sebahagiannya (contohnya +60 •••• 4567); hanya pentadbir boleh melihat nombor penuh untuk menghantar jemputan, dan setiap eksport direkodkan. Kami memadam nombor anda 90 hari selepas jemputan dihantar. Anda boleh meminta kami memadamnya lebih awal dengan menulis kepada privacy@vibelydate.com dari mana-mana alamat dan memberitahu nombor itu.',
        'Untuk melindungi borang daripada bot, kami mungkin menyemak pelayar anda dengan Cloudflare Turnstile, dan kami mengehadkan kekerapan sesuatu nombor boleh dihantar. Untuk had ini, kami menyimpan kod sehala bagi nombor itu (bukan nombor itu sendiri) selama paling lama 1 hari.',
      ],
    },
  },
  ru: {
    privacy: {
      id: 'waitlist',
      heading: '5j. Лист ожидания раннего доступа',
      paragraphs: [
        'Пока регистрация закрыта, вы можете записаться в лист ожидания раннего доступа на vibelydate.com. Мы храним ваш малайзийский мобильный номер, выбранный город (по желанию), язык, страницу, с которой вы записались, и время, когда вы дали согласие. Мы используем эти данные только для того, чтобы отправить вам одно приглашение по SMS, когда подойдёт ваша очередь, и чтобы решить, в каких городах открываться первыми. Мы не используем их для рекламы и никому не передаём, кроме SMS-провайдера, который доставляет приглашение.',
        'Список не виден другим пользователям. Наша команда видит номера в скрытом виде (например, +60 •••• 4567); полный номер видят только администраторы, чтобы отправить приглашения, и каждая выгрузка записывается в журнал. Мы удаляем ваш номер через 90 дней после отправки приглашения. Вы можете попросить удалить его раньше: напишите на privacy@vibelydate.com с любого адреса и укажите номер.',
        'Чтобы защитить форму от ботов, мы можем проверить ваш браузер с помощью Cloudflare Turnstile и ограничиваем, как часто можно отправить один номер. Для этих ограничений мы храним односторонний код номера (а не сам номер) не дольше 1 дня.',
      ],
    },
  },
}
