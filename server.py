from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict
import uvicorn
from datetime import datetime
import sqlite3
import os

app = FastAPI()

# CORS Ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mutlak yol kullanarak veritabanı bağlantısı
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "en son database.db")

# --- VERİ MODELLERİ ---
class Satis(BaseModel):
    tarih: str
    urun_id: str
    adet: int
    birim_fiyat: float

class StokHareketi(BaseModel):
    tarih: str
    urun_id: str
    miktar: int
    islem_tipi: str

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

# --- ENDPOINTLER ---

@app.get("/api/home")
def home():
    return {"mesaj": "StokZeka AI Backend Çalışıyor (SQLite Aktif)"}

@app.get("/stok/mevcut")
def get_stok():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = """
        SELECT 
            u.Urun_ID as urun_id, 
            u.Urun_Adi as urun_adi, 
            COALESCE(SUM(sh.Miktar), 0) as mevcut_stok, 
            u.Kritik_Stok as kritik_esik,
            t.Tedarikci_Adi,
            ut.Tedarik_Suresi_Gun
        FROM Urunler u
        LEFT JOIN Stok_Hareketleri sh ON u.Urun_ID = sh.Urun_ID
        LEFT JOIN Urun_Tedarik ut ON u.Urun_ID = ut.Urun_ID
        LEFT JOIN Tedarikciler t ON ut.Tedarikci_ID = t.Tedarikci_ID
        GROUP BY u.Urun_ID
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        stok_verisi = []
        for row in rows:
            urun = dict(row)
            if urun["mevcut_stok"] <= urun["kritik_esik"]:
                urun["durum"] = "Kritik"
            elif urun["mevcut_stok"] <= urun["kritik_esik"] * 1.5:
                urun["durum"] = "Düşük"
            else:
                urun["durum"] = "Yeterli"
            stok_verisi.append(urun)
                
        ozet = {
            "toplam": len(stok_verisi),
            "kritik": len([u for u in stok_verisi if u["durum"] == "Kritik"]),
            "dusuk": len([u for u in stok_verisi if u["durum"] == "Düşük"]),
            "yeterli": len([u for u in stok_verisi if u["durum"] == "Yeterli"])
        }
        return {"urunler": stok_verisi, "ozet": ozet}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/urunler")
def get_urunler():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT Urun_ID as urun_id, Urun_Adi as urun_adi FROM Urunler")
        return {"urunler": [dict(row) for row in cursor.fetchall()]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/satislar/kaydet")
def kaydet_satis(satis: Satis):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        toplam_tutar = satis.adet * satis.birim_fiyat
        cursor.execute(
            "INSERT INTO Satislar (Tarih, Urun_ID, Adet, Birim_Fiyat_TL, Toplam_Satis_TL) VALUES (?, ?, ?, ?, ?)",
            (satis.tarih, satis.urun_id, satis.adet, satis.birim_fiyat, toplam_tutar)
        )
        cursor.execute(
            "INSERT INTO Stok_Hareketleri (Tarih, Urun_ID, Miktar, Islem_Tipi) VALUES (?, ?, ?, ?)",
            (satis.tarih, satis.urun_id, -satis.adet, 'Satis')
        )
        conn.commit()
        return {"durum": "basarili", "toplam_tutar_tl": toplam_tutar}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/stok/giris")
def kaydet_stok(hareket: StokHareketi):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        miktar = hareket.miktar if hareket.islem_tipi == "Giris" else -hareket.miktar
        cursor.execute(
            "INSERT INTO Stok_Hareketleri (Tarih, Urun_ID, Miktar, Islem_Tipi) VALUES (?, ?, ?, ?)",
            (hareket.tarih, hareket.urun_id, miktar, hareket.islem_tipi)
        )
        conn.commit()
        return {"durum": "basarili"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/ai/analiz")
def ai_analiz():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.Urun_Adi, COALESCE(SUM(sh.Miktar), 0) as stok, u.Kritik_Stok
            FROM Urunler u
            LEFT JOIN Stok_Hareketleri sh ON u.Urun_ID = sh.Urun_ID
            GROUP BY u.Urun_ID
            HAVING stok <= u.Kritik_Stok
        """)
        kritikler = cursor.fetchall()
        acil_siparisler = [{"urun": k["Urun_Adi"], "miktar": 50, "neden": "Kritik stok seviyesi"} for k in kritikler]
        
        return {
            "ozet": "AI Analizine göre " + (f"{len(acil_siparisler)} ürün kritik seviyede." if acil_siparisler else "stoklar dengeli."),
            "acil_siparisler": acil_siparisler,
            "aylik_tedarik": [{"malzeme": "Süt", "miktar": 400, "birim": "L"}, {"malzeme": "Kahve Çekirdeği", "miktar": 45, "birim": "kg"}]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/ai/malzeme-tuketimi")
def get_malzeme_tuketimi(gunler: int = 30):
    RECIPES = {
        "P001": {"Çay Yaprağı (g)": 3, "Su (ml)": 200},
        "P002": {"Türk Kahvesi (g)": 7, "Su (ml)": 80},
        "P003": {"Espresso Çekirdeği (g)": 18, "Süt (ml)": 200},
        "P004": {"Espresso Çekirdeği (g)": 18, "Süt (ml)": 180, "Buz (g)": 80},
        "P005": {"Espresso Çekirdeği (g)": 18, "Su (ml)": 180},
    }
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT Urun_ID, SUM(Adet) as toplam_adet FROM Satislar WHERE Tarih >= date('now', ?) GROUP BY Urun_ID", (f'-{gunler} days',))
        satislar = cursor.fetchall()
        
        tuketim = {}
        for s in satislar:
            recipe = RECIPES.get(s["Urun_ID"], {"Hammadde (birim)": 1})
            for hammadde, miktar in recipe.items():
                tuketim[hammadde] = tuketim.get(hammadde, 0) + (s["toplam_adet"] * miktar)
        return {"malzeme_tuketimi": tuketim}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/finans/analiz")
def get_finans_analiz():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = """
        SELECT 
            u.Urun_Adi as urun_adi,
            AVG(s.Birim_Fiyat_TL) as ortalama_satis_fiyat,
            ut.Birim_Maliyet_TL as birim_maliyet
        FROM Urunler u
        LEFT JOIN Satislar s ON u.Urun_ID = s.Urun_ID
        LEFT JOIN Urun_Tedarik ut ON u.Urun_ID = ut.Urun_ID
        GROUP BY u.Urun_ID
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        analiz = []
        for row in rows:
            item = dict(row)
            item["ortalama_satis_fiyat"] = item["ortalama_satis_fiyat"] or 0
            item["birim_maliyet"] = item["birim_maliyet"] or 0
            analiz.append(item)
        return {"analiz": analiz}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# Statik dosyaları sunmak
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
