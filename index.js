// Время и праздники — календарь истории для SillyTavern:
// дата, сезон, место и местный колорит, праздники, дни рождения, хроника,
// праздничные события с традициями, секретной задачей и шуточными медалями.

const MODULE = 'time_place';
const INJECT_KEY = 'time_place_inject';
const POS_IN_CHAT = 1;
const TITLE = 'Время и праздники';

  // ===================== Время и место =====================
  // Календарь ведёт код: модель только сообщает, сколько прошло времени или какая теперь дата.

  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  const COUNTRIES = {
      UK: { name: 'Великобритания', keys: ['великобритан', 'британ', 'англи', 'шотланд', 'уэльс', 'лондон', 'uk', 'united kingdom', 'england', 'britain'] },
      US: { name: 'США', keys: ['сша', 'америк', 'штат', 'нью-йорк', 'калифорни', 'usa', 'united states', 'america'] },
      JP: { name: 'Япония', keys: ['япони', 'токио', 'осака', 'киото', 'japan'] },
      RU: { name: 'Россия', keys: ['росси', 'москв', 'петербург', 'russia'] },
  };

  function detectCountry(text) {
      const t = String(text || '').toLowerCase();
      for (const [code, c] of Object.entries(COUNTRIES)) {
          if (c.keys.some(k => (k.length <= 3 ? new RegExp(`(^|[^a-zа-яё])${k}([^a-zа-яё]|$)`).test(t) : t.includes(k)))) return code;
      }
      return '';
  }

  // Даты храним как 'YYYY-MM-DD', считаем в UTC, чтобы не мешали часовые пояса
  function toDate(iso) {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
  }
  function toIso(dt) {
      return dt.toISOString().slice(0, 10);
  }
  function addDays(iso, n) {
      const dt = toDate(iso);
      dt.setUTCDate(dt.getUTCDate() + n);
      return toIso(dt);
  }
  function addMonths(iso, n) {
      const dt = toDate(iso);
      const day = dt.getUTCDate();
      dt.setUTCDate(1);
      dt.setUTCMonth(dt.getUTCMonth() + n);
      const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
      dt.setUTCDate(Math.min(day, last));
      return toIso(dt);
  }
  function daysBetween(a, b) {
      return Math.round((toDate(b) - toDate(a)) / 86400000);
  }
  function ymd(y, m, d) {
      return toIso(new Date(Date.UTC(y, m - 1, d)));
  }
  function formatDate(iso, withYear = true) {
      const dt = toDate(iso);
      return `${dt.getUTCDate()} ${MONTHS_GEN[dt.getUTCMonth()]}${withYear ? ' ' + dt.getUTCFullYear() : ''}`;
  }
  function weekday(iso) {
      return WEEKDAYS[toDate(iso).getUTCDay()];
  }
  function plural(n, one, few, many) {
      const a = Math.abs(n) % 100, b = a % 10;
      if (a > 10 && a < 20) return many;
      if (b > 1 && b < 5) return few;
      if (b === 1) return one;
      return many;
  }
  function daysWord(n) {
      return `${n} ${plural(n, 'день', 'дня', 'дней')}`;
  }

  // Пасха: западная (григорианская) и православная (юлианская + 13 дней, верно для 1900–2099)
  function westernEaster(y) {
      const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
      const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
      return ymd(y, month, day);
  }
  function orthodoxEaster(y) {
      const a = y % 4, b = y % 7, c = y % 19;
      const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
      const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
      return addDays(ymd(y, month, day), 13);
  }
  // n-й день недели месяца (wd: 0 — вс, 1 — пн…); n = -1 — последний
  function nthWeekday(y, m, wd, n) {
      if (n > 0) {
          const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
          return ymd(y, m, 1 + ((wd - first + 7) % 7) + (n - 1) * 7);
      }
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const lastWd = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
      return ymd(y, m, lastDay - ((lastWd - wd + 7) % 7));
  }

  // Праздники и события. Правила: d — фиксированная дата [месяц, день], to — конец периода,
  // nth — [месяц, день недели, номер], easter / orth — смещение от западной / православной Пасхи, len — длительность в днях
  const HOLIDAYS = {
      ALL: [
          { name: 'Новый год', d: [1, 1] },
          { name: 'День святого Валентина', d: [2, 14] },
          { name: 'Хэллоуин', d: [10, 31] },
          { name: 'Сочельник', d: [12, 24] },
          { name: 'Рождество', d: [12, 25] },
          { name: 'Канун Нового года', d: [12, 31] },
      ],
      UK: [
          { name: 'Новый год', d: [1, 1], note: 'выходной; после вечеринок в канун' },
          { name: 'Ночь Бёрнса', d: [1, 25], note: 'шотландский праздник: хаггис, стихи Роберта Бёрнса' },
          { name: 'День святого Валентина', d: [2, 14], note: 'открытки и ужины в ресторанах' },
          { name: 'Блинный вторник (Pancake Day)', easter: -47, note: 'все едят блины с лимоном и сахаром, школьные забеги с блинами' },
          { name: 'День матери (Mothering Sunday)', easter: -21, note: 'цветы и открытки мамам' },
          { name: 'День святого Патрика', d: [3, 17], note: 'ирландский праздник, отмечают в пабах: зелёный цвет, Guinness' },
          { name: 'День дурака', d: [4, 1], note: 'розыгрыши до полудня' },
          { name: 'Страстная пятница', easter: -2, note: 'выходной, булочки с крестом (hot cross buns)' },
          { name: 'Пасха', easter: 0, note: 'шоколадные яйца, охота за яйцами для детей' },
          { name: 'Пасхальный понедельник', easter: 1, note: 'банковский выходной' },
          { name: 'Майский банковский выходной', nth: [5, 1, 1], note: 'длинные выходные' },
          { name: 'Весенний банковский выходной', nth: [5, 1, -1], note: 'длинные выходные, часто поездки за город' },
          { name: 'День отца', nth: [6, 0, 3] },
          { name: 'Уимблдон', d: [6, 29], len: 14, note: 'теннисный турнир: клубника со сливками, все смотрят матчи' },
          { name: 'Летние школьные каникулы', d: [7, 22], to: [9, 3], note: 'семьи уезжают в отпуск, на море или в Европу' },
          { name: 'Летний банковский выходной', nth: [8, 1, -1], note: 'последний длинный уикенд лета, Ноттинг-Хиллский карнавал в Лондоне' },
          { name: 'Хэллоуин', d: [10, 31], note: 'костюмы, тыквы, дети ходят за сладостями' },
          { name: 'Ночь Гая Фокса (Bonfire Night)', d: [11, 5], note: 'костры и фейерверки' },
          { name: 'Воскресенье памяти', nth: [11, 0, 2], note: 'минута молчания, красные маки на одежде (их носят с конца октября)' },
          { name: 'Сочельник', d: [12, 24] },
          { name: 'Рождество', d: [12, 25], note: 'главный праздник года: индейка, крекеры с бумажными коронами, речь короля по ТВ' },
          { name: 'День подарков (Boxing Day)', d: [12, 26], note: 'выходной, распродажи, футбол' },
          { name: 'Канун Нового года (Хогманай)', d: [12, 31], note: 'вечеринки, фейерверки, «Auld Lang Syne» в полночь' },
      ],
      US: [
          { name: 'Новый год', d: [1, 1] },
          { name: 'День Мартина Лютера Кинга', nth: [1, 1, 3], note: 'федеральный выходной' },
          { name: 'Супербоул', nth: [2, 0, 2], note: 'финал по американскому футболу: вечеринки, крылышки, реклама' },
          { name: 'День святого Валентина', d: [2, 14], note: 'открытки, шоколад, школьники обмениваются валентинками' },
          { name: 'День святого Патрика', d: [3, 17], note: 'всё зелёное, парады, особенно в Нью-Йорке, Бостоне и Чикаго' },
          { name: 'Пасха', easter: 0, note: 'охота за яйцами, пасхальный кролик' },
          { name: 'День матери', nth: [5, 0, 2], note: 'цветы, завтрак маме' },
          { name: 'День памяти (Memorial Day)', nth: [5, 1, -1], note: 'неофициальное начало лета: барбекю, открытие бассейнов' },
          { name: 'Выпускные', d: [5, 20], to: [6, 15], note: 'школьные и университетские выпускные, проммы' },
          { name: 'День отца', nth: [6, 0, 3] },
          { name: 'День независимости', d: [7, 4], note: 'фейерверки, барбекю, флаги' },
          { name: 'День труда', nth: [9, 1, 1], note: 'конец лета, после него начинается учебный год' },
          { name: 'Хэллоуин', d: [10, 31], note: 'костюмы, тыквы, trick-or-treat, украшенные дома' },
          { name: 'День благодарения', nth: [11, 4, 4], note: 'главный семейный праздник: индейка, тыквенный пирог, парад Macy\'s' },
          { name: 'Чёрная пятница', nth: [11, 4, 4], shift: 1, note: 'огромные распродажи' },
          { name: 'Сочельник', d: [12, 24] },
          { name: 'Рождество', d: [12, 25], note: 'ёлка, подарки, носки у камина, рождественские огни на домах' },
          { name: 'Канун Нового года', d: [12, 31], note: 'вечеринки, падение шара на Таймс-сквер' },
      ],
      JP: [
          { name: 'Сёгацу (Новый год)', d: [1, 1], to: [1, 3], note: 'главный праздник: первое посещение храма (хацумодэ), осэти, новогодние открытки, семья' },
          { name: 'День совершеннолетия', nth: [1, 1, 2], note: '20-летние в праздничных кимоно' },
          { name: 'Сэцубун', d: [2, 3], note: 'бросают бобы со словами «Демоны вон, удача в дом!»' },
          { name: 'День святого Валентина', d: [2, 14], note: 'в Японии шоколад дарят девушки — любимым и коллегам' },
          { name: 'Хинамацури (праздник девочек)', d: [3, 3], note: 'выставка кукол хина' },
          { name: 'Белый день', d: [3, 14], note: 'парни отвечают подарками на валентинки' },
          { name: 'Ханами', d: [3, 25], to: [4, 10], note: 'цветёт сакура: пикники под деревьями' },
          { name: 'Начало учебного и рабочего года', d: [4, 1], note: 'новые классы, первокурсники, новые сотрудники' },
          { name: 'Золотая неделя', d: [4, 29], to: [5, 5], note: 'череда выходных, все путешествуют' },
          { name: 'День детей', d: [5, 5], note: 'вывешивают карпов-коинобори' },
          { name: 'Сезон дождей (цую)', d: [6, 7], to: [7, 19], note: 'постоянные дожди, сырость, цветут гортензии' },
          { name: 'Танабата', d: [7, 7], note: 'желания на бумажных полосках на бамбуке' },
          { name: 'Летние фестивали', d: [7, 20], to: [8, 31], note: 'мацури, юкаты, фейерверки, уличная еда' },
          { name: 'Обон', d: [8, 13], to: [8, 16], note: 'поминовение предков, поездки в родные места, танцы бон-одори' },
          { name: 'День почитания старших', nth: [9, 1, 3] },
          { name: 'Хэллоуин', d: [10, 31], note: 'костюмированные толпы в Сибуе' },
          { name: 'Сити-го-сан', d: [11, 15], note: 'дети 3, 5 и 7 лет в нарядах идут в храм' },
          { name: 'Сочельник', d: [12, 24], note: 'в Японии — романтический вечер для пар, курица из KFC и клубничный торт' },
          { name: 'Омисока (канун Нового года)', d: [12, 31], note: 'уборка, лапша тосикоси-соба, 108 ударов храмового колокола' },
      ],
      RU: [
          { name: 'Новогодние каникулы', d: [1, 1], to: [1, 8], note: 'длинные выходные: оливье, мандарины, гости' },
          { name: 'Рождество', d: [1, 7], note: 'православное Рождество' },
          { name: 'Старый Новый год', d: [1, 14] },
          { name: 'Крещение', d: [1, 19], note: 'купание в проруби' },
          { name: 'Татьянин день', d: [1, 25], note: 'день студентов' },
          { name: 'День святого Валентина', d: [2, 14] },
          { name: 'Масленица', orth: -55, len: 7, note: 'неделя блинов, в последний день сжигают чучело' },
          { name: 'День защитника Отечества', d: [2, 23], note: 'поздравляют мужчин' },
          { name: 'Международный женский день', d: [3, 8], note: 'цветы, особенно тюльпаны и мимоза, поздравляют женщин' },
          { name: 'День смеха', d: [4, 1] },
          { name: 'Пасха', orth: 0, note: 'куличи, крашеные яйца, «Христос воскресе!»' },
          { name: 'Майские праздники', d: [5, 1], to: [5, 11], note: 'шашлыки, дачи, открытие сезона' },
          { name: 'День Победы', d: [5, 9], note: 'парад, салют, георгиевские ленточки' },
          { name: 'День России', d: [6, 12] },
          { name: 'Ивана Купала', d: [7, 7], note: 'венки, костры, гадания' },
          { name: 'День знаний', d: [9, 1], note: 'начало учебного года, линейки, букеты' },
          { name: 'День учителя', d: [10, 5] },
          { name: 'Хэллоуин', d: [10, 31], note: 'не официальный праздник, но молодёжь устраивает костюмированные вечеринки, в барах и клубах тематические ночи' },
          { name: 'День народного единства', d: [11, 4] },
          { name: 'Канун Нового года', d: [12, 31], note: 'ёлка, оливье, речь президента, бой курантов' },
      ],
  };

  function occurrences(h, y) {
      let start;
      if (h.d) start = ymd(y, h.d[0], h.d[1]);
      else if (h.nth) start = addDays(nthWeekday(y, h.nth[0], h.nth[1], h.nth[2]), h.shift || 0);
      else if (h.easter !== undefined) start = addDays(westernEaster(y), h.easter);
      else if (h.orth !== undefined) start = addDays(orthodoxEaster(y), h.orth);
      else if (h.md) start = ymd(y, Number(h.md.slice(0, 2)), Number(h.md.slice(3, 5)));
      else return null;
      let end = start;
      if (h.to) {
          end = ymd(y, h.to[0], h.to[1]);
          if (end < start) end = ymd(y + 1, h.to[0], h.to[1]);
      } else if (h.len) end = addDays(start, h.len - 1);
      return { start, end };
  }

  function holidaysFor(st) {
      const code = st.time.country;
      const base = HOLIDAYS[code] || HOLIDAYS.ALL;
      const custom = (st.time.custom || []).map(c => ({ name: c.name, md: c.md, note: c.note, custom: true }));
      return base.concat(custom);
  }

  // Праздники, которые идут сейчас или начнутся в ближайшие days дней
  function upcoming(st, days) {
      const today = st.time.date;
      const y = toDate(today).getUTCFullYear();
      const out = [];
      for (const h of holidaysFor(st)) {
          for (const yy of [y - 1, y, y + 1]) {
              const o = occurrences(h, yy);
              if (!o) continue;
              if (o.end < today) continue;
              const inDays = daysBetween(today, o.start);
              if (inDays > days) continue;
              out.push(Object.assign({}, h, { start: o.start, end: o.end, inDays: inDays, ongoing: o.start <= today }));
              break;
          }
      }
      return out.sort((a, b) => a.start.localeCompare(b.start));
  }

  // Сезон и его приметы (все поддерживаемые страны — в Северном полушарии)
  const SEASON_HINTS = {
      'зима': 'холодно, рано темнеет; тёплая одежда, горячие напитки, снег или слякоть',
      'весна': 'теплеет, всё цветёт, дни становятся длиннее, погода переменчивая',
      'лето': 'тепло или жарко, длинные светлые вечера; отпуска, пляжи, пикники, прогулки допоздна',
      'осень': 'холодает, листопад, дожди, рано темнеет; начало учебного года, уютные вечера дома',
  };
  function season(iso) {
      const m = toDate(iso).getUTCMonth() + 1, d = toDate(iso).getUTCDate();
      const name = [12, 1, 2].includes(m) ? 'зима' : m <= 5 ? 'весна' : m <= 8 ? 'лето' : 'осень';
      const idx = { 'зима': [12, 1, 2], 'весна': [3, 4, 5], 'лето': [6, 7, 8], 'осень': [9, 10, 11] }[name].indexOf(m);
      const phase = idx === 0 ? (d <= 10 ? 'начало' : 'первая половина') : idx === 1 ? 'середина' : (d >= 20 ? 'конец' : 'вторая половина');
      return { name, phase, hint: SEASON_HINTS[name] };
  }

  // Разбор даты из ответа модели или ввода: 2025-02-14, 14.02.2025, 14.02, «14 февраля 2025», «14 февраля»
  function parseDateText(text, refIso) {
      const t = String(text || '').trim().toLowerCase();
      let y, m, d;
      let mm = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (mm) [y, m, d] = [Number(mm[1]), Number(mm[2]), Number(mm[3])];
      if (!mm && (mm = t.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/))) {
          d = Number(mm[1]); m = Number(mm[2]);
          if (mm[3]) y = Number(mm[3].length === 2 ? '20' + mm[3] : mm[3]);
      }
      if (!m) {
          mm = t.match(/(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?/);
          if (mm) {
              const mi = MONTHS_GEN.findIndex(x => mm[2].startsWith(x.slice(0, 3)));
              if (mi >= 0) { d = Number(mm[1]); m = mi + 1; if (mm[3]) y = Number(mm[3]); }
          }
      }
      if (!m || !d || m > 12 || d > 31) return null;
      if (!y) {
          // год не указан — берём ближайшую такую дату не раньше текущей даты истории
          const ref = refIso || toIso(new Date());
          y = toDate(ref).getUTCFullYear();
          if (ymd(y, m, d) < ref) y += 1;
      }
      const iso = ymd(y, m, d);
      return toDate(iso).getUTCMonth() + 1 === m ? iso : null;
  }

  // «+3 дня», «2 недели», «месяц», «полгода»
  function parseDuration(text) {
      const t = String(text || '').toLowerCase().replace(',', '.');
      const mm = t.match(/(\d+(?:\.\d+)?)?\s*(дн|ден|сут|недел|нед|месяц|мес|год|лет|полгода)/);
      if (!mm) return null;
      if (mm[2] === 'полгода') return { months: 6 };
      const n = mm[1] ? Number(mm[1]) : 1;
      if (/^(дн|ден|сут)/.test(mm[2])) return { days: Math.round(n) };
      if (/^нед/.test(mm[2])) return { days: Math.round(n * 7) };
      if (/^мес/.test(mm[2])) return { months: Math.round(n) };
      return { months: Math.round(n * 12) };
  }

  function applyDuration(iso, dur) {
      return dur.months ? addMonths(iso, dur.months) : addDays(iso, dur.days);
  }

  function placeLine(st) {
      const t = st.time;
      const country = COUNTRIES[t.country]?.name || t.countryName || '';
      return [t.city, country].filter(Boolean).join(', ');
  }

  function holidayLine(h, today) {
      const when = h.ongoing
          ? (h.start === h.end ? 'сегодня' : `идёт сейчас (до ${formatDate(h.end, false)})`)
          : h.inDays === 1 ? 'завтра' : `через ${daysWord(h.inDays)} (${formatDate(h.start, false)})`;
      return `— ${h.name}: ${when}${h.note ? ` — ${h.note}` : ''}`;
  }

  // ---------- Хроника: когда что было ----------
  function agoText(days) {
      if (days <= 0) return 'сегодня';
      if (days === 1) return 'вчера';
      if (days < 7) return `${daysWord(days)} назад`;
      if (days < 14) return 'неделю назад';
      if (days < 28) return `${Math.round(days / 7)} ${plural(Math.round(days / 7), 'неделю', 'недели', 'недель')} назад`;
      if (days < 60) return 'месяц назад';
      if (days < 365) { const m = Math.round(days / 30); return `${m} ${plural(m, 'месяц', 'месяца', 'месяцев')} назад`; }
      const y = Math.round(days / 365);
      return `${y} ${plural(y, 'год', 'года', 'лет')} назад`;
  }
  function timeline(st) {
      if (!Array.isArray(st.time.timeline)) st.time.timeline = [];
      return st.time.timeline;
  }
  function addEvent(st, date, text) {
      const list = timeline(st);
      text = String(text || '').trim();
      if (!text || !date) return false;
      if (list.some(e => e.text.toLowerCase() === text.toLowerCase())) return false;
      list.push({ date, text });
      list.sort((a, b) => a.date.localeCompare(b.date));
      if (list.length > 60) list.splice(0, list.length - 60);
      return true;
  }
  function chronicleLines(st, count) {
      const today = st.time.date;
      return timeline(st).slice(-count).map(e => `— ${formatDate(e.date, false)}${today ? ` (${agoText(daysBetween(e.date, today))})` : ''}: ${e.text}`);
  }

  // Шапка для обычных ответов
  function buildTimeInjection(st) {
      const t = st.time;
      if (!st.direction.time || (!t.date && !placeLine(st))) return '';
      const lines = ['[Время и место истории — держись их, даже если давно не упоминались.'];
      if (t.date) {
          const s = season(t.date);
          lines.push(`Сейчас: ${weekday(t.date)}, ${formatDate(t.date)}. ${s.name[0].toUpperCase() + s.name.slice(1)} (${s.phase}): ${s.hint}.`);
      }
      const place = placeLine(st);
      if (place) lines.push(`Место: ${place}. Еда, деньги, бытовые мелочи, обращения, праздники — местные; не переноси реалии других стран.`);
      if (t.flavor) lines.push(`Местный колорит: ${t.flavor}`);
      if (t.date) {
          const up = upcoming(st, 21);
          if (up.length) {
              lines.push('Праздники и события рядом (персонажи о них знают; разыгрывать не обязательно, но игнорировать странно):');
              up.slice(0, 4).forEach(h => lines.push(holidayLine(h, t.date)));
          }
          const chron = chronicleLines(st, 12);
          if (chron.length) {
              lines.push('Хроника — когда что произошло (держись этих сроков; не путай «на прошлой неделе» и «месяц назад»):');
              chron.forEach(l => lines.push(l));
          }
      }
      return lines.join('\n') + ']';
  }

  // Раздел для размышления
  function buildTimeSection(st) {
      if (!st?.direction?.time) return '';
      const t = st.time;
      const lines = ['Время и место. Календарь ведёт код — ты только сообщаешь изменения.'];
      if (t.date) {
          lines.push(`Последняя известная дата истории: ${weekday(t.date)}, ${formatDate(t.date)}.`);
      } else {
          lines.push('Дата истории ещё не задана. Определи её по чату (упоминания месяца, погоды, праздников, сезона). Если точных подсказок нет — выбери правдоподобную дату, которая подходит к происходящему, и задай её командой DATE.');
      }
      const place = placeLine(st);
      lines.push(place ? `Место: ${place}.` : 'Место ещё не задано. Определи страну и город по чату и задай командой PLACE.');
      if (t.date) {
          const up = upcoming(st, 45);
          if (up.length) {
              lines.push('Ближайшие праздники и события:');
              up.slice(0, 6).forEach(h => lines.push(holidayLine(h, t.date)));
          }
      }
      lines.push('');
      lines.push('Команды для времени и места:');
      lines.push('TIME +N дней / недель / месяцев — сколько сюжетного времени прошло в чате с последней известной даты (оцени по событиям: ночёвки, «на следующий день», таймскипы). Если прошло меньше суток — не пиши ничего.');
      lines.push('DATE ДД.ММ.ГГГГ — если в чате прямо названа дата или нужно задать её впервые.');
      lines.push('PLACE Страна: Город — если место задано впервые или персонажи переехали.');
      lines.push('EVENT: важное событие из чата с прошлой проверки — знакомство, ссора, признание, первый поцелуй, переезд, поездка, праздник. Одна строка, кратко. Дату плагин поставит сам; если событие было не сегодня — EVENT ДД.ММ: текст. Не повторяй то, что уже есть в хронике.');
      const recent = chronicleLines(st, 6);
      if (recent.length) { lines.push('Последнее в хронике:'); recent.forEach(l => lines.push(l)); }
      return lines.join('\n');
  }

  // Обработка команд TIME / DATE / PLACE / LOCAL. Возвращает true, если строка распознана.
  function applyTimeCommand(st, line, res) {
      const t = st.time;
      let m;
      if ((m = line.match(/^TIME\s*[:：]?\s*\+?\s*(.+)$/i))) {
          if (!st.direction.time || !t.date) return true;
          const dur = parseDuration(m[1]);
          if (dur && (dur.days > 0 || dur.months > 0)) {
              const before = t.date;
              t.date = applyDuration(t.date, dur);
              res.timeMoved = daysBetween(before, t.date);
          }
          return true;
      }
      if ((m = line.match(/^DATE\s*[:：]?\s*(.+)$/i))) {
          if (!st.direction.time) return true;
          const iso = parseDateText(m[1], t.date);
          if (iso) {
              if (t.date && iso !== t.date) res.timeMoved = daysBetween(t.date, iso);
              else if (!t.date) res.dateSet = iso;
              t.date = iso;
          }
          return true;
      }
      if ((m = line.match(/^PLACE\s*[:：]?\s*(.+)$/i))) {
          if (!st.direction.time) return true;
          let countryText = m[1], city = '';
          const sep = m[1].match(/^\[?([^\]:：]+?)\]?\s*[:：—–]\s*(.+)$/);
          if (sep) { countryText = sep[1]; city = sep[2]; }
          else if (m[1].includes(',')) { const parts = m[1].split(','); countryText = parts.pop(); city = parts.join(','); }
          const code = detectCountry(countryText) || detectCountry(m[1]);
          const newCountryName = code ? '' : countryText.trim();
          if (code !== t.country || newCountryName !== t.countryName) {
              if (!t.flavorLocked) t.flavor = '';
              res.placeSet = true;
          }
          if (city.trim() !== t.city) res.placeSet = true;
          t.country = code;
          t.countryName = newCountryName;
          t.city = city.trim();
          return true;
      }
      if ((m = line.match(/^EVENT\s*\[?(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)?\]?\s*[:：—–-]\s*(.+)$/i))) {
          if (!st.direction.time || !t.date) return true;
          let date = t.date;
          if (m[1]) {
              const d = parseDateText(m[1].replace(/[-/]/g, '.'), '1900-01-01');
              if (d) {
                  // год не указан — берём ближайшую такую дату не позже текущей
                  date = /\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}/.test(m[1]) ? d : `${t.date.slice(0, 4)}${d.slice(4)}`;
                  if (date > t.date) date = `${Number(t.date.slice(0, 4)) - 1}${d.slice(4)}`;
              }
          }
          if (addEvent(st, date, m[2])) (res.events = res.events || []).push(m[2].trim());
          return true;
      }
      if ((m = line.match(/^LOCAL\s*[:：—–-]\s*(.+)$/i))) {
          if (st.direction.time && !t.flavorLocked) t.flavor = m[1].trim();
          return true;
      }
      return false;
  }



  // Колорит — отдельным коротким запросом, чтобы модель его не пропускала
  function flavorPrompt(st) {
      return 'Напиши 2–3 предложения о местном колорите для ролевой игры, действие которой происходит здесь: ' + placeLine(st) + '. ' +
          'Перечисли конкретно: типичная еда и напитки, валюта и привычки с деньгами (например, чаевые), транспорт, климат, бытовые мелочи и манера общения местных. ' +
          'Это справка для автора, чтобы не путать реалии разных стран. Пиши по-русски, без вступления и без списков — сразу текст.';
  }
  function cleanFlavor(raw) {
      return String(raw || '').replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u2800\u3000\u3164\uFEFF]/g, ' ')
          .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '').replace(/\*\*/g, '').trim()
          .replace(/^["«]|["»]$/g, '').trim();
  }

  // ===================== Праздничные события =====================
  // Традиции (классические задачи), скрытая задача, метки в ответах, итог и медали.

  var TRADITIONS = [
    { match: ['хэллоуин'], emoji: '🎃', vibe: 'тыквы на крыльцах, гирлянды из летучих мышей, костюмы в витринах, запах корицы и сладостей', tasks: ['Вырезать фонарь из тыквы', 'Выбрать или смастерить костюм', 'Раздать сладости детям или сходить за сладостями самим', 'Посмотреть ужастик вместе', 'Сходить на хэллоуинскую вечеринку', 'Украсить дом к празднику'] },
    { match: ['валентин'], emoji: '💘', vibe: 'сердечки в витринах, очереди в цветочных, парочки в кафе', tasks: ['Подарить валентинку', 'Устроить романтический ужин', 'Сделать подарок своими руками', 'Сходить на свидание', 'Признаться кому-то в чувствах'] },
    { match: ['белый день'], emoji: '🍬', vibe: 'в магазинах белый шоколад и зефир в подарочных коробках', tasks: ['Ответить на валентинку подарком', 'Выбрать белый шоколад или сладости', 'Вручить подарок лично'] },
    { country: 'JP', match: ['сочельник'], emoji: '🎄', vibe: 'иллюминация, парочки на улицах, очереди за курицей и клубничными тортами', tasks: ['Сходить на свидание', 'Съесть рождественский клубничный торт', 'Заказать курицу из KFC', 'Погулять под иллюминацией'] },
    { match: ['рождество', 'сочельник'], emoji: '🎁', vibe: 'ёлки в окнах, рождественские ярмарки, огоньки, глинтвейн и музыка', tasks: ['Нарядить ёлку', 'Обменяться подарками', 'Испечь рождественское печенье', 'Спеть или послушать рождественские песни', 'Повесить носки для подарков'] },
    { match: ['сёгацу'], emoji: '⛩', vibe: 'очереди у храмов, новогодние украшения из сосны и бамбука, тишина закрытых магазинов', tasks: ['Сходить в храм на хацумодэ', 'Попробовать осэти', 'Вытянуть предсказание омикудзи', 'Отправить новогодние открытки'] },
    { match: ['омисока'], emoji: '🔔', vibe: 'генеральная уборка, запах лапши, ожидание колокола', tasks: ['Сделать генеральную уборку', 'Съесть тосикоси-собу', 'Послушать удары колокола в полночь'] },
    { match: ['новый год', 'новогод', 'канун нового', 'хогманай'], emoji: '🎆', vibe: 'гирлянды, ёлки, предпраздничная суета, запах мандаринов', tasks: ['Нарядить ёлку', 'Приготовить праздничный стол', 'Загадать желание в полночь', 'Посмотреть салют', 'Подарить подарки'] },
    { match: ['масленица'], emoji: '🥞', vibe: 'запах блинов отовсюду, ярмарки, гулянья', tasks: ['Напечь блинов', 'Сходить на гулянья', 'Сжечь чучело Масленицы', 'Попросить прощения в Прощёное воскресенье'] },
    { match: ['блинный'], emoji: '🥞', vibe: 'везде блины, школьники тренируются к блинным забегам', tasks: ['Напечь блинов', 'Попробовать блины с лимоном и сахаром', 'Поучаствовать в блинном забеге'] },
    { match: ['пасха'], emoji: '🐣', vibe: 'крашеные яйца, весенние цветы, праздничная выпечка в витринах', tasks: ['Покрасить яйца', 'Устроить охоту за яйцами', 'Испечь праздничную выпечку', 'Собраться на семейный обед'] },
    { match: ['благодарения'], emoji: '🦃', vibe: 'запах индейки и тыквенного пирога, все едут к родным', tasks: ['Приготовить индейку', 'Испечь тыквенный пирог', 'Собраться за общим столом', 'Сказать, за что благодарен', 'Посмотреть парад или футбол'] },
    { match: ['гая фокса'], emoji: '🎆', vibe: 'запах дыма, костры в парках, хлопки фейерверков', tasks: ['Сходить на костёр', 'Посмотреть фейерверк', 'Пожарить зефир на огне'] },
    { match: ['независимости'], emoji: '🎇', vibe: 'флаги, барбекю во дворах, ожидание фейерверков', tasks: ['Устроить барбекю', 'Посмотреть фейерверк', 'Надеть что-то в цветах флага'] },
    { match: ['женский'], emoji: '💐', vibe: 'тюльпаны и мимоза на каждом углу, очереди в цветочных', tasks: ['Подарить цветы', 'Поздравить близких и коллег', 'Устроить приятный сюрприз'] },
    { match: ['защитника'], emoji: '🎖', vibe: 'открытки, поздравления в офисах, носки и пена для бритья в подарочных наборах', tasks: ['Поздравить мужчин', 'Подарить что-то практичное', 'Устроить праздничный ужин'] },
    { match: ['танабата'], emoji: '🎋', vibe: 'бамбук с разноцветными бумажными полосками, юкаты', tasks: ['Написать желание на бумажной полоске', 'Повесить его на бамбук', 'Надеть юкату'] },
    { match: ['ханами'], emoji: '🌸', vibe: 'розовые облака сакуры, пикники в парках, лепестки на асфальте', tasks: ['Устроить пикник под сакурой', 'Занять место под деревом с утра', 'Сделать фото среди цветов'] },
    { match: ['обон'], emoji: '🏮', vibe: 'фонарики, танцы бон-одори, поезда переполнены едущими домой', tasks: ['Съездить в родные места', 'Станцевать бон-одори', 'Зажечь фонарики'] },
    { match: ['летние фестивали'], emoji: '🎐', vibe: 'юкаты, лотки с уличной едой, фейерверки над рекой', tasks: ['Надеть юкату', 'Попробовать уличную еду', 'Посмотреть фейерверк', 'Поймать золотую рыбку на ярмарке'] },
    { match: ['супербоул'], emoji: '🏈', vibe: 'все обсуждают матч и рекламу, в магазинах горы крылышек и чипсов', tasks: ['Устроить вечеринку у телевизора', 'Наготовить крылышек', 'Поспорить на исход матча'] },
    { match: ['патрика'], emoji: '☘', vibe: 'всё зелёное, парады, переполненные пабы', tasks: ['Надеть что-то зелёное', 'Сходить в паб', 'Посмотреть парад'] },
    { match: ['рожден'], emoji: '🎂', vibe: 'именинника поздравляют с утра', tasks: ['Выбрать подарок', 'Устроить сюрприз', 'Испечь или заказать торт', 'Собрать друзей', 'Сказать тёплые слова'] },
  ];

  function traditionsFor(h, country) {
    var name = String(h.name || '').toLowerCase();
    for (var i = 0; i < TRADITIONS.length; i++) {
      var t = TRADITIONS[i];
      if (t.country && t.country !== country) continue;
      if (t.match.some(function (m) { return name.indexOf(m) >= 0; })) return t;
    }
    if (h.custom) return { emoji: '🗓', vibe: '', tasks: ['Отметить эту дату вместе', 'Сделать что-то памятное'] };
    return null;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  function ensureHolidayState(st) {
    if (st.holiday === undefined) st.holiday = null;
    if (!st.holidayDone || typeof st.holidayDone !== 'object') st.holidayDone = {};
    if (!Array.isArray(st.medals)) st.medals = [];
    if (!Array.isArray(st.memories)) st.memories = [];
    if (!Array.isArray(st.traces)) st.traces = [];
    if (!st.notified || typeof st.notified !== 'object') st.notified = {};
  }

  // Праздник, который пора активировать (за leadDays дней до начала и до его конца)
  function holidayToActivate(st, leadDays) {
    var t = st.time;
    if (!t.date || (st.holiday && !st.holiday.finished)) return null;
    var list = upcoming(st, leadDays);
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      var key = h.name + '|' + h.start;
      if (st.holidayDone[key]) continue;
      var tr = traditionsFor(h, t.country);
      if (!tr) continue;
      return { h: h, key: key, tr: tr };
    }
    return null;
  }

  // Настроение секретной задачи — выбирается на удачу
  var MOODS = {
    warm: { icon: '🌟', name: 'тёплый сюрприз', rule: 'особенный момент, который сделает праздник запоминающимся в хорошем смысле или продвинет вперёд отношения и линии персонажей: неожиданная приятность, совпадение, маленькое чудо, жест заботы' },
    chaos: { icon: '🔥', name: 'весёлый хаос', rule: 'забавное происшествие в рамках жанра истории: что-то идёт не по плану, неловкость или суматоха, которую потом будут вспоминать со смехом' }
  };
  var SECRET_RULES = 'Это ситуация или событие, а не сценарий: опиши, что произойдёт или что нужно устроить. Не диктуй персонажам реплики, признания и чувства (никаких «заставить X признаться», «X скажет вслух») — как они отреагируют, решится в сцене.';

  function newHoliday(found) {
    var classic = shuffle(found.tr.tasks).slice(0, 2).map(function (text) { return { text: text, done: false, hidden: false, kind: 'classic' }; });
    return {
      key: found.key, name: found.h.name, emoji: found.tr.emoji, vibe: found.tr.vibe, note: found.h.note || '',
      start: found.h.start, end: found.h.end, tasks: classic, finished: false,
      mood: Math.random() < 0.5 ? 'warm' : 'chaos'
    };
  }

  function moodOf(hol) { return MOODS[hol && hol.mood] || MOODS.warm; }

  function activationPrompt(hol, st, names, direction) {
    var mood = moodOf(hol);
    return [
      '[OOC: Пауза в ролевой игре. Ты — помощник автора. Скоро праздник: ' + hol.name + ' (' + formatDate(hol.start, false) + ')' + (placeLine(st) ? ', место: ' + placeLine(st) : '') + '.',
      direction ? direction + '\n' : '',
      'Классические традиции уже выбраны: ' + hol.tasks.map(function (x) { return '«' + x.text + '»'; }).join(', ') + '.',
      'Придумай по контексту этой ролевой ещё две праздничные задачи для ' + names.user + ' — связанные с праздником И с персонажами, отношениями, происходящим в истории. Лёгкие, выполнимые за пару сцен, строго в духе направления истории.',
      'STORY: открытая сюжетная задача (игрок её видит)',
      'SECRET: скрытая задача-сюрприз (игрок её не видит, а ты будешь ненавязчиво создавать для неё поводы). Её настроение — ' + mood.name + ': ' + mood.rule + '. ' + SECRET_RULES,
      'Ответь ровно двумя строками в этом формате, без пояснений.]'
    ].filter(Boolean).join('\n');
  }

  function cleanLine(raw) {
    return String(raw || '').replace(/[   -​  ⠀　ㅤ﻿]/g, ' ').replace(/\*\*/g, '').replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '');
  }

  function applyActivation(hol, raw) {
    var text = cleanLine(raw);
    var story = text.match(/STORY\s*[:：—–-]\s*(.+)/i);
    var secret = text.match(/SECRET\s*[:：—–-]\s*(.+)/i);
    if (story) hol.tasks.push({ text: story[1].trim(), done: false, hidden: false, kind: 'story' });
    if (secret) hol.tasks.push({ text: secret[1].trim(), done: false, hidden: true, kind: 'secret' });
  }

  // Реролл одной задачи праздника
  function rerollTaskPrompt(hol, idx, st, names, direction) {
    var x = hol.tasks[idx];
    var others = hol.tasks.filter(function (y, i) { return i !== idx && !y.hidden; }).map(function (y) { return '«' + y.text + '»'; }).join(', ');
    var what;
    if (x.kind === 'secret') {
      var mood = moodOf(hol);
      what = 'Придумай новую скрытую задачу-сюрприз. Настроение — ' + mood.name + ': ' + mood.rule + '. ' + SECRET_RULES;
    } else if (x.kind === 'classic') {
      what = 'Предложи другую классическую традицию этого праздника' + (placeLine(st) ? ' для места: ' + placeLine(st) : '') + ', которая подходит к направлению истории.';
    } else {
      what = 'Придумай другую открытую праздничную задачу, связанную с праздником и с персонажами, отношениями, происходящим в истории. Лёгкую, выполнимую за пару сцен.';
    }
    return [
      '[OOC: Пауза в ролевой игре. Ты — помощник автора. Праздник: ' + hol.name + '.',
      direction ? direction + '\n' : '',
      x.kind === 'secret' ? 'Игроку нужна другая секретная задача.' : 'Игроку не подошла задача «' + x.text + '».',
      what,
      others ? 'Не повторяй остальные задачи: ' + others + '.' : '',
      'Ответь ровно одной строкой:',
      'TASK: текст задачи для ' + names.user + ']'
    ].filter(Boolean).join('\n');
  }

  function applyTaskReroll(hol, idx, raw) {
    var m = cleanLine(raw).match(/(?:TASK|SECRET|STORY)\s*[:：—–-]\s*(.+)/i);
    var x = hol.tasks[idx];
    if (!m || !x) return false;
    x.text = m[1].trim().replace(/\]$/, '');
    x.done = false;
    return true;
  }

  function whenText(hol, today) {
    if (today < hol.start) {
      var d = daysBetween(today, hol.start);
      return d === 1 ? 'завтра' : 'через ' + daysWord(d);
    }
    if (today > hol.end) return 'уже прошёл';
    return hol.start === hol.end ? 'сегодня' : 'идёт сейчас';
  }

  // Блок праздника для обычных ответов модели
  function buildHolidayInjection(st) {
    ensureHolidayState(st);
    var out = [];
    var hol = st.holiday;
    var today = st.time.date;
    if (hol && !hol.finished && today) {
      var lines = ['[Праздничное событие: ' + hol.emoji + ' ' + hol.name + ' — ' + whenText(hol, today) + '.'];
      if (hol.vibe) lines.push('Атмосфера вокруг: ' + hol.vibe + '.');
      var open = hol.tasks.map(function (x, i) { return { x: x, n: i + 1 }; }).filter(function (o) { return !o.x.hidden; });
      lines.push('Праздничные традиции, которые игрок может выполнить (персонажи могут предлагать, но не навязывай):');
      open.forEach(function (o) { lines.push(o.n + '. ' + o.x.text + (o.x.done ? ' — уже сделано' : '')); });
      var sec = hol.tasks.map(function (x, i) { return { x: x, n: i + 1 }; }).filter(function (o) { return o.x.hidden && !o.x.done; });
      if (sec.length) lines.push('Секретная задача (' + moodOf(hol).name + '; игрок о ней не знает; создавай для неё ненавязчивые поводы, не раскрывай прямо; это ситуация, а не сценарий — не диктуй персонажам реплики и чувства): ' + sec.map(function (o) { return o.n + '. ' + o.x.text; }).join('; '));
      lines.push('Служебные метки: если в твоём ответе одна из задач по-настоящему выполнена — допиши в самом конце ответа <!--✓номер-->. Если в ответе наступил следующий день — допиши <!--день+1--> (или +N, если прошло несколько дней). Метки невидимы для игрока; не упоминай их в тексте.]');
      out.push(lines.join('\n'));
    }
    var traces = st.traces.filter(function (x) { return today && today <= x.until; });
    if (traces.length) out.push('[Следы недавних праздников — они ещё заметны в сцене: ' + traces.map(function (x) { return x.text; }).join(' ') + ']');
    if (st.memories.length) out.push('[Воспоминания о прошлых праздниках (персонажи могут на них ссылаться): ' + st.memories.slice(-5).map(function (m) { return m.text; }).join(' ') + ']');
    return out.join('\n\n');
  }

  function fullInjection(st) {
    return [buildTimeInjection(st), buildHolidayInjection(st)].filter(Boolean).join('\n\n');
  }

  // Строки для плановой проверки: подстраховка, если модель забыла поставить метку
  function holidayCheckSection(st) {
    ensureHolidayState(st);
    var hol = st.holiday;
    if (!hol || hol.finished) return '';
    var lines = ['Праздник «' + hol.name + '», задачи:'];
    hol.tasks.forEach(function (x, i) { lines.push((i + 1) + '. ' + x.text + (x.hidden ? ' (секретная)' : '') + (x.done ? ' — выполнено' : '')); });
    lines.push('TASK номер — если задача уже выполнена в чате, но выше не отмечена.');
    return lines.join('\n');
  }

  function markTask(st, n, res) {
    var hol = st.holiday;
    if (!hol || hol.finished) return;
    var x = hol.tasks[Number(n) - 1];
    if (!x || x.done) return;
    x.done = true;
    (res.tasksDone = res.tasksDone || []).push(x);
  }

  // Метки в обычном ответе модели: <!--✓2-->, <!--день+1-->
  var TAG_RE = /<!--\s*(✓|v|done)\s*#?(\d+)\s*-->|<!--\s*(день|day)\s*\+\s*(\d+)\s*-->/gi;
  function applyReplyTags(st, text, res) {
    var m;
    TAG_RE.lastIndex = 0;
    var found = false;
    while ((m = TAG_RE.exec(String(text || '')))) {
      found = true;
      if (m[2]) markTask(st, m[2], res);
      else if (m[4] && st.time.date) {
        var n = Math.min(60, Number(m[4]) || 1);
        st.time.date = addDays(st.time.date, n);
        res.timeMoved = (res.timeMoved || 0) + n;
      }
    }
    return found;
  }
  function stripTags(text) {
    return String(text || '').replace(TAG_RE, '').replace(/\s+$/, '');
  }

  function tierOf(hol) {
    var open = hol.tasks.filter(function (x) { return !x.hidden; });
    var done = open.filter(function (x) { return x.done; }).length;
    var secret = hol.tasks.some(function (x) { return x.hidden && x.done; });
    var share = open.length ? done / open.length : 0;
    var tier = done === 0 ? 'anti' : share < 0.5 ? 'bronze' : share < 1 ? 'silver' : 'gold';
    return { tier: tier, done: done, total: open.length, secret: secret };
  }
  var TIER_NAMES = { anti: 'антимедаль', bronze: 'бронза', silver: 'серебро', gold: 'золото' };
  var TIER_ICONS = { anti: '🥔', bronze: '🥉', silver: '🥈', gold: '🥇' };

  function finalePrompt(hol, st, names) {
    var t = tierOf(hol);
    return [
      '[OOC: Пауза в ролевой игре. Ты — помощник автора. Праздник «' + hol.name + '» закончился. Перечитай, как он прошёл в чате (если он прошёл за кадром из-за таймскипа — оцени, как он мог пройти).',
      'Задачи праздника: ' + hol.tasks.map(function (x) { return '«' + x.text + '»' + (x.hidden ? ' (секретная)' : '') + ' — ' + (x.done ? 'выполнено' : 'нет'); }).join('; ') + '.',
      'Итог: выполнено ' + t.done + ' из ' + t.total + ' открытых традиций' + (t.secret ? ', и секретная задача тоже' : '') + '. Уровень медали: ' + TIER_NAMES[t.tier] + '.',
      'Ответь ровно тремя строками:',
      'MEDAL: эмодзи | смешное название | одна строка с юмором о том, как ' + names.user + ' на самом деле провёл(а) этот праздник' + (t.tier === 'anti' ? ' (это антимедаль за то, что праздник прошёл мимо)' : ''),
      'OUTCOME: 1–2 предложения о том, как это отразилось на отношениях: кто доволен, кто разочарован. ' + (t.tier === 'anti' || t.tier === 'bronze' ? 'Добавь лёгкие последствия в духе истории.' : 'Отметь, чем праздник запомнится.'),
      'TRACE: что осталось от праздника в ближайшие дни — предмет, фото, остатки еды, следы веселья.]'
    ].join('\n').replace(/\{\{user\}\}/gi, names.user);
  }

  function applyFinale(hol, st, raw) {
    var t = tierOf(hol);
    var text = String(raw || '').replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u2800\u3000\u3164\uFEFF]/g, ' ').replace(/\*\*/g, '');
    var medal = text.match(/MEDAL\s*[:：—–-]\s*(.+)/i);
    var outcome = text.match(/OUTCOME\s*[:：—–-]\s*(.+)/i);
    var trace = text.match(/TRACE\s*[:：—–-]\s*(.+)/i);
    var parts = medal ? medal[1].split('|').map(function (s) { return s.trim(); }) : [];
    var m = {
      emoji: parts[0] || hol.emoji,
      title: parts[1] || (TIER_NAMES[t.tier][0].toUpperCase() + TIER_NAMES[t.tier].slice(1) + ': ' + hol.name),
      desc: parts[2] || ('Выполнено ' + t.done + ' из ' + t.total + ' традиций.'),
      tier: t.tier, secret: t.secret, holiday: hol.name, date: hol.end
    };
    st.medals.push(m);
    var year = hol.end.slice(0, 4);
    if (outcome) st.memories.push({ text: hol.name + ' ' + year + ': ' + outcome[1].trim(), date: hol.end });
    if (st.memories.length > 12) st.memories.splice(0, st.memories.length - 12);
    if (trace) st.traces.push({ text: trace[1].trim(), until: addDays(hol.end, 5) });
    st.traces = st.traces.filter(function (x) { return x.until >= (st.time.date || x.until); });
    hol.finished = true;
    st.holidayDone[hol.key] = true;
    addEvent(st, hol.end, hol.name + ': ' + (outcome ? outcome[1].trim() : 'праздник прошёл') + ' (медаль «' + m.title + '»)');
    return m;
  }

  // Напоминания: за leadDays дней и в сам день — по одному разу
  function dueReminders(st, leadDays) {
    ensureHolidayState(st);
    var out = [];
    if (!st.time.date) return out;
    upcoming(st, leadDays).forEach(function (h) {
      var key = h.name + '|' + h.start;
      var stage = h.ongoing || h.inDays === 0 ? 'today' : 'soon';
      var seen = st.notified[key] || [];
      if (seen.indexOf(stage) >= 0) return;
      seen.push(stage);
      st.notified[key] = seen;
      var tr = traditionsFor(h, st.time.country);
      var emoji = (tr && tr.emoji) || '📅';
      out.push(stage === 'today'
        ? emoji + ' Сегодня — ' + h.name
        : emoji + ' ' + (h.inDays === 1 ? 'Завтра' : 'Через ' + daysWord(h.inDays)) + ' — ' + h.name);
    });
    var keys = Object.keys(st.notified);
    if (keys.length > 60) keys.slice(0, keys.length - 60).forEach(function (k) { delete st.notified[k]; });
    return out;
  }

  // ---------- Движок праздника (общий для всех версий) ----------
  // io: { generate(prompt, withContext) -> текст, toast(text), names, lead, events, showToasts }
  // Меняет st на месте; сохранение — на стороне вызывающего.
  async function holidayProgress(st, io, opts) {
    opts = opts || {};
    ensureHolidayState(st);
    if (!st.time.date) return;
    var reminders = dueReminders(st, io.lead);
    if (io.showToasts) reminders.forEach(function (x) { io.toast(x); });
    if (!io.events) return;
    var hol = st.holiday;
    if (hol && !hol.finished && (opts.finish || st.time.date > hol.end)) {
      var raw = '';
      try { raw = await io.generate(finalePrompt(hol, st, io.names), true); } catch (e) { raw = ''; }
      if (!hol.finished) {
        var medal = applyFinale(hol, st, raw);
        io.toast('🏅 ' + medal.emoji + ' «' + medal.title + '» — ' + medal.desc);
      }
    }
    var found = holidayToActivate(st, io.lead);
    if (found) {
      var h = newHoliday(found);
      var raw2 = '';
      try { raw2 = await io.generate(activationPrompt(h, st, io.names, io.direction || ''), true); } catch (e) { raw2 = ''; }
      applyActivation(h, raw2);
      st.holiday = h;
      var open = h.tasks.filter(function (x) { return !x.hidden; }).length;
      io.toast(h.emoji + ' Праздничное событие: ' + h.name + '\nТрадиций: ' + open + (h.tasks.length > open ? ' + 🔒 секретная (' + moodOf(h).icon + ')' : ''));
    }
  }

  function holidaySummary(res) {
    var out = [];
    (res.tasksDone || []).forEach(function (x) { out.push(x.hidden ? '🔓 Секретная задача выполнена: ' + x.text : '✓ ' + x.text); });
    return out;
  }

  // Дни рождения
  function normNameB(x) { return String(x || '').trim().toLowerCase().replace(/ё/g, 'е'); }
  function hasBday(st, who) {
    var k = normNameB(who);
    return st.time.custom.some(function (c) { return c.bday && normNameB(c.who) === k; });
  }
  function bdaySection(st, userName, charNames) {
    var known = st.time.custom.filter(function (c) { return c.bday; }).map(function (c) { var md = c.md.split('-').map(Number); return c.who + ' — ' + md[1] + ' ' + MONTHS_GEN[md[0] - 1]; });
    var lines = ['Дни рождения' + (known.length ? ' (уже известны: ' + known.join(', ') + ')' : '') + '.'];
    var missing = [userName].concat(charNames || []).filter(function (n) { return n && !hasBday(st, n); });
    if (missing.length) lines.push('Ещё не заданы для: ' + missing.join(', ') + '. Найди дату в карточке персонажа, описании персоны или в чате; если её нигде нет — придумай правдоподобную, подходящую персонажу.');
    lines.push('BDAY Имя: ДД.ММ — день рождения ' + (missing.length ? 'для них, а также ' : '') + 'для значимого NPC, если о нём есть сведения в истории или он важен для сюжета.');
    return lines.join('\n');
  }
  // Команды TASK и BDAY. Возвращает true, если строка распознана.
  function applyEventCommand(st, line, res) {
    var m = line.match(/^TASK\s*✓?\s*#?\s*(\d+)/i);
    if (m) { markTask(st, m[1], res); return true; }
    m = line.match(/^BDAY\s*[:：]?\s*\[?([^\]:：]{1,60}?)\]?\s*[:：—–-]\s*(.+)$/i);
    if (m) {
      var who = m[1].trim();
      var iso = parseDateText(m[2], '2000-01-01');
      if (iso && !hasBday(st, who)) {
        st.time.custom.push({ name: 'День рождения: ' + who, md: iso.slice(5), bday: true, who: who });
        (res.bdays = res.bdays || []).push(who);
      }
      return true;
    }
    return false;
  }


const defaults = {
    enabled: true,
    interval: 8,
    depth: 4,
    role: 0,
    events: true,
    leadDays: 3,
    showToasts: true,
};

let busy = false;
const ctx = () => SillyTavern.getContext();

function settings() {
    const all = ctx().extensionSettings;
    if (!all[MODULE]) all[MODULE] = structuredClone(defaults);
    for (const k of Object.keys(defaults)) if (all[MODULE][k] === undefined) all[MODULE][k] = defaults[k];
    return all[MODULE];
}

function store() {
    const c = ctx();
    if (!c.chatId || !c.chatMetadata) return null;
    if (!c.chatMetadata[MODULE]) c.chatMetadata[MODULE] = { lastCheckAt: c.chat?.length ?? 0, lastRaw: '' };
    const st = c.chatMetadata[MODULE];
    st.direction = { time: true }; // общим функциям календаря нужен этот флаг
    if (!st.time) st.time = { date: '', country: '', countryName: '', city: '', flavor: '', flavorLocked: false, custom: [] };
    if (!Array.isArray(st.time.custom)) st.time.custom = [];
    if (!Array.isArray(st.time.timeline)) st.time.timeline = [];
    if (typeof st.lastCheckAt !== 'number') st.lastCheckAt = c.chat?.length ?? 0;
    if (typeof st.lastRaw !== 'string') st.lastRaw = '';
    ensureHolidayState(st);
    return st;
}

function escapeHtml(t) {
    return String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function storyNames() {
    const c = ctx();
    let chars = [];
    try {
        if (c.groupId && Array.isArray(c.groups)) {
            const g = c.groups.find(x => x.id === c.groupId);
            chars = (g?.members || []).map(av => c.characters.find(ch => ch.avatar === av)?.name).filter(Boolean);
        }
    } catch (e) { /* ignore */ }
    if (!chars.length && c.name2) chars = [c.name2];
    return { user: c.name1 || 'игрок', char: chars.join(', ') || 'персонаж', chars };
}

function updateInjection() {
    const c = ctx();
    const s = settings();
    const st = store();
    const text = s.enabled && st ? (s.events ? fullInjection(st) : buildTimeInjection(st)) : '';
    c.setExtensionPrompt(INJECT_KEY, text || '', POS_IN_CHAT, Number(s.depth) || 0, false, Number(s.role) || 0);
}

// ---------- запросы к модели ----------
let ownPrompt = '';

async function quietGenerateOnce(prompt) {
    const fn = ctx().generateQuietPrompt;
    ownPrompt = prompt;
    try {
        if (fn.length === 0) return await fn({ quietPrompt: prompt });
        return await fn(prompt, false, false);
    } finally {
        ownPrompt = '';
    }
}

// Таверна добавляет скрытый промпт в конец как системное сообщение; некоторые
// провайдеры (Gemini через прокси без постобработки) на этом падают — делаем его сообщением пользователя.
function fixOwnPromptRole(data) {
    if (!ownPrompt || !data || data.dryRun || !Array.isArray(data.chat)) return;
    const probe = ownPrompt.slice(0, 60);
    const msgs = data.chat;
    for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (typeof m?.content !== 'string' || !m.content.includes(probe)) continue;
        if (m.role !== 'system') return;
        const prev = msgs[i - 1];
        if (prev && prev.role === 'user' && typeof prev.content === 'string') {
            prev.content += '\n\n' + m.content;
            msgs.splice(i, 1);
        } else {
            m.role = 'user';
            delete m.name;
        }
        return;
    }
}

const ODD_SPACES = /[   -​  ⠀　ㅤ﻿]/g;

async function quietGenerate(prompt) {
    try {
        return String(await quietGenerateOnce(prompt) ?? '').replace(ODD_SPACES, ' ');
    } catch (err) {
        const msg = String(err?.message || err);
        if (!/429|too many|rate|exhausted|quota/i.test(msg)) throw err;
        setStatus('Лимит запросов — жду 30 секунд и пробую ещё раз…');
        toastr.info('Лимит запросов у провайдера. Повторю через 30 секунд.', TITLE);
        await new Promise(r => setTimeout(r, 30000));
        return String(await quietGenerateOnce(prompt) ?? '').replace(ODD_SPACES, ' ');
    }
}

function buildCheckPrompt(st) {
    const names = storyNames();
    return [
        '[OOC: Пауза в ролевой игре. Сейчас ты НЕ пишешь ответ персонажа. На минуту ты — помощник автора, который следит за временем и местом действия этой истории. Перечитай чат.',
        '',
        buildTimeSection(st),
        '',
        bdaySection(st, names.user, names.chars),
        '',
        settings().events ? holidayCheckSection(st) : '',
        '',
        'Ответь ТОЛЬКО командами, каждая с новой строки, без пояснений и без текста роли. Если ничего не изменилось — ответь одним словом: NONE]',
    ].join('\n').replace(/\n{3,}/g, '\n\n').replace(/\{\{user\}\}/gi, names.user).replace(/\{\{char\}\}/gi, names.char);
}

function cleanRaw(raw) {
    return String(raw || '').replace(ODD_SPACES, ' ').replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '').replace(/\*\*/g, '').trim();
}

function parseAndApply(st, raw) {
    const res = {};
    const text = cleanRaw(raw);
    if (!text || /^NONE[.!]?$/i.test(text)) return res;
    for (let line of text.split('\n')) {
        line = line.trim().replace(/^[-*•>\s]+/, '').replace(/^`+|`+$/g, '').trim();
        if (!line) continue;
        if (applyTimeCommand(st, line, res)) continue;
        applyEventCommand(st, line, res);
    }
    return res;
}

function summarize(res, st) {
    const parts = [];
    if (res.timeMoved) parts.push(`📅 ${res.timeMoved > 0 ? 'прошло' : 'назад на'} ${daysWord(Math.abs(res.timeMoved))} → ${formatDate(st.time.date)}`);
    else if (res.dateSet) parts.push(`📅 дата истории: ${formatDate(res.dateSet)}`);
    if (res.placeSet) parts.push(`📍 место: ${placeLine(st)}`);
    if (res.bdays) parts.push(`🎂 дни рождения: ${res.bdays.join(', ')}`);
    if (res.events) parts.push(`📜 в хронику: ${res.events.length}`);
    holidaySummary(res).forEach(x => parts.push(x));
    return parts;
}

async function fillFlavor(st, manual) {
    const t = st.time;
    if (!placeLine(st) || (!manual && (t.flavor || t.flavorLocked))) return false;
    const text = cleanFlavor(await quietGenerate(flavorPrompt(st)));
    if (!text) { if (manual) toastr.warning('Модель не написала колорит — попробуй ещё раз', TITLE); return false; }
    t.flavor = text;
    t.flavorLocked = false;
    if (manual) toastr.success('🧭 Колорит обновлён', TITLE);
    return true;
}

async function holidayStep(st, opts) {
    const s = settings();
    await holidayProgress(st, {
        generate: p => quietGenerate(p),
        toast: x => toastr.info(escapeHtml(x).replace(/\n/g, '<br>'), TITLE, { escapeHtml: false, timeOut: 9000 }),
        names: storyNames(),
        direction: '',
        lead: Math.max(1, Number(s.leadDays) || 3),
        events: !!s.events,
        showToasts: !!s.showToasts,
    }, opts);
}

// Обёртка для действий с запросом к модели
async function withBusy(status, fn) {
    if (busy) { toastr.info('Модель уже занята — подожди пару секунд', TITLE); return undefined; }
    const st = store();
    if (!st) { toastr.warning('Сначала открой чат', TITLE); return undefined; }
    const chatId = ctx().chatId;
    busy = true;
    setStatus(status);
    ctx().setExtensionPrompt(INJECT_KEY, '', POS_IN_CHAT, 0);
    try {
        return await fn(st);
    } catch (err) {
        console.error('[time_place]', err);
        toastr.error(String(err?.message || err), `${TITLE}: ошибка`);
        return undefined;
    } finally {
        if (ctx().chatId === chatId) await ctx().saveMetadata();
        busy = false;
        updateInjection();
        renderPanel();
    }
}

async function check(manual = false) {
    if (!ctx().chat?.length) return;
    await withBusy('Модель сверяет время и место…', async st => {
        const s = settings();
        const raw = await quietGenerate(buildCheckPrompt(st));
        st.lastRaw = raw;
        st.lastCheckAt = ctx().chat.length;
        const res = parseAndApply(st, raw);
        const parts = summarize(res, st);
        if (parts.length && (s.showToasts || manual)) toastr.success(parts.map(escapeHtml).join('<br>'), TITLE, { escapeHtml: false, timeOut: 8000 });
        else if (!parts.length && manual) toastr.info(cleanRaw(raw) ? '📅 Без изменений' : 'Модель вернула пустой ответ', TITLE);
        try { await fillFlavor(st, false); } catch (e) { /* не критично */ }
        await holidayStep(st);
    });
}

const runHolidayStep = opts => withBusy('Проверяю праздники…', st => holidayStep(st, opts));
const runFlavor = () => withBusy('Модель пишет местный колорит…', st => fillFlavor(st, true));

async function rerollHolidayTask(idx) {
    await withBusy('Модель придумывает другую задачу…', async st => {
        const hol = st.holiday;
        if (!hol || hol.finished || !hol.tasks[idx]) return;
        const raw = await quietGenerate(rerollTaskPrompt(hol, idx, st, storyNames(), ''));
        st.lastRaw = raw;
        if (!applyTaskReroll(hol, idx, raw)) { toastr.warning('Модель ответила не по формату — загляни в «Последний ответ модели»', TITLE); return; }
        const x = hol.tasks[idx];
        toastr.success(x.hidden ? '🔒 Секретная задача заменена' : escapeHtml(x.text), '🎲 Новая задача', { escapeHtml: false });
    });
}

// Метки в ответе модели: <!--✓2--> (задача выполнена), <!--день+1--> (наступил следующий день)
async function processReplyTags() {
    const st = store();
    const s = settings();
    if (!st || !s.enabled) return;
    const c = ctx();
    const id = c.chat.length - 1;
    const msg = c.chat[id];
    if (!msg || msg.is_user || typeof msg.mes !== 'string' || !msg.mes.includes('<!--')) return;
    const res = {};
    if (!applyReplyTags(st, msg.mes, res)) return;
    msg.mes = stripTags(msg.mes);
    try {
        if (typeof c.updateMessageBlock === 'function') c.updateMessageBlock(id, msg);
        await c.saveChat();
    } catch (e) { /* метки невидимы */ }
    const parts = holidaySummary(res);
    if (res.timeMoved) parts.unshift(`📅 прошло ${daysWord(res.timeMoved)} → ${formatDate(st.time.date)}`);
    if (parts.length && s.showToasts) toastr.success(parts.map(escapeHtml).join('<br>'), TITLE, { escapeHtml: false, timeOut: 8000 });
    await c.saveMetadata();
    if (res.timeMoved) await runHolidayStep();
}

async function onMessageReceived() {
    try { await processReplyTags(); } catch (e) { console.error('[time_place] tags', e); }
    updateInjection();
    renderPanel();
    const s = settings();
    const st = store();
    if (!s.enabled || !st || busy) return;
    const len = ctx().chat.length;
    if (st.lastCheckAt > len) st.lastCheckAt = len;
    const unknown = !st.time.date || !placeLine(st);
    if ((unknown && len >= 2 && len - st.lastCheckAt >= 2) || len - st.lastCheckAt >= (Number(s.interval) || 8)) {
        setTimeout(() => check(false), 800);
    }
}

// ---------- интерфейс ----------
const PANEL_HTML = `
<div class="tpl-settings">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>📅 Время и праздники</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content" id="tpl_panel">
      <label class="checkbox_label"><input type="checkbox" id="tpl_enabled"> Включено</label>
      <label class="checkbox_label"><input type="checkbox" id="tpl_toasts"> Уведомлять об изменениях даты и места</label>
      <label class="checkbox_label"><input type="checkbox" id="tpl_events"> Праздничные события (традиции и медали)</label>
      <div class="tpl-row"><label for="tpl_interval">Проверять время каждые N сообщений</label><input type="number" min="2" max="100" class="text_pole" id="tpl_interval"></div>
      <div class="tpl-row"><label for="tpl_lead">За сколько дней напоминать о праздниках</label><input type="number" min="1" max="7" class="text_pole" id="tpl_lead"></div>
      <div class="tpl-row"><label for="tpl_depth">Глубина вставки</label><input type="number" min="0" max="50" class="text_pole" id="tpl_depth"></div>
      <small class="tpl-hint">Если стоит и «Блокнот рассказчика», выключи в нём раздел «Время и место в этом чате», чтобы время не учитывалось дважды.</small>
      <div class="tpl-status" id="tpl_status"></div>
      <div class="menu_button" id="tpl_check"><i class="fa-solid fa-magnifying-glass"></i> Проверить сейчас</div>
      <div id="tpl_body"></div>
    </div>
  </div>
</div>`;

function setStatus(text) {
    if (text) { $('#tpl_status').text(text); return; }
    const st = store();
    const s = settings();
    if (!st) { $('#tpl_status').text('Чат не открыт'); return; }
    const len = ctx().chat?.length ?? 0;
    const left = Math.max(0, (Number(s.interval) || 8) - (len - st.lastCheckAt));
    $('#tpl_status').text(s.enabled ? `До следующей проверки: ${left} сообщ.` : 'Выключено');
}

async function askText(title, initial = '') {
    const c = ctx();
    if (typeof c.callGenericPopup === 'function' && c.POPUP_TYPE) {
        const r = await c.callGenericPopup(title, c.POPUP_TYPE.INPUT, initial, { rows: 3 });
        return typeof r === 'string' ? r : null;
    }
    return window.prompt(title, initial);
}

async function commit() {
    await ctx().saveMetadata();
    updateInjection();
    renderPanel();
}

function renderPanel() {
    const body = $('#tpl_body').empty();
    if (!busy) setStatus('');
    const st = store();
    if (!st) return;
    renderCalendar(st, body);
    renderHolidays(st, body);
    if (st.lastRaw) {
        const det = $('<details><summary>Последний ответ модели</summary><pre class="tpl-raw"></pre></details>');
        det.find('pre').text(st.lastRaw);
        body.append(det);
    }
}

function renderCalendar(st, body) {
    const t = st.time;
    const det = $('<details open class="tpl-section"><summary>📅 Календарь</summary></details>');
    body.append(det);
    const head = $('<div class="tpl-now"></div>');
    if (t.date) { const s = season(t.date); head.text(`${weekday(t.date)}, ${formatDate(t.date)} · ${s.name}, ${s.phase}`); }
    else head.text('Дата не задана — модель определит её при проверке, или задай сама.');
    det.append(head);

    const dateRow = $(`<div class="tpl-row tpl-wrap">
        <input type="date" class="text_pole tpl-date">
        <div class="menu_button tpl-shift" data-d="-1">−1 д</div>
        <div class="menu_button tpl-shift" data-d="1">+1 д</div>
        <div class="menu_button tpl-shift" data-d="7">+1 нед</div>
        <div class="menu_button tpl-shift" data-m="1">+1 мес</div>
      </div>`);
    dateRow.find('.tpl-date').val(t.date).on('change', async function () {
        const v = $(this).val();
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { t.date = v; await commit(); runHolidayStep(); }
    });
    dateRow.find('.tpl-shift').on('click', async function () {
        const base = t.date || toIso(new Date());
        const d = Number($(this).data('d') || 0), mo = Number($(this).data('m') || 0);
        t.date = mo ? addMonths(base, mo) : addDays(base, d);
        await commit();
        runHolidayStep();
    });
    det.append(dateRow);

    const placeRow = $(`<div class="tpl-row tpl-wrap">
        <select class="text_pole tpl-country">
          <option value="">Страна не задана</option>
          <option value="UK">Великобритания</option>
          <option value="US">США</option>
          <option value="JP">Япония</option>
          <option value="RU">Россия</option>
          <option value="other">Другая…</option>
        </select>
        <input type="text" class="text_pole tpl-city" placeholder="Город">
      </div>`);
    const other = $('<input type="text" class="text_pole" placeholder="Название страны">');
    const sel = placeRow.find('.tpl-country');
    sel.val(t.country || (t.countryName ? 'other' : ''));
    other.val(t.countryName).toggle(!t.country && !!t.countryName);
    const placeChanged = async () => {
        if (!t.flavorLocked) t.flavor = '';
        await commit();
        if (placeLine(st) && !t.flavor) runFlavor();
    };
    sel.on('change', async function () {
        const v = $(this).val();
        if (v === 'other') { t.country = ''; other.show().trigger('focus'); return; }
        t.country = v;
        t.countryName = '';
        await placeChanged();
    });
    other.on('change', async function () { t.country = ''; t.countryName = $(this).val().trim(); await placeChanged(); });
    placeRow.find('.tpl-city').val(t.city).on('change', async function () { t.city = $(this).val().trim(); await commit(); });
    det.append(placeRow, other);

    const flavor = $('<textarea class="text_pole tpl-flavor" rows="3" placeholder="Местный колорит: еда, деньги, транспорт, климат, привычки. Модель заполнит сама, когда известна страна."></textarea>');
    flavor.val(t.flavor).on('change', async function () { t.flavor = $(this).val().trim(); t.flavorLocked = !!t.flavor; await commit(); });
    det.append(flavor);
    det.append($('<div class="menu_button"><i class="fa-solid fa-compass"></i> Сгенерировать колорит</div>').on('click', () => {
        if (!placeLine(st)) return toastr.warning('Сначала укажи страну или город', TITLE);
        runFlavor();
    }));

    const list = t.timeline;
    const chron = $('<details class="tpl-section"><summary></summary></details>');
    chron.find('summary').text(`📜 Хроника (${list.length})`);
    if (!list.length) chron.append('<div class="tpl-empty">Здесь будут важные события с датами — модель записывает их при проверках.</div>');
    [...list].reverse().forEach(e => {
        const row = $('<div class="tpl-card"><div class="tpl-meta"></div><div class="tpl-text"></div><div class="tpl-actions"><i class="fa-solid fa-trash" title="Удалить"></i></div></div>');
        row.find('.tpl-meta').text(formatDate(e.date) + (t.date ? ` · ${agoText(daysBetween(e.date, t.date))}` : ''));
        row.find('.tpl-text').text(e.text);
        row.find('.fa-trash').on('click', async () => { list.splice(list.indexOf(e), 1); await commit(); });
        chron.append(row);
    });
    chron.append($('<div class="menu_button"><i class="fa-solid fa-plus"></i> Добавить событие</div>').on('click', async () => {
        const text = await askText('Что произошло?');
        if (!text || !text.trim()) return;
        const when = await askText('Когда? Например «14 октября» или «14.10.2024». Пусто — сегодня по истории');
        if (when === null) return;
        let date = when.trim() ? parseDateText(when, '1900-01-01') : t.date;
        if (!date) return toastr.warning('Не поняла дату', TITLE);
        if (t.date && date > t.date && !/\d{4}/.test(when)) date = `${Number(t.date.slice(0, 4)) - 1}${date.slice(4)}`;
        addEvent(st, date, text);
        await commit();
    }));
    det.append(chron);
}

function renderHolidays(st, body) {
    const s = settings();
    const t = st.time;
    const hol = st.holiday;
    const active = s.events && hol && !hol.finished && t.date;
    const det = $('<details open class="tpl-section"><summary></summary></details>');
    det.find('summary').text('🎉 Праздники' + (active ? ' •' : ''));
    body.append(det);

    if (active) {
        const tier = tierOf(hol);
        const box = $('<div class="tpl-card tpl-event"><div class="tpl-event-title"></div><div class="tpl-meta"></div><div class="tpl-tasks"></div></div>');
        box.find('.tpl-event-title').text(`${hol.emoji} ${hol.name} — ${whenText(hol, t.date)}`);
        box.find('.tpl-meta').text(`Традиции: ${tier.done} из ${tier.total}${hol.tasks.some(x => x.hidden) ? ' · есть секретная задача' : ''}`);
        hol.tasks.forEach((x, i) => {
            const row = $('<div class="tpl-task-row"><label class="checkbox_label"><input type="checkbox"><span></span></label><div class="tpl-actions"><i class="fa-solid fa-dice" title="Другая задача"></i><i class="fa-solid fa-pen" title="Изменить"></i></div></div>');
            row.find('span').text(x.hidden && !x.done ? '🔒 Секретная задача' : `${x.hidden ? '🔓 ' : ''}${x.text}`);
            row.find('input').prop('checked', !!x.done).on('change', async function () { x.done = $(this).prop('checked'); await commit(); });
            if (x.done) row.find('.tpl-actions').remove();
            if (x.hidden) row.find('.fa-pen').remove();
            row.find('.fa-dice').on('click', () => rerollHolidayTask(i));
            row.find('.fa-pen').on('click', async () => {
                const v = await askText('Изменить задачу', x.text);
                if (v && v.trim()) { x.text = v.trim(); await commit(); }
            });
            box.find('.tpl-tasks').append(row);
        });
        box.append($('<div class="menu_button"><i class="fa-solid fa-flag-checkered"></i> Завершить праздник и получить медаль</div>').on('click', () => runHolidayStep({ finish: true })));
        det.append(box);
    } else if (s.events) {
        det.append($('<div class="tpl-empty"></div>').text(`Сейчас праздничного события нет. Оно начнётся за ${Math.max(1, Number(s.leadDays) || 3)} дн. до ближайшего праздника или дня рождения.`));
    }

    if (t.date) {
        det.append('<div class="tpl-subhead">Ближайшие праздники и события</div>');
        const up = upcoming(st, 60);
        if (!up.length) det.append('<div class="tpl-empty">В ближайшие два месяца ничего нет.</div>');
        up.forEach(h => {
            const when = h.ongoing ? 'идёт сейчас' : h.inDays === 0 ? 'сегодня' : `через ${daysWord(h.inDays)}`;
            det.append($('<div class="tpl-sub"></div>').text(`${formatDate(h.start, false)} — ${h.name} (${when})`));
        });
    }

    det.append('<div class="tpl-subhead">Свои даты</div>');
    if (!t.custom.length) det.append('<div class="tpl-empty">Дни рождения, годовщины и другие важные даты.</div>');
    t.custom.forEach((c, i) => {
        const row = $('<div class="tpl-card"><div class="tpl-text"></div><div class="tpl-actions"><i class="fa-solid fa-trash" title="Удалить"></i></div></div>');
        const [mm, dd] = c.md.split('-').map(Number);
        row.find('.tpl-text').text(`${dd} ${MONTHS_GEN[mm - 1]} — ${c.name}`);
        row.find('.fa-trash').on('click', async () => { t.custom.splice(i, 1); await commit(); });
        det.append(row);
    });
    det.append($('<div class="menu_button"><i class="fa-solid fa-cake-candles"></i> Добавить свою дату</div>').on('click', async () => {
        const name = await askText('Что за дата? Например «День рождения Деку» или «Годовщина знакомства»');
        if (!name || !name.trim()) return;
        const when = await askText('Когда? Например «20 февраля» или «20.02»');
        if (!when) return;
        const iso = parseDateText(when, '2000-01-01');
        if (!iso) return toastr.warning('Не поняла дату. Напиши, например, «20 февраля» или «20.02».', TITLE);
        t.custom.push({ name: name.trim(), md: iso.slice(5) });
        await commit();
    }));

    if (st.medals.length) {
        const med = $('<details class="tpl-section"><summary></summary></details>');
        med.find('summary').text(`🏅 Витрина медалей (${st.medals.length})`);
        [...st.medals].reverse().forEach(m => {
            const row = $('<div class="tpl-card"><div class="tpl-text"></div><div class="tpl-meta"></div><div class="tpl-sub"></div></div>');
            row.find('.tpl-text').text(`${m.emoji || ''} «${m.title}»${m.secret ? ' ✨' : ''}`);
            row.find('.tpl-meta').text(`${TIER_ICONS[m.tier] || ''} ${TIER_NAMES[m.tier] || ''} · ${m.holiday} ${String(m.date || '').slice(0, 4)}`);
            row.find('.tpl-sub').text(m.desc);
            med.append(row);
        });
        det.append(med);
    }
    if (st.memories.length) {
        const mem = $('<details class="tpl-section"><summary></summary></details>');
        mem.find('summary').text(`💭 Воспоминания о праздниках (${st.memories.length})`);
        [...st.memories].reverse().forEach(m => mem.append($('<div class="tpl-sub"></div>').text(m.text)));
        det.append(mem);
    }
}

function bind(id, key, kind) {
    const el = $(`#${id}`);
    const s = settings();
    if (kind === 'checkbox') {
        el.prop('checked', !!s[key]).on('change', () => { s[key] = el.prop('checked'); ctx().saveSettingsDebounced(); updateInjection(); renderPanel(); });
    } else {
        el.val(s[key]).on('input change', () => { s[key] = Number(el.val()); ctx().saveSettingsDebounced(); updateInjection(); setStatus(''); });
    }
}

jQuery(async () => {
    const c = ctx();
    $('#extensions_settings2').append(PANEL_HTML);
    bind('tpl_enabled', 'enabled', 'checkbox');
    bind('tpl_toasts', 'showToasts', 'checkbox');
    bind('tpl_events', 'events', 'checkbox');
    bind('tpl_interval', 'interval', 'number');
    bind('tpl_lead', 'leadDays', 'number');
    bind('tpl_depth', 'depth', 'number');
    $('#tpl_check').on('click', () => check(true));

    const ev = c.event_types;
    c.eventSource.on(ev.MESSAGE_RECEIVED, onMessageReceived);
    for (const e of [ev.MESSAGE_SENT, ev.CHAT_CHANGED, ev.MESSAGE_DELETED]) {
        if (e) c.eventSource.on(e, () => { updateInjection(); renderPanel(); });
    }
    if (ev.CHAT_COMPLETION_PROMPT_READY) c.eventSource.on(ev.CHAT_COMPLETION_PROMPT_READY, fixOwnPromptRole);
    updateInjection();
    renderPanel();
});
