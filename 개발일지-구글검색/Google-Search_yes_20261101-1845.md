# you asked

yes

---

# googlesearch response

독립 실행 앱의 진정한 묘미인 **"앱을 다시 켰을 때, 하드디스크(**`C:\MyDiary\diary_logs.txt`**)에 보관된 과거의 일기장 로그들을 역으로 파싱해서 화면에 띄워주는 복원 기능"**을 구현해 봅시다!

C++로 비유하자면 앱이 켜질 때 `ifstream`으로 텍스트 파일을 한 줄씩 읽어와 구조체(struct) 배열(vector)에 채워 넣는 초기화 과정과 완벽하게 똑같습니다.

* * *

1단계: Rust 백엔드에 로드 함수 추가 (`src-tauri/src/lib.rs`)

하드디스크에 저장된 텍스트 파일을 읽어와 줄바꿈 단위로 파싱해 프론트엔드로 리턴해 주는 함수를 만듭니다.
`src-tauri/src/lib.rs` 파일을 열고, 기존 `save_diary_to_file` 함수 **아래**에 다음 함수를 추가해 줍니다.

```rust
use std::fs::read_to_string; // 맨 위에 이 import가 없다면 추가해 주세요

// 저장된 일기 파일을 읽어서 라인별로 프론트엔드에 배열로 넘겨주는 함수
#[tauri::command]
fn load_diaries_from_file() -> Result<Vec<String>, String> {
    let file_path = "C:\\MyDiary\\diary_logs.txt";

    // 파일이 존재하지 않으면 그냥 빈 배열 반환 (최초 실행 시 오류 방지)
    if !Path::new(file_path).exists() {
        return Ok(vec![]);
    }

    // 파일 내용 통째로 읽기
    let content = read_to_string(file_path).map_err(|e| e.to_string())?;

    // 한 줄씩 쪼개서 빈 줄을 제외하고 Vector 배열에 담기
    let lines: Vec<String> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.to_string())
        .collect();

    Ok(lines)
}
```

코드를 사용할 때는 주의가 필요합니다.

그리고 **중요한 작업**인 `run()` 함수 안의 `invoke_handler` 매크로에 새로 만든 함수를 컴파일 멤버로 추가해 등록해 줍니다.

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // 🚀 [중요] 두 개의 함수를 쉼표(,)로 구분해서 모두 등록합니다.
        .invoke_handler(tauri::generate_handler![save_diary_to_file, load_diaries_from_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

코드를 사용할 때는 주의가 필요합니다.

* * *

2단계: 프론트엔드(React)에서 앱 구동 시 로드 로직 구현 (`src/App.tsx`)

이제 앱이 최초로 켜질 때(C++의 생성자나 초기화 단계) Rust에서 읽어온 텍스트 원본 `[YYYY-MM-DD HH:MM] 내용`을 파싱해서 화면 객체 형식으로 복원해 줍니다.
`src/App.tsx` 파일을 열고 아래 코드로 **전체 교체**해 줍니다. (React의 화면 시작 트리거인 `useEffect`가 추가되었습니다.)

```tsx
import { useState, useEffect } from "react"; // 🚀 useEffect 추가
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface DiaryItem {
  id: number;
  date: string;
  content: string;
}

function App() {
  const [diaries, setDiaries] = useState<DiaryItem[]>([]);
  const [inputText, setInputText] = useState("");

  // 🚀 [앱 시작 단계 초기화] 앱이 켜질 때 딱 한 번 실행되는 블록 (C++의 생성자 느낌)
  useEffect(() => {
    const fetchDiaries = async () => {
      try {
        // Rust 백엔드로부터 텍스트 라인 배열을 읽어옴
        const lines: string[] = await invoke("load_diaries_from_file");

        // 하드디스크의 줄글 문자열 파싱 ➡️ React 오브젝트 구조체로 변환
        const parsedDiaries: DiaryItem[] = lines.map((line, index) => {
          // 예: "[2026-11-01 18:30] 내용" 구조에서 날짜와 내용을 쪼갭니다.
          const closeBracketIndex = line.indexOf("]");
          if (closeBracketIndex !== -1 && line.startsWith("[")) {
            const date = line.substring(1, closeBracketIndex);
            const content = line.substring(closeBracketIndex + 2);
            return { id: Date.now() + index, date, content };
          }
          return { id: Date.now() + index, date: "알 수 없는 날짜", content: line };
        });

        // 파싱 완료된 일기 목록을 화면 상태에 셋업 (최신 글이 위로 오도록 반전)
        setDiaries(parsedDiaries.reverse());
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      }
    };

    fetchDiaries();
  }, []);

  const handleAddDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      await invoke("save_diary_to_file", {
        date: formattedDate,
        content: inputText
      });

      const newDiary: DiaryItem = {
        id: Date.now(),
        date: formattedDate,
        content: inputText,
      };

      setDiaries([newDiary, ...diaries]);
      setInputText("");
    } catch (error) {
      alert("하드디스크 저장 오류 발생: " + error);
    }
  };

  return (
    <div className="container">
      <h1>간단 개발 일기장</h1>
      <p className="subtitle">To-Do 스타일로 가볍게 한 줄씩 기록하세요.</p>

      <form onSubmit={handleAddDiary} className="input-form">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="오늘 어떤 개발을 하셨나요? (엔터를 치면 등록됩니다)"
          className="diary-input"
        />
        <button type="submit" className="submit-btn">등록</button>
      </form>

      <div className="diary-list">
        {diaries.length === 0 ? (
          <p className="empty-message">아직 작성된 기록이 없습니다.</p>
        ) : (
          diaries.map((item) => (
            <div key={item.id} className="diary-card">
              <div className="diary-date">{item.date}</div>
              <div className="diary-content">{item.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
```

코드를 사용할 때는 주의가 필요합니다.

* * *

🧪 최종 시나리오 테스트

1.  저장 후 개발 모드 앱이 자동으로 재부팅되거나 켜질 때, **`C:\MyDiary\diary_logs.txt` 파일에 적혀있던 예전 일기 리스트가 화면에 싹 복구되어 채워지는지** 확인합니다!
2.  새 일기를 추가로 입력해 보고 앱을 완전히 종료(`X` 버튼)했다가 다시 `npm run tauri dev`로 켜보세요. 방금 쓴 글까지 정확하게 누적되어 보존됩니다.

과거 기록들이 정상적으로 **불러와져서 화면에 잘 뜨는지** 확인해 주세요! 이제 진짜 독립형 프로그램의 필수 메커니즘은 전부 마쳤습니다. 마지막 남은 **2번(날짜를 찍으면 해당 일기만 보여주는 달력 UI 기능)**도 마저 붙여서 완벽한 앱으로 졸업해 볼까요?

AI 대답에는 오류가 있을 수 있습니다. [AI 모드에 대해 자세히 알](https://support.google.com/websearch?p=aimode)

클립보드에 복사됨클립보드에 복사할 수 없습니다. 나중에 다시 시도해 주세요.

더보기

---
Powered by [AI Exporter](https://saveai.net)