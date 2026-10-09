import type { LikesDictionary, SettingsDictionary } from './en'

export const settingsMs: SettingsDictionary = {
  title: 'Tetapan',
  open: 'Tetapan',
  notifications: 'Pemberitahuan',
  notifyTypesHint: 'Perkara yang kami maklumkan (apabila pemberitahuan tolak dihidupkan).',
  notifyTypes: {
    new_matches: 'Padanan baharu',
    messages: 'Mesej',
    likes: 'Seseorang menyukai anda',
    feed_replies: 'Balasan dalam suapan',
    random_reveal: 'Padanan temu janji buta',
    new_people: 'Orang baharu berdekatan',
    calls: 'Panggilan masuk',
    crush: 'Orang yang anda sukai membalas',
  },
  privacy: 'Privasi',
  pause: 'Jeda profil saya',
  pauseHint:
    'Anda tidak akan muncul dalam Teroka atau “Siapa suka anda”. Padanan dan sembang anda kekal. Temu janji buta hanya memadankan anda apabila anda sendiri mencari.',
  blocked: 'Pengguna yang disekat',
  blockedEmpty: 'Anda belum menyekat sesiapa.',
  blockedEmptyHint:
    'Apabila anda menyekat seseorang dari sembang atau profil, mereka akan muncul di sini.',
  unblock: 'Nyahsekat',
  unblockConfirm:
    'Nyahsekat {name}? Anda akan dapat melihat satu sama lain semula. Padanan yang telah dibuang tidak dipulihkan.',
  feedReplyPush: 'Balasan baharu pada hantaran anda',
  feedReplyPushBody: 'Buka suapan untuk membacanya.',
  account: 'Akaun',
}

export const likesMs: LikesDictionary = {
  title: 'Siapa suka anda',
  open: 'Siapa suka anda: {count}',
  hint: 'Mereka sudah suka anda. Suka balik untuk padanan serta-merta.',
  empty: 'Belum ada suka baharu',
  emptyHint: 'Apabila seseorang suka anda, mereka muncul di sini. Teruskan swipe!',
  likeBack: 'Suka balik',
  pass: 'Langkau',
  view: 'Lihat {name}',
  lockedTitle: '{count} orang suka anda',
  lockedHint: 'Teruskan swipe: apabila anda juga suka mereka, ia satu padanan.',
  pushTitle: 'Seseorang suka anda di Vibely 💘',
  pushBody: 'Buka Vibely untuk melihat siapa.',
  pushBodyLocked: 'Teruskan swipe: mungkin ia satu padanan!',
}
