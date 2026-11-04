use std::fs::{create_dir_all, OpenOptions, read_to_string};
use std::io::Write;
use std::path::Path;
use tauri::Manager;

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

    // 💡 \n 문자열이 실제 파일 줄바꿈으로 들어가도록 수정
    let log_line = format!("[{}] {}\n", date, content);
    file.write_all(log_line.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}

// [커맨드 2] 날짜 수정 시 전체 데이터를 파일에 동기화(덮어쓰기)하는 함수
#[tauri::command]
fn rewrite_all_diaries(logs: Vec<String>) -> Result<(), String> {
    let dir_path = "C:\\MyDiary";
    let file_path = format!("{}\\{}", dir_path, "diary_logs.txt");

    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(file_path)
        .map_err(|e| e.to_string())?;

    for line in logs {
        // 💡 역슬래시 두 개 지우고 순수 \n으로 줄바꿈 처리
        let log_line = format!("{}\n", line);
        file.write_all(log_line.as_bytes()).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// [커맨드 3] 일기 불러오기 함수
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(icon) = app.default_window_icon().cloned() {
                for window in app.webview_windows().values() {
                    let _ = window.set_icon(icon.clone());
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_diary_to_file, 
            load_diaries_from_file,
            rewrite_all_diaries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
