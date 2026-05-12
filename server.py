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
DB_NAME = os.path.join(BASE_DIR, "stokzeka-database-5.db")

# --- VERİ MODELLERİ ---
class Satis(BaseModel):
    tarih: str
    urun_id: str
    adet: int
    birim_fiyat: float

class StokHareketi(BaseModel):
    tarih: str
    urun_id: str # Burada urun_id yerine hammadde_id gelecek UI'dan
    miktar: int
    islem_tipi: str

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

# --- ENDPOINTLER ---

@app.get("/api/home")
def home():
    return {"mesaj": "StokZeka AI Backend Çalışıyor (Hammadde Bazlı)"}

@app.get("/stok/mevcut")
def get_stok():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Hammadde bazlı stok sorgusu
        query = """
        SELECT 
            h.Hammadde_ID as urun_id, 
            h.Hammadde_Adi as urun_adi, 
            COALESCE(SUM(sh.Miktar), 0) as mevcut_stok, 
            h.Kritik_Stok as kritik_esik,
            t.Tedarikci_Adi,
            ht.Tedarik_Suresi_Gun
        FROM Hammaddeler h
        LEFT JOIN Stok_Hareketleri sh ON h.Hammadde_ID = sh.Hammadde_ID
        LEFT JOIN Hammadde_Tedarik ht ON h.Hammadde_ID = ht.Hammadde_ID
        LEFT JOIN Tedarikciler t ON ht.Tedarikci_ID = t.Tedarikci_ID
        GROUP BY h.Hammadde_ID
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        stok_verisi = []
        for row in rows:
            item = dict(row)
            if item["mevcut_stok"] <= item["kritik_esik"]:
                item["durum"] = "Kritik"
            elif item["mevcut_stok"] <= item["kritik_esik"] * 1.5:
                item["durum"] = "Düşük"
            else:
                item["durum"] = "Yeterli"
            stok_verisi.append(item)
                
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

@app.get("/hammaddeler")
def get_hammaddeler():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT Hammadde_ID as hammadde_id, Hammadde_Adi as hammadde_adi FROM Hammaddeler")
        return {"hammaddeler": [dict(row) for row in cursor.fetchall()]}
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
        
        # 1. Satışı Kaydet
        cursor.execute(
            "INSERT INTO Satislar (Tarih, Urun_ID, Adet, Birim_Fiyat_TL, Toplam_Satis_TL) VALUES (?, ?, ?, ?, ?)",
            (satis.tarih, satis.urun_id, satis.adet, satis.birim_fiyat, toplam_tutar)
        )
        
        # 2. Tarife göre hammadde tüketimini Stok_Hareketleri'ne işle
        cursor.execute("SELECT Hammadde_ID, Miktar FROM Tarifler WHERE Urun_ID = ?", (satis.urun_id,))
        tarif_bileşenleri = cursor.fetchall()
        
        for bilesen in tarif_bileşenleri:
            tuketim_miktari = - (satis.adet * bilesen["Miktar"])
            cursor.execute(
                "INSERT INTO Stok_Hareketleri (Tarih, Hammadde_ID, Miktar, Islem_Tipi) VALUES (?, ?, ?, ?)",
                (satis.tarih, bilesen["Hammadde_ID"], tuketim_miktari, 'Satis_Tuketimi')
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
        # UI'dan gelen urun_id aslında hammadde_id olarak kullanılacak
        miktar = hareket.miktar if hareket.islem_tipi == "Giris" else -hareket.miktar
        cursor.execute(
            "INSERT INTO Stok_Hareketleri (Tarih, Hammadde_ID, Miktar, Islem_Tipi) VALUES (?, ?, ?, ?)",
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
        
        # 1. Trend Analizi
        cursor.execute("""
            SELECT 
                CASE WHEN CAST(strftime('%w', Tarih) AS INT) IN (0, 6) THEN 'HaftaSonu' ELSE 'HaftaIci' END as tip,
                AVG(Adet) as ortalama_satis
            FROM Satislar
            GROUP BY tip
        """)
        trends = {row["tip"]: row["ortalama_satis"] for row in cursor.fetchall()}
        
        hafta_sonu_artis_orani = 1.0
        if "HaftaSonu" in trends and "HaftaIci" in trends and trends["HaftaIci"] > 0:
            hafta_sonu_artis_orani = trends["HaftaSonu"] / trends["HaftaIci"]

        # 2. Kritik Hammadde Analizi
        cursor.execute("""
            SELECT h.Hammadde_Adi, h.Hammadde_ID, COALESCE(SUM(sh.Miktar), 0) as mevcut_stok, h.Kritik_Stok
            FROM Hammaddeler h
            LEFT JOIN Stok_Hareketleri sh ON h.Hammadde_ID = sh.Hammadde_ID
            GROUP BY h.Hammadde_ID
        """)
        hammaddeler = cursor.fetchall()
        
        bugun_gun = datetime.now().weekday()
        yarın_hafta_sonu_mu = bugun_gun in [4, 5, 6]
        
        acil_siparisler = []
        for h in hammaddeler:
            mevcut = h["mevcut_stok"]
            esik = h["Kritik_Stok"]
            
            dinamik_esik = esik
            if yarın_hafta_sonu_mu:
                dinamik_esik = esik * hafta_sonu_artis_orani
            
            if mevcut <= dinamik_esik:
                neden = "Kritik stok seviyesi"
                if yarın_hafta_sonu_mu and hafta_sonu_artis_orani > 1:
                    neden = f"Beklenen hafta sonu yoğunluğu nedeniyle"
                
                acil_siparisler.append({
                    "urun": h["Hammadde_Adi"],
                    "miktar": int(esik * 1.5),
                    "neden": neden
                })
        
        mesaj = "AI Analizi Tamamlandı: "
        if acil_siparisler:
            mesaj += f"{len(acil_siparisler)} hammadde için tedarik planlanmalı."
        else:
            mesaj += "Tüm hammadde stokları güvenli seviyede."

        return {
            "ozet": mesaj,
            "acil_siparisler": acil_siparisler,
            "tahmin_detay": {
                "hafta_sonu_katsayisi": round(hafta_sonu_artis_orani, 2),
                "yarın_riskli_mi": yarın_hafta_sonu_mu
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/ai/malzeme-tuketimi")
def get_malzeme_tuketimi(gunler: int = 30):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Gerçek tarifler ve satışlar üzerinden hammadde tüketimi
        query = """
        SELECT 
            h.Hammadde_Adi, 
            SUM(s.Adet * t.Miktar) as toplam_tuketim
        FROM Satislar s
        JOIN Tarifler t ON s.Urun_ID = t.Urun_ID
        JOIN Hammaddeler h ON t.Hammadde_ID = h.Hammadde_ID
        WHERE s.Tarih >= date('now', ?)
        GROUP BY h.Hammadde_ID
        """
        cursor.execute(query, (f'-{gunler} days',))
        tuketim_rows = cursor.fetchall()
        
        tuketim = {row["Hammadde_Adi"]: row["toplam_tuketim"] for row in tuketim_rows}
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
        
        # Ürün bazlı maliyet ve satış analizi
        # Maliyet = Tarifteki her bir hammadde * Hammadde birim maliyeti
        query = """
        SELECT 
            u.Urun_Adi as urun_adi,
            AVG(s.Birim_Fiyat_TL) as ortalama_satis_fiyat,
            (
                SELECT SUM(t.Miktar * ht.Birim_Maliyet_TL)
                FROM Tarifler t
                JOIN Hammadde_Tedarik ht ON t.Hammadde_ID = ht.Hammadde_ID
                WHERE t.Urun_ID = u.Urun_ID
            ) as birim_maliyet
        FROM Urunler u
        LEFT JOIN Satislar s ON u.Urun_ID = s.Urun_ID
        GROUP BY u.Urun_ID
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        cursor.execute("SELECT SUM(Toplam_Satis_TL) FROM Satislar")
        toplam_ciro = cursor.fetchone()[0] or 0
        
        # Gerçekleşen toplam maliyeti stok hareketlerinden de hesaplayabiliriz
        # Ama burada basitleştirmek için satışlar üzerinden gidiyoruz
        cursor.execute("""
            SELECT SUM(s.Adet * (
                SELECT SUM(t.Miktar * ht.Birim_Maliyet_TL)
                FROM Tarifler t
                JOIN Hammadde_Tedarik ht ON t.Hammadde_ID = ht.Hammadde_ID
                WHERE t.Urun_ID = s.Urun_ID
            )) as toplam_maliyet
            FROM Satislar s
        """)
        toplam_maliyet = cursor.fetchone()[0] or 0
        
        analiz = []
        for row in rows:
            item = dict(row)
            item["ortalama_satis_fiyat"] = item["ortalama_satis_fiyat"] or 0
            item["birim_maliyet"] = item["birim_maliyet"] or 0
            analiz.append(item)
            
        return {
            "analiz": analiz,
            "toplam_ciro": toplam_ciro,
            "toplam_maliyet": toplam_maliyet,
            "net_kar": toplam_ciro - toplam_maliyet
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# Statik dosyaları sunmak
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
