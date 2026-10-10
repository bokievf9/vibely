import type { PaymentsDictionary, paymentErrorsEn } from './en'

export const paymentsMs: PaymentsDictionary = {
  buy: 'Dapatkan {plan}',
  buyTest: 'Dapatkan {plan} (ujian)',
  testMode: 'Mod ujian untuk pasukan: tiada bayaran sebenar diambil.',
  draftPrice: 'Harga draf, hanya kelihatan kepada pasukan',
  legalLive: 'Bayaran sekali untuk tempoh yang anda pilih. Ia tidak diperbaharui secara automatik.',
  periods: { m1: '1 bulan', m3: '3 bulan', m12: '12 bulan' },
  planPeriod: '{plan}, {period}',
  statuses: {
    pending: 'Belum selesai',
    paid: 'Dibayar',
    failed: 'Gagal',
    refunded: 'Dikembalikan',
    cancelled: 'Dibatalkan',
    expired: 'Tamat tempoh',
  },
  history: {
    section: 'Bayaran',
    title: 'Sejarah bayaran',
    hint: 'Pembelian pelan anda',
    empty: 'Belum ada bayaran.',
    test: 'Ujian',
  },
  return: {
    title: 'Bayaran',
    pending: 'Menunggu pengesahan',
    pendingBody:
      'Penyedia pembayaran sedang mengesahkan bayaran anda. Biasanya ini mengambil masa beberapa saat. Anda boleh tinggalkan halaman ini: pelan anda aktif sebaik sahaja ia disahkan.',
    slow: 'Masih menunggu. Semak Sejarah bayaran dalam Tetapan beberapa minit lagi.',
    paid: 'Bayaran diterima',
    paidBody: 'Vibely {plan} kini milik anda. Selamat menikmati!',
    failed: 'Bayaran tidak berjaya',
    failedBody: 'Bayaran tidak selesai. Anda boleh cuba lagi dari halaman Pelan.',
    cancelled: 'Pembayaran dibatalkan',
    cancelledBody: 'Tiada apa-apa dibeli. Anda boleh mula semula dari halaman Pelan.',
    refunded: 'Bayaran ini telah dikembalikan',
    refundedBody: 'Pelan daripada bayaran ini telah tamat.',
    notFound: 'Kami tidak menemui bayaran ini.',
    toPlans: 'Kembali ke Pelan',
    toHistory: 'Sejarah bayaran',
  },
  test: {
    title: 'Pembayaran ujian',
    body: 'Untuk pasukan sahaja. Halaman ini menggantikan penyedia pembayaran: tiada caj dan tiada butiran kad diminta.',
    amount: 'Jumlah',
    pay: 'Bayar (ujian)',
    fail: 'Gagal (ujian)',
    unavailable: 'Pembayaran ujian tidak tersedia.',
    done: 'Pesanan ini tidak lagi menunggu bayaran.',
  },
}

export const paymentErrorsMs: typeof paymentErrorsEn = {
  paymentsUnavailable: 'Pembayaran belum tersedia.',
  priceUnavailable: 'Pelan ini tidak boleh dibeli sekarang.',
  checkoutFailed: 'Kami tidak dapat membuka pembayaran. Sila cuba lagi.',
}
