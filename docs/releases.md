# Релизы и обновления

## Цели

- Логисты скачивают установщик клиента с сайта (фронта) из раздела “Скачать приложение”.
- Клиент умеет обновляться:
  - optional update: “Обновить” / “Не сейчас”
  - force update: только “Обновить”

Best practice: **GitHub Releases (тесты, публично)** → затем **S3/CloudFront (прод)**.

## Имена файлов (рекомендуемые)

Для Windows (NSIS):
- `CheckPrinterClient-Setup.exe` — стабильное имя asset для кнопки “Скачать”
- `latest.yml` — метаданные для auto-update
- `*.blockmap` — ускорение дифф‑обновления

## GitHub Actions (сборка и релиз)

Workflow: `.github/workflows/release.yml`

Триггер: push тега вида `v1.2.3`.

В CI используем `electron-builder` и публикацию в GitHub Releases через `GITHUB_TOKEN`.

## Канал обновлений

### Тесты (GitHub)
- Ссылка на скачивание (для фронта):  
  `https://github.com/<OWNER>/<REPO>/releases/latest/download/CheckPrinterClient-Setup.exe`

### Прод (S3/CloudFront)
- Базовый URL: `https://downloads.<domain>/check-printer-client/win/`
- Файлы:
  - `.../latest.yml`
  - `.../CheckPrinterClient-Setup.exe`
  - `.../*.blockmap`

## TODO

- ✅ `electron-updater` подключён (GitHub Releases).
- ⏳ `update-manifest.json` (политика force/optional) — следующий шаг.
