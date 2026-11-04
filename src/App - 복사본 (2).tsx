import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface DiaryItem {
  id: number;
  date: string;
  content: string;
  isPending: boolean;
}

function App() {
  const [diaries, setDiaries] = useState<DiaryItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDateInput, setEditDateInput] = useState("");
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  const [editingContentId, setEditingContentId] = useState<number | null>(null);
  const [editContentInput, setEditContentInput] = useState("");

  useEffect(() => {
    fetchAndSetDiaries();
  }, []);

  const fetchAndSetDiaries = async () => {
    try {
      const lines: string[] = await invoke("load_diaries_from_file");
      const tempParsed: DiaryItem[] = [];
      let globalIndex = 0;

      lines.forEach((line) => {
        if (!line.trim()) return;
        
        const closeBracketIndex = line.indexOf("]");
        if (closeBracketIndex !== -1 && line.startsWith("[")) {
          const date = line.substring(1, closeBracketIndex).trim();
          let remaining = line.substring(closeBracketIndex + 2).trim();
          
          let isPending = false;
          if (remaining.startsWith("[PENDING]")) {
            isPending = true;
            remaining = remaining.substring("[PENDING]".length).trim();
          }

          tempParsed.push({ id: Date.now() + globalIndex++, date, content: remaining, isPending });
        } else {
          tempParsed.push({ id: Date.now() + globalIndex++, date: "알 수 없는 날짜", content: line, isPending: false });
        }
      });

      tempParsed.sort((a, b) => b.date.localeCompare(a.date));
      setDiaries(tempParsed);
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    }
  };

  const syncWithHardDrive = async (updatedList: DiaryItem[]) => {
    try {
      const rawLines = [...updatedList]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(item => {
          const pendingFlag = item.isPending ? "[PENDING] " : "";
          return "[" + item.date + "] " + pendingFlag + item.content;
        });
      await invoke("rewrite_all_diaries", { logs: rawLines });
    } catch (error) {
      alert("하드디스크 동기화 오류: " + error);
    }
  };

  const handleAddDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    let targetDate = "";
    if (selectedDate) {
      const now = new Date();
      const timeStr = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      targetDate = selectedDate + " " + timeStr;
    } else {
      const now = new Date();
      targetDate = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0") + " " + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    }

    try {
      await invoke("save_diary_to_file", { date: targetDate, content: inputText });
      const newDiary: DiaryItem = { id: Date.now() + Math.random(), date: targetDate, content: inputText, isPending: false };
      
      const nextDiaries = [newDiary, ...diaries].sort((a, b) => b.date.localeCompare(a.date));
      setDiaries(nextDiaries);
      await syncWithHardDrive(nextDiaries);
      setInputText("");
    } catch (error) {
      alert("하드디스크 저장 오류 발생: " + error);
    }
  };

  const togglePendingStatus = async (id: number) => {
    const updated = diaries.map(item => {
      if (item.id === id) {
        return { ...item, isPending: !item.isPending };
      }
      return item;
    });
    setDiaries(updated);
    await syncWithHardDrive(updated);
  };

  const startEditDate = (item: DiaryItem) => {
    setEditingContentId(null);
    setEditContentInput("");
    setEditingId(item.id);
    const baseDate = item.date.split(" ");
    setEditDateInput(baseDate[0]);
  };

  const saveEditedDate = async (id: number) => {
    const updated = diaries.map(item => {
      if (item.id === id) {
        const parts = item.date.split(" ");
        const originalTime = parts[1] || "00:00";
        return { ...item, date: editDateInput + " " + originalTime };
      }
      return item;
    });

    updated.sort((a, b) => b.date.localeCompare(a.date));
    setDiaries(updated);
    setEditingId(null);
    await syncWithHardDrive(updated);
  };

  const startEditContent = (item: DiaryItem) => {
    setEditingId(null);
    setEditingContentId(item.id);
    setEditContentInput(item.content);
  };

  const saveEditedContent = async (id: number) => {
    const trimmed = editContentInput.trim();
    if (!trimmed) {
      alert("수정할 내용을 입력해 주세요.");
      return;
    }

    const updated = diaries.map((item) => {
      if (item.id === id) {
        return { ...item, content: trimmed };
      }
      return item;
    });

    setDiaries(updated);
    setEditingContentId(null);
    setEditContentInput("");
    await syncWithHardDrive(updated);
  };

  const cancelEditContent = () => {
    setEditingContentId(null);
    setEditContentInput("");
  };

  const renderCalendarDays = () => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dayButtons = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      dayButtons.push(<div key={"empty-" + i} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = currentYear + "-" + String(currentMonth + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      const isSelected = selectedDate === dateString;

      dayButtons.push(
        <button
          key={"day-" + day}
          onClick={() => setSelectedDate(dateString)}
          className={"calendar-day-btn " + (isSelected ? "active" : "")}
        >
          {day}
        </button>
      );
    }
    return dayButtons;
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else { setCurrentMonth(currentMonth - 1); }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else { setCurrentMonth(currentMonth + 1); }
  };

  const filteredDiaries = diaries
    .filter((item) => !selectedDate || item.date.startsWith(selectedDate))
    .filter((item) => !showOnlyPending || item.isPending);

  return (
    <div className="app-window">
      <header className="app-header">
        <h1>간단 to-do 일기장</h1>
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
              {selectedDate ? `✍️ 소급 입력 활성: ${selectedDate}` : "👀 전체 목록 조회 중"}
            </div>

            <button onClick={() => setSelectedDate("")} className="clear-filter-btn" disabled={!selectedDate}>
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
              placeholder={selectedDate ? `📌 [소급 모드] ${selectedDate} 날짜로 일기가 입력됩니다.` : "오늘 어떤 개발을 하셨나요? (엔터를 치면 등록됩니다)"}
              className="diary-input"
              style={{ backgroundColor: selectedDate ? "#f0fdf4" : "white" }}
            />
            <button type="submit" className="submit-btn">등록</button>
          </form>

          <div className="list-filter-bar">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showOnlyPending}
                onChange={(e) => setShowOnlyPending(e.target.checked)}
                className="pending-filter-checkbox"
              />
              <span className="checkbox-text">⚠️ 예정 작업만 필터링해서 보기</span>
            </label>
          </div>

          <div className="diary-list">
            {filteredDiaries.length === 0 ? (
              <p className="empty-message">해당 조건에 작성된 기록이 없습니다.</p>
            ) : (
              filteredDiaries.map((item) => (
              <div key={item.id} className={"diary-card " + (item.isPending ? "pending-style" : "")}>
                <div className="diary-card-header">
                  {editingId === item.id ? (
                    <div className="edit-zone">
                      <input
                        type="date"
                        value={editDateInput}
                        onChange={(e) => setEditDateInput(e.target.value)}
                        className="date-edit-picker"
                      />
                      <button onClick={() => saveEditedDate(item.id)} className="save-edit-btn">확인</button>
                      <button onClick={() => setEditingId(null)} className="cancel-edit-btn">취소</button>
                    </div>
                  ) : (
                    <div className="view-zone">
                      <span
                        className="diary-dateclickable"
                        onClick={() => startEditDate(item)}
                        title="클릭하여 날짜 수정하기"
                      >
                        📅 {item.date}
                      </span>

                      <div className="card-actions">
                        <span
                          className="content-edit-btn"
                          onClick={() => startEditContent(item)}
                          title="클릭하여 내용 수정하기"
                        >
                          ✏️ 수정
                        </span>

                        <span
                          className={"star-toggle-icon " + (item.isPending ? "active" : "")}
                          onClick={() => togglePendingStatus(item.id)}
                          title={item.isPending ? "예정 작업 해제" : "예정 작업 표시"}
                        >
                          {item.isPending ? "★ 예정" : "☆ 예정"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {editingContentId === item.id ? (
                  <div className="content-edit-zone">
                    <input
                      type="text"
                      value={editContentInput}
                      onChange={(e) => setEditContentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditedContent(item.id);
                        if (e.key === "Escape") cancelEditContent();
                      }}
                      className="content-edit-input"
                      autoFocus
                    />
                    <div className="content-edit-actions">
                      <button onClick={() => saveEditedContent(item.id)} className="save-edit-btn">확인</button>
                      <button onClick={cancelEditContent} className="cancel-edit-btn">취소</button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="diary-content diary-content-editable"
                    onClick={() => startEditContent(item)}
                    title="클릭하여 내용 수정하기"
                  >
                    {item.content}
                  </div>
                )}
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

