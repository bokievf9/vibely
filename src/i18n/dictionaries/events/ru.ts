import type { EventsDictionary, eventErrorsEn } from './en'

export const eventsRu: EventsDictionary = {
  kicker: 'Вечер свиданий вслепую',
  startsIn: 'Начало {time}',
  in: 'через {time}',
  days: '{n} д',
  hours: '{n} ч',
  minutes: '{n} мин',
  startingNow: 'начинается',
  liveNow: 'Идёт сейчас',
  inRoom: 'В комнате: {count}',
  inRoomOne: 'В комнате: 1',
  inRoomNone: 'Будьте первым в комнате',
  remind: 'Напомнить',
  reminded: 'Напомним за 15 минут до начала.',
  enter: 'Войти',
  hide: 'Скрыть',
  youAreIn: 'Вы на вечере: {title}',
  relaxedFilters:
    'Сегодня подбираем только по полу и с широким диапазоном возраста (примерно 10 лет в обе стороны от вашего). Интересы не учитываются.',
  waitingHint: 'Подождите, следующий собеседник уже на подходе.',
  leave: 'Покинуть вечер',
  nextSoon: 'Ищем следующего собеседника...',
  endedTitle: 'Вечер закончился',
  endedText: 'Спасибо, что были с нами. Свидания вслепую открыты каждый день.',
  endedButton: 'К свиданиям вслепую',
  pushSoonTitle: '{title}: начало через 15 минут',
  pushSoonBody: 'Готовьтесь к вечеру свиданий вслепую в Vibely.',
  pushLiveTitle: '{title}: уже идёт',
  pushLiveBody: 'Войдите в комнату и познакомьтесь с кем-то новым.',
}

export const eventErrorsRu: typeof eventErrorsEn = {
  eventNotLive: 'Этот вечер закончился. Свидания вслепую по-прежнему открыты.',
}
