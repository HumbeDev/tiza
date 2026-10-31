//! Lists the system's graphics cards. The web engine can't be asked: WebKit (Linux/macOS)
//! reports a fake "Apple GPU" to pages for privacy, so the real names come from the OS.

use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct GpuDevice {
    pub name: String,
    pub vendor: String,
    /// Kernel or OS driver, when known (e.g. `i915`, `nvidia`).
    #[ts(optional)]
    pub driver: Option<String>,
    /// The GPU the system boots with and uses by default (Linux: `boot_vga`).
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct GpuReport {
    pub devices: Vec<GpuDevice>,
    /// Linux: Tiza was started asking for the discrete GPU (PRIME render offload).
    pub offload_requested: bool,
}

pub fn report() -> GpuReport {
    GpuReport {
        devices: devices(),
        offload_requested: ["DRI_PRIME", "__NV_PRIME_RENDER_OFFLOAD"]
            .iter()
            .any(|v| std::env::var(v).is_ok_and(|x| x != "0" && !x.is_empty())),
    }
}

fn vendor_fallback(id: u16) -> &'static str {
    match id {
        0x8086 => "Intel",
        0x10de => "NVIDIA",
        0x1002 => "AMD",
        0x106b => "Apple",
        0x1af4 => "Virtio",
        0x15ad => "VMware",
        _ => "Unknown",
    }
}

/// Looks up vendor and device names in a `pci.ids` database.
pub fn pci_names(db: &str, vendor: u16, device: u16) -> (Option<String>, Option<String>) {
    let vendor_key = format!("{vendor:04x}");
    let device_key = format!("{device:04x}");
    let mut vendor_name = None;
    for line in db.lines() {
        if vendor_name.is_none() {
            if let Some(rest) = line.strip_prefix(&vendor_key)
                && rest.starts_with("  ")
            {
                vendor_name = Some(rest.trim().to_string());
            }
            continue;
        }
        // Inside our vendor: device lines start with one tab; the next vendor ends it.
        if !line.starts_with('\t') && !line.starts_with('#') && !line.is_empty() {
            break;
        }
        if let Some(rest) = line
            .strip_prefix('\t')
            .and_then(|l| l.strip_prefix(&device_key))
            && rest.starts_with("  ")
        {
            return (vendor_name, Some(rest.trim().to_string()));
        }
    }
    (vendor_name, None)
}

#[cfg(target_os = "linux")]
fn devices() -> Vec<GpuDevice> {
    use std::fs;
    use std::path::Path;

    let read = |p: &Path| fs::read_to_string(p).map(|s| s.trim().to_string()).ok();
    let hex = |s: Option<String>| {
        s.and_then(|s| u16::from_str_radix(s.trim_start_matches("0x"), 16).ok())
    };
    let db = [
        "/usr/share/hwdata/pci.ids",
        "/usr/share/misc/pci.ids",
        "/usr/share/pci.ids",
    ]
    .iter()
    .find_map(|p| fs::read_to_string(p).ok())
    .unwrap_or_default();

    let Ok(entries) = fs::read_dir("/sys/bus/pci/devices") else {
        return Vec::new();
    };
    let mut gpus: Vec<GpuDevice> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|dir| read(&dir.join("class")).is_some_and(|c| c.starts_with("0x03")))
        .filter_map(|dir| {
            let vendor = hex(read(&dir.join("vendor")))?;
            let device = hex(read(&dir.join("device")))?;
            let (vendor_name, device_name) = pci_names(&db, vendor, device);
            let vendor_name = vendor_name.unwrap_or_else(|| vendor_fallback(vendor).into());
            Some(GpuDevice {
                name: device_name.unwrap_or_else(|| format!("{vendor_name} {device:04x}")),
                vendor: vendor_name,
                driver: fs::read_link(dir.join("driver"))
                    .ok()
                    .and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned())),
                primary: read(&dir.join("boot_vga")).as_deref() == Some("1"),
            })
        })
        .collect();
    gpus.sort_by_key(|g| !g.primary);
    gpus
}

#[cfg(target_os = "windows")]
fn devices() -> Vec<GpuDevice> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,DriverVersion | ConvertTo-Json -Compress",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    let Ok(output) = output else {
        return Vec::new();
    };
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap_or_default();
    let items = match value {
        serde_json::Value::Array(a) => a,
        v @ serde_json::Value::Object(_) => vec![v],
        _ => Vec::new(),
    };
    items
        .iter()
        .enumerate()
        .map(|(i, v)| GpuDevice {
            name: v["Name"].as_str().unwrap_or("?").into(),
            vendor: v["AdapterCompatibility"].as_str().unwrap_or("").into(),
            driver: v["DriverVersion"].as_str().map(Into::into),
            primary: i == 0,
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn devices() -> Vec<GpuDevice> {
    let output = std::process::Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-json"])
        .output();
    let Ok(output) = output else {
        return Vec::new();
    };
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap_or_default();
    value["SPDisplaysDataType"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .enumerate()
                .map(|(i, v)| GpuDevice {
                    name: v["sppci_model"].as_str().unwrap_or("?").into(),
                    vendor: v["spdisplays_vendor"].as_str().unwrap_or("").into(),
                    driver: None,
                    primary: i == 0,
                })
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn devices() -> Vec<GpuDevice> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    const DB: &str = "\
# comment
10de  NVIDIA Corporation
\t25a0  GA107M [GeForce RTX 3050 Ti Mobile]
\t\t1043 1e12  Some subsystem
8086  Intel Corporation
\t9a49  TigerLake-LP GT2 [Iris Xe Graphics]
\t9a68  TigerLake-H GT1 [UHD Graphics]
8087  Intel Corporation (other)
\t0001  Not a GPU
";

    #[test]
    fn finds_vendor_and_device_names() {
        let (v, d) = pci_names(DB, 0x8086, 0x9a68);
        assert_eq!(v.as_deref(), Some("Intel Corporation"));
        assert_eq!(d.as_deref(), Some("TigerLake-H GT1 [UHD Graphics]"));
        let (v, d) = pci_names(DB, 0x10de, 0x25a0);
        assert_eq!(v.as_deref(), Some("NVIDIA Corporation"));
        assert_eq!(d.as_deref(), Some("GA107M [GeForce RTX 3050 Ti Mobile]"));
    }

    #[test]
    fn stops_at_the_next_vendor_and_handles_unknowns() {
        assert_eq!(
            pci_names(DB, 0x8086, 0x0001),
            (Some("Intel Corporation".into()), None)
        );
        assert_eq!(pci_names(DB, 0x1234, 0x0001), (None, None));
        assert_eq!(vendor_fallback(0x10de), "NVIDIA");
    }

    #[test]
    fn report_does_not_panic_on_this_machine() {
        let r = report();
        assert!(r.devices.iter().filter(|g| g.primary).count() <= 1);
    }
}
