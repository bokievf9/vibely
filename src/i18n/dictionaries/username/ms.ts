import type { UsernameDictionary, usernameErrorsEn } from './en'

export const usernameMs: UsernameDictionary = {
  label: 'Nama pengguna',
  rules: '3-20 aksara: huruf a-z, nombor, titik dan garis bawah.',
  suggested: 'Kami pilih satu daripada nama anda. Anda boleh tukar sekarang atau kemudian.',
  checking: 'Menyemak…',
  available: '@{username} tersedia',
  current: 'Ini nama pengguna anda',
  taken: '@{username} sudah diambil',
  invalid:
    'Gunakan 3-20 aksara: a-z, 0-9, titik atau garis bawah. Tiada titik di awal atau akhir, tiada dua titik berturut-turut.',
  reserved: 'Nama pengguna ini dikhaskan',
  checkFailed: 'Tidak dapat menyemak nama pengguna ini. Cuba lagi.',
  section: 'Nama pengguna',
  change: 'Tukar',
  changeTitle: 'Tukar nama pengguna',
  save: 'Simpan',
  saved: 'Nama pengguna disimpan',
  onceIn30Days: 'Anda boleh menukar nama pengguna sekali setiap 30 hari.',
  nextChange: 'Anda boleh menukarnya lagi pada {date}.',
  findMe: 'Cari saya melalui nama pengguna',
  findMeHint:
    'Orang lain boleh mencari anda melalui @nama pengguna atau nama dalam carian. Profil yang dijeda tidak akan muncul.',
  searchTitle: 'Carian',
  searchOpen: 'Cari orang',
  searchLabel: 'Cari melalui @nama pengguna atau nama',
  searchPlaceholder: '@nama pengguna atau nama',
  searchHint:
    'Taip sekurang-kurangnya 2 aksara untuk mencari orang yang disahkan melalui @nama pengguna atau nama.',
  searchEmpty: 'Tiada sesiapa dijumpai',
  searchEmptyHint: 'Semak ejaan. Sesetengah orang mematikan carian melalui nama pengguna.',
  searchFailed: 'Carian tidak tersedia buat masa ini.',
  retry: 'Cuba lagi',
  clear: 'Kosongkan carian',
  results: 'Hasil carian',
  openProfile: 'Buka profil {name}',
  backToSearch: 'Kembali ke carian',
  like: 'Suka',
  liked: 'Disukai',
  likedHint: 'Jika dia juga suka anda, ia padanan dan sembang akan dibuka.',
}

export const usernameErrorsMs: typeof usernameErrorsEn = {
  usernameInvalid:
    'Gunakan 3-20 aksara: a-z, 0-9, titik atau garis bawah. Tiada titik di awal atau akhir, tiada dua titik berturut-turut.',
  usernameReserved: 'Nama pengguna ini dikhaskan',
  usernameTaken: 'Nama pengguna ini sudah diambil',
  usernameCooldown: 'Anda boleh menukar nama pengguna sekali setiap 30 hari',
}
