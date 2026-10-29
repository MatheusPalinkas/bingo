const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

// Em dev, carregamos a URL do servidor do Angular; em produção, o index.html buildado.
const isDev = process.env['ELECTRON_IS_DEV'] === '1';
const DEV_SERVER_URL = process.env['ELECTRON_DEV_URL'] || 'http://localhost:4200';

// Caminho do index.html gerado pelo builder @angular/build:application.
const INDEX_HTML = path.join(__dirname, '..', 'dist', 'app-bingo', 'browser', 'index.html');
const PRELOAD = path.join(__dirname, 'preload.js');
const ICON = path.join(__dirname, '..', 'build', 'icon.ico');

let mainWindow = null;
let panelWindow = null;

/** Carrega a app na janela, opcionalmente num modo (ex.: painel destacado). */
function loadApp(win, mode) {
  if (isDev) {
    const url = mode ? `${DEV_SERVER_URL}/?mode=${mode}` : DEV_SERVER_URL;
    win.loadURL(url);
  } else {
    win.loadFile(INDEX_HTML, mode ? { query: { mode } } : undefined);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: ICON,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadApp(mainWindow);
  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => (mainWindow = null));
}

/** Abre (ou foca) a janela secundária com o painel destacado. */
function openPanelWindow() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.focus();
    return;
  }

  panelWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    show: false,
    autoHideMenuBar: true,
    title: 'Painel BINGO',
    icon: ICON,
    parent: mainWindow ?? undefined,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadApp(panelWindow, 'panel');
  panelWindow.once('ready-to-show', () => panelWindow?.show());

  panelWindow.on('closed', () => {
    panelWindow = null;
    // Avisa a janela principal que o painel foi fechado.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('panel:closed');
    }
  });
}

function closePanelWindow() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.close();
  }
}

ipcMain.handle('panel:open', () => {
  openPanelWindow();
});

ipcMain.handle('panel:close', () => {
  closePanelWindow();
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
