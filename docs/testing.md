# Тестирование без принтера (fake printer)

## Зачем

Чтобы проверять, что:
- UI → IPC → ESC/POS → TCP работает
- байты реально отправляются на `host:port`

## Как запускать

1) В одном терминале:
```bash
npm run fake-printer
```

2) В другом терминале:
```bash
npm run dev
```

3) В UI нажать “Тестовая печать”.

## Результат

Fake printer сохраняет каждый “job” в:
- `fake-printer-out/job-<timestamp>.bin`

В терминале fake‑printer видно:
- `connection from ...`
- `received N bytes`

## Советы

- Если видишь `EADDRINUSE 9100` — порт занят (скорее всего уже запущен другой fake‑printer).
- Для теста можно менять `settings.printer.host/port` на другие значения.

## QA: статус‑бар (observability)

Проверки делаются в desktop‑приложении: сверху всегда виден статус‑бар (backend/socket/join/printer/update).

1) **Backend offline (HTTP)**
   - Выключи интернет или поставь неверный `Backend URL`.
   - Ожидаемо: `backend: нет`, в экране склада действия заблокированы и видна причина.

2) **Socket/join**
   - Поставь неправильный `Token (printer client)`.
   - Ожидаемо: `socket: ok`, `join: bad token` (или `join: нет` если сокет не подключился).

3) **Printer reachable**
   - Запусти `npm run fake-printer` и поставь `printer.host=127.0.0.1`, `printer.port=9100`.
   - Ожидаемо: `printer: ok`, “Тестовая печать” доступна.
   - Останови fake‑printer.
   - Ожидаемо: `printer: нет/timeout`, “Тестовая печать” заблокирована.

4) **Force update**
   - На backend выставь `min_supported_version` выше текущей версии приложения.
   - Ожидаемо: экран заглушки “Нужно обновить приложение”, действия заблокированы.

5) **Device activation (код)**
   - На сайте логистов → “Принтеры” (роль admin) сгенерируй код активации.
   - В desktop → “Статус” → “Активация устройства” введи/отсканируй код и нажми “Активировать”.
   - Ожидаемо: появится “Устройство активировано”, а в логах `Device activation OK`.

