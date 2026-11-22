// ACTES CRM - Windows launcher.
// Opens the published app in its own browser window (no address bar) using the
// Edge or Chrome that is already installed on the machine.
// Build: see desktop/build.sh (zig cc -target x86_64-windows-gnu)

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shlobj.h>

#define APP_URL_W L"https://actes-crm.lovable.app"
#define APP_ID_W  L"ACTES.CRM.Desktop"

static int file_exists(const wchar_t *path) {
  DWORD attr = GetFileAttributesW(path);
  return attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY);
}

// Returns the first installed browser, or NULL.
static wchar_t *find_browser(void) {
  static const wchar_t *names[] = {
    L"Microsoft\\Edge\\Application\\msedge.exe",
    L"Google\\Chrome\\Application\\chrome.exe",
  };
  static const wchar_t *roots[] = {
    L"LOCALAPPDATA", L"PROGRAMFILES", L"PROGRAMFILES(X86)", L"PROGRAMW6432",
  };
  static wchar_t buf[MAX_PATH * 2];

  for (size_t r = 0; r < sizeof(roots) / sizeof(roots[0]); r++) {
    wchar_t base[MAX_PATH];
    DWORD n = GetEnvironmentVariableW(roots[r], base, MAX_PATH);
    if (n == 0 || n >= MAX_PATH) continue;
    for (size_t i = 0; i < sizeof(names) / sizeof(names[0]); i++) {
      wsprintfW(buf, L"%s\\%s", base, names[i]);
      if (file_exists(buf)) return buf;
    }
  }
  return NULL;
}

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE hPrev, LPWSTR lpCmd, int nShow) {
  (void)hInst; (void)hPrev; (void)lpCmd; (void)nShow;

  wchar_t profile[MAX_PATH];
  if (!SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, profile))) {
    MessageBoxW(NULL, L"تعذّر فتح مجلد المستخدم. جرّب فتح التطبيق من المتصفح.", L"ACTES CRM", MB_OK);
    return 1;
  }

  wchar_t *browser = find_browser();
  if (!browser) {
    MessageBoxW(NULL,
      L"لم يتم العثور على متصفح Edge أو Chrome.\n\n"
      L"ثبّت أحداهما ثم أعد التشغيل، أو افتح الرابط:\n" APP_URL_W,
      L"ACTES CRM", MB_OK | MB_ICONINFORMATION);
    return 1;
  }

  // Own taskbar identity, so the window is grouped as ACTES and not as the browser.
  SetCurrentProcessExplicitAppUserModelID(APP_ID_W);

  STARTUPINFOW si = {0};
  si.cb = sizeof(si);
  PROCESS_INFORMATION pi = {0};

  // --app = window without tabs or address bar.
  // --user-data-dir keeps a dedicated profile so the window is never merged
  // into an ordinary browser window, and the login/session stays inside ACTES.
  wchar_t cmdline[MAX_PATH * 4];
  wsprintfW(cmdline,
    L"\"%s\" --app=" APP_URL_W L" --user-data-dir=\"%s\\ACTES-CRM\" "
    L"--class=ACTES-CRM --no-first-run --no-default-browser-check",
    browser, profile);

  if (!CreateProcessW(NULL, cmdline, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
    MessageBoxW(NULL, L"تعذّر تشغيل المتصفح.", L"ACTES CRM", MB_OK | MB_ICONERROR);
    return 1;
  }

  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);
  return 0;
}
