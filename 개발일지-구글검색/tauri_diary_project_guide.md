# Vite + React + Tauri 개발 일지 및 가이드 요약

## 1. 프로젝트 목적 및 핵심 아키텍처
기존의 무거운 Electron 대신, C++급으로 빠르고 가벼운 **Rust** 네이티브 엔진과 **Vite + React** 기반의 웹 프론트엔드를 결합하여 초경량 탁상용 일기장 데스크톱 앱(.exe)을 구축했습니다.

### 기술 스택 간의 역할 대칭 구조 (C++ 기준 1:1 매칭)
- **TypeScript / React**: Qt, MFC와 같은 UI 라이브러리 역할 (세련된 화면 및 상태 제어)
- **Rust (Tauri 커널)**: C++ 언어 본체 역할 (하드디스크 파일 I/O 및 OS 시스템 제어)
- **Vite**: Webpack을 대체하는 컴파일러/빌드 시스템 (오브젝트 파일 역할의 HTML/JS 압축 생성)
- **Tauri v2**: Visual Studio Linker 역할 (껍데기를 씌워 단독 실행 파일인 `.exe`로 최종 패키징)

---

## 2. 주요 기능 및 소스 코드

### ① 백엔드 코어 시스템 (`src-tauri/src/lib.rs`)
Tauri v2 아키텍처 표준을 따르며, 하드디스크(`C:\MyDiary\diary_logs.txt`)에 일기 데이터를 누적 저장(Append)하고 앱 시동 시 역으로 한 줄씩 파싱하여 불러오는 2개의 커맨드(API)를 내장하고 있습니다.

```rust
use std::fs::{create_dir_all, OpenOptions, read_to_string};
use std::io::Write;
use std::path::Path;

// [커맨드 1] 일기 저장 함수
#[tauri::command]
fn save_diary_to_file(date: String, content: String) -> Result<(), String> {
    let dir_path = "C:\MyDiary";
    
    if !Path::new(dir_path).exists() {
        create_dir_all(dir_path).map_err(|e| e.to_string())?;
    }

    let file_path = format!("{}\{}", dir_path, "diary_logs.txt");

    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open(file_path)
        .map_err(|e| e.to_string())?;

    let log_line = format!("[{}] {}
", date, content);
    file.write_all(log_line.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}

// [커맨드 2] 일기 불러오기 함수
#[tauri::command]
fn load_diaries_from_file() -> Result<Vec<String>, String> {
    let file_path = "C:\MyDiary\diary_logs.txt";

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
        .invoke_handler(tauri::generate_handler![save_diary_to_file, load_diaries_from_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### ② 프론트엔드 UI 및 달력 필터링 로직 (`src/App.tsx`)
좌측에 정사각형 바둑판 형태의 탁상용 달력이 상시 노출되며, 날짜를 클릭하면 우측 일기장 목록 리스트에 해당 일자의 로그만 실시간 필터링되는 2단 분할 구조(Split View)입니다.

```tsx
import { useState, useEffect } from "react";
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
  const [selectedDate, setSelectedDate] = useState("");
  
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  useEffect(() => {
    const fetchDiaries = async () => {
      try {
        const lines: string[] = await invoke("load_diaries_from_file");
        const parsedDiaries = lines.map((line, index) => {
          const closeBracketIndex = line.indexOf("]");
          if (closeBracketIndex !== -1 && line.startsWith("[")) {
            const date = line.substring(1, closeBracketIndex);
            const content = line.substring(closeBracketIndex + 2);
            return { id: Date.now() + index, date, content };
          }
          return { id: Date.now() + index, date: "알 수 없는 날짜", content: line };
        });
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
      await invoke("save_diary_to_file", { date: formattedDate, content: inputText });
      const newDiary: DiaryItem = { id: Date.now(), date: formattedDate, content: inputText };
      setDiaries([newDiary, ...diaries]);
      setInputText("");
    } catch (error) {
      alert("하드디스크 저장 오류 발생: " + error);
    }
  };

  const renderCalendarDays = () => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dayButtons = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      dayButtons.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0folder_name_placeholder')}`;
      const formatString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = selectedDate === formatString;

      dayButtons.push(
        <button
          key={`day-${day}`}
          onClick={() => setSelectedDate(formatString)}
          className={`calendar-day-btn ${isSelected ? "active" : ""}`}
        >
          {day}
        </button>
      );
    }
    return dayButtons;
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const filteredDiaries = selectedDate
    ? diaries.filter((item) => item.date.startsWith(selectedDate))
    : diaries;

  return (
    <div className="app-window">
      <header className="app-header">
        <h1>간단 개발 일기장</h1>
        <p className="subtitle">To-Do 스타일로 가볍게 한 줄씩 기록하세요.</p>
      </header>

      <div className="main-content-layout">
        <aside className="left-sidebar">
          <div className="calendar-card">
            <div className="calendar-header">
              <button onClick={handlePrevMonth}>&lt;</button>
              <span>{currentYear}년 {currentMonth + 1}월</span>
              <button onClick={handleNextMonth}>&gt;</button>
            </div>
            <div className="calendar-weekdays">
              <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
            </div>
            <div className="calendar-days-grid">
              {renderCalendarDays()}
            </div>
            <div className="filter-status-box">
              {selectedDate ? `📅 선택: ${selectedDate}` : "👀 전체 목록 조회 중"}
            </div>
            <button 
              onClick={() => setSelectedDate("")} 
              className="clear-filter-btn"
              disabled={!selectedDate}
            >
              전체 목록 보기
            </button>
          </div>
        </aside>

        <main className="right-content">
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
            {filteredDiaries.length === 0 ? (
              <p className="empty-message">해당 조건에 작성된 기록이 없습니다.</p>
            ) : (
              filteredDiaries.map((item) => (
                <div key={item.id} className="diary-card">
                  <div className="diary-date">{item.date}</div>
                  <div className="diary-content">{item.content}</div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
```

---

## 3. 실행 및 릴리즈 빌드 커맨드 요약

### 1) 실시간 개발 및 HMR 디버깅 모드
코드를 저장하는 즉시 화면 전체 새로고침 없이 0.1초 만에 내용이 반영되는 모드입니다.
```powershell
npm run tauri dev
```

### 2) 상용 독립 실행형 완제품 패키징 빌드
컴파일러 최적화와 필요 없는 데드 코드를 걷어내어 가장 가벼운 상태의 단독 실행 `.exe` 파일을 출력합니다.
```powershell
npm run tauri build
```

### 3) 완제품 산출물 릴리즈 위치
- **단독 실행형 파일 (.exe)**: `src-tauri\target\release\my-diary-app.exe`
- **배포/설치형 패키지**: `src-tauri\target\release\bundle\nsis\my-diary-app_0.1.0_x64-setup.exe`

---
*본 가이드는 C++ 엔지니어의 구조적 시각에 맞추어 도구들의 핵심 메커니즘 위주로 요약 정리되었습니다.*
