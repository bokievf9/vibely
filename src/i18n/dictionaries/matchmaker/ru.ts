import type { IncognitoDictionary, MatchmakerDictionary, MatchmakerErrorsDictionary } from './en'

export const matchmakerRu: MatchmakerDictionary = {
  preview: 'Знакомство',
  introduce: 'Познакомить с другом',
  sheetTitle: 'Познакомить: {name}',
  sheetHint:
    'Выберите кого-то из других своих мэтчей. Они увидят друг друга, только если оба заинтересуются. Отказ никто не увидит.',
  search: 'Поиск по мэтчам',
  loading: 'Загружаем ваши мэтчи',
  noMatches: 'Чтобы познакомить, нужен хотя бы ещё один мэтч.',
  nothingFound: 'Ничего не найдено',
  noteLabel: 'Записка для обоих (необязательно)',
  notePlaceholder: 'Почему они подойдут друг другу?',
  noteCount: '{count}/{max}',
  send: 'Отправить знакомство',
  sent: 'Знакомство отправлено',
  sentHint: 'Сначала его увидит {name} в вашем чате. Если есть интерес, следующим будет {other}.',
  done: 'Готово',
  reward: 'Если всё получится, вы получите 7 дней VIP.',
  cardTitle: '{name} хочет вас познакомить',
  cardTitleMine: 'Вы познакомили {name} и {other}',
  cardLoading: 'Загружаем знакомство',
  noteFrom: 'Записка от {name}',
  interested: 'Интересно',
  noThanks: 'Нет, спасибо',
  waiting: 'Вы ответили «да». Если {name} тоже заинтересуется, у вас откроется чат.',
  matched: 'Это мэтч! Вы и {name} теперь на связи.',
  openChat: 'Открыть чат',
  closed: 'Вы отказались от этого знакомства.',
  pending: 'Ждём ответа.',
  matchedMine: 'У них мэтч. Спасибо за знакомство!',
  unavailable: 'Это знакомство больше недоступно.',
  pinnedTitle: 'Вас познакомил(а) {name}',
  pinnedTitleAnon: 'Вас познакомил друг',
  pinnedHint: 'Вас свёл человек, у которого мэтч с вами обоими.',
  pushIntro: '{name} хочет вас с кем-то познакомить',
  pushIntroBody: 'Откройте чат, чтобы узнать, с кем.',
  pushWorked: 'Ваше знакомство сработало',
  pushWorkedBody: '{b} и {c} теперь мэтч. Вы получили 7 дней VIP.',
}

export const matchmakerErrorsRu: MatchmakerErrorsDictionary = {
  referralExists: 'Этих двоих уже недавно знакомили.',
  referralUnavailable: 'Сейчас это знакомство невозможно.',
  noteTooLong: 'Записка слишком длинная (не больше 200 символов)',
}

export const incognitoRu: IncognitoDictionary = {
  setting: 'Режим инкогнито',
  settingHint: 'В разделе Знакомства вас видят только те, кого вы лайкнули.',
  sheetTitle: 'Режим инкогнито',
  sheetIntro: 'Вас видят только те, кого вы лайкнули.',
  sheetPoints: [
    'В разделе Знакомства вы появляетесь только у людей, которых уже лайкнули.',
    'Вас нет в поиске по имени пользователя, в «Пересечениях» и в «Кто вас лайкнул».',
    'Если человек, которого вы лайкнули, лайкнет вас в ответ, это мэтч как обычно.',
  ],
  sheetNote:
    'Мэтчи, чаты, посты в ленте и свидания вслепую работают как обычно. Выключить можно в любой момент.',
  turnOn: 'Включить инкогнито',
  notNow: 'Не сейчас',
}
