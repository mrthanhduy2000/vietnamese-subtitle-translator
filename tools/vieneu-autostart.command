#!/bin/zsh
# Tự động hóa máy chủ giọng VieNeu: chạy ngay khi đăng nhập macOS và tự bật lại nếu bị tắt.
# Nhấp đúp tệp này để CÀI. Muốn gỡ: chạy trong Terminal:  ~/VieNeu-TTS/tools-vieneu-autostart.command --go
# (hoặc: launchctl bootout gui/$UID/com.damduy.vieneu && rm ~/Library/LaunchAgents/com.damduy.vieneu.plist)
set -e
LABEL="com.damduy.vieneu"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP="$HOME/VieNeu-TTS"

if [[ "$1" == "--go" || "$1" == "--uninstall" ]]; then
    launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Đã gỡ tự khởi động VieNeu."
    exit 0
fi

if [[ ! -x "$APP/.venv/bin/python" ]]; then
    echo "Không tìm thấy $APP/.venv/bin/python. Hãy kiểm tra lại thư mục VieNeu-TTS."
    exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$APP/.venv/bin/python</string>
        <string>-m</string>
        <string>apps.openai_speech</string>
    </array>
    <key>WorkingDirectory</key><string>$APP</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOST</key><string>127.0.0.1</string>
        <key>PORT</key><string>8000</string>
        <key>VIENEU_BACKEND</key><string>onnx</string>
        <key>VIENEU_DEVICE</key><string>cpu</string>
        <key>VIENEU_PRECISION</key><string>fp32</string>
        <key>VIENEU_QUEUE</key><string>4</string>
        <key>VIENEU_QUEUE_TIMEOUT</key><string>20</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>ThrottleInterval</key><integer>10</integer>
    <key>ProcessType</key><string>Background</string>
    <key>StandardOutPath</key><string>$APP/server.log</string>
    <key>StandardErrorPath</key><string>$APP/server.log</string>
</dict>
</plist>
PLISTEOF

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$PLIST"
echo "Đã cài. Máy chủ VieNeu sẽ tự chạy khi đăng nhập và tự bật lại nếu bị tắt."
for i in {1..40}; do
    if curl -s -m 2 http://127.0.0.1:8000/health > /dev/null; then echo "VieNeu đã sẵn sàng."; exit 0; fi
    sleep 1
done
echo "Chưa thấy phản hồi sau 40 giây, xem nhật ký: $APP/server.log"
