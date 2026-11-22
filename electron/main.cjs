// ACTES CRM - Electron desktop shell. Loads the published app in its own window.
const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

const APP_URL = "https://actes-crm.lovable.app";
const INTERNAL = ["actes-crm.lovable.app", "sunwise-engineer-network.lovable.app", "catalog-whisperer-starligight-shelf.lovable.app"];
const isInternal = (u) => { try { return INTERNAL.includes(new URL(u).hostname); } catch { return false; } };

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId("ACTES.CRM.Desktop");

let win;
function create() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    title: "ACTES CRM", icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: { partition: "persist:actes-crm", contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) { win.loadURL(url); } else { shell.openExternal(url); }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => { if (!isInternal(url)) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on("before-input-event", (e, i) => {
    if (i.type !== "keyDown") return;
    if (i.key === "F5" || (i.control && i.key.toLowerCase() === "r")) { win.webContents.reload(); e.preventDefault(); }
    if (i.key === "F11") { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (i.control && (i.key === "=" || i.key === "+")) win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5);
    if (i.control && i.key === "-") win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5);
    if (i.control && i.key === "0") win.webContents.setZoomLevel(0);
  });
  win.webContents.on("did-fail-load", () => {
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
      '<html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding-top:20vh">' +
      '<h2>تعذّر الاتصال بالإنترنت</h2><p>تحقق من الاتصال ثم اضغط F5</p></body></html>'));
  });
  win.loadURL(APP_URL);
}
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(create);
app.on("window-all-closed", () => app.quit());
