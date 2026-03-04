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

const ANIM_STEPS: u32 = 20;
const ANIM_STEP_MS: u64 = 12; // ~240ms total

/// Ease-out cubic: fast start, smooth deceleration
fn ease_out(t: f64) -> f64 {
    1.0 - (1.0 - t).powi(3)
}

/// Linearly interpolate between two values
fn lerp(from: f64, to: f64, t: f64) -> f64 {
    from + (to - from) * t
}

/// Animate a window from its current size/position to a target over ANIM_STEPS
fn animate_window(
    win: tauri::WebviewWindow,
    from_w: f64, from_h: f64, from_x: f64, from_y: f64,
    to_w: f64, to_h: f64, to_x: f64, to_y: f64,
) {
    std::thread::spawn(move || {
        for i in 1..=ANIM_STEPS {
            let t = ease_out(i as f64 / ANIM_STEPS as f64);
            let w = lerp(from_w, to_w, t);
            let h = lerp(from_h, to_h, t);
            let x = lerp(from_x, to_x, t);
            let y = lerp(from_y, to_y, t);
            let _ = win.set_size(tauri::LogicalSize::new(w, h));
            let _ = win.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
            std::thread::sleep(std::time::Duration::from_millis(ANIM_STEP_MS));
        }
    });
}

#[tauri::command]
fn enter_mini_mode(window: tauri::WebviewWindow, state: tauri::State<'_, MiniModeState>) {
    let scale = window.scale_factor().unwrap_or(1.0);

    // Read current geometry
    let (from_w, from_h, from_x, from_y) =
        if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
            let lw = size.width as f64 / scale;
            let lh = size.height as f64 / scale;
            (lw, lh, pos.x as f64, pos.y as f64)
        } else {
            (1200.0, 800.0, 0.0, 0.0)
        };

    // Save geometry only if it's a full-sized window
    if from_w > 500.0 && from_h > 400.0 {
        let mut geo = state.0.lock().unwrap();
        geo.x = from_x;
        geo.y = from_y;
        geo.width = from_w;
        geo.height = from_h;
    }

    // Compute target position (top-right of current monitor, flush with edges)
    let (to_x, to_y) = if let Some(monitor) = window.current_monitor().ok().flatten() {
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        let ms = monitor.scale_factor();
        let mon_w = mon_size.width as f64 / ms;
        let margin = 6.0; // small gap from screen edge
        let x = mon_pos.x as f64 + (mon_w - 340.0 - margin) * ms;
        let y = mon_pos.y as f64 + 38.0 * ms; // just below menu bar
        (x, y)
    } else {
        (from_x, from_y)
    };

    // Navigate first, allow mini UI to start loading
    let _ = window.eval("window.location.href='/mini'");

    // Relax min-size so we can animate down
    let _ = window.set_min_size(Some(tauri::LogicalSize::new(320.0, 220.0)));

    let win = window.clone();
    std::thread::spawn(move || {
        // Brief pause to let the page navigation begin
        std::thread::sleep(std::time::Duration::from_millis(150));
        // Animate to mini size
        let anim_win = win.clone();
        animate_window(anim_win, from_w, from_h, from_x, from_y, 340.0, 240.0, to_x, to_y);
        // Wait for animation to finish, then set always-on-top
        std::thread::sleep(std::time::Duration::from_millis(ANIM_STEPS as u64 * ANIM_STEP_MS + 50));
        let _ = win.set_always_on_top(true);
    });
}

#[tauri::command]
fn exit_mini_mode(window: tauri::WebviewWindow, state: tauri::State<'_, MiniModeState>) {
    let scale = window.scale_factor().unwrap_or(1.0);

    // Read current (mini) geometry
    let (from_w, from_h, from_x, from_y) =
        if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
            (size.width as f64 / scale, size.height as f64 / scale, pos.x as f64, pos.y as f64)
        } else {
            (380.0, 360.0, 0.0, 0.0)
        };

    // Read target geometry
    let (to_w, to_h, to_x, to_y) = {
        let geo = state.0.lock().unwrap();
        if geo.width > 500.0 && geo.height > 400.0 {
            (geo.width, geo.height, geo.x, geo.y)
        } else {
            // No saved geometry — target center of screen
            let center_x = if let Some(monitor) = window.current_monitor().ok().flatten() {
                let mon_pos = monitor.position();
                let mon_size = monitor.size();
                let ms = monitor.scale_factor();
                let mon_w = mon_size.width as f64 / ms;
                let cx = mon_pos.x as f64 + (mon_w - 1200.0) / 2.0 * ms;
                let cy = mon_pos.y as f64 + ((mon_size.height as f64 / ms - 800.0) / 2.0) * ms;
                (cx, cy)
            } else {
                (100.0, 100.0)
            };
            (1200.0, 800.0, center_x.0, center_x.1)
        }
    };

    let _ = window.set_always_on_top(false);
    // Navigate to full view
    let _ = window.eval("window.location.href='/'");
    // Relax min-size for animation (current min is 360x340, need to go up)
    // We'll set the final min-size after animation completes
    let _ = window.set_min_size::<tauri::LogicalSize<f64>>(None);

    let win = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(150));
        let anim_win = win.clone();
        animate_window(anim_win, from_w, from_h, from_x, from_y, to_w, to_h, to_x, to_y);
        // Restore min-size after animation
        std::thread::sleep(std::time::Duration::from_millis(ANIM_STEPS as u64 * ANIM_STEP_MS + 50));
        let _ = win.set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)));
    });
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

            // Always start in full-size mode (window-state plugin may have saved mini dimensions)
            let _ = window.set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)));
            let _ = window.set_size(tauri::LogicalSize::new(1200.0, 800.0));
            let _ = window.set_always_on_top(false);
            let _ = window.center();
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
