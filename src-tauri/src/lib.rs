use tauri_plugin_sql::{Migration, MigrationKind};

/// Reads AppKit's effective appearance directly. The webview's own
/// `prefers-color-scheme` and tao's cached window theme can both get stuck at
/// whatever they were when the webview was created, so the frontend asks this
/// instead when it needs to know the OS appearance.
#[cfg(target_os = "macos")]
#[tauri::command]
fn system_theme_mode(app: tauri::AppHandle) -> Result<String, String> {
    use std::sync::mpsc;

    let (tx, rx) = mpsc::channel();
    app.run_on_main_thread(move || {
        use objc2::MainThreadMarker;
        use objc2_app_kit::{NSApplication, NSAppearanceNameAqua, NSAppearanceNameDarkAqua};
        use objc2_foundation::NSArray;

        let is_dark = unsafe {
            let mtm = MainThreadMarker::new().expect("run_on_main_thread guarantees this");
            let ns_app = NSApplication::sharedApplication(mtm);
            let appearance = ns_app.effectiveAppearance();
            let names = NSArray::from_slice(&[NSAppearanceNameAqua, NSAppearanceNameDarkAqua]);
            let best = appearance.bestMatchFromAppearancesWithNames(&names);
            best.is_some_and(|n| &*n == NSAppearanceNameDarkAqua)
        };
        let _ = tx.send(if is_dark { "dark" } else { "light" }.to_string());
    })
    .map_err(|e| e.to_string())?;

    rx.recv().map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn system_theme_mode() -> Result<String, String> {
    Err("unsupported platform".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "entries.loggedAt timestamp",
            sql: include_str!("../migrations/002_logged_at.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:timetracker.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![system_theme_mode])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
