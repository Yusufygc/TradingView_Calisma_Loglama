import sys
import os
import pandas as pd
from datetime import datetime
from PyQt5 import QtWidgets, QtCore, QtGui
import mss
import mss.tools
import keyboard  # Klavye kütüphanesi

# --- AYARLAR ---
EXCEL_FILE = "Trading_Gunlugu_V2.xlsx"
IMAGE_FOLDER = "Trading_Gorselleri"
HOTKEY = "f10"
HOTKEY_TEXT = "Loglamak için: F10"

# Klasör kontrolü
if not os.path.exists(IMAGE_FOLDER):
    os.makedirs(IMAGE_FOLDER)

# Excel kontrolü
if not os.path.exists(EXCEL_FILE):
    df = pd.DataFrame(columns=["Tarih", "Saat", "Hisse/Enstrüman", "Not", "Görsel_Yolu"])
    df.to_excel(EXCEL_FILE, index=False)

# --- Thread Güvenliği İçin Sinyal Sınıfı ---
class HotkeyHandler(QtCore.QObject):
    request_snip = QtCore.pyqtSignal()

# --- Ekran Alıntısı Aracı ---
class Snipper(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        # Pencere ayarları: Çerçevesiz, Her zaman üstte
        self.setWindowFlags(QtCore.Qt.FramelessWindowHint | QtCore.Qt.WindowStaysOnTopHint | QtCore.Qt.Tool)
        
        self.start_point = None
        self.end_point = None
        self.is_snipping = False
        
        # 1. Ekranın o anki görüntüsünü al (Dondurma Efekti İçin)
        self.sct = mss.mss()
        monitor = self.sct.monitors[0] # Tüm monitörleri kapsayan alan
        
        # Pencereyi tüm ekranı kaplayacak şekilde ayarla
        self.setGeometry(monitor['left'], monitor['top'], monitor['width'], monitor['height'])
        
        # Ekran görüntüsünü al ve QPixmap'e çevir
        sct_img = self.sct.grab(monitor)
        # Windows'ta MSS genellikle BGRA döner, bunu QImage ile uyumlu hale getiriyoruz
        self.screenshot = QtGui.QImage(sct_img.raw, sct_img.width, sct_img.height, QtGui.QImage.Format_ARGB32)
        self.screenshot_pixmap = QtGui.QPixmap.fromImage(self.screenshot)

        self.setCursor(QtGui.QCursor(QtCore.Qt.CrossCursor))
        self.show()
        self.activateWindow()
        self.raise_()

    def paintEvent(self, event):
        painter = QtGui.QPainter(self)
        
        # 1. Adım: Tüm ekrana aldığımız ekran görüntüsünü çiz (Zemin)
        painter.drawPixmap(0, 0, self.screenshot_pixmap)
        
        # 2. Adım: Üzerine yarı saydam siyah bir örtü ekle (Loşluk efekti)
        # Bu sayede kullanıcı nerenin seçili olmadığını anlar
        painter.fillRect(self.rect(), QtGui.QColor(0, 0, 0, 100)) # 100 değeri koyuluğu belirler (0-255)
        
        if self.start_point and self.end_point:
            # Seçim karesini belirle
            rect = QtCore.QRect(self.start_point, self.end_point).normalized()
            
            # 3. Adım: Seçilen alanın içini "Aydınlat"
            # Bunu yapmak için orijinal temiz görüntüyü seçilen kare boyutunda tekrar çiziyoruz
            painter.drawPixmap(rect, self.screenshot_pixmap, rect)
            
            # 4. Adım: Yeşil çerçeve çiz
            painter.setPen(QtGui.QPen(QtGui.QColor(0, 255, 0), 2, QtCore.Qt.SolidLine))
            painter.setBrush(QtCore.Qt.NoBrush)
            painter.drawRect(rect)

    def mousePressEvent(self, event):
        self.start_point = event.pos()
        self.is_snipping = True
        self.update() # paintEvent'i tetikler

    def mouseMoveEvent(self, event):
        if self.is_snipping:
            self.end_point = event.pos()
            self.update() # paintEvent'i tetikler (Canlı çizim)

    def mouseReleaseEvent(self, event):
        if self.is_snipping:
            self.end_point = event.pos()
            self.close() # Pencereyi kapat
            self.process_snip()

    def process_snip(self):
        if not self.start_point or not self.end_point: return

        # Koordinatları normalize et (Ters seçimler için)
        rect = QtCore.QRect(self.start_point, self.end_point).normalized()
        
        if rect.width() < 10 or rect.height() < 10: return 

        # Seçilen alanı orijinal pixmap'ten kes
        cropped = self.screenshot_pixmap.copy(rect)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{IMAGE_FOLDER}/Log_{timestamp}.png"
        
        # Görseli kaydet
        cropped.save(filename, "PNG")
        
        # Veri girişini aç
        self.open_input_dialog(filename)

    def open_input_dialog(self, image_path):
        self.dialog = LogEntryDialog(image_path)
        self.dialog.exec_()

# --- Veri Giriş Penceresi ---
class LogEntryDialog(QtWidgets.QDialog):
    def __init__(self, image_path):
        super().__init__()
        self.image_path = image_path
        self.setWindowTitle("Trading Log Ekle")
        # Pencere her zaman üstte olsun
        self.setWindowFlags(QtCore.Qt.WindowStaysOnTopHint | QtCore.Qt.Dialog)
        self.resize(350, 250)
        
        # TradingView Koyu Tema Stili
        self.setStyleSheet("""
            QDialog { background-color: #1e222d; color: #d1d4dc; }
            QLabel { color: #d1d4dc; font-weight: bold; }
            QLineEdit { background-color: #2a2e39; border: 1px solid #363a45; color: white; padding: 5px; border-radius: 4px; }
            QPushButton { background-color: #2962ff; color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; }
            QPushButton:hover { background-color: #1e53e5; }
        """)

        layout = QtWidgets.QVBoxLayout()

        # Görsel Önizleme
        self.image_label = QtWidgets.QLabel("Görsel")
        pixmap = QtGui.QPixmap(image_path)
        if not pixmap.isNull():
            self.image_label.setPixmap(pixmap.scaled(300, 100, QtCore.Qt.KeepAspectRatio))
        self.image_label.setAlignment(QtCore.Qt.AlignCenter)
        layout.addWidget(self.image_label)

        # Hisse Girişi
        self.ticker_input = QtWidgets.QLineEdit()
        self.ticker_input.setPlaceholderText("Hisse (Örn: ASELS)")
        if os.path.exists("last_ticker.txt"):
            try:
                with open("last_ticker.txt", "r") as f:
                    self.ticker_input.setText(f.read())
            except: pass
        layout.addWidget(QtWidgets.QLabel("Hisse / Enstrüman:"))
        layout.addWidget(self.ticker_input)

        # Not Girişi
        self.note_input = QtWidgets.QLineEdit()
        self.note_input.setPlaceholderText("Notunuz...")
        layout.addWidget(QtWidgets.QLabel("Açıklama:"))
        layout.addWidget(self.note_input)
        
        self.note_input.setFocus()

        save_btn = QtWidgets.QPushButton("Kaydet (Enter)")
        save_btn.clicked.connect(self.save_log)
        layout.addWidget(save_btn)

        self.setLayout(layout)
        self.activateWindow()

    def keyPressEvent(self, event):
        if event.key() == QtCore.Qt.Key_Return or event.key() == QtCore.Qt.Key_Enter:
            self.save_log()
        elif event.key() == QtCore.Qt.Key_Escape:
            self.close()

    def save_log(self):
        ticker = self.ticker_input.text().upper()
        note = self.note_input.text()
        
        if not ticker: return 

        try:
            with open("last_ticker.txt", "w") as f:
                f.write(ticker)
        except: pass

        try:
            new_data = {
                "Tarih": [datetime.now().strftime("%Y-%m-%d")],
                "Saat": [datetime.now().strftime("%H:%M:%S")],
                "Hisse/Enstrüman": [ticker],
                "Not": [note],
                "Görsel_Yolu": [self.image_path]
            }
            
            df_new = pd.DataFrame(new_data)
            
            if os.path.exists(EXCEL_FILE):
                try:
                    df_old = pd.read_excel(EXCEL_FILE)
                    df_combined = pd.concat([df_old, df_new], ignore_index=True)
                    df_combined.to_excel(EXCEL_FILE, index=False)
                except Exception as e:
                    QtWidgets.QMessageBox.warning(self, "Hata", "Excel dosyası açık olabilir. Lütfen kapatıp tekrar deneyin.")
                    return
            else:
                df_new.to_excel(EXCEL_FILE, index=False)

            print(f"✅ Kaydedildi: {ticker}")
            self.accept()
            
        except Exception as e:
            print(f"Hata: {e}")
            QtWidgets.QMessageBox.critical(self, "Hata", str(e))

# --- ANA FONKSİYON ---
def main():
    # Windows DPI Ayarları (Bulanıklığı önler)
    if hasattr(QtCore.Qt, 'AA_EnableHighDpiScaling'):
        QtWidgets.QApplication.setAttribute(QtCore.Qt.AA_EnableHighDpiScaling, True)
    if hasattr(QtCore.Qt, 'AA_UseHighDpiPixmaps'):
        QtWidgets.QApplication.setAttribute(QtCore.Qt.AA_UseHighDpiPixmaps, True)

    app = QtWidgets.QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False) 
    
    handler = HotkeyHandler()
    windows = [] # Garbage collection önlemi

    def open_snipper():
        windows.clear()
        snip_window = Snipper()
        windows.append(snip_window)
        snip_window.show()

    handler.request_snip.connect(open_snipper)

    print("🚀 TradingView Snipper Başlatıldı!")
    print(f"👉 Kullanım: {HOTKEY} tuşuna basın.")
    print("❌ Çıkış: Program penceresini kapatın veya terminalden durdurun.")

    def on_hotkey():
        handler.request_snip.emit()

    keyboard.add_hotkey(HOTKEY, on_hotkey)

    sys.exit(app.exec_())

if __name__ == "__main__":
    main()