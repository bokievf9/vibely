import type { Locale } from '@/i18n/config'
import type { LegalSection } from './types'

// Crossed paths (opt-in coarse location history) and Plans (24-hour intents). Kept in its own
// file and inserted into each locale as one delimited section, like ./calls.ts.
// Draft: MUST be reviewed by a Malaysian lawyer (PDPA 2010) before launch, in particular the
// consent wording for location history.
export const nearbyLegal: Record<Locale, { privacy: LegalSection }> = {
  en: {
    privacy: {
      heading: '5b. Crossed paths and Plans',
      paragraphs: [
        'Crossed paths is off unless you turn it on in Settings or Discover, after we explain how it works. It shows people you were near during the day, and only between two people who both turned it on. You can turn it off at any time.',
        'While it is on and the app is open on your screen, your device sends its location to us at most every 10 minutes, and only if you already allowed location access. Nothing is sent in the background. We immediately reduce each location to an area of about 1 km, the day and the hour, plus whether it was night time. We do not store the exact location or coordinates of these pings.',
        'Areas where you are at night or where you spend most of your time (such as home or work) are ignored. Other people never see an exact place or time: only a count, "today" or "yesterday", and the name of a neighbourhood or city from our own list, for example "Crossed paths 2 times today near Bangsar". Encounters are shown only a few hours after they happen. Blocked, hidden, paused and banned people never appear.',
        'This location history is deleted automatically after 48 hours, and all of it is deleted at once when you turn Crossed paths off or delete your account. It is not used for ads, sold or shared with anyone.',
        'Plans: you can pick one plan from a fixed list (for example "Coffee buddy"). It is shown on your profile to other verified users for 24 hours and can be used to show people with the same plan first in Discover. It is deleted when it expires or when you clear it.',
      ],
    },
  },
  ms: {
    privacy: {
      heading: '5b. Selisih jalan dan Rancangan',
      paragraphs: [
        'Selisih jalan dimatikan kecuali anda menghidupkannya dalam Tetapan atau Teroka, selepas kami menerangkan cara ia berfungsi. Ia menunjukkan orang yang berada berdekatan dengan anda pada hari itu, dan hanya antara dua orang yang kedua-duanya menghidupkannya. Anda boleh mematikannya bila-bila masa.',
        'Semasa ia hidup dan aplikasi dibuka pada skrin anda, peranti anda menghantar lokasinya kepada kami paling kerap setiap 10 minit, dan hanya jika anda sudah membenarkan akses lokasi. Tiada apa yang dihantar di latar belakang. Kami segera mengecilkan setiap lokasi kepada kawasan kira-kira 1 km, hari dan jam, serta sama ada ia waktu malam. Kami tidak menyimpan lokasi tepat atau koordinat ping ini.',
        'Kawasan tempat anda berada pada waktu malam atau paling banyak menghabiskan masa (seperti rumah atau tempat kerja) diabaikan. Orang lain tidak pernah melihat tempat atau masa yang tepat: hanya bilangan, "hari ini" atau "semalam", dan nama kawasan kejiranan atau bandar daripada senarai kami sendiri, contohnya "Berselisih jalan 2 kali hari ini berhampiran Bangsar". Pertemuan hanya dipaparkan beberapa jam selepas ia berlaku. Orang yang disekat, disembunyikan, dijeda dan diharamkan tidak pernah muncul.',
        'Sejarah lokasi ini dipadam secara automatik selepas 48 jam, dan semuanya dipadam serta-merta apabila anda mematikan Selisih jalan atau memadam akaun anda. Ia tidak digunakan untuk iklan, dijual atau dikongsi dengan sesiapa.',
        'Rancangan: anda boleh memilih satu rancangan daripada senarai tetap (contohnya "Kawan minum kopi"). Ia dipaparkan pada profil anda kepada pengguna disahkan lain selama 24 jam dan boleh digunakan untuk memaparkan orang dengan rancangan sama dahulu dalam Teroka. Ia dipadam apabila tamat tempoh atau apabila anda memadamnya.',
      ],
    },
  },
  ru: {
    privacy: {
      heading: '5b. Пересечения и Планы',
      paragraphs: [
        'Функция «Пересечения» выключена, пока вы сами не включите её в Настройках или в разделе Знакомства, после того как мы объясним, как она работает. Она показывает людей, рядом с которыми вы были в течение дня, и только между двумя людьми, которые оба её включили. Выключить её можно в любой момент.',
        'Пока функция включена и приложение открыто на экране, устройство отправляет нам местоположение не чаще раза в 10 минут и только если вы уже разрешили доступ к геолокации. В фоне ничего не отправляется. Мы сразу огрубляем каждое местоположение до района примерно 1 км, дня и часа, а также отмечаем, было ли это ночью. Точное местоположение и координаты этих отметок не хранятся.',
        'Районы, где вы бываете ночью или проводите больше всего времени (например, дом или работа), не учитываются. Другие люди никогда не видят точное место или время: только количество, «сегодня» или «вчера» и название района или города из нашего собственного списка, например «Пересеклись 2 раза сегодня в районе Bangsar». Пересечения показываются только спустя несколько часов. Заблокированные, скрытые, приостановленные и забаненные профили не показываются.',
        'Эта история местоположений автоматически удаляется через 48 часов и полностью удаляется сразу, как только вы выключите «Пересечения» или удалите аккаунт. Она не используется для рекламы, не продаётся и никому не передаётся.',
        'Планы: вы можете выбрать один план из фиксированного списка (например, «Выпить кофе»). Он виден другим верифицированным пользователям в вашем профиле 24 часа и может использоваться, чтобы показывать людей с таким же планом первыми в разделе Знакомства. План удаляется, когда истекает срок или когда вы его убираете.',
      ],
    },
  },
}
