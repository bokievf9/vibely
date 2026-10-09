import type { promoEn, promoErrorsEn } from './en'

export const promoMs: typeof promoEn = {
  section: 'Kod promo',
  row: 'Masukkan kod promo',
  rowHint: 'Kod daripada acara, kumpulan kampus dan rakan kongsi membuka ciri VIP.',
  vipUntil: 'VIP sehingga {date}',
  boostUntil: 'Dipaparkan dahulu di Discover sehingga {date}',
  pendingHint: 'Ciri anda diaktifkan sebaik sahaja swafoto anda diluluskan.',
  haveCode: 'Ada kod promo?',
  optional: 'Pilihan',
  title: 'Kod promo',
  label: 'Kod',
  placeholder: 'cth. XMUM2026',
  intro: 'Masukkan kod seperti yang anda terima. Huruf besar atau kecil tidak penting.',
  apply: 'Guna',
  grantedTitle: 'Anda kini VIP',
  pendingTitle: 'Kod diterima',
  pendingBody:
    'Kod {code} disimpan untuk anda. Ciri diaktifkan sebaik sahaja swafoto anda diluluskan.',
  grantedBody: 'Kod {code} digunakan. Inilah yang anda dapat:',
  perkVipDate: 'Lencana VIP di sebelah nama anda sehingga {date}',
  perkVipDays: 'Lencana VIP di sebelah nama anda selama {days} hari',
  perkBoostDate: 'Profil anda dipaparkan dahulu di Discover sehingga {date}',
  perkBoostHours: 'Profil anda dipaparkan dahulu di Discover selama {hours} jam',
  perkSeeLikes: 'Lihat siapa yang menyukai anda',
  perkQueue: 'Keutamaan dalam barisan Temu Janji Buta',
  nonTransferable: 'Ciri adalah peribadi dan tidak boleh dipindahkan. Lihat Syarat Penggunaan.',
  done: 'Selesai',
  badge: 'VIP',
}

export const promoErrorsMs: typeof promoErrorsEn = {
  promoInvalid: 'Kod ini tidak wujud. Semak ejaan.',
  promoExpired: 'Kod ini telah tamat tempoh.',
  promoUsedUp: 'Kod ini telah habis digunakan.',
  promoNotForYou: 'Kod ini tidak tersedia untuk profil anda.',
  promoAlreadyRedeemed: 'Anda telah menggunakan kod ini.',
  promoTooManyAttempts: 'Terlalu banyak cubaan. Cuba lagi dalam sejam.',
  promoFormat: 'Hanya huruf, nombor, _ dan - (3 hingga 32 aksara).',
}
