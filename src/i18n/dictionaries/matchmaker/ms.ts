import type { IncognitoDictionary, MatchmakerDictionary, MatchmakerErrorsDictionary } from './en'

export const matchmakerMs: MatchmakerDictionary = {
  preview: 'Satu perkenalan',
  introduce: 'Kenalkan kepada kawan',
  sheetTitle: 'Kenalkan {name}',
  sheetHint:
    'Pilih salah seorang padanan anda yang lain. Mereka hanya melihat satu sama lain jika kedua-duanya berminat. "Tidak apa" tidak pernah ditunjukkan kepada sesiapa.',
  search: 'Cari padanan anda',
  loading: 'Memuatkan padanan anda',
  noMatches: 'Anda perlu sekurang-kurangnya satu lagi padanan untuk membuat perkenalan.',
  nothingFound: 'Tiada apa dijumpai',
  noteLabel: 'Nota untuk kedua-duanya (pilihan)',
  notePlaceholder: 'Kenapa mereka akan serasi?',
  noteCount: '{count}/{max}',
  send: 'Hantar perkenalan',
  sent: 'Perkenalan dihantar',
  sentHint:
    '{name} melihatnya dalam sembang anda dahulu. Jika mereka berminat, giliran {other} pula.',
  done: 'Selesai',
  reward: 'Apabila ia berjaya, anda mendapat 7 hari VIP.',
  cardTitle: '{name} mahu mengenalkan anda',
  cardTitleMine: 'Anda mengenalkan {name} kepada {other}',
  cardLoading: 'Memuatkan perkenalan',
  noteFrom: 'Nota daripada {name}',
  interested: 'Berminat',
  noThanks: 'Tidak apa',
  waiting: 'Anda kata ya. Jika {name} juga berminat, sembang akan dibuka untuk anda berdua.',
  matched: 'Padan! Anda dan {name} kini berhubung.',
  openChat: 'Buka sembang',
  closed: 'Anda melepaskan perkenalan ini.',
  pending: 'Menunggu jawapan mereka.',
  matchedMine: 'Mereka berpadanan. Terima kasih atas perkenalan ini!',
  unavailable: 'Perkenalan ini tidak lagi tersedia.',
  pinnedTitle: 'Dikenalkan oleh {name}',
  pinnedTitleAnon: 'Dikenalkan oleh seorang kawan',
  pinnedHint: 'Seorang kawan yang berpadanan dengan anda berdua telah mempertemukan anda.',
  pushIntro: '{name} mahu mengenalkan anda kepada seseorang',
  pushIntroBody: 'Buka sembang untuk melihat siapa.',
  pushWorked: 'Perkenalan anda berjaya',
  pushWorkedBody: '{b} dan {c} kini berpadanan. Anda mendapat 7 hari VIP.',
}

export const matchmakerErrorsMs: MatchmakerErrorsDictionary = {
  referralExists: 'Mereka berdua sudah dikenalkan baru-baru ini.',
  referralUnavailable: 'Perkenalan ini tidak dapat dibuat sekarang.',
  noteTooLong: 'Nota terlalu panjang (maksimum 200 aksara)',
}

export const incognitoMs: IncognitoDictionary = {
  setting: 'Mod inkognito',
  settingHint: 'Hanya orang yang anda suka boleh melihat anda dalam Teroka.',
  sheetTitle: 'Mod inkognito',
  sheetIntro: 'Hanya orang yang anda suka boleh melihat anda.',
  sheetPoints: [
    'Dalam Teroka anda hanya muncul kepada orang yang anda sudah suka.',
    'Anda disembunyikan daripada carian nama pengguna, selisih jalan dan "Siapa suka anda".',
    'Apabila seseorang yang anda suka turut menyukai anda, ia padanan seperti biasa.',
  ],
  sheetNote:
    'Padanan, sembang, kiriman suapan dan temu janji buta anda berfungsi seperti biasa. Matikan bila-bila masa.',
  turnOn: 'Hidupkan inkognito',
  notNow: 'Bukan sekarang',
}
