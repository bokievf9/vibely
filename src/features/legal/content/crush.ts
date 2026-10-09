import type { Locale } from '@/i18n/config'
import type { LegalSection } from './types'

// Secret crush: the crush flag on an invite link and secret likes from a profile page. Kept in
// its own file and inserted into each locale as one delimited section, like ./nearby.ts.
// Draft: MUST be reviewed by a Malaysian lawyer (PDPA 2010) before launch.
export const crushLegal: Record<Locale, { privacy: LegalSection }> = {
  en: {
    privacy: {
      heading: '5c. Secret crush and secret likes',
      paragraphs: [
        'When you share an invite link, you can mark it as a crush link ("I have a crush on this person"). The only thing we store is that flag on your single-use invite link. We never ask for, collect or store the phone number, email address or name of the person you send it to: you share the link yourself, in whatever app you choose. You can create at most 3 crush links every 30 days.',
        'If that person signs up through your link and is verified, they are shown once that the person who invited them has a crush on them, with your name, age and first photo, and can answer yes or no. Their answer is private: you only find out if they say yes and you are both looking for each other, which creates a match like a mutual like. If they say no, close the card, or you are not looking for each other, nothing is revealed to you; as with any invite, you only see that your link was used. The answer is deleted with the invite or the account.',
        'When you like a profile you opened from people search or Crossed paths, the other person is not told. They see your like only in "Who liked you", exactly like a like in Discover, and a match is created only if they like you back.',
      ],
    },
  },
  ms: {
    privacy: {
      heading: '5c. Crush rahsia dan suka rahsia',
      paragraphs: [
        'Apabila anda berkongsi pautan jemputan, anda boleh menandakannya sebagai pautan crush ("Saya ada crush pada orang ini"). Satu-satunya perkara yang kami simpan ialah tanda itu pada pautan jemputan sekali guna anda. Kami tidak pernah meminta, mengumpul atau menyimpan nombor telefon, alamat e-mel atau nama orang yang anda hantar pautan itu: anda sendiri berkongsi pautan itu dalam mana-mana aplikasi pilihan anda. Anda boleh membuat paling banyak 3 pautan crush setiap 30 hari.',
        'Jika orang itu mendaftar melalui pautan anda dan disahkan, dia akan ditunjukkan sekali sahaja bahawa orang yang menjemputnya ada crush padanya, dengan nama, umur dan foto pertama anda, dan boleh menjawab ya atau tidak. Jawapannya adalah peribadi: anda hanya akan tahu jika dia menjawab ya dan anda berdua saling mencari, yang mewujudkan padanan seperti suka bersama. Jika dia menjawab tidak, menutup kad itu, atau anda berdua tidak saling mencari, tiada apa yang didedahkan kepada anda; seperti mana-mana jemputan, anda hanya melihat bahawa pautan anda telah digunakan. Jawapan itu dipadam bersama jemputan atau akaun.',
        'Apabila anda menyukai profil yang anda buka daripada carian orang atau Selisih jalan, orang itu tidak diberitahu. Dia hanya melihat suka anda dalam "Siapa suka anda", sama seperti suka dalam Teroka, dan padanan hanya diwujudkan jika dia juga menyukai anda.',
      ],
    },
  },
  ru: {
    privacy: {
      heading: '5c. Тайная симпатия и тайные лайки',
      paragraphs: [
        'Делясь ссылкой-приглашением, вы можете отметить её как ссылку с симпатией («Мне нравится этот человек»). Мы храним только эту отметку на вашей одноразовой ссылке-приглашении. Мы никогда не запрашиваем, не собираем и не храним номер телефона, адрес электронной почты или имя человека, которому вы её отправляете: вы сами делитесь ссылкой в любом удобном приложении. Можно создать не более 3 таких ссылок за 30 дней.',
        'Если этот человек зарегистрируется по вашей ссылке и пройдёт проверку, ему один раз покажут, что пригласивший его человек испытывает к нему симпатию, с вашим именем, возрастом и первой фотографией, и он сможет ответить да или нет. Его ответ приватен: вы узнаете о нём, только если он ответит да и вы оба ищете друг друга, тогда возникает мэтч, как при взаимном лайке. Если он ответит нет, закроет карточку или вы не подходите друг другу по предпочтениям, вам ничего не сообщается; как и при любом приглашении, вы видите только, что ссылкой воспользовались. Ответ удаляется вместе с приглашением или аккаунтом.',
        'Когда вы ставите лайк профилю, открытому из поиска людей или «Пересечений», этому человеку ничего не сообщается. Он увидит ваш лайк только в разделе «Кому вы понравились», ровно как лайк в Знакомствах, а мэтч возникает только при взаимном лайке.',
      ],
    },
  },
}
