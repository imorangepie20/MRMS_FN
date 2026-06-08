# MRT 갱신 스케줄링 가이드

`scripts/09_generate_mrt.py`를 정기적으로 호출해 모든 사용자의 MRT를 1주 2회 갱신.

## Linux / WSL / Mac (crontab)

```bash
crontab -e
```

다음 라인 추가 (매주 월, 목 오전 3시):

```
0 3 * * 1,4 cd "/Volumes/MacExtend 1/MRMS_FN" && .venv/bin/python3 scripts/09_generate_mrt.py --all >> logs/mrt_cron.log 2>&1
```

확인:

```bash
crontab -l                    # 등록된 cron job 조회
tail -f logs/mrt_cron.log     # 다음 실행 결과 보기
```

## macOS (launchd 권장)

cron 대신 launchd 사용이 더 권장됨 (재시작 후에도 활성 유지, 외장 SSD sleep 처리 우호적).

`~/Library/LaunchAgents/team.approid.mrms.mrt.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>team.approid.mrms.mrt</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Volumes/MacExtend 1/MRMS_FN/.venv/bin/python3</string>
    <string>/Volumes/MacExtend 1/MRMS_FN/scripts/09_generate_mrt.py</string>
    <string>--all</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Volumes/MacExtend 1/MRMS_FN</string>
  <key>StandardOutPath</key>
  <string>/Volumes/MacExtend 1/MRMS_FN/logs/mrt_cron.log</string>
  <key>StandardErrorPath</key>
  <string>/Volumes/MacExtend 1/MRMS_FN/logs/mrt_cron.err</string>
  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Weekday</key><integer>1</integer>
      <key>Hour</key><integer>3</integer>
      <key>Minute</key><integer>0</integer>
    </dict>
    <dict>
      <key>Weekday</key><integer>4</integer>
      <key>Hour</key><integer>3</integer>
      <key>Minute</key><integer>0</integer>
    </dict>
  </array>
</dict>
</plist>
```

로드:

```bash
launchctl load ~/Library/LaunchAgents/team.approid.mrms.mrt.plist
launchctl list | grep mrms     # 등록 확인
```

해제:

```bash
launchctl unload ~/Library/LaunchAgents/team.approid.mrms.mrt.plist
```

다음 실행 시간 확인:

```bash
launchctl print gui/$(id -u)/team.approid.mrms.mrt | grep -A 2 "next fire"
```

## 수동 실행 (디버깅)

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
python3 scripts/09_generate_mrt.py --all
```

또는 특정 사용자만:

```bash
python3 scripts/09_generate_mrt.py --email me@example.com
```

## 트러블슈팅

### "ModuleNotFoundError: No module named 'mrms'"

venv 활성화 안 됨. cron/launchd 환경엔 shell이 없음 → `.venv/bin/python3` 절대 경로로 호출.

### "DATABASE_URL 못 찾음"

cron은 shell 환경변수 안 상속. `.env` 파일이 cwd에 있어야 함 → `cd /Volumes/MacExtend 1/MRMS_FN` 먼저 실행. launchd plist는 `WorkingDirectory` 키로 동일.

### "외장 SSD 마운트 안 됨"

Mac에서 외장 SSD가 sleep 모드면 cron 실행 시 unmount일 수 있음. 무인 운영 시 내장 디스크 경로 권장. launchd는 sleep 후 wake 시점에 missed jobs 재실행 (`StartCalendarInterval` 기본 동작).

### 로그 디렉토리 누락

```bash
mkdir -p logs    # 한 번만
```

### Cron 실행됐지만 결과 없음

```bash
cat logs/mrt_cron.log | tail -100
```

흔한 원인:
- DB connection refused (Docker PG 미실행)
- TrackEmbedding 적재 안 됨 → 사용자 모두 skip
- `--all` 모드 시 모든 사용자 0곡이면 정상 (skip yellow 메시지)

## 권장 빈도

| 갱신 주기 | 비고 |
|---|---|
| 주 2회 (월/목 3am) | 디자인 문서 권장. 보통 사용자 신규 좋아요 누적 가시화 |
| 매일 1회 | UserTrack 변경이 잦은 시점 (active onboarding) |
| 주 1회 | 사용자 활동 적음 → 비용 절감 |

UserTrack 변경량 모니터링 후 조정.
