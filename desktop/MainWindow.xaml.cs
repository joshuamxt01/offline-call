using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace Nexa;

/// <summary>
/// Native Windows shell for Nexa: hosts the web app in WebView2 (Chromium).
/// It reuses the entire web client — calls, chat, everything — and flips the
/// Chromium flag that lets camera/mic work over plain HTTP on the LAN, so it
/// works fully offline on a company Wi‑Fi with no HTTPS/tunnel.
/// </summary>
public partial class MainWindow : Window
{
    private static readonly string ConfigDir =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Nexa");
    private static readonly string ServerFile = Path.Combine(ConfigDir, "server.txt");
    private const string DefaultServer = "https://offline-call.vercel.app";

    private string _server = "";

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        ShowOverlay("Starting the app engine…");
        _server = LoadServer();
        if (string.IsNullOrWhiteSpace(_server))
        {
            _server = PromptForServer(DefaultServer);
            if (string.IsNullOrWhiteSpace(_server)) { Close(); return; }
            SaveServer(_server);
        }
        ServerLabel.Text = _server;
        await InitWebViewAsync();
    }

    private async System.Threading.Tasks.Task InitWebViewAsync()
    {
        string origin;
        try { origin = new Uri(_server).GetLeftPart(UriPartial.Authority); }
        catch { MessageBox.Show("That server address isn't a valid URL."); ChangeServer_Click(this, new RoutedEventArgs()); return; }

        // Treat the LAN origin as secure so getUserMedia (camera/mic) works over
        // http://, and let media autoplay without a click.
        var args =
            $"--unsafely-treat-insecure-origin-as-secure={origin} " +
            "--autoplay-policy=no-user-gesture-required " +
            "--disable-features=AutofillServerCommunication";

        var options = new CoreWebView2EnvironmentOptions(additionalBrowserArguments: args);
        var userData = Path.Combine(ConfigDir, "WebView2");
        Directory.CreateDirectory(userData);

        // A white surface avoids the all-black look if a frame is slow to paint.
        Web.DefaultBackgroundColor = System.Drawing.Color.White;

        try
        {
            var env = await CoreWebView2Environment.CreateAsync(null, userData, options);
            await Web.EnsureCoreWebView2Async(env);
        }
        catch (Exception ex)
        {
            ShowError(
                "Couldn't start the built-in browser engine (WebView2).\n" +
                "Install the free 'WebView2 Runtime' from Microsoft, then reopen Nexa.\n\n" + ex.Message);
            return;
        }

        // Auto-grant camera + microphone for the app.
        Web.CoreWebView2.PermissionRequested += (_, args2) =>
        {
            if (args2.PermissionKind == CoreWebView2PermissionKind.Camera ||
                args2.PermissionKind == CoreWebView2PermissionKind.Microphone)
            {
                args2.State = CoreWebView2PermissionState.Allow;
            }
        };
        Web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        Web.CoreWebView2.Settings.IsStatusBarEnabled = false;

        // Hide the overlay only once the page actually loads; show a clear error otherwise.
        Web.CoreWebView2.NavigationCompleted += (_, ev) =>
        {
            if (ev.IsSuccess) HideOverlay();
            else ShowError(
                $"Couldn't reach {_server}.\n\n" +
                "• Make sure the server PC has run startup.bat and the web app is on.\n" +
                "• Check you typed the right address (e.g. http://192.168.1.50:3000).\n" +
                "• This PC must be on the same Wi‑Fi/network as the server.");
        };
        Web.CoreWebView2.ProcessFailed += (_, __) =>
            ShowError("The app engine stopped unexpectedly. Click Retry.");

        ShowOverlay($"Connecting to {_server}…");
        Web.CoreWebView2.Navigate(_server);
    }

    private void Reload_Click(object sender, RoutedEventArgs e)
    {
        ShowOverlay($"Connecting to {_server}…");
        Web.CoreWebView2?.Reload();
    }

    // ---- overlay helpers ----
    private void ShowOverlay(string message)
    {
        LoadingText.Text = message;
        LoadingBar.Visibility = Visibility.Visible;
        ErrorActions.Visibility = Visibility.Collapsed;
        LoadingOverlay.Visibility = Visibility.Visible;
    }

    private void ShowError(string message)
    {
        LoadingText.Text = message;
        LoadingBar.Visibility = Visibility.Collapsed;
        ErrorActions.Visibility = Visibility.Visible;
        LoadingOverlay.Visibility = Visibility.Visible;
    }

    private void HideOverlay() => LoadingOverlay.Visibility = Visibility.Collapsed;

    private void ChangeServer_Click(object sender, RoutedEventArgs e)
    {
        var next = PromptForServer(_server);
        if (string.IsNullOrWhiteSpace(next) || next == _server) return;
        SaveServer(next);
        // The secure-origin flag is fixed at engine startup, so restart to apply.
        Process.Start(new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = true });
        Application.Current.Shutdown();
    }

    // ---- config ----
    private static string LoadServer()
    {
        try { return File.Exists(ServerFile) ? File.ReadAllText(ServerFile).Trim() : ""; }
        catch { return ""; }
    }

    private static void SaveServer(string url)
    {
        try { Directory.CreateDirectory(ConfigDir); File.WriteAllText(ServerFile, url.Trim().TrimEnd('/')); }
        catch { /* ignore */ }
    }

    private static string PromptForServer(string current)
    {
        return Microsoft.VisualBasic.Interaction.InputBox(
            "Enter your Nexa server address (the PC running startup.bat, on the same Wi‑Fi):\n\n" +
            "Example:  http://192.168.1.50:3000",
            "Nexa server",
            current).Trim();
    }
}
