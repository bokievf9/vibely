import type { EventsDictionary, eventErrorsEn } from './en'

export const eventsMs: EventsDictionary = {
  kicker: 'Malam Temu Janji Buta',
  startsIn: 'Bermula {time}',
  in: 'dalam {time}',
  days: '{n} hari',
  hours: '{n} jam',
  minutes: '{n} min',
  startingNow: 'bermula sekarang',
  liveNow: 'Sedang berlangsung',
  inRoom: '{count} orang di dalam bilik',
  inRoomOne: '1 orang di dalam bilik',
  inRoomNone: 'Jadilah yang pertama di dalam bilik',
  remind: 'Ingatkan saya',
  reminded: 'Kami akan ingatkan anda 15 minit sebelum ia bermula.',
  enter: 'Masuk',
  hide: 'Sembunyi',
  youAreIn: 'Anda di dalam: {title}',
  relaxedFilters:
    'Malam ini kami memadankan mengikut jantina sahaja, dengan julat umur yang luas (lebih kurang 10 tahun ke atas dan ke bawah umur anda). Minat tidak ditapis.',
  waitingHint: 'Tunggu sebentar, orang seterusnya sedang datang.',
  leave: 'Tinggalkan malam ini',
  nextSoon: 'Mencari orang seterusnya...',
  endedTitle: 'Malam ini telah tamat',
  endedText: 'Terima kasih kerana hadir. Temu janji buta dibuka setiap hari.',
  endedButton: 'Kembali ke temu janji buta',
  pushSoonTitle: '{title} bermula dalam 15 minit',
  pushSoonBody: 'Bersedia untuk Malam Temu Janji Buta di Vibely.',
  pushLiveTitle: '{title} sedang berlangsung',
  pushLiveBody: 'Masuk ke bilik dan kenali seseorang yang baharu.',
}

export const eventErrorsMs: typeof eventErrorsEn = {
  eventNotLive: 'Malam ini telah tamat. Temu janji buta masih dibuka.',
}
