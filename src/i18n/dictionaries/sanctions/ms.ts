import type { SanctionsDictionary, sanctionErrorsEn } from './en'

export const sanctionsMs: SanctionsDictionary = {
  bannedUntil: 'Sekatan tamat pada {date}.',
  bannedForever: 'Sekatan ini tiada tarikh tamat.',
  appealTitle: 'Rayuan',
  appealHint:
    'Jika anda rasa ini satu kesilapan, beritahu kami apa yang berlaku. Moderator akan menyemak rayuan anda.',
  appealLabel: 'Rayuan anda',
  appealPlaceholder: 'Terangkan apa yang berlaku (10 hingga 1000 aksara)',
  appealSend: 'Hantar rayuan',
  appealSent: 'Rayuan anda telah dihantar. Kami akan menyemaknya tidak lama lagi.',
  appealOpen: 'Rayuan anda pada {date} sedang disemak.',
  appealRejected: 'Rayuan terakhir anda telah disemak. Sekatan kekal.',
  warningTitle: 'Amaran daripada moderator',
  warningBody:
    'Akaun anda menerima amaran. Sebab: {reason}. Pelanggaran berulang boleh menyebabkan anda disenyapkan atau disekat.',
  warningUntil: 'Amaran ini aktif sehingga {date}.',
  warningOk: 'Saya faham',
  mutedTitle: 'Anda tidak boleh menghantar mesej buat masa ini',
  mutedBody:
    'Sehingga {date} anda tidak boleh menghantar mesej sembang, mesej sembang rawak, hantaran atau komen. Sebab: {reason}.',
  mutedOk: 'OK',
}

export const sanctionErrorsMs: typeof sanctionErrorsEn = {
  muted: 'Anda tidak boleh menghantar mesej sehingga tempoh senyap tamat.',
  appealOpen: 'Anda sudah mempunyai rayuan yang sedang disemak.',
  appealTooShort: 'Sila tulis sekurang-kurangnya 10 aksara.',
  appealNotBanned: 'Akaun anda tidak disekat.',
}
