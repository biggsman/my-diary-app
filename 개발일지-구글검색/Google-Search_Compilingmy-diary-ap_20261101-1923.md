# you asked

Compiling my-diary-app v0.1.0 (C:\Users\bigco\Documents\Develop\my-diary-app\src-tauri)warning: function `load_diaries_from_file` is never used --> src\lib.rs:37:4 |37 | fn load_diaries_from_file() -> Result<Vec<String>, String> { | ^^^^^^^^^^^^^^^^^^^^^^ | = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by defaultwarning: `my-diary-app` (lib) generated 1 warning Finished `dev` profile [unoptimized + debuginfo] target(s) in 8.22s Running `target\debug\my-diary-app.exe` Info File src-tauri\src\lib.rs changed. Rebuilding application... Running DevCommand (`cargo run --no-default-features --color always --`) Compiling my-diary-app v0.1.0 (C:\Users\bigco\Documents\Develop\my-diary-app\src-tauri)error: unexpected closing delimiter: `}` --> src\lib.rs:67:1 |59 | pub fn run() { | - this opening brace......66 | } | - ...matches this closing brace67 | } | ^ unexpected closing delimitererror: could not compile `my-diary-app` (lib) due to 1 previous error오후 6:44:33 [vite] (client) hmr update /src/App.tsx일괄 작업을 끝내시겠습니까 (Y/N)?PS C:\Users\bigco\Documents\Develop\my-diary-app> npm run tauri dev> my-diary-app@0.1.0 tauri> tauri dev Running BeforeDevCommand (`npm run dev`)> my-diary-app@0.1.0 dev> vite VITE v8.3.5 ready in 279 ms ➜ Local: http://localhost:1420/ Running DevCommand (`cargo run --no-default-features --color always --`) Info Watching C:\Users\bigco\Documents\Develop\my-diary-app\src-tauri for changes... Compiling my-diary-app v0.1.0 (C:\Users\bigco\Documents\Develop\my-diary-app\src-tauri)error: unexpected closing delimiter: `}` --> src\lib.rs:67:1 |59 | pub fn run() { | - this opening brace......66 | } | - ...matches this closing brace67 | } | ^ unexpected closing delimitererror: could not compile `my-diary-app` (lib) due to 1 previous error

---

# googlesearch response

아, 컴파일 에러 메시지를 보니 C++ 개발할 때 흔히 겪는 **중괄호 닫기(`}`)의 쌍이 하나 더 들어가서 생긴 문법 에러**입니다!

`src-tauri/src/lib.rs` 파일 맨 아랫부분에 `}` 가 한 개 과하게 추가되어 Rust 컴파일러가 빌드를 중단한 상태입니다.

에러 없이 완벽하게 한 번에 빌드되도록 중괄호 쌍을 정확하게 교정한 **`src-tauri/src/lib.rs` 전체 소스 코드**를 다시 전달해 드립니다. 이 코드로 통째로 복사해서 덮어씌워 주시면 바로 해결됩니다.

* * *

🛠️ 교정된 `src-tauri/src/lib.rs` (전체 복사 후 덮어쓰기)

```rust
use std::fs::{create_dir_all, OpenOptions, read_to_string};
use std::io::Write;
use std::path::Path;

// [커맨드 1] 일기 저장 함수
#[tauri::command]
fn save_diary_to_file(date: String, content: String) -> Result<(), String> {
    let dir_path = "C:\\MyDiary";

    if !Path::new(dir_path).exists() {
        create_dir_all(dir_path).map_err(|e| e.to_string())?;
    }

    let file_path = format!("{}\\{}", dir_path, "diary_logs.txt");

    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open(file_path)
        .map_err(|e| e.to_string())?;

    let log_line = format!("[{}] {}\n", date, content);
    file.write_all(log_line.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}

// [커맨드 2] 일기 불러오기 함수
#[tauri::command]
fn load_diaries_from_file() -> Result<Vec<String>, String> {
    let file_path = "C:\\MyDiary\\diary_logs.txt";

    if !Path::new(file_path).exists() {
        return Ok(vec![]);
    }

    let content = read_to_string(file_path).map_err(|e| e.to_string())?;

    let lines: Vec<String> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.to_string())
        .collect();

    Ok(lines)
}

// Tauri v2 메인 앱 빌더 및 런타임 시작 진입점
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // 🚀 두 함수를 핸들러에 바인딩하여 프론트엔드로 노출시킵니다.
        .invoke_handler(tauri::generate_handler![save_diary_to_file, load_diaries_from_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

코드를 사용할 때는 주의가 필요합니다.

* * *

🧪 조치 후 재빌드 방법

1.  위의 코드로 `src-tauri/src/lib.rs` 파일을 깔끔하게 덮어쓰고 저장합니다.
2.  터미널 창에서 자동으로 리빌드가 일어나거나, 혹시 멈춰있다면 `Ctrl + C`를 누른 뒤 다시 `npm run tauri dev`를 입력해 줍니다.

중괄호 개수가 정확하게 맞아떨어졌기 때문에, Rust 컴파일러가 경고나 에러 없이 `Finished dev profile` 메시지를 띄우며 윈도우 창을 활성화해 줄 것입니다!

에러가 말끔히 사라지고 **과거에 써두었던 일기 데이터가 화면에 복원되어 예쁘게 노출**되는지 확인 후 알려주세요!

AI 대답에는 오류가 있을 수 있습니다. [AI 모드에 대해 자세히 알](https://support.google.com/websearch?p=aimode)

클립보드에 복사됨클립보드에 복사할 수 없습니다. 나중에 다시 시도해 주세요.

더보기

---
Powered by [AI Exporter](https://saveai.net)