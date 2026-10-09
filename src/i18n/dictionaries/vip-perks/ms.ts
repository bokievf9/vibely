import type { vipPerksEn, vipPerksErrorsEn } from './en'

export const vipPerksMs: typeof vipPerksEn = {
  vip: 'VIP',
  receipts: {
    setting: 'Hantar resit baca',
    hint: 'Apabila dimatikan, tiada sesiapa melihat bila anda membaca mesej mereka, dan anda juga tidak melihat bila mereka membaca mesej anda.',
    vipHint: 'VIP menunjukkan bila mesej anda dibaca.',
  },
  visitors: {
    title: 'Siapa melihat anda',
    entry: 'Siapa melihat profil anda',
    entryHint: '30 hari lepas',
    countOne: '1 orang melihat profil anda dalam 30 hari lepas',
    countMany: '{count} orang melihat profil anda dalam 30 hari lepas',
    empty: 'Belum ada lawatan',
    emptyHint: 'Apabila seseorang membuka profil anda, mereka dipaparkan di sini selama 30 hari.',
    lockedTitle: 'Lihat siapa melihat profil anda',
    lockedText:
      'VIP menunjukkan semua orang yang membuka profil anda dalam 30 hari lepas, supaya anda boleh menyukai mereka kembali.',
    viewedToday: 'Dilihat hari ini',
    viewedYesterday: 'Dilihat semalam',
    viewedDaysAgo: 'Dilihat {days} hari lalu',
    liked: 'Anda menyukai mereka',
    incognitoHint: 'Lawatan anda juga direkodkan. Mod Inkognito merahsiakannya.',
  },
  note: {
    button: 'Suka dengan nota',
    title: 'Suka dengan nota',
    intro: 'Tegur sebelum padanan. Nota anda sampai bersama suka anda.',
    placeholder: 'Tulis sesuatu yang baik dan khusus',
    counter: '{count}/200',
    quota: 'Satu nota sehari',
    riskHint:
      'Nota yang mengandungi nombor telefon, pautan, aplikasi lain atau hal wang akan ditahan dan tidak dipaparkan.',
    send: 'Hantar suka',
    sentTitle: 'Suka dihantar bersama nota anda',
    sentHint: 'Jika mereka menyukai anda kembali, nota anda membuka sembang.',
    heldHint:
      'Suka anda telah dihantar. Nota sedang disemak dan tidak akan dipaparkan buat masa ini.',
    yours: 'Nota anda',
    from: 'Nota daripada {name}',
    report: 'Laporkan nota',
    reportNote:
      'Moderator akan melihat nota ini. Ia hilang daripada senarai suka anda serta-merta.',
  },
}

export const vipPerksErrorsMs: typeof vipPerksErrorsEn = {
  noteLimitReached: 'Anda sudah menggunakan nota hari ini. Cuba lagi esok.',
  noteAlreadySent: 'Anda sudah menghantar nota kepada orang ini.',
  noteUnavailable: 'Anda tidak lagi boleh menghantar nota kepada orang ini.',
  noteTooLong: 'Maksimum 200 aksara',
}
