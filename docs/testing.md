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

