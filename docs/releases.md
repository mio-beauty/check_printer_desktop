# Релизы и обновления

## Цели

- Логисты скачивают установщик клиента с сайта (фронта) из раздела “Скачать приложение”.
- Клиент умеет обновляться:
  - optional update: “Обновить” / “Не сейчас”
  - force update: только “Обновить”

Установщики публикуются в GitHub Releases.

## Имена файлов (рекомендуемые)

Для Windows (NSIS):
- `MioBeauty-SkladPrinter-Setup.exe` — стабильное имя asset для кнопки “Скачать”
- `latest.yml` — метаданные для auto-update
- `*.blockmap` — ускорение дифф‑обновления

## GitHub Actions (сборка и релиз)

Workflow: `.github/workflows/release.yml`

Триггер: push тега вида `v1.2.3`.

В CI используем `electron-builder` и публикацию в GitHub Releases через `GITHUB_TOKEN`.

## Канал обновлений

### Тесты (GitHub)
- Ссылка на скачивание (для фронта):  
  `https://github.com/<OWNER>/<REPO>/releases/latest/download/MioBeauty-SkladPrinter-Setup.exe`

## TODO

- ✅ `electron-updater` подключён (GitHub Releases).
- ✅ `GET /api/desktop/update-manifest` (политика force/optional) подключён через backend.
- ✅ Optional update: пользователь нажимает “Обновить” → скачивание → перезапуск.
- ✅ Force update: блокирующий экран → “Обновить” → скачивание → перезапуск.
