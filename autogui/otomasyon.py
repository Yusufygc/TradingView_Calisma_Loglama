import pyautogui
import keyboard
import pandas as pd
import time
import os
import tkinter as tk
from tkinter import simpledialog
from datetime import datetime

# --- Ayarlar ---
DOSYA_ADI = "Trading_Gunlugu.xlsx"
KISAYOL_TUSU = "F9"  # Loglamak için basılacak tuş
KAYIT_KLASORU = "Screenshots"  # Ekran görüntülerinin kaydedileceği klasör

# Klasör yoksa oluştur
if not os.path.exists(KAYIT_KLASORU):
    os.makedirs(KAYIT_KLASORU)

def excel_olustur_veya_yukle():
    """Excel dosyası yoksa başlıklarla oluşturur, varsa yükler."""
    if not os.path.exists(DOSYA_ADI):
        df = pd.DataFrame(columns=["Tarih", "Saat", "Hisse", "Fiyat", "Not", "Ekran_Goruntusu"])
        df.to_excel(DOSYA_ADI, index=False)
        print(f"{DOSYA_ADI} oluşturuldu.")
    else:
        print(f"{DOSYA_ADI} mevcut, veri eklenecek.")

def veri_giris_penceresi():
    """Kullanıcıdan veri almak için küçük bir GUI açar."""
    ROOT = tk.Tk()
    ROOT.withdraw() # Ana pencereyi gizle
    # Pencerenin her zaman üstte kalmasını sağla
    ROOT.attributes('-topmost', True) 
    
    # Kullanıcıdan input al
    hisse = simpledialog.askstring(title="Log Girişi", prompt="Hisse Adı (Örn: ASELS):")
    if not hisse: return None # İptal edilirse çık
    
    fiyat = simpledialog.askstring(title="Log Girişi", prompt="Fiyat Seviyesi:")
    not_text = simpledialog.askstring(title="Log Girişi", prompt="Notunuz/İşlem:")
    
    ROOT.destroy()
    return hisse.upper(), fiyat, not_text

def log_al():
    """Ekran görüntüsü alır ve verileri kaydeder."""
    try:
        print("\nLoglama başlatılıyor...")
        
        # 1. Ekran Görüntüsü Al (TradingView o an açık varsayılır)
        zaman_damgasi = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_name = f"{KAYIT_KLASORU}/Log_{zaman_damgasi}.png"
        screenshot = pyautogui.screenshot()
        screenshot.save(screenshot_name)
        
        # 2. Kullanıcıdan Veri Al
        user_input = veri_giris_penceresi()
        if not user_input:
            print("İşlem iptal edildi.")
            return

        hisse, fiyat, not_text = user_input
        
        # 3. Verileri Hazırla
        tarih = datetime.now().strftime("%Y-%m-%d")
        saat = datetime.now().strftime("%H:%M:%S")
        
        yeni_veri = {
            "Tarih": tarih,
            "Saat": saat,
            "Hisse": hisse,
            "Fiyat": fiyat,
            "Not": not_text,
            "Ekran_Goruntusu": screenshot_name
        }
        
        # 4. Excel'e Kaydet
        # Mevcut dosyayı oku
        df_mevcut = pd.read_excel(DOSYA_ADI)
        # Yeni veriyi DataFrame'e çevir ve birleştir (concat kullanarak)
        df_yeni = pd.DataFrame([yeni_veri])
        df_sonuc = pd.concat([df_mevcut, df_yeni], ignore_index=True)
        
        df_sonuc.to_excel(DOSYA_ADI, index=False)
        
        print(f"✅ KAYIT BAŞARILI: {hisse} - {fiyat}")
        
        # Sesli uyarı (Opsiyonel - Windows için)
        # import winsound
        # winsound.Beep(1000, 200)

    except Exception as e:
        print(f"❌ HATA OLUŞTU: {e}")

def main():
    excel_olustur_veya_yukle()
    print(f"Program çalışıyor... TradingView açıkken '{KISAYOL_TUSU}' tuşuna basın.")
    print("Çıkmak için 'ESC' tuşuna basın.")
    
    # Hotkey dinleyici
    keyboard.add_hotkey(KISAYOL_TUSU, log_al)
    
    # Programın kapanmaması için döngü
    keyboard.wait('esc')

if __name__ == "__main__":
    main()