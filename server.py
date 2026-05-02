from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
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

DB_NAME = "en son database.db"

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
        # Durum hesaplama
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
    conn.close()
    return {"urunler": stok_verisi, "ozet": ozet}

@app.get("/urunler")
def get_urunler():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT Urun_ID as urun_id, Urun_Adi as urun_adi FROM Urunler")
    urunler = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"urunler": urunler}

@app.post("/satislar/kaydet")
def kaydet_satis(satis: Satis):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
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
    cursor = conn.cursor()
    try:
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
    return {
        "ozet": "Satış verileri Americano ve Soğuk Kahve talebinde artış gösteriyor. Bazı ürünlerin stokları kritik seviyenin altında.",
        "acil_siparisler": [
            {"urun": "Americano", "miktar": 50, "neden": "Kritik stok seviyesi"},
            {"urun": "Espresso", "miktar": 100, "neden": "Sıfır stok tespiti"}
        ],
        "aylik_tedarik": [
            {"malzeme": "Süt", "miktar": 400, "birim": "L"},
            {"malzeme": "Kahve Çekirdeği", "miktar": 45, "birim": "kg"}
        ]
    }

@app.get("/finans/analiz")
def get_finans_analiz():
    conn = get_db_connection()
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
    
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        analiz = []
        for row in rows:
            item = dict(row)
            if item["ortalama_satis_fiyat"] is None:
                item["ortalama_satis_fiyat"] = 0
            if item["birim_maliyet"] is None:
                item["birim_maliyet"] = 0
            analiz.append(item)
        return {"analiz": analiz}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# Statik dosyaları sunmak için (Render kurulumu için gerekli)
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
