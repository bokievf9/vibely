import type { passwordErrorsEn, PasswordDictionary } from './en'

export const passwordRu: PasswordDictionary = {
  methods: 'Способ входа',
  tabPhone: 'Телефон',
  tabUsername: 'Имя пользователя',
  usernameLabel: 'Имя пользователя',
  usernamePlaceholder: '@username',
  passwordLabel: 'Пароль',
  show: 'Показать пароль',
  hide: 'Скрыть пароль',
  signIn: 'Войти',
  usernameNote: 'Впервые в Vibely? Сначала создайте аккаунт по номеру телефона.',
  forgot: 'Забыли пароль?',
  forgotTitle: 'Забыли пароль?',
  forgotBody:
    'Войдите по номеру телефона и коду из SMS. Затем откройте Настройки, раздел «Пароль для входа», и задайте новый пароль.',
  forgotAction: 'Войти по телефону',
  section: 'Пароль для входа',
  statusOn: 'Пароль включён',
  statusOff: 'Пароля нет',
  hintOn: 'Можно входить по @{username} и паролю или по коду из SMS.',
  hintOff:
    'Добавьте пароль, чтобы входить по @{username} без ожидания SMS. Вход по коду из SMS тоже останется.',
  set: 'Задать пароль',
  change: 'Изменить',
  remove: 'Удалить пароль',
  setTitle: 'Задать пароль',
  changeTitle: 'Сменить пароль',
  verifyIntro:
    'Для безопасности аккаунта сначала подтвердите, что это вы. Мы отправим код по SMS на {phone}.',
  sendCode: 'Отправить код',
  codeLabel: 'Код из SMS',
  codeHint: 'Введите 6-значный код, отправленный на {phone}.',
  verify: 'Подтвердить',
  resend: 'Отправить новый код',
  newLabel: 'Новый пароль',
  repeatLabel: 'Повторите пароль',
  rules:
    'Не короче 10 символов. Не используйте имя пользователя или номер телефона. Хорошо работают несколько несвязанных слов.',
  strength: 'Надёжность: {level}',
  levels: ['очень слабый', 'слабый', 'средний', 'хороший', 'надёжный'],
  save: 'Сохранить пароль',
  saved: 'Пароль сохранён. На других устройствах выполнен выход.',
  removeTitle: 'Удалить пароль?',
  removeBody:
    'Войти можно будет только по коду из SMS. На других устройствах будет выполнен выход.',
  removeConfirm: 'Удалить',
  removed: 'Пароль удалён',
}

export const passwordErrorsRu: typeof passwordErrorsEn = {
  passwordTooShort: 'Пароль должен быть не короче 10 символов',
  passwordTooLong: 'Пароль слишком длинный',
  passwordPersonal: 'Не используйте в пароле имя пользователя или номер телефона',
  passwordWeak: 'Такой пароль легко угадать. Добавьте слова или символы',
  passwordMismatch: 'Пароли не совпадают',
  passwordPwned: 'Этот пароль встречался в утечках данных. Выберите другой',
  passwordSame: 'Это уже ваш текущий пароль',
  passwordReauth: 'Сначала подтвердите вход кодом из SMS',
  loginFailed: 'Неверное имя пользователя или пароль',
  loginLocked: 'Слишком много попыток. Попробуйте через 15 минут или войдите по телефону',
}
