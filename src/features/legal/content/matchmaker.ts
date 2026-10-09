import type { Locale } from '@/i18n/config'
import type { LegalSection } from './types'

// Matchmaker (introductions between two of your matches) and Incognito mode. Kept in its own
// file and inserted into each locale as one delimited section, like ./nearby.ts.
// Draft: MUST be reviewed by a Malaysian lawyer (PDPA 2010) before launch.
export const matchmakerLegal: Record<Locale, { privacy: LegalSection }> = {
  en: {
    privacy: {
      heading: '5c. Introductions by friends and Incognito mode',
      paragraphs: [
        'Introductions: a user may introduce two of their own matches to each other. The first person sees the other person\'s first photo, first name and age, together with the introducer\'s note. The second person sees the same only after the first person said they are interested. A "No thanks" is never shown to anyone, including the introducer. If both are interested, a regular match is created and the note is shown as the first message of that chat; the introducer learns only that the introduction worked.',
        'An introduction is possible only between people who are matched with the introducer, who have not blocked each other, and at most 5 times a day per user. The same two people cannot be introduced again for 90 days. A block between any of the three people cancels the introduction. Introductions and their notes are deleted after 90 days.',
        'Incognito mode is off unless you turn it on in Settings. While it is on, your profile is shown in Discover only to people you have liked, and you do not appear in username search, in Crossed paths or in "Who liked you". Your existing matches, chats, feed posts and blind dates are not affected. You can turn it off at any time.',
      ],
    },
  },
  ms: {
    privacy: {
      heading: '5c. Perkenalan oleh kawan dan Mod inkognito',
      paragraphs: [
        'Perkenalan: pengguna boleh mengenalkan dua padanan mereka sendiri antara satu sama lain. Orang pertama melihat foto pertama, nama pertama dan umur orang kedua, bersama nota daripada pengenal. Orang kedua melihat perkara yang sama hanya selepas orang pertama menyatakan minat. "Tidak apa" tidak pernah ditunjukkan kepada sesiapa, termasuk pengenal. Jika kedua-duanya berminat, padanan biasa dibuat dan nota dipaparkan sebagai mesej pertama sembang itu; pengenal hanya tahu bahawa perkenalan itu berjaya.',
        'Perkenalan hanya boleh dibuat antara orang yang berpadanan dengan pengenal, yang tidak menyekat satu sama lain, dan paling banyak 5 kali sehari bagi setiap pengguna. Dua orang yang sama tidak boleh dikenalkan semula selama 90 hari. Sekatan antara mana-mana tiga orang itu membatalkan perkenalan. Perkenalan dan notanya dipadam selepas 90 hari.',
        'Mod inkognito dimatikan kecuali anda menghidupkannya dalam Tetapan. Semasa ia hidup, profil anda dipaparkan dalam Teroka hanya kepada orang yang anda suka, dan anda tidak muncul dalam carian nama pengguna, dalam Selisih jalan atau dalam "Siapa suka anda". Padanan, sembang, kiriman suapan dan temu janji buta anda yang sedia ada tidak terjejas. Anda boleh mematikannya bila-bila masa.',
      ],
    },
  },
  ru: {
    privacy: {
      heading: '5c. Знакомства через друзей и режим инкогнито',
      paragraphs: [
        'Знакомства: пользователь может познакомить двух своих мэтчей друг с другом. Первый человек видит первое фото, имя и возраст второго, а также записку того, кто знакомит. Второй видит то же самое только после того, как первый ответил, что ему интересно. Отказ никогда никому не показывается, в том числе тому, кто знакомит. Если заинтересованы оба, создаётся обычный мэтч, а записка показывается первым сообщением в этом чате; тот, кто знакомил, узнаёт только то, что знакомство состоялось.',
        'Познакомить можно только людей, у которых есть мэтч с тем, кто знакомит, которые не блокировали друг друга, и не более 5 раз в день на пользователя. Одних и тех же двух людей нельзя познакомить повторно в течение 90 дней. Блокировка между любыми из троих отменяет знакомство. Знакомства и записки к ним удаляются через 90 дней.',
        'Режим инкогнито выключен, пока вы не включите его в Настройках. Пока он включён, ваш профиль показывается в разделе Знакомства только тем, кого вы лайкнули, и вы не появляетесь в поиске по имени пользователя, в «Пересечениях» и в «Кто вас лайкнул». Ваши существующие мэтчи, чаты, посты в ленте и свидания вслепую не затрагиваются. Выключить его можно в любой момент.',
      ],
    },
  },
}
