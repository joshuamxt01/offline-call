# Nexa — Windows desktop app

A native Windows `.exe` that runs the Nexa web client inside **WebView2** (Windows'
built-in Chromium engine). It reuses the entire web app — voice/video calls, chat,
everything — so there's no separate client to maintain.

**Why WebView2 instead of a from-scratch C# WebRTC app:** the web client already does
WebRTC perfectly. Wrapping it in a native shell gives the desktop the same features for
a fraction of the code, and lets us flip one Chromium flag so **camera/mic work over
plain `http://` on the LAN** — meaning it works fully offline on a company Wi‑Fi with no
HTTPS or tunnel.

## Build it (no Visual Studio needed)
```
build.bat
```
First run downloads a local .NET 8 SDK (~200 MB, into `.dotnet\`) and the WebView2 package,
then produces a single self-contained file:
```
publish\Nexa.exe
```
That `.exe` needs no .NET install to run — just Windows 10/11 with the **WebView2 Runtime**
(already present on virtually all Win10/11 via Edge).

## Use it
1. On the server PC: run `startup.bat` (backend) and the web app (`http://<PC-IP>:3000`).
2. On any Windows PC on the **same Wi‑Fi**: run `Nexa.exe`.
3. It asks for the **server address** once (e.g. `http://192.168.1.50:3000`) — the PC running
   the server. Change it later with the **"Change server"** button.
4. Log in and call — camera/mic are auto-granted; media stays peer-to-peer on the LAN.

> Combined with the admin **Access** tab (approved-network lock), you get the on-prem model:
> install the server at the company, approve the office subnet, hand out this `.exe`, and it
> only works for machines on that Wi‑Fi.

## Files
- `Nexa.csproj` — WPF, .NET 8, WebView2 + VisualBasic (for the input box)
- `MainWindow.xaml(.cs)` — the WebView2 host, server config, camera/mic permission, LAN-secure flag
- `build.bat` — self-provisioning build
