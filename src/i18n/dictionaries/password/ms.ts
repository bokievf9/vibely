import type { passwordErrorsEn, PasswordDictionary } from './en'

export const passwordMs: PasswordDictionary = {
  methods: 'Cara log masuk',
  tabPhone: 'Telefon',
  tabUsername: 'Nama pengguna',
  usernameLabel: 'Nama pengguna',
  usernamePlaceholder: '@namapengguna',
  passwordLabel: 'Kata laluan',
  show: 'Tunjukkan kata laluan',
  hide: 'Sembunyikan kata laluan',
  signIn: 'Log masuk',
  usernameNote: 'Baru di Vibely? Cipta akaun anda dengan nombor telefon dahulu.',
  forgot: 'Lupa kata laluan?',
  forgotTitle: 'Lupa kata laluan?',
  forgotBody:
    'Log masuk dengan nombor telefon dan kod SMS. Kemudian buka Tetapan, Kata laluan log masuk, dan tetapkan kata laluan baharu.',
  forgotAction: 'Log masuk dengan telefon',
  section: 'Kata laluan log masuk',
  statusOn: 'Kata laluan aktif',
  statusOff: 'Tiada kata laluan',
  hintOn: 'Anda boleh log masuk dengan @{username} dan kata laluan, atau dengan kod SMS.',
  hintOff:
    'Tambah kata laluan untuk log masuk dengan @{username} tanpa menunggu SMS. Kod SMS tetap boleh digunakan.',
  set: 'Tetapkan kata laluan',
  change: 'Tukar',
  remove: 'Buang kata laluan',
  setTitle: 'Tetapkan kata laluan',
  changeTitle: 'Tukar kata laluan',
  verifyIntro:
    'Untuk keselamatan akaun anda, sahkan bahawa ini anda dahulu. Kami akan menghantar kod SMS ke {phone}.',
  sendCode: 'Hantar kod',
  codeLabel: 'Kod SMS',
  codeHint: 'Masukkan kod 6 digit yang kami hantar ke {phone}.',
  verify: 'Sahkan',
  resend: 'Hantar kod baharu',
  newLabel: 'Kata laluan baharu',
  repeatLabel: 'Ulang kata laluan',
  rules:
    'Sekurang-kurangnya 10 aksara. Jangan guna nama pengguna atau nombor telefon anda. Beberapa perkataan rawak adalah pilihan yang baik.',
  strength: 'Kekuatan: {level}',
  levels: ['sangat lemah', 'lemah', 'sederhana', 'baik', 'kuat'],
  save: 'Simpan kata laluan',
  saved: 'Kata laluan disimpan. Peranti anda yang lain telah dilog keluar.',
  removeTitle: 'Buang kata laluan?',
  removeBody:
    'Anda hanya boleh log masuk dengan kod SMS. Peranti anda yang lain akan dilog keluar.',
  removeConfirm: 'Buang',
  removed: 'Kata laluan dibuang',
}

export const passwordErrorsMs: typeof passwordErrorsEn = {
  passwordTooShort: 'Gunakan sekurang-kurangnya 10 aksara',
  passwordTooLong: 'Kata laluan ini terlalu panjang',
  passwordPersonal: 'Jangan guna nama pengguna atau nombor telefon dalam kata laluan',
  passwordWeak: 'Kata laluan ini mudah diteka. Tambah lebih banyak perkataan atau aksara',
  passwordMismatch: 'Kata laluan tidak sepadan',
  passwordPwned: 'Kata laluan ini pernah bocor dalam kebocoran data. Pilih yang lain',
  passwordSame: 'Ini sudah kata laluan anda',
  passwordReauth: 'Sila sahkan dengan kod SMS dahulu',
  loginFailed: 'Nama pengguna atau kata laluan salah',
  loginLocked: 'Terlalu banyak cubaan. Cuba lagi dalam 15 minit atau log masuk dengan telefon',
}
