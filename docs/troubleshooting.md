# Troubleshooting

## DevTools шум (Autofill.enable / SSL handshake failed)

Это сообщения Chromium/Electron, обычно не влияющие на работу приложения.
Если мешают — отключаем автозапуск DevTools и включаем по флагу (TODO).

## “Cannot use import statement outside a module” / preload не грузится

Preload должен быть **CommonJS**:
- файл `electron/preload/index.cjs`
- сборка копирует его в `dist-electron/preload/index.cjs` (скрипт `scripts/copy_preload.mjs`)

Если `window.checkPrinter` отсутствует — значит preload не загрузился.

## Fake printer не пишет файлы

Проверь:
- запущен ли `npm run fake-printer`
- совпадает ли host/port в UI настройках (обычно `127.0.0.1:9100`)

Если `EADDRINUSE 9100` — порт занят, останови второй экземпляр.

## Нет заданий печати от backend

Сейчас обязательный шаг для прод‑режима: реализовать `join` в Socket.IO (room=`local_printer`).
Без `join` backend может не считать клиента “принтером” и не слать задания (TODO).

