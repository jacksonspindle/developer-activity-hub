use std::sync::Mutex;

use tauri::{
    Manager,
    menu::{CheckMenuItem, MenuBuilder, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(not(debug_assertions))]
struct ServerChild(std::sync::Mutex<Option<std::process::Child>>);

#[derive(Default)]
struct SavedGeometry {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

struct MiniModeState(Mutex<SavedGeometry>);

#[tauri::command]
fn enter_mini_mode(window: tauri::WebviewWindow, state: tauri::State<'_, MiniModeState>) {
    // Save current geometry only if it's larger than mini size
    if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
        let scale = window.scale_factor().unwrap_or(1.0);
        let logical_w = size.width as f64 / scale;
        let logical_h = size.height as f64 / scale;
        if logical_w > 500.0 && logical_h > 400.0 {
            let mut geo = state.0.lock().unwrap();
            geo.x = pos.x as f64;
            geo.y = pos.y as f64;
            geo.width = logical_w;
            geo.height = logical_h;
        }
    }

    // Navigate first, then resize after a short delay so mini UI loads before shrinking
    let _ = window.eval("window.location.href='/mini'");
    let win = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(300));
        let _ = win.set_min_size(Some(tauri::LogicalSize::new(360.0, 340.0)));
        let _ = win.set_size(tauri::LogicalSize::new(380.0, 360.0));
        if let Some(monitor) = win.current_monitor().ok().flatten() {
            let mon_pos = monitor.position();
            let mon_size = monitor.size();
            let scale = monitor.scale_factor();
            let mon_w = mon_size.width as f64 / scale;
            let x = mon_pos.x as f64 + (mon_w - 400.0) * scale;
            let y = mon_pos.y as f64 + 40.0 * scale;
            let _ = win.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
        }
        let _ = win.set_always_on_top(true);
    });
}

#[tauri::command]
fn exit_mini_mode(window: tauri::WebviewWindow, state: tauri::State<'_, MiniModeState>) {
    // Restore min-size constraints first — must happen before set_size
    let _ = window.set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)));

    // Restore saved geometry (fall back to default 1200x800 if never saved)
    {
        let geo = state.0.lock().unwrap();
        if geo.width > 500.0 && geo.height > 400.0 {
            let _ = window.set_size(tauri::LogicalSize::new(geo.width, geo.height));
            let _ = window.set_position(tauri::PhysicalPosition::new(geo.x as i32, geo.y as i32));
        } else {
            let _ = window.set_size(tauri::LogicalSize::new(1200.0, 800.0));
            let _ = window.center();
        }
    }

    let _ = window.set_always_on_top(false);
    let _ = window.eval("window.location.href='/'");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MiniModeState(Mutex::new(SavedGeometry::default())))
        .invoke_handler(tauri::generate_handler![enter_mini_mode, exit_mini_mode])
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // --- System tray ---
            let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let always_on_top = CheckMenuItem::with_id(
                app,
                "always_on_top",
                "Always on Top",
                true,
                false,
                None::<&str>,
            )?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = MenuBuilder::new(app)
                .items(&[&show, &always_on_top, &separator, &quit])
                .build()?;

            let aot = always_on_top.clone();

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => show_window(app),
                    "always_on_top" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let on_top = aot.is_checked().unwrap_or(false);
                            let _ = win.set_always_on_top(on_top);
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_window(tray.app_handle());
                    }
                });

            // Use app icon for tray if available
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone()).icon_as_template(true);
            }

            tray_builder.build(app)?;

            // --- Close window → hide to tray ---
            let window = app.get_webview_window("main").unwrap();
            let win_for_close = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win_for_close.hide();
                }
            });

            // --- macOS vibrancy (transparent blur) ---
            #[cfg(target_os = "macos")]
            match apply_vibrancy(
                &window,
                NSVisualEffectMaterial::HudWindow,
                Some(NSVisualEffectState::Active),
                None,
            ) {
                Ok(_) => eprintln!("Vibrancy applied successfully"),
                Err(e) => eprintln!("Failed to apply vibrancy: {e}"),
            }

            // --- Production: spawn Next.js standalone server ---
            #[cfg(not(debug_assertions))]
            {
                use std::net::TcpStream;
                use std::process::Command as StdCommand;
                use std::thread;
                use std::time::{Duration, Instant};

                let resource_dir = app
                    .path()
                    .resource_dir()
                    .expect("failed to resolve resource dir");
                let server_js = resource_dir
                    .join(".next")
                    .join("standalone")
                    .join("server.js");

                match StdCommand::new("node")
                    .arg(&server_js)
                    .env("PORT", "3000")
                    .env("HOSTNAME", "localhost")
                    .spawn()
                {
                    Ok(child) => {
                        app.manage(ServerChild(std::sync::Mutex::new(Some(child))));

                        let handle = app.handle().clone();
                        thread::spawn(move || {
                            let start = Instant::now();
                            let timeout = Duration::from_secs(30);
                            while start.elapsed() < timeout {
                                if TcpStream::connect("127.0.0.1:3000").is_ok() {
                                    // Brief pause to let Next.js finish initialization
                                    thread::sleep(Duration::from_millis(300));
                                    if let Some(win) = handle.get_webview_window("main") {
                                        let _ = win.eval(
                                            "window.location.replace('http://localhost:3000')",
                                        );
                                    }
                                    return;
                                }
                                thread::sleep(Duration::from_millis(200));
                            }
                            eprintln!("Timed out waiting for Next.js server");
                        });
                    }
                    Err(e) => {
                        eprintln!("Failed to start Next.js server: {e}");
                        eprintln!("Make sure Node.js is installed and in PATH");
                    }
                }
            }

            // Show the window (window-state plugin may have repositioned it already)
            let _ = window.show();

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(not(debug_assertions))]
            if let tauri::RunEvent::Exit = _event {
                if let Some(state) = _app.try_state::<ServerChild>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
